# Maintainability & Production-Grade Code Standards Audit
**Branch:** `feat/vertical-slices-prod`  
**Date:** 2026-06-28  
**Goal:** Make the codebase easier to understand, safer to extend, and less fragile under ongoing product iteration.

---

## Severity legend

| Symbol | Meaning |
|---|---|
| 🔴 **Critical** | Active maintenance hazard — bugs hide here; changes will cause incidents |
| 🟠 **High** | Real friction; costs hours per sprint; will bite on the next feature |
| 🟡 **Medium** | Accumulates technical debt; fine now, painful in 6 months |
| 🟢 **Low** | Polish; do it when in the area |

---

## Part 1: Files That Are Too Large or Doing Too Much

### Oversized threshold: >300 lines for a single-purpose module; >200 lines for a route handler

| File | Lines | Primary problem |
|---|---|---|
| `client/src/pages/ComponentShowcase.tsx` | 1,437 | **Dead code** — not routed, not imported |
| `client/src/pages/PlanRecommender.tsx` | 1,293 | Page renders 5 distinct UI states + orchestrates 4 data flows |
| `client/src/lib/mockData.ts` | 1,284 | Two dead exports (`MOCK_PLANS`, `POPULAR_DOCTORS`) bloat a live file |
| `client/src/pages/AdminDashboard.tsx` | 1,112 | Admin overview + plan management + sync history + override management |
| `client/src/pages/AICompare.tsx` | 1,063 | Page-level state + 3 compare modes + SSE streaming + sessionStorage caching |
| `client/src/pages/FindBestPlan.tsx` | 1,020 | Multi-step wizard + validation + 3 sub-flows |
| `client/src/pages/Home.tsx` | 960 | Landing + MBI verify flow + handoff orchestration |
| `client/src/components/InlineCompare.tsx` | 927 | Full compare feature re-implemented outside `features/plan-compare/` |
| `client/src/pages/PlanLookup.tsx` | 897 | Plan lookup + enrollment flow + doctor check |
| `client/src/components/Header.tsx` | 619 | Navigation + auth state + mobile menu + theme toggle + notifications |
| `server/formularyCalculator.ts` | 626 | Drug database (data) + cost calculation (domain logic) mixed in one file |
| `server/adminRouter.ts` | 596 | Auth check + CDN map + caching + plan extraction + 8 route handlers |
| `server/pverifyRouter.ts` | 470 | Token caching + mock builder + PHI boundary + 1 route handler + 3 sub-functions |
| `server/healthProfileRouter.ts` | 451 | LLM orchestration + PHI scrubbing + Zod schemas + 1 route handler |
| `server/plansRouter.ts` | 438 | CDN map + in-memory cache + ZIP resolution + annotation + drug enrichment + 1 route handler |

---

## Part 2: Files That Violate Single Responsibility

### [SRP-01] 🔴 `server/plansRouter.ts` — data map + cache + adapter + handler in one file

**What it does:**
1. Defines `STATE_CDN_URLS` (50-entry constant — pure config)
2. Manages `stateCache` and `zipCache` (infrastructure — LRU cache)
3. Implements `getStateData()` (CDN adapter)
4. Implements `resolveZipToCounty()` (CMS API adapter)
5. Implements `loadAdminOverrides()` (DB adapter)
6. Implements `enrichPlansWithDrugCosts()` (domain logic — calls formularyCalculator)
7. Implements `annotatePlans()` (presentation transform)
8. Exports the tRPC route handler (delivery layer)

**Why it matters:** Adding a feature touches 5–8 concerns simultaneously. A caching bug is in the same file as the domain logic, so the diff is harder to review and test in isolation.

---

### [SRP-02] 🔴 `server/adminRouter.ts` — 7 concerns in 596 lines

1. `checkAdminPassword()` — auth logic (should be a middleware/procedure)
2. `STATE_CDN_URLS` — duplicate of `plansRouter.ts` copy (should be shared)
3. `adminStateCache` — duplicate cache implementation (should be shared)
4. `loadStateDataForAdmin()` — CDN adapter (duplicate of `getStateData()`)
5. `extractCarriersFromStateData()` — data extraction (domain)
6. `extractPlansFromStateData()` — data extraction (domain)
7. 8 route handlers — delivery layer

**Why it matters:** `checkAdminPassword` at line 136–142 is inline in the file rather than enforced via `adminProcedure`. Any new admin route can accidentally skip this check. The duplicate CDN map diverges silently.

---

### [SRP-03] 🟠 `server/formularyCalculator.ts` — drug database embedded in business logic

Lines 1–402: `DRUG_DATABASE` — a 400-line static JavaScript object of drug → tier/cost mappings.  
Lines 403–626: `calculateDrugCosts()` and `enrichPlansWithDrugCosts()` — calculation logic.

**Why it matters:** Updating drug data requires reading past 400 lines of code. The data cannot be tested independently of the algorithm. If the data moves to a DB table later, the algorithm file needs major surgery.

**Fix:** Extract `DRUG_DATABASE` to `server/formularyCalculator.data.ts` or `shared/data/drugDatabase.ts`.

---

### [SRP-04] 🟠 `api/compare-stream.ts` — untyped adapter + prompt builder + streaming handler

1. Lines 1–100: `PlanInput` interface + untyped prompt builder functions (`any` parameters)
2. Lines 100–200: Anthropic API call + fallback to Forge
3. Lines 200–285: SSE streaming logic

