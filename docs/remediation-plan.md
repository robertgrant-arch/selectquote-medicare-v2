# Production Hardening — Batched Remediation Plan
**Branch:** `feat/vertical-slices-prod`  
**Date:** 2026-06-28  
**Source audits:** architecture-audit, architecture-integrity-audit, code-creep-audit, performance-audit, maintainability-audit

---

## Reading guide

Each batch is self-contained and independently mergeable. Complete and deploy one batch before starting the next within the same phase. Phases may not be skipped — Phase 2 (tests) gates all downstream phases.

**Risk levels**

| Symbol | Meaning |
|---|---|
| 🟢 Zero | Config-only or additive; no existing behavior touched |
| 🟡 Low | Edits existing files; existing tests must stay green |
| 🟠 Medium | Moves code; requires new coverage before merge |
| 🔴 High | Changes interfaces or data flow; requires full regression before merge |

---

## Phase 0 — Inventory & Mapping
**Goal:** Produce a stable, agreed-upon map of what exists before touching anything. No code changes.

---

### Batch 0-A: Confirm dead code before deletion
**Purpose:** Verify that files marked "dead" in the code-creep audit have zero live callers.  
**Risk:** 🟢 Zero — read-only  
**Files touched:** None (read-only grep and import tracing)

**Pre-checks:**
```bash
# Confirm ComponentShowcase is not routed
grep -rn "ComponentShowcase" client/src/ --include="*.tsx" --include="*.ts"

# Confirm MOCK_PLANS has no import sites
grep -rn "MOCK_PLANS" client/src/ --include="*.tsx" --include="*.ts"

# Confirm POPULAR_DOCTORS has no import sites
grep -rn "POPULAR_DOCTORS" client/src/ --include="*.tsx" --include="*.ts"

# Confirm compareRouter.comparePlans has no client callers
grep -rn "comparePlans\|compareRouter" client/src/ --include="*.tsx" --include="*.ts"

# Confirm calculateDrugCosts export is only used internally
grep -rn "calculateDrugCosts" server/ api/ --include="*.ts"
```

**Success criteria:** All outputs match the creep audit findings. Document any surprises before proceeding.

---

### Batch 0-B: Map all import paths for files that will move
**Purpose:** Before Phase 4 moves any file, every import site must be catalogued.  
**Risk:** 🟢 Zero — read-only  
**Files touched:** None

**Pre-checks:**
```bash
# All importers of formularyCalculator
grep -rn "formularyCalculator" server/ api/ client/src/ --include="*.ts" --include="*.tsx"

# All importers of shared/security/crypto
grep -rn "shared/security/crypto\|from.*crypto" server/ api/ --include="*.ts"

# All uses of STATE_CDN_URLS and CDN_BASE
grep -rn "STATE_CDN_URLS\|CDN_BASE\|cloudfront.net" server/ api/ --include="*.ts"

# All importers of quoteSession/* from outside the slice
grep -rn "from.*quoteSession" server/ --include="*.ts" | grep -v "quoteSession/"

# All uses of maskStr/maskEmail in router
grep -rn "maskStr\|maskEmail" server/ --include="*.ts"
```

**Success criteria:** Import map is documented as a comment at the top of each migration batch PR description.

---

### Batch 0-C: Audit test coverage baseline
**Purpose:** Know exactly which behaviors are already covered before adding tests in Phase 2.  
**Risk:** 🟢 Zero — read-only

**Pre-checks:**
```bash
# Run full test suite and capture baseline
cd /path/to/repo && npx vitest run --reporter=verbose 2>&1 | tee docs/test-baseline.txt

# List all test files
find . -name "*.test.ts" -o -name "*.test.tsx" | grep -v node_modules | sort
```

**Success criteria:** `docs/test-baseline.txt` committed. All tests green before Phase 2 begins.

---

## Phase 1 — Security & Safety Fixes
**Goal:** Eliminate the three committed-secret and auth-bypass risks that are dangerous regardless of refactor order. These are config changes only.

---

### Batch 1-A: Remove hardcoded secrets
**Purpose:** Eliminate source-controlled API key and default admin password before any other work.  
**Risk:** 🟡 Low — two env var reads become mandatory; deploy requires env var set  
**Audit sources:** CONST-02, CONST-03 (maintainability audit)

**Files changing:**
- `api/plans.ts` — remove `?? "d687412e7b53146b2631dc01974ad0a4"` fallback
- `server/adminRouter.ts` — remove `?? (process.env.NODE_ENV !== "production" ? "admin123" : "")` fallback

**Pre-checks:**
```bash
# Confirm both env vars are set in all target environments before merging
echo $CMS_MARKETPLACE_API_KEY
echo $ADMIN_PASSWORD

# Confirm the API key is the same value as the committed default
# (so the change does not alter the running system on first deploy)
```

**Changes:**

`api/plans.ts:62` — replace:
```ts
const CMS_API_KEY = process.env.CMS_MARKETPLACE_API_KEY ?? "d687412e7b53146b2631dc01974ad0a4";
```
with:
```ts
const CMS_API_KEY = process.env.CMS_MARKETPLACE_API_KEY;
if (!CMS_API_KEY) {
  throw new Error("[plans] CMS_MARKETPLACE_API_KEY is required");
}
```

`server/adminRouter.ts:137` — replace:
```ts
const expected = process.env.ADMIN_PASSWORD ?? (process.env.NODE_ENV !== "production" ? "admin123" : "");
```
with:
```ts
const expected = process.env.ADMIN_PASSWORD;
if (!expected) {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Admin not configured" });
}
```

**Post-checks:**
```bash
# Confirm no remaining hardcoded key patterns
grep -rn "d687412e7b53146b2631dc01974ad0a4\|admin123" server/ api/ --include="*.ts"
# Expected: no output

# Run plans-related tests
npx vitest run server/plans
```

