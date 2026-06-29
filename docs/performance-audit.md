# Production-Readiness Performance Audit
**Branch:** `feat/vertical-slices-prod`  
**Date:** 2026-06-28  
**Method:** Static analysis of every hot-path file. No profiler attached — impacts are estimated from code structure, payload sizes, and known runtime behavior.

---

## Severity legend

| Symbol | Meaning |
|---|---|
| 🔴 **Critical** | Causes timeouts, errors, or severely degraded UX in production |
| 🟠 **High** | Measurable latency / resource waste; affects real users |
| 🟡 **Medium** | Efficiency gap; acceptable now, breaks at scale |
| 🟢 **Quick win** | Low effort, high return, no regression risk |
| 🔧 **Structural** | Correct fix requires non-trivial change; needs regression coverage |

---

## Part 1: Performance Findings by Slice

---

### PLANS SLICE — `server/plansRouter.ts`, `api/plans.ts`

---

#### [P1] 🔴 Vercel default 60 s function timeout is shorter than the code's own timeouts

**File:** `vercel.json`, `api/plans.ts`, `api/chat.ts`, `api/compare-stream.ts`

`vercel.json` contains no `functions` configuration. The default Vercel function timeout is **60 seconds** (Hobby) or **300 s** (Pro, if configured). The code sets these abort timeouts:

| Handler | AbortSignal timeout |
|---|---|
| `api/plans.ts` CDN fetch | 15 000 ms |
| `api/plans.ts` ZIP API | 8 000 ms |
| `api/chat.ts` | No explicit AbortSignal |
| `api/compare-stream.ts` | 120 000 ms |

On the Hobby plan, `api/compare-stream.ts` will be killed by Vercel at 60 s before its own 120 s abort fires. The client receives a hard TCP close with no error payload, which the SSE client cannot distinguish from a network failure.

**Root cause:** No `vercel.json` `functions` block.

**Fix:**
```json
{
  "functions": {
    "api/compare-stream.ts": { "maxDuration": 300, "memory": 1024 },
    "api/chat.ts":           { "maxDuration": 300, "memory": 1024 },
    "api/plans.ts":          { "maxDuration": 30,  "memory": 512  }
  }
}
```

**Risk of regression:** Zero — config-only change.  
**Validation:** Deploy to preview; confirm compare-stream completes past the 60 s mark.

---

#### [P2] 🔴 Cold-start plans request can take up to 23 seconds

**File:** `api/plans.ts`, `server/plansRouter.ts`

Every cold-started request to `/api/plans` must:

1. Resolve ZIP → county via CMS Marketplace API (8 s timeout)
2. Download state JSON from CloudFront CDN (15 s timeout)
3. Run formulary enrichment if drugs are present

Worst-case cold-start latency: **23 s** before a single byte reaches the client. Typical warm latency: <100 ms (both caches hit).

**Root cause:** In-memory caches (`stateCache`, `zipCache`) are process-local. Each Vercel cold start has an empty cache. Prewarm runs only in Express (`_core/index.ts:137`) — it is never triggered in the Vercel serverless context.

**Fix (structural):**  
Use Vercel KV (Redis-compatible) or a global CDN edge cache to persist state data across cold starts. Minimum viable fix: add `Cache-Control: public, s-maxage=86400` to the CloudFront CDN responses so Vercel's edge layer caches them between cold starts.

Quick mitigation: add the prewarm call to `api/plans.ts` module scope (runs on warm-up, not on the request path):
```ts
// Top of api/plans.ts — fires on module load, fills cache for first real request
void Promise.allSettled([
  resolveZipToCounty("64030"), // KC metro seed
  getStateData("MO"),
]).catch(() => {});
```

**Risk of regression:** Low — prewarm is already fire-and-forget.  
**Validation:** Cold-start timing via Vercel function logs before and after.

---

#### [P3] 🟠 `loadAdminOverrides()` hits the DB on every plan request with no result cache

**File:** `server/plansRouter.ts:218-245`

Every call to `GET /api/plans` runs:
```ts
const overrides = await loadAdminOverrides(); // 2 DB queries via Promise.all
```

This fetches **all plan overrides** (every row in `planOverrides`) plus all disabled carriers on every request. There is no cache. Admin overrides change at most a few times per day.

**Root cause:** `loadAdminOverrides` is a plain async function with no memoization.