The prompt builders use `any` throughout, while `server/compareStream.ts` has the same builders with full Zod validation. This is not a shared module — it's a diverged copy.

---

### [SRP-05] 🟠 `client/src/lib/utils.ts` — Tailwind helper hosting domain logic

Contains `cn()` (a 2-line Tailwind class merger), `checkDoctorNetworkForPlan()`, and `checkDoctorNetworkForAllPlans()` — a probabilistic network membership algorithm. Domain logic has no business living in a utility file named `utils.ts`.

---

### [SRP-06] 🟠 `client/src/pages/AdminDashboard.tsx` — four admin features in one page

The page mixes: carrier override management, plan override management, CMS sync history, and data source management. Each of these is a distinct feature with independent state, queries, and UI.

---

### [SRP-07] 🟡 `server/pverifyRouter.ts` — module-level token cache next to route handler

The `cachedToken` module-level variable (line 46) is infrastructure state living directly in the route handler file. It is also dead infrastructure on Vercel (as documented in the performance audit).

---

### [SRP-08] 🟡 `client/src/lib/aiRecommendationEngine.ts` — two scoring models + algorithm + weights

`MODEL_A` and `MODEL_B` weight configurations live alongside `scoreAllPlans()`, normalization passes, and `scoreAllPlansInternal()`. Changing a weight requires reading the algorithm to know which array index to edit.

---

## Part 3: `any` Usage Audit

**Total `any` usages in non-test production code: ~85.** Categorized by type and fix priority.

### Category A — 🔴 Untyped cross-process boundaries (must fix)

These `any` types allow malformed data to pass through silently. Bugs here are invisible until production.

| Location | Usage | Fix |
|---|---|---|
| `api/compare-stream.ts:28,42,54,77` | `function build2PlanPrompt(current: any, newPlan: any)` | Use the `PlanInput` interface already defined at line 9 of same file |
| `api/formularyCalculator.ts:601,603` | `enrichPlansWithDrugCosts(plans: any[], drugs: any[]): any[]` | Import plan/drug types from `shared/types.ts` |
| `api/plans.ts:65,123,140,141` | `stateCache: Map<string, Record<string, any[]>>`, `findPlansForCounty(stateData: Record<string, any[]>)`, `annotatePlans(plans: any[])` | Define `CmsPlan` interface in `shared/types.ts` |
| `server/formularyCalculator.ts:601,603` | Same as api copy | Same fix |
| `client/src/contexts/QuoteHandoffContext.tsx:15,16` | `doctors: any[]`, `drugs: any[]` | Use `Doctor[]` and `RxDrug[]` from `client/src/lib/types.ts` |
| `client/src/features/pre-enrollment-checklist/lib/crmPayload.ts:9,31,34,39,43` | All function parameters | Define `CRMPayload` type; use it |

### Category B — 🟠 Internal cast escapes (should fix)

These work at runtime but defeat type-checking. They indicate the type system doesn't model the data flow correctly.

| Location | Usage | Root cause | Fix |
|---|---|---|---|
| `client/src/pages/Plans.tsx:107,127,157,158,165,166` | `(p as any).estimatedAnnualDrugCost` | Drug cost is added dynamically by enrichment; type doesn't capture it | Add `estimatedAnnualDrugCost?: number` to the plan type |
| `client/src/components/PlanCard.tsx:108` | `const planAny = plan as any` | Same as above | Same fix |
| `client/src/components/AIRecommendationBanner.tsx:18,29` | `(plan as any).estAnnualDrugCost` | Inconsistent field name (`estAnnualDrugCost` vs `estimatedAnnualDrugCost`) | Standardize field name; add to type |
| `client/src/components/AITop3Cards.tsx:53` | `(plan as any).estimatedAnnualDrugCost` | Same | Same |
| `client/src/features/plan-cost/lib/annualCostCalculator.ts:89` | `const p = plan as any` | Same | Same |
| `server/_core/sdk.ts:138,139,142,249,250,253` | `(data as any)?.platforms` | OAuth data shape not typed | Define `OAuthTokenData` interface |
| `server/quoteSession/router.ts:114,147,164,180` | `clientIp(ctx.req as any)` | `ctx.req` type doesn't match `clientIp` parameter | Wrap in typed helper `getClientIp(ctx: Context): string` |

### Category C — 🟡 External API response parsing (acceptable with a guard)

These parse external JSON (NPPES, Vapi, Blue Button). Using `any` at the fetch boundary is acceptable only if the data is immediately narrowed to a typed structure.

| Location | Current state | Required improvement |
|---|---|---|
| `api/doctors.ts:103,105,106,128,132,148,149` | `any` on NPPES API response | Already narrowed — acceptable; add comment citing NPPES spec |
| `api/provider-network.ts:102,107,108,120,121` | `any` on NPPES results | Same |
| `server/pverifyRouter.ts:153` | `as any` on pVerify JSON | Add `PVerifyEligibilityResponse` interface; narrow immediately |
| `client/src/components/VoiceWidget.tsx:61` | `(msg: any)` on Vapi message | Define `VapiMessage` discriminated union |
| `api/voice-webhook.ts:55` | `(plans.plans || plans || []).slice(0, 3).map((p: any)` | Type the plan shape at this boundary |

### Category D — 🟢 Framework/browser escape hatches (acceptable)