**Rollback:** Revert the two file edits. No DB changes; no deploy artifact changes.

**Regression coverage required:** Existing test suite green. No new tests required — this is a startup guard, not a logic change.

---

### Batch 1-B: Fix Vercel function timeouts
**Purpose:** Prevent streaming functions from being killed by Vercel's default 60 s limit before their own 120 s abort fires.  
**Risk:** 🟢 Zero — config only  
**Audit source:** P1 (performance audit)

**Files changing:**
- `vercel.json` — add `functions` block

**Changes:**
```json
{
  "functions": {
    "api/compare-stream.ts":   { "maxDuration": 300, "memory": 1024 },
    "api/chat.ts":             { "maxDuration": 300, "memory": 1024 },
    "api/recommend-stream.ts": { "maxDuration": 300, "memory": 1024 },
    "api/plans.ts":            { "maxDuration": 30,  "memory": 512  },
    "api/bluebutton-callback.ts": { "maxDuration": 60, "memory": 512 }
  }
}
```

**Post-checks:**
```bash
# Confirm vercel.json is valid JSON
cat vercel.json | python3 -m json.tool

# Deploy to preview and confirm functions list shows updated durations
vercel deploy --prebuilt && vercel functions ls
```

**Rollback:** Revert `vercel.json`. Instant — no code change.

**Regression coverage required:** None. Config-only.

---

### Batch 1-C: Fix `invokeLLM` missing timeout
**Purpose:** Prevent indefinite hang if Forge API becomes unresponsive.  
**Risk:** 🟡 Low — adds a guard that only fires on genuine outage  
**Audit source:** P9 (performance audit)

**Files changing:**
- `server/_core/llm.ts` — add `AbortSignal.timeout(60_000)` to fetch

**Pre-checks:**
```bash
grep -n "fetch(" server/_core/llm.ts
npx vitest run server/healthProfile.test.ts  # baseline
```

**Changes:** In `invokeLLM()` fetch call, add `signal: AbortSignal.timeout(60_000)`.

**Post-checks:**
```bash
npx vitest run server/healthProfile.test.ts
```

**Rollback:** Remove the `signal` parameter.

**Regression coverage required:** `server/healthProfile.test.ts` must still pass.

---

## Phase 2 — Add Missing Tests
**Goal:** Build regression coverage around every behavior that will be touched in Phases 3–5 before touching it. No production code changes.

---

### Batch 2-A: Test streaming disconnect handling
**Purpose:** Before fixing compareStream's missing `res.destroyed` check, prove the missing behavior with a failing test.  
**Risk:** 🟢 Zero — test files only  
**Audit source:** P6 (performance audit)

**Files changing:**
- `server/compare.test.ts` — extend with disconnect scenario

**New tests to add:**
```ts
describe("compareStream disconnect", () => {
  it("aborts the Anthropic call when the response is destroyed mid-stream", async () => {
    // Arrange: mock Anthropic to return a slow stream
    // Act: call the stream handler; destroy res after 50ms
    // Assert: Anthropic abort was called; no further writes attempted
  });
});
```

**Post-checks:**
```bash
npx vitest run server/compare.test.ts
# New test must FAIL (proving the bug exists) before Batch 3-B fixes it
```

---

### Batch 2-B: Test pVerify token refresh
**Purpose:** Confirm the token cache behavior before extracting it to its own module.  
**Risk:** 🟢 Zero  
**Audit source:** Architecture integrity — eligibility slice refactor prerequisite

**Files changing:**
- `server/pverify.test.ts` — extend with token cache tests

**New tests to add:**
```ts
describe("getPverifyToken", () => {
  it("reuses a cached token that has not expired");
  it("fetches a new token when the cache is within the 60s buffer window");
  it("fetches a new token when cachedToken is null");
  it("does not expose the raw token in any log output"); // PHI guard
});
```

**Post-checks:**
```bash
npx vitest run server/pverify.test.ts
```

---

### Batch 2-C: Test plan loading and annotation
**Purpose:** Lock in the behavior of `getStateData`, `resolveZipToCounty`, `annotatePlans`, and `loadAdminOverrides` before extracting them to separate files.  
**Risk:** 🟢 Zero  
**Audit source:** Plans slice decomposition prerequisite

**Files changing:**
- `server/plans.test.ts` (new file)

**New tests to add:**
```ts
describe("getStateData", () => {
  it("returns cached data on second call without re-fetching CDN");
  it("evicts oldest entry when cache exceeds STATE_CACHE_MAX");
  it("throws with a clear error message when CDN returns non-200");
});

describe("annotatePlans", () => {
  it("adds rank field starting at 1");
  it("applies admin carrier disable list correctly");
  it("applies admin plan-level overrides correctly");
  it("returns empty array when given empty input");
});

describe("resolveZipToCounty", () => {
  it("returns cached county on second call without re-fetching CMS API");
  it("throws with a clear error message when CMS API returns non-200");
});
```

**Post-checks:**
```bash
npx vitest run server/plans.test.ts
# All new tests must pass against current (pre-refactor) code
```

---

### Batch 2-D: Test formulary calculator in isolation
**Purpose:** Verify drug cost calculation behavior before moving the file to `shared/`.  
**Risk:** 🟢 Zero  
**Audit source:** CFG-01 (formularyCalculator duplication), SRP-03

**Files changing:**
- `server/formulary.test.ts` (new file)

**New tests to add:**
```ts
describe("enrichPlansWithDrugCosts", () => {
  it("adds estimatedAnnualDrugCost field to each plan");
  it("returns 0 drug cost for a plan with no matching formulary entry");
  it("caps cost at OOP_CAP_2026 for high-cost drug scenarios");
  it("produces identical output when called twice with same input");  // pure function guard
  it("does not mutate the original plans array");  // immutability guard
});

describe("calculateDrugCosts", () => {
  it("returns correct monthly breakdown for a Tier 2 generic");
  it("applies correct deductible phase before coverage kicks in");
});
```