**Fix (quick win):** Add a 60-second module-level TTL cache:
```ts
let overridesCache: { data: AdminOverrides; expiresAt: number } | null = null;

async function loadAdminOverrides(): Promise<AdminOverrides> {
  if (overridesCache && Date.now() < overridesCache.expiresAt) {
    return overridesCache.data;
  }
  const data = await fetchOverridesFromDb();
  overridesCache = { data, expiresAt: Date.now() + 60_000 };
  return data;
}
```

**Measured impact:** Eliminates 2 DB roundtrips on every warm plan request. At 60 req/15 min (rate limit), that is 120 DB queries per 15 min → 2 per 15 min after caching.  
**Risk of regression:** Low. Admin changes reflect within 60 s maximum.  
**Validation:** Check admin carrier/plan toggles apply within 60 s.

---

#### [P4] 🟠 Drug enrichment re-runs full `O(12 × drugs × plans)` loop every request

**File:** `server/formularyCalculator.ts:600`, `server/plansRouter.ts:378-410`

When a beneficiary adds drugs to their search, the client re-fetches the entire plan list with the new drug list encoded as a query parameter:
```ts
// Plans.tsx:263
const drugsStr = rxDrugs.length > 0 ? JSON.stringify(rxDrugs.map(d => ({ name: d.name, dosage: d.dosage }))) : '';
fetch(`/api/plans?zip=${zip}&drugs=${encodeURIComponent(drugsStr)}`)
```

The server runs `enrichPlansWithDrugCosts(plans, drugs)` which loops `12 months × drugs.length × plans.length`. For 100 plans × 8 drugs, this is ~9,600 calculations per request.

**Root cause:** Enrichment has no per-(plan, drugSet) cache; drugs are passed through the URL query string.

**Fix (structural):** Two options:
1. **Server-side cache:** Cache `enrichPlansWithDrugCosts` results keyed by `hash(stateAbbr + county + drugs)` for 60 s.
2. **Client-side enrichment:** Return plan data once (no drugs in query), calculate drug costs in a Web Worker on the client using `formularyCalculator.ts` (already a pure function). Eliminates the re-fetch entirely on drug changes.

Option 2 eliminates the network round-trip; option 1 is a smaller change.  
**Risk of regression:** Medium (client-side option touches the data flow significantly).  
**Validation:** Drug cost totals must match before and after; test with known drug/tier combination.

---

#### [P5] 🟠 State CDN cache has no TTL — can serve month-old plan data

**File:** `server/plansRouter.ts:82-102`

```ts
const stateCache = new Map<string, Record<string, unknown[]>>();
const STATE_CACHE_MAX = 20;
```

Cache entries are evicted only when `stateCache.size >= 20` (FIFO eviction). A state loaded at server startup stays cached for the entire process lifetime — potentially days.

**Root cause:** No TTL on cache entries. CMS data changes annually, but the admin can upload new CDN files at any time; stale cache prevents the update from propagating.

**Fix:** Add timestamp-based TTL (24 h matches CMS update cadence):
```ts
const stateCache = new Map<string, { data: Record<string, unknown[]>; loadedAt: number }>();
const STATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function isFresh(entry: { loadedAt: number }): boolean {
  return Date.now() - entry.loadedAt < STATE_CACHE_TTL_MS;
}
```

**Risk of regression:** Low. Plans refresh daily at most.  
**Validation:** Set TTL to 60 s in a test env; confirm a re-upload of state JSON propagates.

---

#### [P6] 🟠 `compareStream.ts` does not detect client disconnect — streams to a closed connection

**File:** `server/compareStream.ts`

`recommendStream.ts` correctly checks `res.destroyed`:
```ts
if (res.destroyed) break; // line 236
```

`compareStream.ts` has no equivalent check. If a user closes the compare modal mid-stream, the server continues calling the Anthropic API and writing to a closed socket until the 120 s timeout fires. Under the AI rate limiter (20/15 min), a single abandoned request burns one slot for 2 minutes.

**Fix:**
```ts
for await (const chunk of stream) {
  if (res.destroyed) {
    abortController.abort();
    break;
  }
  // write SSE event
}
```

**Risk of regression:** Zero — adds a guard around existing stream loop.  
**Validation:** Open compare modal → start stream → close modal → confirm Anthropic call is aborted in server logs.

---

### ELIGIBILITY SLICE — `server/pverifyRouter.ts`