| Location | Pattern | Why acceptable |
|---|---|---|
| `client/src/lib/a11y/` | `AbortSignal.any?.()` cast | Newer API, not yet in TypeScript lib |
| `client/src/components/ui/dialog.tsx` | `(e as any).isComposing` | Non-standard browser event property |
| Analytics files (`matchScoreAnalytics.ts`, etc.) | `(window as any).gtag` | No `@types/gtag` installed |

---

## Part 4: Error Handling Gaps

### [ERR-01] 🔴 Silent catches in streaming handlers mask production errors

**Files:** `api/chat.ts:236,305`, `api/compare-stream.ts:234`

```ts
} catch { /* skip */ }
```

These wrap individual SSE chunk writes. When a chunk write fails (network error, serialization error), the error is silently discarded and streaming continues. The client receives a partial response with no indication of failure.

**Fix:**
```ts
} catch (err) {
  console.error("[compare-stream] chunk write failed:", err);
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify({ type: "error", message: "Stream interrupted" })}\n\n`);
  }
  break; // or return — don't continue streaming after a write failure
}
```

---

### [ERR-02] 🔴 Empty catches swallow CDN and ZIP resolution failures silently

**Files:** `api/plans.ts:100,118`

```ts
} catch {
  // empty
}
```

If the CDN fetch fails (timeout, 4xx, network error), the plan list returns empty with no error signal to the client. The user sees an empty plan grid with no explanation.

**Fix:** Re-throw or return a typed error result:
```ts
} catch (err) {
  console.error("[plans] CDN fetch failed for state:", stateAbbr, err);
  throw new Error(`Failed to load plan data for state ${stateAbbr}`);
}
```

---

### [ERR-03] 🟠 `api/doctors.ts` inner loop has bare `catch {}` — NPI errors lost

**File:** `api/doctors.ts:45`

```ts
try {
  const geo = await fetch(`/api/geocode?zip=${zip}`);
  // ...
} catch {}  // silent — distance calculation simply fails without logging
```

If geocoding fails for a doctor's ZIP, that doctor silently gets no distance calculation. No log entry means this fails silently in production.

---

### [ERR-04] 🟠 `api/provider-network.ts:41` and `server/providerNetwork.ts:99` — empty catches on NPPES calls

Same pattern — NPPES API failures are swallowed, resulting in all doctors appearing as "out of network" with no observable cause.

---

### [ERR-05] 🟠 Inconsistent error classification across tRPC and REST handlers

tRPC routers throw `TRPCError` with `code` semantics (good):
```ts
throw new TRPCError({ code: "NOT_FOUND", message: "Session not found or expired" });
```

Vercel API handlers use mixed patterns:
```ts
// api/plans.ts — returns 500 for all errors regardless of type
res.status(500).json({ error: "Failed to load plans" });