**Post-checks:**
```bash
npx vitest run server/formulary.test.ts
```

---

### Batch 2-E: Test admin route authentication enforcement
**Purpose:** Confirm every admin route rejects requests without a correct password before restructuring the auth check.  
**Risk:** 🟢 Zero  
**Audit source:** NEST-01, SRP-02 (admin router)

**Files changing:**
- `server/admin.test.ts` (new file, extend existing if present)

**New tests to add:**
```ts
describe("admin routes — auth enforcement", () => {
  const adminRoutes = [
    "getCarrierOverrides",
    "setCarrierOverride",
    "getPlansPage",
    "upsertPlanOverride",
    "getDataSources",
    "getSyncLogs",
    "triggerSync",
    "getCarriersForState",
    "getPlansForState",
  ];

  for (const route of adminRoutes) {
    it(`${route} returns UNAUTHORIZED when adminPassword is missing`, async () => {
      // call route without adminPassword input
      // assert TRPCError code === "UNAUTHORIZED"
    });

    it(`${route} returns UNAUTHORIZED when adminPassword is wrong`, async () => {
      // call route with wrong password
      // assert TRPCError code === "UNAUTHORIZED"
    });
  }
});
```

**Post-checks:**
```bash
npx vitest run server/admin.test.ts
# All 18+ tests must pass against current code
```

---

### Batch 2-F: Test quote session repository edge cases
**Purpose:** Lock in behavior of the PHI-sensitive session layer before any structural changes.  
**Risk:** 🟢 Zero  
**Audit source:** P11, P12 (session creation performance), plus existing PHI compliance coverage

**Files changing:**
- `server/quoteSession/quoteSession.test.ts` — extend

**New tests to add:**
```ts
describe("createSession", () => {
  it("returns a session ID and raw resume token");
  it("does NOT store the raw token — only the hash — in the DB");
  it("correctly encrypts all PHI fields before DB insert");
  it("createSession followed by loadByTokenHash returns identical decrypted data");
});

describe("loadByTokenHash", () => {
  it("extends expiresAt on every successful resume");
  it("returns null for an expired session token");
  it("returns null for an unknown token");
  it("appends an audit entry for each resume");
});
```

**Post-checks:**
```bash
npx vitest run server/quoteSession/
# All existing + new tests must pass
```

---

### Phase 2 gate

Before proceeding to Phase 3, all of the following must be true:

- [ ] `docs/test-baseline.txt` committed
- [ ] All original tests still pass (no regressions from test file additions)
- [ ] Batches 2-A through 2-F all green
- [ ] The Batch 2-A `compareStream` disconnect test is **failing** (proving the bug exists)

---

## Phase 3 — Low-Risk Cleanup
**Goal:** Remove dead code, consolidate duplicated constants, and fix silent error swallowing. No behavior changes. Each batch is independently mergeable.

---

### Batch 3-A: Delete confirmed dead code
**Purpose:** Remove the three dead exports confirmed in Batch 0-A.  
**Risk:** 🟡 Low — deletion  
**Audit source:** A1–A6 (code-creep audit)

**Files changing:**
- `client/src/pages/ComponentShowcase.tsx` — delete entire file
- `client/src/lib/mockData.ts` — delete `MOCK_PLANS` (lines ~1–800) and `POPULAR_DOCTORS` (lines ~800–1050); keep `POPULAR_RX_DRUGS` (still imported)
- `server/compareRouter.ts` — delete entire file (zero client callers confirmed in Batch 0-A)
- `server/formularyCalculator.ts` lines 598–626 — remove exported `calculateDrugCosts` (only used internally; internal calls unchanged)

**Pre-checks:**
```bash
# Re-run dead code grep from Batch 0-A to confirm nothing changed
grep -rn "ComponentShowcase\|MOCK_PLANS\|POPULAR_DOCTORS\|comparePlans\|compareRouter" \
  client/src/ server/ --include="*.ts" --include="*.tsx"
```

**Post-checks:**
```bash
npx vitest run
npx tsc --noEmit
# No TypeScript errors, no test regressions
```

**Rollback:** `git revert` the commit. No DB or deploy changes.

**Regression coverage required:** Existing test suite green. No new tests.

---

### Batch 3-B: Fix streaming error swallowing
**Purpose:** Replace empty catch blocks in streaming handlers with logging and client notification.  
**Risk:** 🟡 Low — changes error path behavior, not happy path  
**Audit source:** ERR-01, ERR-02 (maintainability audit)

**Files changing:**
- `api/chat.ts:236,305`
- `api/compare-stream.ts:166,234`
- `api/plans.ts:100,118`
- `api/doctors.ts:45,76`
- `api/provider-network.ts:41`
- `server/providerNetwork.ts:99`
- `server/_core/dataApi.ts:59`
- `server/quoteSession/repository.ts:333` (if applicable)

**Standard replacement pattern:**

Replace:
```ts
} catch { /* skip */ }
```