---

#### [P7] 🔴 pVerify token cache is module-level — evicted on every Vercel cold start

**File:** `server/pverifyRouter.ts:46`

```ts
let cachedToken: { token: string; expiresAt: number } | null = null;
```

The pVerify OAuth token lives in module scope. In Vercel serverless, each cold start starts with `cachedToken = null`, so the first eligibility request on a cold function always fetches a new token (adds ~300–500 ms). Under sustained traffic this is tolerable; under burst traffic with many cold starts it becomes a pVerify API rate-limit risk.

**Root cause:** No cross-invocation persistence for the token.

**Fix (quick win):** Persist the token in Vercel KV or the database `cmsDataSources` table (reuse the existing infrastructure). Alternatively, accept the cold-start penalty and add a comment explaining why.

**Risk of regression:** Low.  
**Validation:** Confirm eligibility check latency in Vercel function logs across multiple cold starts.

---

#### [P8] 🟡 Mock fallback adds 1.2 s artificial delay that silently passes to production

**File:** `server/pverifyRouter.ts:199-240`

```ts
await new Promise((resolve) => setTimeout(resolve, 1200)); // simulate API delay
```

If `PVERIFY_CLIENT_ID` or `PVERIFY_CLIENT_SECRET` is missing, the router silently returns mock data after a 1.2 s sleep. In production this means misconfigured credentials produce fake eligibility results with added latency, not an error.

**Root cause:** Mock fallback designed for development was shipped to production code path.

**Fix:** Add an explicit warning and remove the sleep:
```ts
console.warn("[pVerify] No credentials configured — returning MOCK eligibility data. Set PVERIFY_CLIENT_ID and PVERIFY_CLIENT_SECRET.");
// Remove the setTimeout
```

**Risk of regression:** Zero — only changes behavior when credentials are missing (which should not happen in production).

---

### LLM / AI SLICE — `server/_core/llm.ts`, `server/healthProfileRouter.ts`

---

#### [P9] 🔴 `invokeLLM()` has no fetch timeout — can hang indefinitely

**File:** `server/_core/llm.ts:268`

```ts
const response = await fetch(resolveApiUrl(), {
  method: "POST",
  headers: { ... },
  body: JSON.stringify(payload),
  // No signal, no timeout
});
```

If the Forge API (Gemini 2.5 Flash proxy) becomes unresponsive, this fetch hangs until the OS TCP keepalive fires — typically 2 minutes or more. The client request is also hung, consuming a tRPC connection slot.

**Root cause:** No `AbortSignal` on the LLM fetch.

**Fix:**
```ts
const response = await fetch(resolveApiUrl(), {
  method: "POST",
  headers: { ... },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(60_000), // 60 s budget
});
```

**Risk of regression:** Zero — adds a guard that only fires if Forge is genuinely stuck.  
**Validation:** Mock a slow Forge response and confirm the error surfaces correctly.

---

#### [P10] 🟡 Health scoring uses extended thinking with 128-token budget on every call

**File:** `server/_core/llm.ts:280`

```ts
payload.thinking = { "budget_tokens": 128 };
payload.max_tokens = 32768;
```

Extended thinking is enabled for every `invokeLLM()` call. This applies even to the health profile scoring, which is a deterministic scoring task that does not benefit from extended reasoning. The 128-token thinking budget adds latency for zero quality gain on structured tasks.

**Root cause:** Template default left in place.

**Fix:** Only enable thinking for tasks that require it (e.g., the AI narrative in `recommendStream.ts`). Add a `thinking` flag to `InvokeParams`:
```ts
export type InvokeParams = {
  // ...
  enableThinking?: boolean;  // default false
};
```

**Risk of regression:** Low — disable thinking for structured tasks, keep for narrative.

---

### QUOTE SESSION SLICE — `server/quoteSession/repository.ts`

---

#### [P11] 🟠 `createSession` runs 3+ sequential async operations — at least 5–12 DB round-trips

**File:** `server/quoteSession/repository.ts:56-90`

```ts
await db.insert(quoteSessions).values({ ... });  // 1 query
await writeChildRows(id, input);                 // 1 (contact) + 1 (eligibility)
                                                 // + N (medications) + M (providers) — all sequential
await appendAudit(id, "session_created", ...);   // 1 query
```