// api/voice-webhook.ts — returns 200 for all errors
res.status(200).json({ error: "Failed to process" }); // 200 with error payload
```

Returning `200 OK` with an error payload breaks any client that checks HTTP status codes.

---

### [ERR-06] 🟡 `server/adminRouter.ts:443` — background sync error goes to `console.error` only

```ts
triggerSync().catch((err) => console.error("[Admin] Sync failed:", err));
```

No alert, no retry, no status update in the `cmsDataSources` table. Operators have no way to know sync failed except by reading logs.

---

### [ERR-07] 🟡 No error boundary on streaming SSE clients

`client/src/pages/AICompare.tsx` and `client/src/components/InlineCompare.tsx` start EventSource / fetch streams. If the stream returns a non-2xx status, the error is caught in a local try/catch but only updates local UI state. There is no `<ErrorBoundary>` wrapping these components — if the error handling itself throws (e.g., `setState` called after unmount), React renders a blank screen.

---

## Part 5: Inconsistent Validation Strategy

### [VAL-01] 🔴 `api/` functions have no shared validation contract

tRPC procedures (`server/`) validate every input via Zod before the handler runs — enforced by middleware. Vercel API functions (`api/`) validate inconsistently:

| File | Validation approach |
|---|---|
| `api/plans.ts` | Inline regex: `if (!/^\d{5}$/.test(zip))` |
| `api/chat.ts` | `messages.length > 50` check only |
| `api/compare-stream.ts` | `JSON.parse()` with no schema validation |
| `api/voice-webhook.ts` | Duck-typed: `if (toolCall?.function?.name === ...)` |
| `api/bluebutton-callback.ts` | `if (!code || !state)` only |
| `api/doctors.ts` | `if (!name)` only |
| `api/validate-zip.ts` | Regex + CMS API call |

**Impact:** `api/compare-stream.ts` accepts any JSON body and passes it directly to the prompt builder and then to the Anthropic API. A malformed plan object generates a malformed prompt, producing a garbage response with no indication of where it went wrong.

**Fix:** Add Zod validation at the top of every `api/` handler:
```ts
// Standard pattern for all api/ files
const bodyResult = PlanCompareInputSchema.safeParse(req.body);
if (!bodyResult.success) {
  return res.status(400).json({ error: "Invalid request", issues: bodyResult.error.issues });
}
const body = bodyResult.data; // typed from here on
```

---

### [VAL-02] 🟠 Duplicate Zod schemas for plan input across three files

`BenefitDetailSchema` and `PlanInputSchema` are defined independently in:
- `server/compareStream.ts:17-74` — Zod schema, fully typed
- `server/compareRouter.ts:31-80` — Zod schema, slightly different field names
- `api/compare-stream.ts:9-27` — TypeScript interface only, `any` parameters in builders

These are the same concept defined three times. A field added to one (e.g., `partBPremiumReduction`) must be added to all three manually.

---

### [VAL-03] 🟡 No shared ZIP validator

ZIP code validation (`/^\d{5}$/`) is reimplemented in:
- `api/plans.ts:82`
- `api/validate-zip.ts:12`
- `client/src/features/zip-validation/lib/zipValidator.ts`

`shared/const.ts` and `shared/types.ts` exist but do not include this validator.

---

## Part 6: Magic Strings and Constants Drift

### [CONST-01] 🔴 `STATE_CDN_URLS` defined three times — will drift on next CMS data release

**Files:** `server/plansRouter.ts:22-76`, `server/adminRouter.ts:30-57`, `api/plans.ts:6-58`

All three define the identical 50-state CDN URL map with the identical `CDN_BASE` string. When CMS publishes new plan data, these three maps must all be updated simultaneously. The next update will hit two out of three, guaranteed.

**Fix:** Move to `shared/const.ts` (which already exists):
```ts
// shared/const.ts
export const CDN_BASE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663319810046/5TY7JcF275WMujMHZWWJT8";
export const STATE_CDN_URLS: Record<string, string> = { /* ... */ };
```

Then import in all three files. One edit, three consumers updated.

---

### [CONST-02] 🔴 Hardcoded CMS API key as a fallback constant

**File:** `api/plans.ts:62`

```ts
const CMS_API_KEY = process.env.CMS_MARKETPLACE_API_KEY ?? "d687412e7b53146b2631dc01974ad0a4";
```

This key is committed to source control. If the key rotates, the fallback is stale. If an engineer deploys without setting the env var, production silently uses the committed key.

**Fix:** Fail at startup, not silently:
```ts
const CMS_API_KEY = process.env.CMS_MARKETPLACE_API_KEY;
if (!CMS_API_KEY) throw new Error("CMS_MARKETPLACE_API_KEY is required");
```

---

### [CONST-03] 🔴 Dev admin password default `"admin123"` in production code path

**File:** `server/adminRouter.ts:137`

```ts
const expected = process.env.ADMIN_PASSWORD ?? (process.env.NODE_ENV !== "production" ? "admin123" : "");
```

If `NODE_ENV` is not explicitly set to `"production"` in a staging environment, `"admin123"` becomes the admin password. Staging often has production data.

**Fix:**
```ts
const expected = process.env.ADMIN_PASSWORD;
if (!expected) {
  console.error("[Admin] ADMIN_PASSWORD env var not set — admin routes disabled");
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Admin not configured" });
}
```

---

### [CONST-04] 🟠 LRU cache sizes are hardcoded magic numbers in three places

| File | Constant | Value |
|---|---|---|
| `server/plansRouter.ts:83` | `STATE_CACHE_MAX` | 20 |
| `server/plansRouter.ts:84` | `ZIP_CACHE_MAX` | 5000 |
| `server/adminRouter.ts:73` | `if (adminStateCache.size >= 10)` | 10 (inline) |

The admin cache limit is not even a named constant — it's an inline `10`. This means tuning the cache requires finding these by text search, not by looking at a constants file.

---

### [CONST-05] 🟡 `PREWARM_STATES` is hardcoded — no connection to business configuration

**File:** `server/plansRouter.ts:86-89`

```ts
const PREWARM_STATES = ["MO", "KS", "FL", "TX", "CA", "NY", "OH", "PA", "IL", "GA"];
```

This list represents the states with the most SelectQuote business. It should either be in an env var or in the `cmsDataSources` table so it can be managed without a deploy.

---

## Part 7: Weak Naming

### [NAME-01] 🟠 `annotePlans` vs `enrichPlansWithDrugCosts` — inconsistent verb for the same operation

- `api/plans.ts:140`: `annotatePlans(plans)` — adds rank index, does light sorting
- `server/formularyCalculator.ts:600`: `enrichPlansWithDrugCosts(plans, drugs)` — adds drug cost fields

Both "annotate" and "enrich" mean "add computed fields to a plan object." One file uses one verb, the other uses the other. The operations are conceptually identical; they should share a verb family.

---

### [NAME-02] 🟡 `loadAdminOverrides` vs `loadStateDataForAdmin` — parallel names for different concepts

`loadAdminOverrides` (DB query) and `loadStateDataForAdmin` (CDN HTTP fetch) both start with `load` but do fundamentally different things. The naming suggests they are peers; they are not.

Better: `fetchStateDataFromCDN()` (HTTP + external) vs `queryAdminOverrides()` (DB + internal).

---

### [NAME-03] 🟡 `maskStr` / `maskEmail` in `quoteSession/router.ts` vs `maskValue` in `shared/security/`

Two masking implementations:
- `server/quoteSession/router.ts:38-42`: `maskStr(s: string): string` and `maskEmail(s: string): string`
- `shared/security/crypto.ts`: `maskValue(s: string, visibleChars: number): string`

Same concept, different names, different files. The router-local versions should be deleted in favor of the shared one.

---

### [NAME-04] 🟡 `extractCarriersFromStateData` vs `extractPlansFromStateData` — but one returns names, the other returns objects

`extractCarriersFromStateData` returns `string[]` (carrier names).  
`extractPlansFromStateData` returns `object[]` (plan objects).

The naming suggests they are symmetric, but the return types are not.

---

### [NAME-05] 🟢 `getDb()` vs `getDb` (import pattern) is confusing

`server/db.ts` exports `getDb` as an async function (lazy singleton). Files import it as:
```ts
import { getDb } from "../db";
const dbConn = await getDb();
```

The name `getDb` reads as a getter but is actually an async factory. A clearer name would be `connectToDb()` or `db()` to signal "this is async and may connect."

---

## Part 8: Hidden Side Effects

### [SIDE-01] 🟠 `server/_core/index.ts` runs side effects at module import time

```ts
// Immediately on import:
validateCryptoEnv();       // throws if ENCRYPTION_KEY missing
prewarmPlanCache();        // fires HTTP requests to CDN
seedCmsDataSources();      // writes to DB
startCmsPipelineCron();    // starts node-cron
```

These side effects run when the module is first required. In tests, any import of `_core/index.ts` would trigger DB writes and HTTP calls unless carefully mocked. Currently tests appear to avoid importing this file, but it's fragile.

**Fix:** Wrap in an explicit `initializeServer()` function that is called exactly once from the entry point.

---

### [SIDE-02] 🟠 Module-level cache population on `api/plans.ts` and `api/compare-stream.ts`

Both files do work at module scope that affects all requests. In `api/plans.ts`, the `stateCache` and `zipCache` Maps are initialized at module scope (not in a handler function), which means their contents persist across Vercel warm invocations. This is intentional for caching but is invisible to a reader of the handler function.

---

### [SIDE-03] 🟡 `console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl)` on every cold start

**File:** `server/_core/sdk.ts` (OAuth init)

This log runs every time the module loads (every cold start). It logs the OAuth base URL, which is fine, but logs are the only indication that OAuth initialization ran. If initialization fails silently, this log still appears, which is misleading.

---

## Part 9: Deeply Nested Conditionals

### [NEST-01] 🟠 `server/adminRouter.ts` — nested auth + input + DB condition chain

Several handlers follow this pattern:
```ts
handler: async ({ input, ctx }) => {
  if (!input.adminPassword) throw ...;
  checkAdminPassword(input.adminPassword);  // throws if wrong
  
  const dbConn = await getDb();
  if (!dbConn) throw ...;
  
  if (input.carriers && input.carriers.length > 0) {
    for (const carrier of input.carriers) {
      if (carrier.isEnabled !== undefined) {
        // 4 levels deep
      }
    }
  }
}
```

Admin password is checked manually in every handler rather than once in `adminProcedure`. If a new route is added and the developer forgets `checkAdminPassword()`, it silently bypasses auth.

**Fix:** Move `checkAdminPassword` into `adminProcedure` middleware (it may already exist in `_core/trpc.ts` — verify and enforce usage).

---

### [NEST-02] 🟠 `server/formularyCalculator.ts` — 4-level loop nesting in `calculateDrugCosts`

```ts
for (const month of MONTHS) {        // level 1
  for (const drug of drugs) {        // level 2
    const profile = findDrug(drug);
    if (profile) {                   // level 3
      for (const tier of TIERS) {   // level 4
        if (coverage[tier]) {        // level 5
          // calculation
        }
      }
    }
  }
}
```

At 5 levels of nesting the logic is difficult to follow and impossible to unit test individual branches without running the full loop.

**Fix:** Extract `calculateMonthCost(drug, month, coverage): number` as a pure function, then the outer loop becomes flat.

---

### [NEST-03] 🟡 `client/src/pages/Plans.tsx` — 3+ nested ternaries in JSX render

Filter logic and sort logic use nested ternaries that make the branching hard to read:
```ts
const sortedPlans = filteredPlans.sort((a, b) => {
  if (sortBy === "premium") return a.premium - b.premium;
  if (sortBy === "drugCost") {
    const aCost = (a as any).estimatedAnnualDrugCost ?? 0;
    const bCost = (b as any).estimatedAnnualDrugCost ?? 0;
    return aCost - bCost;
  }
  // ... more cases
});
```

Each `sortBy` case is a separate `if` — this is fine. The `as any` casts are not (covered in Part 3).

---

## Part 10: Config Drift

### [CFG-01] 🔴 `api/formularyCalculator.ts` is a 626-line copy of `server/formularyCalculator.ts`

```bash
server/formularyCalculator.ts   626 lines
api/formularyCalculator.ts      626 lines  # identical copy
```

These two files exist as separate modules because `api/` functions cannot import from `server/` (different runtime). But the solution is not to copy — it is to move the shared logic to `shared/`.

**Confirmed risk:** Drug data in `server/formularyCalculator.ts` and `api/formularyCalculator.ts` will diverge on the next drug database update. One update, two files, one engineer, one forgotten copy.

**Fix:** Move `formularyCalculator` to `shared/formulary/` and import from both `server/` and `api/`.

---

### [CFG-02] 🟠 `vercel.json` does not configure function timeouts, memory, or regions

Covered in the performance audit, but repeated here as a maintainability issue: the absence of explicit config means the next engineer deploying a new API function gets Vercel defaults (60 s, 512 MB, any region) without any indication of what the existing functions require.

**Fix:** Add a `functions` block to `vercel.json` as the declarative source of truth for all serverless constraints.

---

### [CFG-03] 🟡 `shared/const.ts` exists but is not used for the most important constants

`shared/const.ts` presumably holds some shared constants, but the three largest constants in the codebase (`STATE_CDN_URLS`, `CDN_BASE`, `PREWARM_STATES`) are not there. The file exists but doesn't contain what it should.

---

### [CFG-04] 🟡 Rate limiter constants are only in `server/_core/index.ts` — not documented or configurable

```ts
const generalLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
const aiLimiter       = rateLimit({ windowMs: 15 * 60 * 1000, max: 20  });
const plansLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 60  });
```

These limits affect security posture and performance. They should be named constants or env vars, not inline numbers buried in the startup file.

---

## Part 11: Inconsistent Folder Conventions

### Current state

```
server/
  _core/             # infrastructure — consistent with naming convention
  quoteSession/      # ✅ full vertical slice: router, repository, schemas, crypto, tokens
  plansRouter.ts     # ❌ flat file — not a slice, not consistent with quoteSession/
  adminRouter.ts     # ❌ flat file
  formularyCalculator.ts  # ❌ flat file (domain logic)
  compareStream.ts   # ❌ flat file (streaming handler)
  compareRouter.ts   # ❌ flat file (tRPC handler)
  recommendStream.ts # ❌ flat file