With (for streaming chunk writes):
```ts
} catch (err) {
  console.error("[compare-stream] chunk write error:", err);
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify({ type: "error", message: "Stream interrupted" })}\n\n`);
    res.end();
  }
  return;
}
```

With (for non-streaming API fetches that currently silently fail):
```ts
} catch (err) {
  console.error("[plans] CDN fetch failed:", stateAbbr, err);
  throw err; // let the outer handler return a 500
}
```

**Pre-checks:**
```bash
# Baseline — confirm test for disconnect is still failing (Batch 2-A)
npx vitest run server/compare.test.ts
```

**Post-checks:**
```bash
npx vitest run server/compare.test.ts
# The disconnect test added in Batch 2-A must NOW PASS
npx vitest run  # full suite
```

**Rollback:** Revert the file edits. Error behavior returns to silent.

**Regression coverage required:** Batch 2-A test must transition from failing to passing. Full suite green.

---

### Batch 3-C: Consolidate STATE_CDN_URLS into shared/const.ts
**Purpose:** Eliminate three copies of the CDN map; updates to CDN URLs become a single-file change.  
**Risk:** 🟡 Low — pure import redirect  
**Audit source:** CONST-01, SRP-01 (maintainability audit)

**Files changing:**
- `shared/const.ts` — add `CDN_BASE` and `STATE_CDN_URLS`
- `server/plansRouter.ts` — remove local declaration; import from `shared/const.ts`
- `server/adminRouter.ts` — remove local declaration; import from `shared/const.ts`
- `api/plans.ts` — remove local declaration; import from `shared/const.ts`

**Pre-checks:**
```bash
# Confirm all three copies are identical (diff them)
diff <(grep -A 52 "CDN_BASE" server/plansRouter.ts) <(grep -A 27 "CDN_BASE" server/adminRouter.ts)
diff <(grep -A 52 "CDN_BASE" server/plansRouter.ts) <(grep -A 52 "CDN_BASE" api/plans.ts)
```

**Post-checks:**
```bash
grep -rn "cloudfront.net" server/ api/ --include="*.ts"
# Expected: only shared/const.ts matches

npx vitest run
npx tsc --noEmit
```

**Rollback:** Revert `shared/const.ts` addition; restore local declarations in the three files.

**Regression coverage required:** Batch 2-C plan tests must stay green.

---

### Batch 3-D: Fix QuoteHandoffContext `any[]` types
**Purpose:** Replace `doctors: any[]` and `drugs: any[]` in context with proper types.  
**Risk:** 🟡 Low — type-only change; runtime behavior identical  
**Audit source:** Category A (maintainability audit `any` section)

**Files changing:**
- `client/src/contexts/QuoteHandoffContext.tsx` — `any[]` → `Doctor[]`, `RxDrug[]`
- `client/src/pages/Plans.tsx:236,242` — update mapping expressions that use `doc: any` and `d: any`

**Pre-checks:**
```bash
npx tsc --noEmit  # baseline — see current error count
```

**Post-checks:**
```bash
npx tsc --noEmit  # error count must not increase; ideally decreases
npx vitest run
```

**Rollback:** Revert type annotations.

**Regression coverage required:** TypeScript must compile cleanly. No new test needed.

---

### Batch 3-E: Add `estimatedAnnualDrugCost` to plan type; remove `as any` casts
**Purpose:** Eliminate the `(plan as any).estimatedAnnualDrugCost` pattern across 6 files.  
**Risk:** 🟡 Low — additive optional field; no runtime change  
**Audit source:** Category B (maintainability audit `any` section)

**Files changing:**
- `client/src/lib/types.ts` — add `estimatedAnnualDrugCost?: number` to the plan type
- `client/src/pages/Plans.tsx:107,127,157,158,165,166` — remove `as any` casts
- `client/src/components/PlanCard.tsx:108` — remove `const planAny = plan as any`
- `client/src/components/AIRecommendationBanner.tsx:18,29` — standardize field name
- `client/src/components/AITop3Cards.tsx:53`
- `client/src/features/plan-cost/lib/annualCostCalculator.ts:89`

**Note:** `AIRecommendationBanner` uses `estAnnualDrugCost` while other files use `estimatedAnnualDrugCost`. Standardize to `estimatedAnnualDrugCost`.

**Pre-checks:**
```bash
grep -rn "estAnnualDrugCost\|estimatedAnnualDrugCost" client/src/ --include="*.tsx" --include="*.ts"
# Document all uses before changing
```

**Post-checks:**
```bash
npx tsc --noEmit
grep -rn "as any" client/src/components/PlanCard.tsx client/src/pages/Plans.tsx
# Expected: zero remaining in these files
```

**Rollback:** Revert type addition and cast removals.

**Regression coverage required:** TypeScript clean. Existing tests green.

---

### Batch 3-F: Extract drug data from calculator
**Purpose:** Separate static drug data from calculation logic so each can be changed independently.  
**Risk:** 🟡 Low — pure file split; no logic change  
**Audit source:** SRP-03 (maintainability audit)

**Files changing:**
- `server/formularyCalculator.ts` — remove `DRUG_DATABASE` (lines 1–402)
- `shared/formulary/database.ts` (new) — holds `DRUG_DATABASE` export
- `server/formularyCalculator.ts` — add `import { DRUG_DATABASE } from "../../shared/formulary/database"`

**Pre-checks:**
```bash
npx vitest run server/formulary.test.ts  # Batch 2-D tests must be green
```

**Post-checks:**
```bash
npx vitest run server/formulary.test.ts
npx tsc --noEmit
```

**Rollback:** Move `DRUG_DATABASE` back inline; delete `shared/formulary/database.ts`.

**Regression coverage required:** All Batch 2-D tests must pass.

---

### Phase 3 gate

Before proceeding to Phase 4:

- [ ] All Phase 3 batches merged and deployed to staging
- [ ] No new TypeScript errors (`tsc --noEmit` clean)
- [ ] Full test suite still green
- [ ] `compareStream` disconnect test (Batch 2-A) is now passing
- [ ] Zero remaining `cloudfront.net` strings outside `shared/const.ts`
- [ ] Zero remaining `as any` in `Plans.tsx`, `PlanCard.tsx`, `AIRecommendationBanner.tsx`

---

## Phase 4 — Architectural Boundary Fixes
**Goal:** Move shared logic behind proper shared modules; fix cross-slice leaks; enforce admin auth via middleware.

---

### Batch 4-A: Move formularyCalculator to shared/
**Purpose:** Eliminate the `server/` vs `api/` copy; both import from one source.  
**Risk:** 🟠 Medium — moves file; all importers must update  
**Audit source:** CFG-01 (maintainability audit), code-creep B5

**Files changing:**
- `shared/formulary/calculator.ts` (new) — contents of `server/formularyCalculator.ts` (minus `DRUG_DATABASE`, already extracted in Batch 3-F)
- `server/formularyCalculator.ts` — delete
- `api/formularyCalculator.ts` — delete
- `server/plansRouter.ts` — update import
- `api/plans.ts` — update import

**Pre-checks:**
```bash
# Confirm all importers from Batch 0-B inventory
grep -rn "formularyCalculator" server/ api/ client/src/ --include="*.ts" --include="*.tsx"