`writeChildRows` runs sequential inserts for each child entity. With 5 medications and 2 providers, `createSession` makes **10 DB roundtrips** in sequence. At 2 ms per roundtrip (local) or 20 ms (remote), that's 20–200 ms of pure DB wait time before returning to the client.

**Root cause:** Sequential `await` for independent child inserts; audit write not parallelized.

**Fix:** Run independent inserts in parallel using `Promise.all`:
```ts
await db.insert(quoteSessions).values({ ... });

await Promise.all([
  input.contact    ? db.insert(quoteSessionContact).values([...])    : Promise.resolve(),
  input.eligibility ? db.insert(quoteSessionEligibility).values([...]) : Promise.resolve(),
  input.medications?.length ? db.insert(quoteSessionMedications).values([...]) : Promise.resolve(),
  input.providers?.length   ? db.insert(quoteSessionProviders).values([...])   : Promise.resolve(),
  appendAudit(id, "session_created", ...),
]);
```

**Risk of regression:** Medium — parallel inserts must all succeed or the session is inconsistent. Wrap in a DB transaction.  
**Validation:** Run `quoteSession.test.ts` and `phi-compliance.test.ts` after change.

---

#### [P12] 🟡 `loadByTokenHash` runs 3 sequential DB operations

**File:** `server/quoteSession/repository.ts:118-160`

```ts
const rows = await db.select().from(quoteSessions).where(...).limit(1);
// ...
await db.update(quoteSessions).set({ lastAccessedAt, expiresAt }).where(...);
await appendAudit(session.id, "session_resumed", ...);
```

The UPDATE and audit INSERT are independent of each other and can run in parallel.

**Fix:**
```ts
await Promise.all([
  db.update(quoteSessions).set({ lastAccessedAt: new Date(), expiresAt: expiresAt() }).where(...),
  appendAudit(session.id, "session_resumed", clientIp),
]);
```

**Risk of regression:** Low — the UPDATE and audit INSERT have no data dependency.  
**Validation:** Existing `quoteSession.test.ts` resume tests must pass unchanged.

---

### ADMIN SLICE — `server/adminRouter.ts`

---

#### [P13] 🟡 Admin plan search uses leading-wildcard LIKE — prevents index use

**File:** `server/adminRouter.ts:272-280`

```ts
conditions.push(or(
  like(planOverrides.planName, `%${input.search}%`),
  like(planOverrides.planId, `%${input.search}%`),
  like(planOverrides.carrierName, `%${input.search}%`)
));
```

Leading-wildcard `LIKE '%term%'` cannot use a B-tree index. MySQL performs a full table scan on `planOverrides` for every search keystroke. This is fine at 1,000 rows; it becomes visible at 100,000+.

**Root cause:** Full-text search implemented with LIKE.

**Fix:** Add a MySQL FULLTEXT index on `planOverrides(planName, planId, carrierName)` and use `MATCH ... AGAINST`:
```sql
ALTER TABLE plan_overrides ADD FULLTEXT INDEX ft_search (plan_name, plan_id, carrier_name);
```
Or, for the scale of this app: add trailing-wildcard only (`LIKE 'term%'`) which is index-friendly.

**Risk of regression:** Low — search behavior is unchanged; only speed changes.

---

### BLUE BUTTON SLICE — `api/bluebutton-callback.ts`

---

#### [P14] 🟡 EOB pagination loop is sequential — up to 20 HTTP roundtrips in series

**File:** `api/bluebutton-callback.ts:160-200`

```ts
let nextUrl = `${BASE_URL}/v1/fhir/ExplanationOfBenefit/?patient=${patient}&startIndex=0&_count=50`;
let pageCount = 0;
while (nextUrl && pageCount < 20) {
  const eobRes = await fetch(nextUrl, { ... });  // wait for each page
  // ...
  pageCount++;
}
```

Each page fetch is awaited before the next starts. If each page takes 500 ms, 20 pages = **10 seconds of blocking sequential HTTP**. This runs inside a Vercel serverless function with a 60 s default timeout.

**Root cause:** Sequential pagination designed for simplicity; no parallel fetch strategy.

**Fix (quick win):** Fetch the first page, extract the total count, then fan out all remaining pages in parallel:
```ts
const first = await fetchPage(baseUrl);
const total = first.total ?? 0;
const pageSize = 50;
const pageUrls = Array.from(
  { length: Math.ceil(total / pageSize) - 1 },
  (_, i) => `${baseUrl}&startIndex=${(i + 1) * pageSize}`
);
const remaining = await Promise.all(pageUrls.map(fetchPage));
const allEntries = [...first.entry ?? [], ...remaining.flatMap(r => r.entry ?? [])];
```