client/src/
  features/          # ✅ vertical slice structure (plan-compare, zip-validation, etc.)
  pages/             # ❌ fat page components — mix of delivery and business logic
  components/        # ❌ mix: shared UI (StarRating, CarrierLogo) and feature components (InlineCompare)
  lib/               # ❌ mix: utilities (utils.ts, trpc.ts) and domain logic (aiRecommendationEngine.ts)
  hooks/             # ❌ root-level hooks alongside feature-level hooks in features/*/
  contexts/          # ❌ QuoteHandoffContext uses any[] for typed domain objects

api/
  formularyCalculator.ts  # ❌ copy of server/formularyCalculator.ts
  plans.ts           # ❌ duplicate of plansRouter.ts logic
  compare-stream.ts  # ❌ diverged from server/compareStream.ts
```

### What `quoteSession/` gets right (the standard to replicate)

```
server/quoteSession/
  router.ts     — tRPC delivery layer only; no business logic
  repository.ts — DB access only; no HTTP, no domain rules
  schemas.ts    — Zod schemas; no side effects
  crypto.ts     — encryption adapter; thin re-export with PURPOSE binding
  tokens.ts     — pure functions; no imports from other modules
```

---

## Part 12: Refactor Recommendations by Slice

---

### PLANS SLICE

**Current files:** `server/plansRouter.ts`, `api/plans.ts`, `server/formularyCalculator.ts`, `api/formularyCalculator.ts`

**Recommended structure:**
```
server/plans/
  router.ts           — tRPC handler only; delegates to loader and annotator
  planLoader.ts       — CDN fetch, state cache, ZIP resolution (extracted from plansRouter.ts)
  planAnnotator.ts    — annotatePlans(), admin override application (extracted)
  overrideCache.ts    — loadAdminOverrides() with TTL cache (extracted)