# Batch 2-D tests green
npx vitest run server/formulary.test.ts
```

**Post-checks:**
```bash
npx vitest run server/formulary.test.ts
npx vitest run  # full suite
npx tsc --noEmit

# Confirm no remaining copies
find . -name "formularyCalculator.ts" | grep -v node_modules
# Expected: only shared/formulary/calculator.ts
```

**Rollback:** Restore both deleted files; restore import paths.

**Regression coverage required:** All Batch 2-D tests pass. Full suite green.

---

### Batch 4-B: Move PlanInputSchema and compare prompt builders to shared/
**Purpose:** Eliminate schema duplication; `api/compare-stream.ts` uses typed builders instead of `any`.  
**Risk:** 🟠 Medium — changes internal types in compare handlers  
**Audit source:** VAL-02 (maintainability audit), SRP-04

**Files changing:**
- `shared/compare/schemas.ts` (new) — `BenefitDetailSchema`, `PlanInputSchema`, `PlanInput` type
- `shared/compare/promptBuilder.ts` (new) — `build2PlanPrompt`, `build3PlanPrompt` (typed; no `any`)
- `server/compareStream.ts` — remove local schema definitions; import from `shared/compare/`
- `server/compareRouter.ts` — already deleted in Batch 3-A
- `api/compare-stream.ts` — remove local `PlanInput` interface and `any` prompt builders; import from `shared/compare/`

**Pre-checks:**
```bash
# Confirm compareRouter.ts is gone (Batch 3-A)
ls server/compareRouter.ts 2>/dev/null && echo "EXISTS — Batch 3-A incomplete"

# Baseline compare tests
npx vitest run server/compare.test.ts
```

**Post-checks:**
```bash
npx tsc --noEmit

# Confirm no remaining `any` in compare-stream
grep -n ": any\|as any" api/compare-stream.ts server/compareStream.ts
# Expected: zero

npx vitest run server/compare.test.ts
```

**Rollback:** Restore local schema definitions in each file; delete `shared/compare/`.

**Regression coverage required:** Batch 2-A disconnect test still passing. `server/compare.test.ts` green.

---

### Batch 4-C: Enforce adminProcedure for all admin routes
**Purpose:** Centralize auth enforcement so no new admin route can silently skip the password check.  
**Risk:** 🟠 Medium — changes how auth is checked; must verify all admin routes still work  
**Audit source:** NEST-01 (maintainability audit), architecture integrity LEAK-07

**Files changing:**
- `server/_core/trpc.ts` — add or verify `adminProcedure` that calls `checkAdminPassword(input.adminPassword)` in middleware
- `server/adminRouter.ts` — update all 9 route handlers to use `adminProcedure` instead of inline `checkAdminPassword(input.adminPassword)`; remove the inline `checkAdminPassword` function definition

**Pre-checks:**
```bash
# Confirm Batch 2-E admin auth tests are green
npx vitest run server/admin.test.ts

# Count current checkAdminPassword call sites
grep -c "checkAdminPassword" server/adminRouter.ts
# Expected: matches number of admin routes (9)
```

**Changes:**

In `server/_core/trpc.ts`:
```ts
export const adminProcedure = publicProcedure
  .input(z.object({ adminPassword: z.string().min(1) }))
  .use(async ({ input, next }) => {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected || input.adminPassword !== expected) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid admin credentials" });
    }
    return next();
  });
```

In `server/adminRouter.ts`:
- Remove `checkAdminPassword` function definition
- Replace `protectedProcedure.input(adminInput.merge(otherInput))` pattern with `adminProcedure.input(otherInput)` for each route

**Post-checks:**
```bash
# All 18+ auth enforcement tests from Batch 2-E must pass
npx vitest run server/admin.test.ts

# Verify no remaining standalone checkAdminPassword calls
grep -n "checkAdminPassword" server/adminRouter.ts
# Expected: zero
```

**Rollback:** Restore inline `checkAdminPassword` calls; revert `trpc.ts`.

**Regression coverage required:** All Batch 2-E tests must pass. Full suite green.

---

### Batch 4-D: Add Zod validation to all api/ handlers
**Purpose:** Establish consistent input validation at the serverless boundary; prevent malformed requests from reaching LLM or DB.  
**Risk:** 🟡 Low — additive validation; valid existing requests are unchanged  
**Audit source:** VAL-01 (maintainability audit)

**Files changing:** All `api/*.ts` files that currently lack schema validation at the top of the handler:
- `api/compare-stream.ts` — add body validation against `PlanInputSchema` (imported from `shared/compare/schemas.ts` — already done in Batch 4-B)
- `api/chat.ts` — add message array validation
- `api/voice-webhook.ts` — add tool call structure validation
- `api/bluebutton-callback.ts` — add `code` + `state` param validation
- `api/doctors.ts` — add `name` + `zip` validation
- `api/provider-network.ts` — add `plans[]` + `doctors[]` validation

**Standard pattern:**
```ts
import { z } from "zod";

const BodySchema = z.object({ /* ... */ });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
  }
  const body = parsed.data; // typed from here
  // ...
}
```

**Pre-checks:**
```bash
npx tsc --noEmit  # baseline
```

**Post-checks:**
```bash
npx tsc --noEmit  # must not introduce new errors
npx vitest run