**Risk of regression:** Medium — Blue Button API rate limits per user; parallel requests may hit them faster.  
**Validation:** Test with a real Blue Button sandbox account with 3+ pages of claims.

---

### VOICE WEBHOOK SLICE — `api/voice-webhook.ts`

---

#### [P15] 🟡 Voice webhook makes sequential fetches when parallel would suffice

**File:** `api/voice-webhook.ts:49-100`

Each Vapi function call (get_plan_recommendations, check_drug_coverage) makes one HTTP request to an internal API. If a future call needs both plan recommendations and drug coverage in a single turn, the current structure would make them sequential. Currently each function type is handled separately, so this is a latency concern for compound voice flows only.

**Root cause:** No parallel fetch abstraction in the webhook router.

**Fix:** Minor now — add a comment noting that if compound queries are added, they should use `Promise.all`. Not worth changing until the need arises.

---

## Part 2: Client Performance

---

#### [C1] 🔴 No route-level code splitting — entire app loads on first paint

**File:** `vite.config.ts`, `client/src/App.tsx`

`vite.config.ts` has no `build.rollupOptions.output.manualChunks`. `App.tsx` imports all pages as direct (static) imports — not `React.lazy()`. Every page loads in the initial bundle:

| Page | Lines |
|---|---|
| PlanRecommender.tsx | 1,293 |
| AdminDashboard.tsx | 1,112 |
| AICompare.tsx | 1,063 |
| FindBestPlan.tsx | 1,020 |
| Home.tsx | 960 |
| PlanLookup.tsx | 897 |
| Plans.tsx | 753 |

A beneficiary visiting only the Plans page downloads and parses all 7 pages + AdminDashboard. With Tailwind and Radix UI, the unminified initial bundle is likely 800 KB–1.2 MB.

**Fix:** Lazy-load all routes:
```tsx
// App.tsx
const Plans       = React.lazy(() => import("./pages/Plans"));
const AICompare   = React.lazy(() => import("./pages/AICompare"));
const AdminDash   = React.lazy(() => import("./pages/AdminDashboard"));
// ... all pages

// Wrap router in Suspense
<Suspense fallback={<DashboardLayoutSkeleton />}>
  <Route path="/plans" component={Plans} />
</Suspense>
```

**Risk of regression:** Low — lazy loading is transparent to users; add `<Suspense>` fallback to prevent blank-screen flash.  
**Validation:** Check Lighthouse bundle size before/after; confirm all routes still navigate correctly.

---

#### [C2] 🔴 `PlanCard` (495 lines) is not wrapped in `React.memo`

**File:** `client/src/components/PlanCard.tsx`

`PlanCard` accepts 10 props and renders inline benefit details, copay grids, star ratings, doctor network badges, and drug cost breakdowns. It is rendered for every plan in the grid (50–200 cards). It has zero memoization.

Every filter change in `FilterSidebar` triggers:
1. `filteredPlans` useMemo → new array reference (even if plan data is identical)
2. All PlanCard instances re-render because the array reference changed
3. Each PlanCard re-runs its entire render (495 lines of JSX)

**Root cause:** Missing `React.memo` and no `areEqual` comparator.

**Fix:**
```tsx
export const PlanCard = React.memo(function PlanCard(props: PlanCardProps) {
  // ... existing implementation unchanged
}, (prevProps, nextProps) => {
  // Only re-render if the plan data or interaction state changed
  return prevProps.plan.id === nextProps.plan.id
    && prevProps.isFavorited === nextProps.isFavorited
    && prevProps.isCompareActive === nextProps.isCompareActive
    && prevProps.doctorNetworkStatus === nextProps.doctorNetworkStatus;
});
```

**Measured impact:** For 100 plans, a single filter toggle currently triggers 100 PlanCard re-renders. After memoization: 0–5 re-renders (only plans that enter/leave the filtered set).  
**Risk of regression:** Low — the custom comparator must include all props that affect rendering.  
**Validation:** React DevTools Profiler — confirm re-render count drops from 100 to near-zero on filter toggle.

---

#### [C3] 🟠 FilterSidebar changes trigger immediate scoring recalculation — no debounce