shared/formulary/
  calculator.ts       — calculateDrugCosts(), enrichPlansWithDrugCosts() (moved from server/ and api/)
  database.ts         — DRUG_DATABASE constant (extracted from calculator.ts)

shared/const.ts
  STATE_CDN_URLS      — moved here from 3 locations
  CDN_BASE            — moved here
```

**Extraction guide:**
- `annotatePlans()` → keep in slice (`server/plans/planAnnotator.ts`)
- `enrichPlansWithDrugCosts()` → move to shared (`shared/formulary/calculator.ts`)
- `STATE_CDN_URLS` → move to shared (`shared/const.ts`)
- `loadAdminOverrides()` → keep in slice with a TTL cache wrapper

---

### COMPARE SLICE

**Current files:** `server/compareStream.ts`, `server/compareRouter.ts`, `api/compare-stream.ts`

**Problems:**
1. `PlanInputSchema` / `BenefitDetailSchema` defined twice in server, once as interface in api
2. Prompt builders in `api/compare-stream.ts` use `any`; server versions use Zod
3. `compareRouter.ts` (tRPC mutation, non-streaming) has zero client callers — suspected dead

**Recommended structure:**
```
shared/compare/
  schemas.ts      — PlanInputSchema, BenefitDetailSchema (single definition)
  promptBuilder.ts — build2PlanPrompt(), build3PlanPrompt() (typed, shared)

server/compare/
  streamHandler.ts — SSE streaming logic (renamed from compareStream.ts)
  router.ts        — tRPC handler (DELETE compareRouter.ts after confirming dead)

api/
  compare-stream.ts — import from shared/compare/; no local schema or prompt builder
```

**Extraction guide:**
- `PlanInputSchema` → move to shared (`shared/compare/schemas.ts`)
- Prompt builders → move to shared, typed against `PlanInput`
- `compareRouter.ts` → delete after confirming zero callers (already confirmed in code creep audit)

---

### ADMIN SLICE

**Current files:** `server/adminRouter.ts`

**Recommended structure:**
```
server/admin/
  router.ts           — route handlers only; uses adminProcedure for all routes
  stateDataLoader.ts  — loadStateDataForAdmin() + adminStateCache (extracted; shares CDN_BASE from shared/const)
  planExtractor.ts    — extractPlansFromStateData(), extractCarriersFromStateData()
  overrideManager.ts  — DB access for carrier/plan overrides