# Manual smoke test: send a malformed body to each endpoint and confirm 400 response
curl -X POST https://staging.example.com/api/compare-stream \
  -H "Content-Type: application/json" \
  -d '{"invalid": true}' \
  -w "\nHTTP %{http_code}\n"
# Expected: HTTP 400 with issues array
```

**Rollback:** Remove the validation blocks. Requests pass through as before.

**Regression coverage required:** TypeScript clean. Existing integrations must still receive 200 on valid inputs.

---

### Batch 4-E: Unify maskEmail/maskStr with shared maskValue
**Purpose:** Remove duplicate masking functions in the quoteSession router.  
**Risk:** 🟡 Low — identical behavior; only call site changes  
**Audit source:** NAME-03 (maintainability audit)

**Files changing:**
- `server/quoteSession/router.ts` — delete local `maskStr()` and `maskEmail()`; import `maskValue` from `shared/security/crypto.ts`
- Update call sites in same file

**Pre-checks:**
```bash
# Confirm maskValue exists in shared and has same semantics
grep -n "maskValue" shared/security/crypto.ts
grep -n "maskStr\|maskEmail" server/quoteSession/router.ts
```

**Post-checks:**
```bash
npx vitest run server/quoteSession/
npx tsc --noEmit
```

**Rollback:** Restore local functions.

**Regression coverage required:** All `quoteSession/` tests green including PHI compliance.

---

### Batch 4-F: Extract server-side cache into planLoader module
**Purpose:** Separate the CDN cache management from the route handler; sets up for future TTL fix.  
**Risk:** 🟠 Medium — moves caching logic; behavior must be identical  
**Audit source:** SRP-01, P3, P5 (audits)

**Files changing:**
- `server/plans/planLoader.ts` (new) — `getStateData()`, `stateCache`, `zipCache`, `resolveZipToCounty()`, `STATE_CACHE_MAX`, `ZIP_CACHE_MAX`
- `server/plansRouter.ts` — remove extracted logic; import from `./plans/planLoader`

**Pre-checks:**
```bash
npx vitest run server/plans.test.ts  # Batch 2-C tests must be green
```

**Post-checks:**
```bash
npx vitest run server/plans.test.ts
npx vitest run
npx tsc --noEmit
```

**Rollback:** Inline the extracted functions back into `plansRouter.ts`.

**Regression coverage required:** All Batch 2-C tests pass.

---

### Phase 4 gate

Before proceeding to Phase 5:

- [ ] `shared/formulary/calculator.ts` is the single source of truth
- [ ] `shared/compare/schemas.ts` is the single source of truth for compare schemas
- [ ] Zero `any` parameters in `api/compare-stream.ts` prompt builders
- [ ] All admin routes use `adminProcedure`; `checkAdminPassword` deleted from `adminRouter.ts`
- [ ] All `api/` handlers validate inputs with Zod
- [ ] Full test suite green
- [ ] `tsc --noEmit` clean

---

## Phase 5 — Performance Improvements
**Goal:** Apply the quick wins from the performance audit. Each batch is independently deployable.

---

### Batch 5-A: Memoize PlanCard and debounce FilterSidebar
**Purpose:** Eliminate 100+ re-renders per filter toggle.  
**Risk:** 🟡 Low — memoization is transparent to users; requires correct comparator  
**Audit source:** C2, C3 (performance audit)

**Files changing:**
- `client/src/components/PlanCard.tsx` — wrap in `React.memo` with custom comparator
- `client/src/pages/Plans.tsx` — add 150 ms debounce on filter state update

**Pre-checks:**
```bash
# Capture render count baseline with React DevTools Profiler
# (manual step — document in PR)
```

**Changes:**

`PlanCard.tsx`:
```tsx
export const PlanCard = React.memo(function PlanCard(props: PlanCardProps) {
  // ... existing implementation unchanged
}, (prev, next) =>
  prev.plan.id === next.plan.id &&
  prev.isFavorited === next.isFavorited &&
  prev.isCompareActive === next.isCompareActive &&
  prev.doctorNetworkStatus === next.doctorNetworkStatus
);
```

`Plans.tsx` — add `useDebounce` hook (150 ms):
```tsx
const [stagedFilters, setStagedFilters] = useState(DEFAULT_FILTERS);
const filters = useDebounce(stagedFilters, 150);
// Pass setStagedFilters to FilterSidebar; derive filteredPlans from filters (debounced)
```

**Post-checks:**
```bash
npx vitest run
# Visual: toggle a filter checkbox and observe render count in React DevTools
# Expected: only newly visible/hidden plans re-render, not all 100+
```

**Rollback:** Remove `React.memo` wrapper; remove debounce.

**Regression coverage required:** Existing filter behavior must be identical. Favorites, compare selection, enrollment links must all work on filtered plans.

---

### Batch 5-B: Cache loadAdminOverrides with 60-second TTL
**Purpose:** Eliminate 2 DB queries on every warm plan request.  
**Risk:** 🟡 Low — admin override changes reflect within 60 s (acceptable for this data)  
**Audit source:** P3 (performance audit)

**Files changing:**
- `server/plans/planLoader.ts` (extracted in Batch 4-F) — add TTL cache wrapper around `loadAdminOverrides()`

**Changes:**
```ts
let overridesCache: { data: AdminOverrides; expiresAt: number } | null = null;