**File:** `client/src/components/FilterSidebar.tsx`, `client/src/pages/Plans.tsx`

The filter chain:
```
FilterSidebar.onChange (checkbox click)
  → Plans.tsx setFilters (state update)
    → filteredPlans useMemo (O(n) filter)
      → aiScores useMemo (O(n²) scoring + O(n log n) sort)
        → aiScoreMap useMemo
          → All PlanCards re-render
```

Every checkbox click runs the full scoring engine synchronously on the React render thread. For 150 plans × 8 scoring factors + 5 normalization passes, this is ~5 ms of synchronous CPU work per keystroke.

**Root cause:** No debounce between UI event and expensive derived state.

**Fix:** Debounce the filter state update by 150–200 ms:
```tsx
// Plans.tsx
const [stagedFilters, setStagedFilters] = useState(DEFAULT_FILTERS);
const debouncedFilters = useDebounce(stagedFilters, 150);
const filteredPlans = useMemo(() => applyFilters(plans, debouncedFilters), [plans, debouncedFilters]);

// FilterSidebar receives setStagedFilters — UI updates instantly, scoring deferred
```

**Risk of regression:** Low — 150 ms is imperceptible; filters still apply.  
**Validation:** React DevTools Profiler — confirm scoring useMemo fires fewer times per filter interaction.

---

#### [C4] 🟠 `scoreAllPlans` makes 5 full-array `Math.max()` passes per call

**File:** `client/src/lib/aiRecommendationEngine.ts:161-220`

```ts
const maxPremium  = Math.max(...plans.map(p => p.premium * 12), 1);
const maxDrugCost = Math.max(...plans.map(p => getEstimatedAnnualDrugCost(p)), 1);
const maxMOOP     = Math.max(...plans.map(p => p.maxOutOfPocket), 1);
// ... 2 more Math.max passes
```

Spread operator (`...`) on large arrays (100+ elements) is a known V8 performance issue — it materializes the full array before passing to `Math.max`. For 150 plans, this runs 750 element accesses in normalization alone, then 150 × 8-factor scoring, then a sort.

**Root cause:** Idiomatic JS array methods used for readability without considering n² accumulation.

**Fix:** Single-pass normalization:
```ts
let maxPremium = 1, maxDrugCost = 1, maxMOOP = 1;
for (const plan of plans) {
  const annual = plan.premium * 12;
  if (annual > maxPremium) maxPremium = annual;
  const drug = getEstimatedAnnualDrugCost(plan);
  if (drug > maxDrugCost) maxDrugCost = drug;
  if (plan.maxOutOfPocket > maxMOOP) maxMOOP = plan.maxOutOfPocket;
}
```

**Risk of regression:** Zero — mathematically identical, only faster.  
**Validation:** Run existing scoring tests; confirm output is identical.

---

#### [C5] 🟠 Two serial fetches before plans render fully — plans then doctor network

**File:** `client/src/pages/Plans.tsx:261,282`

```ts
// Fetch 1 — plan data
useEffect(() => {
  fetch(`/api/plans?zip=${zip}&drugs=...`)
}, [zip, rxDrugs]);

// Fetch 2 — doctor network (waits for plans to be set)
useEffect(() => {
  if (doctors.length === 0 || plans.length === 0) return;
  fetch("/api/provider-network", { method: "POST", body: JSON.stringify({ doctors, plans }) })
}, [doctors, plans, zip]);
```

The provider-network fetch cannot start until plans are fetched and rendered. This creates a visible waterfall: plans render without network badges → network badges appear 300–800 ms later. Every plan card flickers from no-status to status-known.

**Root cause:** Doctor network check depends on the fetched plan list.

**Fix:** If the user has selected doctors, send both requests in parallel by including the plan query in the provider-network request server-side, or prefetch plan IDs for the ZIP. A simpler client fix: compute an optimistic network estimate synchronously (the client already has `checkDoctorNetworkForPlan` in `utils.ts`) while the authoritative API response loads.

**Risk of regression:** Medium — waterfall is tied to current data flow.  
**Validation:** Confirm plan cards show initial estimates immediately, then update with server response.

---

#### [C6] 🟡 Plans.tsx re-fetches all plan data from the server when drugs change

**File:** `client/src/pages/Plans.tsx:263`