```

**Extraction guide:**
- `checkAdminPassword()` → delete from router; enforce via `adminProcedure` in `_core/trpc.ts`
- `STATE_CDN_URLS` → delete; import from `shared/const.ts`
- `adminStateCache` + `loadStateDataForAdmin()` → merge with `server/plans/planLoader.ts` (same CDN, same structure — no reason for two caches)

---

### ELIGIBILITY SLICE

**Current files:** `server/pverifyRouter.ts`

**Problems:**
1. Token cache (infrastructure) lives next to route handler
2. Mock builder (`buildMockEligibilityResult`) lives next to route handler
3. PHI boundary function (`buildPverifyPayload`) is inline

**Recommended structure:**
```
server/eligibility/
  router.ts         — route handler; delegates to pVerifyClient
  pVerifyClient.ts  — token management, API call, PHI payload builder
  mockBuilder.ts    — buildMockEligibilityResult() (dev/test only)
```

**Extraction guide:**
- Token cache → move to `pVerifyClient.ts`; add Vercel KV adapter behind a port
- `buildPverifyPayload()` → keep in `pVerifyClient.ts` (PHI boundary)
- `buildMockEligibilityResult()` → move to `mockBuilder.ts`; mark with `// DEV ONLY`

---

### FORMULARY SLICE

**Current files:** `server/formularyCalculator.ts`, `api/formularyCalculator.ts` (identical copy)

**Action:**
```
shared/formulary/
  calculator.ts  — calculateDrugCosts(), enrichPlansWithDrugCosts()
  database.ts    — DRUG_DATABASE (the 400-line drug data object)
```

Both `server/` and `api/` import from `shared/formulary/`. The copy in `api/` is deleted.

---

### QUOTE SESSION SLICE

**Current state:** Already well-structured (`router.ts`, `repository.ts`, `schemas.ts`, `crypto.ts`, `tokens.ts`). This is the reference implementation.

**Minor improvements only:**
- `maskStr()` and `maskEmail()` in `router.ts` → delete; use `maskValue()` from `shared/security/crypto.ts`
- `clientIp(ctx.req as any)` pattern → wrap in `getClientIp(ctx: TRPCContext): string` helper in `_core/context.ts`

---

### CLIENT — PLANS PAGE

**Current file:** `client/src/pages/Plans.tsx` (753 lines)

**Problems:**
1. 18 useState calls
2. Orchestrates two independent data fetches (plans + doctor network)
3. Contains inline filter logic
4. Contains inline sort logic

**Recommended structure:**
```
client/src/features/plans/
  hooks/
    usePlans.ts           — fetch + drug enrichment
    useDoctorNetwork.ts   — doctor network fetch (extracted from Plans.tsx)
    usePlanFilters.ts     — filter state + filteredPlans derivation
    usePlanSort.ts        — sort state + sortedPlans derivation
  components/
    PlanGrid.tsx          — renders list of PlanCards
    PlanSortControls.tsx  — sort dropdown
  Plans.tsx               — orchestrator only; composes hooks + components
```

---

### CLIENT — AI COMPARE

**Current files:** `client/src/pages/AICompare.tsx` (1063 lines), `client/src/components/InlineCompare.tsx` (927 lines)

`InlineCompare.tsx` re-implements the compare feature outside `features/plan-compare/`. The `features/plan-compare/` directory has `components/AICompareModal.tsx` — there are now three locations for compare UI logic.

**Fix:** `InlineCompare.tsx` should be a thin wrapper that renders `<AICompareModal>` from `features/plan-compare/`. The implementation belongs in the feature directory.

---

### CLIENT — ADMIN DASHBOARD

**Current file:** `client/src/pages/AdminDashboard.tsx` (1112 lines)

Each admin section should be an independent feature:
```
client/src/features/admin/
  carrier-overrides/  — CarrierOverridesPanel + data hook
  plan-overrides/     — PlanOverridesPanel + data hook
  sync-history/       — SyncHistoryPanel + data hook
  data-sources/       — DataSourcesPanel + data hook

client/src/pages/AdminDashboard.tsx  — compose 4 panels, <200 lines
```

---

## Part 13: Target Naming and File Organization Standard

### Server file naming

```
server/
  {slice}/
    router.ts         — tRPC or Express route handlers only; no business logic
    repository.ts     — DB access (Drizzle queries); no HTTP
    schemas.ts        — Zod schemas; no side effects
    {adapterName}.ts  — external API adapters (e.g., pVerifyClient.ts)
    crypto.ts         — encryption adapter (if slice has PHI)
    tokens.ts         — token generation (if slice has session tokens)

  _core/
    trpc.ts           — procedure factories (publicProcedure, adminProcedure)
    env.ts            — validated environment config
    llm.ts            — LLM adapter port
    context.ts        — tRPC context builder
    index.ts          — server startup (side effects here, nowhere else)
```

### API (Vercel serverless) file naming

```
api/
  {feature}.ts        — thin handler; imports from shared/ for logic; validates input with Zod
```

No business logic. No copied schemas. No inline prompt builders.

### Client file naming

```
client/src/
  features/
    {feature-name}/
      components/     — UI components for this feature only
      hooks/          — hooks for this feature only
      lib/            — pure functions (no side effects)
      types/          — TypeScript interfaces for this feature
      __tests__/      — feature tests

  pages/
    {PageName}.tsx    — orchestrator only; <200 lines; composes features

  components/
    ui/               — shadcn/ui primitives only
    {SharedName}.tsx  — cross-feature shared components (StarRating, CarrierLogo, Header)
    # NOT InlineCompare — feature component, belongs in features/plan-compare/

  lib/
    trpc.ts           — tRPC client setup
    utils.ts          — cn() and other pure utility functions ONLY
    # NOT aiRecommendationEngine — move to features/plan-scoring/
    # NOT doctor network functions — move to features/provider-network/

  hooks/
    # Root-level hooks for cross-feature concerns only (useComposition, useMobile)
    # Feature-specific hooks live in features/{feature}/hooks/
```