export async function loadAdminOverrides(db: DrizzleDb): Promise<AdminOverrides> {
  if (overridesCache && Date.now() < overridesCache.expiresAt) {
    return overridesCache.data;
  }
  const data = await fetchOverridesFromDb(db);
  overridesCache = { data, expiresAt: Date.now() + 60_000 };
  return data;
}
```

**Post-checks:**
```bash
npx vitest run server/plans.test.ts
# Add specific assertion: second call within 60s does not call db.select()
# Verify admin override changes apply within 60s in staging
```

**Rollback:** Remove TTL cache wrapper; restore direct DB calls.

**Regression coverage required:** Batch 2-C plan tests green. Admin tests confirm overrides apply.

---

### Batch 5-C: Add cache TTL to state CDN data
**Purpose:** Prevent stale plan data from being served indefinitely after a CDN update.  
**Risk:** 🟡 Low — adds expiry; warm cache still used within TTL window  
**Audit source:** P5 (performance audit)

**Files changing:**
- `server/plans/planLoader.ts` — change cache entry type from `Record<string, unknown[]>` to `{ data: Record<string, unknown[]>; loadedAt: number }`; reject entries older than 24 h

**Post-checks:**
```bash
npx vitest run server/plans.test.ts
# New test: load state → wait past TTL (mock Date.now) → confirm re-fetch occurs
```

**Rollback:** Revert cache entry type to plain data.

---

### Batch 5-D: Fix compareStream client disconnect detection
**Purpose:** Stop streaming to closed connections; free Anthropic API slots sooner.  
**Risk:** 🟡 Low — only changes behavior on disconnect  
**Audit source:** P6 (performance audit)

**Files changing:**
- `server/compareStream.ts` — add `res.destroyed` check inside streaming loop (mirrors existing pattern in `recommendStream.ts`)

**Pre-checks:**
```bash
# Confirm Batch 2-A disconnect test is still passing (from Batch 3-B)
npx vitest run server/compare.test.ts
```

**Changes:** Inside the SSE streaming loop in `compareStream.ts`:
```ts
for await (const chunk of stream) {
  if (res.destroyed) {
    controller.abort();
    break;
  }
  // existing write logic
}
```

**Post-checks:**
```bash
npx vitest run server/compare.test.ts
```

**Rollback:** Remove the `res.destroyed` check.

**Regression coverage required:** Batch 2-A test passing. Full suite green.

---

### Batch 5-E: Parallelize createSession child row inserts
**Purpose:** Reduce session creation from 10+ sequential DB roundtrips to 3.  
**Risk:** 🟠 Medium — changes DB write pattern; must be wrapped in a transaction  
**Audit source:** P11 (performance audit)

**Files changing:**
- `server/quoteSession/repository.ts` — wrap `writeChildRows` and `appendAudit` in `Promise.all` inside a DB transaction

**Pre-checks:**
```bash
# Batch 2-F tests must be green
npx vitest run server/quoteSession/
```

**Changes:**
```ts
await db.transaction(async (tx) => {
  await tx.insert(quoteSessions).values({ ... });
  await Promise.all([
    writeChildRows(tx, id, input),
    appendAudit(tx, id, "session_created", clientIp),
  ]);
});
```

**Post-checks:**
```bash
npx vitest run server/quoteSession/
# Specifically: "createSession followed by loadByTokenHash returns identical decrypted data"
# must still pass — confirming data written correctly
```

**Rollback:** Revert to sequential awaits.

**Regression coverage required:** All Batch 2-F tests must pass.

---

### Batch 5-F: Add route-level code splitting
**Purpose:** Reduce initial bundle size by lazy-loading pages not needed on first paint.  
**Risk:** 🟡 Low — transparent to users; add Suspense fallbacks to prevent blank screen  
**Audit source:** C1 (performance audit)

**Files changing:**
- `client/src/App.tsx` — convert static imports to `React.lazy()`; wrap all routes in `<Suspense>`

**Pre-checks:**
```bash
# Capture current bundle size
npm run build 2>&1 | grep -E "chunk|asset"
```

**Changes:**
```tsx
// Before
import Plans from "./pages/Plans";
import AICompare from "./pages/AICompare";

// After
const Plans     = React.lazy(() => import("./pages/Plans"));
const AICompare = React.lazy(() => import("./pages/AICompare"));
// ... all page-level components

// Router
<Suspense fallback={<DashboardLayoutSkeleton />}>
  {/* existing routes */}
</Suspense>
```

**Post-checks:**
```bash
npm run build 2>&1 | grep -E "chunk|asset"
# Verify chunk count increased; largest chunk size decreased

# Navigate to each route in staging and confirm no blank screen
# Confirm DashboardLayoutSkeleton renders during load
```

**Rollback:** Revert to static imports; remove Suspense wrapper.

**Regression coverage required:** All routes must navigate correctly. No blank screens.

---

### Phase 5 gate

Before proceeding to Phase 6:

- [ ] React DevTools confirms PlanCard re-renders reduced by >90% on filter toggle
- [ ] Admin overrides cache confirmed working (changes apply within 60 s)
- [ ] compareStream disconnect confirmed aborting Anthropic call
- [ ] Bundle size reduced (document delta in PR)
- [ ] Full test suite green on staging

---

## Phase 6 — Final Hardening and Documentation
**Goal:** Lock in the improvements, add observability, and document the final state.

---

### Batch 6-A: Add structured logging baseline
**Purpose:** Replace ad-hoc `console.log/warn/error` with consistent tagged logging that can be queried in Vercel logs.  
**Risk:** 🟡 Low — additive; no behavior change  
**Audit source:** Maintainability audit (observability section)

**Files changing:** All `server/` and `api/` files that currently use `console.*`

**Pattern:** Standardize on:
```ts
// Each module defines its own tagged logger:
const log = {
  info:  (...args: unknown[]) => console.log("[plans]", ...args),
  warn:  (...args: unknown[]) => console.warn("[plans]", ...args),
  error: (...args: unknown[]) => console.error("[plans]", ...args),
};