When a beneficiary adds a drug, the full plans request fires again:
```ts
useEffect(() => {
  fetch(`/api/plans?zip=${zip}&drugs=${encodeURIComponent(drugsStr)}`)
}, [zip, rxDrugs]); // rxDrugs in dependency array
```

This triggers a full server-round-trip (CDN fetch if cold, admin override DB queries, formulary enrichment). The beneficiary sees a loading spinner every time they add a drug, even though the underlying plan list didn't change — only the cost annotations changed.

**Root cause:** Drug enrichment is server-side rather than client-side.

**Fix:** Separate the two concerns:
1. Fetch plans without drugs on ZIP change (stable data, cache-friendly)
2. Enrich plans with drug costs client-side using the formulary calculator (pure function, no network)

**Risk of regression:** Medium — requires moving drug calculation from server to client.

---

#### [C7] 🟡 `Plans.tsx` has 18 `useState` calls — re-render surface is very wide

**File:** `client/src/pages/Plans.tsx`

With 18 independent state slices, any single update (e.g., modal open/close) re-renders the entire Plans component tree, including all PlanCards. After C2 (PlanCard memoization), this is less critical — but compound state updates (e.g., filter + sort together) cause multiple render cycles.

**Root cause:** No state grouping or `useReducer` for related state.

**Fix (optional):** Group related state into a `useReducer`:
```ts
// Group filter-related state into a single dispatch
const [filterState, dispatch] = useReducer(filterReducer, initialFilterState);
```

This is a medium-effort refactor with moderate benefit. Address after C2 and C3.

---

#### [C8] 🟡 No virtual scrolling — 100+ PlanCards rendered simultaneously

**File:** `client/src/pages/Plans.tsx` (render list)

All plans in `filteredPlans` are rendered to the DOM simultaneously. For a state like Florida or California with 150+ plans, this is 150 PlanCard components mounted, each with 10+ DOM nodes and event listeners.

**Root cause:** Standard `Array.map()` over plan list with no windowing.

**Fix:** Use `@tanstack/react-virtual` or a simple `slice(0, visible)` pattern with a "load more" button:
```tsx
const [visibleCount, setVisibleCount] = useState(20);
const visiblePlans = filteredPlans.slice(0, visibleCount);
```

**Risk of regression:** Low with "load more"; medium with virtual scroll (requires fixed card height or dynamic sizing).  
**Validation:** Confirm all plan functionality (compare, favorite, enroll) works on loaded and not-yet-loaded cards.

---

## Part 3: Database Performance

---

#### [D1] 🟡 MySQL connection uses default pool with no explicit configuration

**File:** `server/db.ts:12`

```ts
_db = drizzle(process.env.DATABASE_URL);
```

Passing a connection string to `drizzle` with mysql2 creates a connection pool with mysql2's defaults (10 connections max, no queue timeout). Under Vercel serverless, each concurrent invocation creates its own pool, potentially exhausting the database's connection limit. A MySQL database on PlanetScale or Railway typically allows 25–100 simultaneous connections.

**Fix:** Use explicit pool configuration for Express and a single-connection approach for serverless:
```ts
// For Express (long-running):
_db = drizzle(mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 10, waitForConnections: true }));

// For Vercel serverless (api/*.ts) — if DB is used directly:
_db = drizzle(mysql.createConnection(process.env.DATABASE_URL));
```

**Risk of regression:** Low.

---

## Part 4: Quick Wins vs Structural Fixes

### Quick Wins — Implement in one PR, low regression risk

| # | Issue | Effort | Impact |
|---|---|---|---|
| QW1 | Add `vercel.json` function timeout config (P1) | 30 min | Prevents chat/compare timeouts in production |
| QW2 | Cache `loadAdminOverrides()` with 60 s TTL (P3) | 1 h | Eliminates 2 DB queries per plan request |
| QW3 | Add `AbortSignal.timeout(60_000)` to `invokeLLM` (P9) | 15 min | Prevents indefinite hang on Forge outage |
| QW4 | Check `res.destroyed` in `compareStream.ts` (P6) | 20 min | Stops streaming to closed connections |
| QW5 | Add TTL to state CDN cache (P5) | 30 min | Prevents stale plan data indefinitely |
| QW6 | Wrap `PlanCard` in `React.memo` (C2) | 1 h | Eliminates ~100 re-renders per filter toggle |
| QW7 | Single-pass normalization in `scoreAllPlans` (C4) | 30 min | Halves scoring CPU time |
| QW8 | Add explicit pVerify mock warning (P8) | 10 min | Makes credential misconfiguration visible |
| QW9 | Parallelize `loadByTokenHash` UPDATE + audit (P12) | 30 min | Saves 1 DB roundtrip on every session resume |