### Naming rules

| Concept | Rule | Example |
|---|---|---|
| DB access | `query*` prefix | `queryPlanOverrides()` |
| External API call | `fetch*` prefix | `fetchStateDataFromCDN()` |
| In-memory load with cache | `load*` prefix | `loadStateData()` |
| PHI boundary functions | `to*` prefix | `toDeidentifiedProfile()`, `toAIHealthProfile()` |
| Admin masking | `mask*` prefix | `maskEmail()`, `maskValue()` |
| Zod schemas | `*Schema` suffix | `PlanInputSchema`, `SaveQuoteInputSchema` |
| TypeScript interfaces | PascalCase, no suffix | `PlanInput`, `Doctor`, `RxDrug` |
| tRPC routers | `*Router` suffix | `plansRouter`, `quoteSessionRouter` |
| React hooks | `use*` prefix | `usePlans`, `useDoctorNetwork` |
| Page components | PascalCase, `Pages.tsx` suffix for bundles | `Plans.tsx`, `AICompare.tsx` |
| Feature directories | kebab-case | `plan-compare/`, `zip-validation/` |

---

## Part 14: Prioritized Remediation

### Batch 1 — Critical fixes, no behavior change, low blast radius

| # | Action | Files | Effort |
|---|---|---|---|
| M1 | Move `STATE_CDN_URLS` + `CDN_BASE` to `shared/const.ts` | 3 files | 30 min |
| M2 | Remove hardcoded CMS API key fallback; fail at startup | `api/plans.ts` | 10 min |
| M3 | Remove `"admin123"` default; fail at startup or disable routes | `server/adminRouter.ts:137` | 10 min |
| M4 | Replace empty `} catch {` blocks in streaming handlers with logging | `api/chat.ts`, `api/compare-stream.ts` | 20 min |
| M5 | Replace empty `} catch {` in CDN/ZIP fetches with thrown errors | `api/plans.ts:100,118` | 15 min |
| M6 | Move `formularyCalculator.ts` to `shared/formulary/`; delete `api/` copy | 2 files | 1 h |
| M7 | Move `PlanInputSchema`/`BenefitDetailSchema` to `shared/compare/schemas.ts` | 3 files | 45 min |
| M8 | Fix `QuoteHandoffContext` `any[]` types → `Doctor[]`, `RxDrug[]` | 1 file | 15 min |

**Total estimated effort:** ~4 hours. All are safe to do without regression test coverage.

### Batch 2 — High-value refactors, require test coverage before merge

| # | Action | Files | Effort |
|---|---|---|---|
| M9 | Extract `DRUG_DATABASE` to `shared/formulary/database.ts` | 1 file | 30 min |
| M10 | Enforce `adminProcedure` for all admin routes; delete inline `checkAdminPassword` | `adminRouter.ts`, `_core/trpc.ts` | 1 h |
| M11 | Add Zod validation at top of every `api/` handler | `api/*.ts` | 2 h |
| M12 | Type `annotatePlans(plans: CmsPlan[])` — define `CmsPlan` in `shared/types.ts` | 3 files | 1 h |
| M13 | Add `estimatedAnnualDrugCost?: number` to plan type; remove `as any` casts | `Plans.tsx`, `PlanCard.tsx`, etc. | 1 h |
| M14 | Extract `checkDoctorNetworkForPlan` from `utils.ts` → `features/provider-network/lib/` | 2 files | 20 min |
| M15 | Extract `aiRecommendationEngine.ts` → `features/plan-scoring/lib/` | 1 file (move) | 15 min |

### Batch 3 — Structural decomposition, requires planning

| # | Action | Effort |
|---|---|---|
| M16 | Decompose `AdminDashboard.tsx` into 4 feature panels | 4 h |
| M17 | Decompose `Plans.tsx` into hooks + grid component | 3 h |
| M18 | Fold `InlineCompare.tsx` into `features/plan-compare/` | 2 h |
| M19 | Restructure `server/plans/` as proper slice | 2 h |
| M20 | Restructure `server/admin/` as proper slice | 2 h |

---

## Summary

| Category | Finding count | Critical | High | Medium |
|---|---|---|---|---|
| File size / SRP | 15 files | 2 | 4 | 9 |
| `any` usage | ~85 instances | 6 groups | 8 groups | acceptable |
| Error handling | 7 gaps | 2 | 3 | 2 |
| Validation | 3 gaps | 1 | 2 | — |
| Magic constants | 5 issues | 3 | 1 | 1 |
| Naming | 5 issues | — | 2 | 3 |
| Side effects | 3 issues | — | 2 | 1 |
| Config drift | 4 issues | 1 | 1 | 2 |
| Folder conventions | 3 areas | — | 1 | 2 |

The single highest-leverage action is **Batch 1** — eight changes, ~4 hours, eliminates the three most dangerous production hazards (committed API key, dev password default, silently swallowed stream errors) and the highest-maintenance-cost issue (triplicated CDN map).