// Usage:
log.info("State data loaded:", stateAbbr, "plans:", plans.length);
log.error("CDN fetch failed:", stateAbbr, err);
```

This is not a full logging framework — it is a consistent tag + severity pattern that makes Vercel log filtering (`[plans]`, `[pVerify]`, `[compare]`) reliable.

**Post-checks:**
```bash
# Confirm no naked console.log in server/ or api/
grep -rn "^  console\.\|^    console\." server/ api/ --include="*.ts"
# All remaining should be tagged through the module-level log object
```

---

### Batch 6-B: Add pVerify mock warning
**Purpose:** Make credential misconfiguration loudly visible in logs instead of silently returning fake data.  
**Risk:** 🟢 Zero  
**Audit source:** P8 (performance audit)

**Files changing:**
- `server/pverifyRouter.ts` — add prominent warning when mock path is taken; remove the 1.2 s artificial sleep

**Changes:**
```ts
if (!process.env.PVERIFY_CLIENT_ID || !process.env.PVERIFY_CLIENT_SECRET) {
  console.error(
    "[pVerify] ⚠️  PVERIFY credentials missing — returning MOCK eligibility data. " +
    "This must not happen in production. Set PVERIFY_CLIENT_ID and PVERIFY_CLIENT_SECRET."
  );
  // Remove: await new Promise((resolve) => setTimeout(resolve, 1200));
  return buildMockEligibilityResult(input);
}
```

**Post-checks:**
```bash
npx vitest run server/pverify.test.ts
```

---

### Batch 6-C: Document the target slice structure in CLAUDE.md
**Purpose:** Ensure the next engineer knows the architecture standard without reading all four audit docs.  
**Risk:** 🟢 Zero  

**Files changing:**
- `CLAUDE.md` (or `docs/ARCHITECTURE.md` if no CLAUDE.md exists) — add or update with:
  - Vertical slice directory convention (from maintainability audit Part 13)
  - Naming rules table
  - PHI boundary functions list
  - Do-not-touch list (from architecture audit)
  - Link to all four audit documents

---

### Batch 6-D: Final TypeScript strict-mode pass
**Purpose:** Catch any remaining `any` gaps that accumulated during the phases.  
**Risk:** 🟡 Low — type-only; may surface latent bugs  

**Files changing:** Any file that `tsc --strict` flags

**Pre-checks:**
```bash
npx tsc --noEmit --strict 2>&1 | wc -l  # baseline error count
```

**Post-checks:**
```bash
npx tsc --noEmit --strict 2>&1 | wc -l  # must be less than or equal baseline
```

**Goal:** Not zero errors (strict on a large existing codebase takes months), but trending down. Document the baseline count and the post-Phase-6 count in the CLAUDE.md.

---

### Batch 6-E: Run full regression suite and smoke test all user flows
**Purpose:** Confirm nothing regressed across all six phases before closing the hardening branch.

**Flows to manually test on staging:**

| Flow | Key assertions |
|---|---|
| ZIP entry → plan grid | Plans load, filters work, drug costs display |
| Drug add → plan cost update | Cost updates without full page reload |
| Plan compare (2 plans) | SSE streams; compare modal renders |
| Plan compare (3 plans) | SSE streams; correct 3-plan layout |
| Session save → resume | Token works; PHI decrypts correctly |
| MBI eligibility verify | Real pVerify call returns (not mock) |
| Admin login → carrier toggle | Override applies within 60 s on plan grid |
| Admin sync trigger | Sync runs; log entry appears in sync history |
| Voice webhook | Vapi call returns plan recommendations |
| AI recommend stream | Streaming narrative renders; disconnect aborts server |

**Post-checks:**
```bash
npx vitest run  # full suite — must be 100% green
npx tsc --noEmit  # no errors
```

---

## Full Phase Summary

| Phase | Batches | Risk level | Purpose |
|---|---|---|---|
| 0 | 0-A, 0-B, 0-C | 🟢 Zero | Inventory and test baseline |
| 1 | 1-A, 1-B, 1-C | 🟡/🟢 Low | Security fixes — secrets, timeouts, LLM hang |
| 2 | 2-A through 2-F | 🟢 Zero | Add missing test coverage around fragile code |
| 3 | 3-A through 3-F | 🟡 Low | Delete dead code, fix error handling, consolidate constants |
| 4 | 4-A through 4-F | 🟠 Medium | Architectural boundary fixes — shared modules, admin auth, API validation |
| 5 | 5-A through 5-F | 🟡/🟠 Low–Medium | Performance quick wins |
| 6 | 6-A through 6-E | 🟡/🟢 Low | Observability, documentation, final verification |

**Total estimated effort (excluding Phase 0 which is research):**
- Phase 1: ~2 h
- Phase 2: ~6 h
- Phase 3: ~5 h
- Phase 4: ~8 h
- Phase 5: ~6 h
- Phase 6: ~4 h
- **Total: ~31 hours of engineering work across ~6–8 weeks at sustainable pace**

---

## Global constraints

1. **One batch = one PR.** Never combine two batches in the same PR.
2. **Phase gate must be verified before the next phase begins.** A failing phase gate blocks all subsequent batches.
3. **Every PR must include:** pre-check output, post-check output, rollback instructions.
4. **No batch may change user-visible behavior** except Batch 5-A (memoization, which changes render performance only) and Batch 5-F (code splitting, which changes load order only).
5. **PHI-touching files (`quoteSession/`, `shared/security/`) require explicit PHI compliance test sign-off** before merge, not just "tests green."
6. **Staging deploy is required for every Phase 4+ batch** before merging to main.