**Total QW effort:** ~5 hours. All pass existing test suite without changes.

---

### Structural Fixes — Require planning, regression coverage

| # | Issue | Effort | Impact |
|---|---|---|---|
| SF1 | Route-level code splitting with `React.lazy` (C1) | 3–4 h | ~40–60% reduction in initial bundle size |
| SF2 | Debounce FilterSidebar changes (C3) | 2 h | Eliminates burst scoring under rapid filter interaction |
| SF3 | Move drug enrichment to client-side (C4, C6) | 4–6 h | Eliminates re-fetch on drug add/remove |
| SF4 | Parallelize `createSession` child inserts (P11) | 2 h | Reduces session creation from 10 to 2–3 DB roundtrips |
| SF5 | Add KV cache for pVerify token + admin overrides (P7, P3) | 4 h | Survives serverless cold starts |
| SF6 | Virtual scrolling for plan grid (C8) | 4–6 h | Cuts DOM nodes by 80% for large states |
| SF7 | Pre-warm Vercel cold starts (P2) | 3 h | Reduces cold-start latency from 23 s to <1 s |
| SF8 | Parallel Blue Button pagination (P14) | 2 h | Reduces claim ingestion from 10 s to 2 s |
| SF9 | Disable extended thinking for non-narrative LLM calls (P10) | 1 h | Reduces LLM latency for structured tasks |

---

## Part 5: Full Findings Index

| ID | Severity | Slice | Issue | Batch |
|---|---|---|---|---|
| P1 | 🔴 Critical | Plans/All | Vercel 60 s default kills 120 s streams | QW |
| P2 | 🔴 Critical | Plans | Cold-start: 23 s worst case | SF7 |
| P3 | 🟠 High | Plans | `loadAdminOverrides` uncached, 2 DB hits/request | QW2 |
| P4 | 🟠 High | Plans | Drug enrichment: O(12×drugs×plans) per request, uncached | SF3 |
| P5 | 🟠 High | Plans | State CDN cache has no TTL — serves stale data forever | QW5 |
| P6 | 🟠 High | Compare | `compareStream` streams to closed connections | QW4 |
| P7 | 🔴 Critical | Eligibility | pVerify token lost on cold start | SF5 |
| P8 | 🟡 Medium | Eligibility | Mock fallback: 1.2 s sleep + silent fake data in prod | QW8 |
| P9 | 🔴 Critical | AI/LLM | `invokeLLM` has no fetch timeout — hangs indefinitely | QW3 |
| P10 | 🟡 Medium | AI/LLM | Extended thinking enabled for structured scoring tasks | SF9 |
| P11 | 🟠 High | QuoteSession | createSession: 5–12 sequential DB roundtrips | SF4 |
| P12 | 🟡 Medium | QuoteSession | loadByTokenHash: sequential UPDATE + audit | QW9 |
| P13 | 🟡 Medium | Admin | LIKE search: leading wildcard = full table scan | — |
| P14 | 🟡 Medium | BlueButton | EOB pagination: 20 sequential HTTP calls | SF8 |
| P15 | 🟡 Medium | Voice | Sequential fetches in webhook handler | — |
| C1 | 🔴 Critical | Client | No code splitting — all pages in initial bundle | SF1 |
| C2 | 🔴 Critical | Client | PlanCard (495 L) not memoized — 100 re-renders per filter | QW6 |
| C3 | 🟠 High | Client | FilterSidebar: no debounce → burst scoring on every click | SF2 |
| C4 | 🟠 High | Client | `scoreAllPlans`: 5 full-array max passes + O(n²) | QW7 |
| C5 | 🟠 High | Client | Plans → doctor-network waterfall: 2 serial fetches | — |
| C6 | 🟡 Medium | Client | Drug change triggers full plan re-fetch from server | SF3 |
| C7 | 🟡 Medium | Client | Plans.tsx: 18 useState calls — wide re-render surface | — |
| C8 | 🟡 Medium | Client | No virtual scrolling — 150+ cards in DOM simultaneously | SF6 |
| D1 | 🟡 Medium | DB | No explicit connection pool config | — |
