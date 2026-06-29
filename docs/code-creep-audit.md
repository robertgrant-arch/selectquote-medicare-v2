# Code Creep Audit
**Branch:** `feat/vertical-slices-prod`  
**Date:** 2026-06-28  
**Method:** Full import-graph analysis, dead-export verification, line-by-line duplicate detection.

> **Constraint:** No behavior changes proposed. Every removal or refactor in this document preserves all user-visible functionality.

---

## Quick-reference severity scale

| Symbol | Meaning |
|---|---|
| 🔴 | Delete — confirmed dead, safe to remove |
| 🟠 | Consolidate — live code with a confirmed duplicate; one copy survives |
| 🟡 | Refactor — live code that has grown past its intended scope |
| 🔵 | Investigate — suspected dead; needs one more verification step before removal |

---

## 1. Categorized Code Creep Issues

---

### Category A — Confirmed Dead Code

#### A1 🔴 `ComponentShowcase.tsx` — 1,437-line orphaned page

| | |
|---|---|
| **File** | `client/src/pages/ComponentShowcase.tsx` |
| **Lines** | 1,437 |
| **Why creep** | Not imported anywhere. Not routed in `App.tsx`. Confirmed by exhaustive grep: zero references outside the file itself. This is a UI component gallery used during initial development and never removed. |
| **Safe to remove** | Yes — no route, no import, no test references it. |
| **Refactor instead** | No. If a component gallery is needed again, Storybook or a dev-only route is the right tool. |
| **Blast radius** | Zero. |

---

#### A2 🔴 `MOCK_PLANS` export in `mockData.ts` — 24 plan objects, never imported

| | |
|---|---|
| **File** | `client/src/lib/mockData.ts:16` |
| **Lines** | ~215 (lines 16–230) |
| **Why creep** | `MOCK_PLANS` is exported but never imported by any file in the project. Confirmed by full grep. The two production consumers of `mockData.ts` import only `POPULAR_RX_DRUGS`. |
| **Safe to remove** | Yes — zero import sites. |
| **Refactor instead** | No. If needed for development, add it to a `__fixtures__/` directory and gate behind `import.meta.env.DEV`. |
| **Blast radius** | Zero. |

---

#### A3 🔴 `POPULAR_DOCTORS` export in `mockData.ts` — 16 synthetic doctor records, never imported

| | |
|---|---|
| **File** | `client/src/lib/mockData.ts:1231` |
| **Lines** | ~53 (lines 1231–1284) |
| **Why creep** | Same as A2. `POPULAR_DOCTORS` is exported but confirmed unused across the entire codebase. |
| **Safe to remove** | Yes — zero import sites. |
| **Refactor instead** | No. |
| **Blast radius** | Zero. |

---

#### A4 🔴 `calculateDrugCosts` — exported but used only internally

| | |
|---|---|
| **File** | `server/formularyCalculator.ts:474` (and its copy `api/formularyCalculator.ts:474`) |
| **Why creep** | `calculateDrugCosts` is exported from both files. It is called only inside the same file, within `enrichPlansWithDrugCosts()` (line 616). No external caller imports it. The export is unused. |
| **Safe to remove** | Yes — remove the `export` keyword. Keep the function itself (it is used internally). |
| **Refactor instead** | No — just drop `export`. |
| **Blast radius** | Zero if made private. Apply to both copies simultaneously. |

---

#### A5 🔴 `DrugCostBreakdown` and `FormularyResult` — exported types with zero external consumers

| | |
|---|---|
| **File** | `server/formularyCalculator.ts:447,456` (and `api/formularyCalculator.ts:447,456`) |
| **Why creep** | Both interfaces are exported but never imported outside the files that define them. They are implementation details of the formulary calculation, not a public API surface. |
| **Safe to remove** | Yes — remove `export` from both in both copies. |
| **Blast radius** | Zero. |

---

#### A6 🔴 `server/index.ts` — production static-file server that is superseded by `_core/index.ts`

| | |
|---|---|
| **File** | `server/index.ts` (919 bytes) |
| **Why creep** | `package.json` "start" script points to `dist/index.js`, which compiles from this file. But `server/_core/index.ts` is the full production server (tRPC, plans, AI, auth). `server/index.ts` is a stripped-down static-file-only server with no API routes. On Vercel, neither runs — `api/*.ts` serverless functions handle all API traffic. Outside Vercel, the static server silently drops all API calls. This file serves no valid deployment scenario and creates confusion about which file is canonical. |
| **Safe to remove** | Yes — but update `package.json`:`start` to point at `server/_core/index.ts` (or `dist/_core/index.js` after build). |
| **Refactor instead** | Update the "start" script only. |
| **Blast radius** | Low — only `npm start` is affected. Dev and Vercel are unaffected. |

---

### Category B — Confirmed Duplicates

#### B1 🟠 `api/formularyCalculator.ts` — 626-line verbatim copy of `server/formularyCalculator.ts`

| | |
|---|---|
| **Files** | `server/formularyCalculator.ts` (626L) and `api/formularyCalculator.ts` (626L) |
| **Why creep** | Byte-for-byte duplicate. `api/plans.ts` imports from `api/formularyCalculator.ts`; `server/plansRouter.ts` imports from `server/formularyCalculator.ts`. Both copies define the same exports at the same line numbers. |
| **Safe to remove** | Yes — delete `api/formularyCalculator.ts`. Update `api/plans.ts` to import `enrichPlansWithDrugCosts` from `../server/formularyCalculator`. |
| **Blast radius** | Low — one import path change in `api/plans.ts`. |

---

#### B2 🟠 `PlanInputSchema` — identical Zod schema defined in two server files

| | |
|---|---|
| **Files** | `server/compareStream.ts:23` and `server/compareRouter.ts:55` |
| **Why creep** | Both files define a `PlanInputSchema` with identical fields (id, carrier, planName, planType, snpType, premium, deductible, maxOutOfPocket, partBPremiumReduction, starRating, copays, rxDrugs, extraBenefits, networkSize, enrollmentPeriod, effectiveDate, isBestMatch, isMostPopular, isNewPlan, contractId, planId). `compareRouter.ts` additionally defines `CopaysSchema`, `RxDrugsSchema`, `BenefitDetailSchema`, `ExtraBenefitsSchema`, `StarRatingSchema` as named sub-schemas. `compareStream.ts` inlines them. |
| **Safe to remove** | Yes — extract to a shared location (e.g., `server/compare/schemas.ts`). Both files import from there. |
| **Blast radius** | Low — two import changes. No behavior change. |

---

#### B3 🟠 `build2PlanPrompt` / `build3PlanPrompt` — duplicate prompt functions with diverging types

| | |
|---|---|
| **Files** | `server/compareStream.ts:116,140` (typed as `PlanInput`) and `api/compare-stream.ts:54,77` (typed as `any`) |
| **Why creep** | The two functions are the same prompt-construction logic, defined twice. The Vercel version uses `any`, so type errors are silenced rather than caught. This is the production delivery path on Vercel. |
| **Safe to remove** | Consolidate into `server/compare/prompts.ts`; both files import. Do not delete either delivery handler — only the inline logic. |
| **Blast radius** | Medium — requires extracting to a new file and verifying the shared module is accessible from `api/`. One import change per file. |

---

#### B4 🟠 CMS ZIP API URL and fetch — same call in three files

| | |
|---|---|
| **Files** | `server/plansRouter.ts:79,121,300`, `api/plans.ts:61,88`, `api/validate-zip.ts:3,27` |
| **Pattern** | All three define `CMS_ZIP_API = "https://marketplace.api.healthcare.gov/api/v1/counties/by/zip"` and call `fetch(\`${CMS_ZIP_API}/${zip}?apikey=${CMS_API_KEY}\`, ...)` with identical options. |
| **Extra issue** | `server/plansRouter.ts:80` has a hardcoded default API key: `?? "d687412e7b53146b2631dc01974ad0a4"`. The other two files default to an empty string (`?? ""`). |
| **Safe to consolidate** | Yes — extract to `server/plans/cmsZipClient.ts` with a single `resolveZipToCounty(zip)` function. All three callers import it. |
| **Blast radius** | Low — three call sites, no behavior change. |

---

#### B5 🟠 CDN state URL map and loader — duplicated between Plans and Admin

| | |
|---|---|
| **Files** | `server/plansRouter.ts:21-77` and `server/adminRouter.ts:29-65` |
| **Pattern** | Both define `CDN_BASE`, `STATE_CDN_URLS` (50-entry map), and a local `loadStateData*()` function. Admin's comment explicitly acknowledges: *"same cache as plansRouter"* — but it maintains a separate in-memory `adminStateCache`, meaning two CDN fetches for the same data can occur simultaneously. |
| **Safe to consolidate** | Yes — extract to `server/plans/cdnLoader.ts`; admin imports the shared loader. |
| **Blast radius** | Low — admin calls the Plans CDN loader instead of its own copy. No behavior change. |

---

#### B6 🟠 `DoctorNetworkResult` / `PlanDoctorNetworkStatus` — defined three times

| | |
|---|---|
| **Files** | `server/providerNetwork.ts:19,28` (exported), `api/provider-network.ts:4,13` (local, `any`-typed internals), `client/src/lib/types.ts:161,168` (canonical client types) |
| **Why creep** | Three independent definitions of the same conceptual type. The API version uses `any`-typed fields while the server version is properly typed. The client version is authoritative for the UI. |
| **Safe to consolidate** | Partially. Client types are correct for the client. Server and API versions should share one definition. Extract to `server/providers/types.ts`; `api/provider-network.ts` imports from there. |
| **Blast radius** | Low — two import changes. The `any` fields in the API version should be fixed during consolidation. |

---

#### B7 🟠 `DrugInput` — defined three times

| | |
|---|---|
| **Files** | `server/formularyCalculator.ts:442`, `api/formularyCalculator.ts:442` (copy — deleted by B1), `api/plans.ts:3` (local inline definition: `interface DrugInput { name: string; dosage?: string; }`) |
| **Why creep** | `api/plans.ts` defines its own `DrugInput` as a 2-field minimal version of the server's 6-field version. This is a silent narrowing that may cause runtime issues if a caller passes fields the server version handles but the API version ignores. |
| **Safe to consolidate** | Yes — after resolving B1, `api/plans.ts` imports `DrugInput` from `server/formularyCalculator`. Remove inline definition. |
| **Blast radius** | Low — one interface change in `api/plans.ts`. |

---

### Category C — Overgrown Files

#### C1 🟡 `server/adminRouter.ts` — 596 lines, mixes CDN fetching + DB access + plan management + sync management

| | |
|---|---|
| **File** | `server/adminRouter.ts` |
| **Why creep** | A single file owns: admin password verification, carrier override CRUD, plan override CRUD, CMS sync status/history/trigger, non-commissionable plan seeding, AND CDN state data fetching (which belongs to the Plans slice). |
| **Safe to split** | Yes — split into `server/admin/router.ts` (tRPC procedures) + import Plans CDN loader (B5). |
| **Blast radius** | Low if file is split with no logic changes. |

---

#### C2 🟡 `server/pverifyRouter.ts` — 470 lines, contains mock data fallback that masks missing credentials

| | |
|---|---|
| **File** | `server/pverifyRouter.ts:199-240` |
| **Why creep** | A 40-line mock eligibility response block lives inside the production router. When pVerify credentials are absent, the router silently returns fake eligibility data. This makes credential misconfiguration invisible in production — the app "works" but all eligibility checks return mock data. |
| **Safe to refactor** | Yes — add a `console.warn("[pVerify] No credentials configured — using mock data")` at minimum. Better: fail-fast in `validateCryptoEnv` style. |
| **Blast radius** | Low — behavior change only in the no-credentials path (which should not exist in production). |

---

#### C3 🟡 `client/src/lib/mockData.ts` — 1,284 lines in the production bundle

| | |
|---|---|
| **File** | `client/src/lib/mockData.ts` |
| **Why creep** | After removing A2 and A3 (MOCK_PLANS, POPULAR_DOCTORS), only `POPULAR_RX_DRUGS` remains in use — 138 lines of data needed by two components (GuidedWorkflowModal, RxDrugsModal). 1,146 dead lines remain in the bundle. |
| **Safe to refactor** | Yes — extract `POPULAR_RX_DRUGS` to its own file (`client/src/lib/popularDrugs.ts`). Delete or move remaining content to a dev fixture. |
| **Blast radius** | Low — two import path changes. |

---

### Category D — Duplicate Validation Logic

#### D1 🟠 `compareRouter.ts` `buildComparisonPrompt` vs `compareStream.ts` `build2PlanPrompt` — same feature, two prompts

| | |
|---|---|
| **Files** | `server/compareRouter.ts:81` (`buildComparisonPrompt`) and `server/compareStream.ts:116` (`build2PlanPrompt`) |
| **Why creep** | Both functions produce an AI prompt comparing two Medicare Advantage plans. `compareRouter.ts` is the tRPC (non-streaming) endpoint; `compareStream.ts` is the SSE streaming endpoint. They use different prompt templates for the same task, and the client exclusively uses the SSE endpoint (`/api/compare-stream`). The tRPC endpoint (`trpc.compare.comparePlans`) has no client callers. |
| **Safe to investigate** | See D1 note below. |

> **Note — tRPC `comparePlans` may be dead:** Exhaustive client grep finds zero calls to `trpc.compare.comparePlans`. The client calls `/api/compare-stream` (SSE) in three places: `AICompare.tsx:609`, `InlineCompare.tsx:284,469`, and `compareStreamClient.ts:125`. `PlanLookup.tsx:269` calls `trpc.pverify.compare` (a separate structured comparison in `pverifyRouter`, not `compareRouter`). If `compareRouter.comparePlans` is confirmed dead, `compareRouter.ts` shrinks to only `validateApiKey` and can be merged into a health-check or deleted. Mark as **🔵 suspected dead** pending client-side search confirmation.

---

#### D2 🟡 Duplicate admin-password check — inline in `adminRouter.ts` with no shared middleware

| | |
|---|---|
| **File** | `server/adminRouter.ts:134` |
| **Why creep** | Every admin procedure independently checks the `ADMIN_PASSWORD` env var inline rather than using a shared middleware or the existing `adminProcedure` from tRPC. The check is repeated 8+ times. |
| **Safe to refactor** | Yes — the existing `adminProcedure` in `_core/trpc.ts` is designed for this. Move admin password validation there. |
| **Blast radius** | Low — behavior preserving; only the location of the check changes. |

---

### Category E — Hardcoded Values / Temporary Patches

#### E1 🔴 Hardcoded CMS API key default in `server/plansRouter.ts`

| | |
|---|---|
| **File** | `server/plansRouter.ts:80` |
| **Code** | `const CMS_API_KEY = process.env.CMS_MARKETPLACE_API_KEY ?? "d687412e7b53146b2631dc01974ad0a4";` |
| **Why creep** | A real public API key is committed as a fallback default. The other two consumers (`api/plans.ts`, `api/validate-zip.ts`) default to `""`, which correctly causes the API call to fail fast rather than silently succeeding with a committed key. |
| **Safe to remove** | Yes — change `?? "d687412e7b53146b2631dc01974ad0a4"` to `?? ""`. |
| **Blast radius** | Zero in prod (env var should be set). In local dev without the env var, ZIP lookups will now return a 401 instead of silently using the committed key. |

---

### Category F — Stale Documentation

#### F1 🟡 `CLAUDE_CODE_REVIEW.md` — March 2026 review with 12 deferred items

| | |
|---|---|
| **File** | `CLAUDE_CODE_REVIEW.md` |
| **Why creep** | Review is 4 months old. 12 deferred low-severity items are documented. Some may now be fixed (e.g., PlanRecommender.tsx had 3 issues, 0 fixed). No re-review has been run. |
| **Action** | Rerun `/code-review` after the safe-cleanup batch completes. Update the document or delete it if superseded by this audit. |

---

#### F2 🟡 `SECURITY_REVIEW.md` — March 2026 review with 4 medium, 3 low deferred items

| | |
|---|---|
| **File** | `SECURITY_REVIEW.md` |
| **Why creep** | Same age issue. The "critical" finding (no rate limiting) was fixed. Medium/low deferred. Rate limiting is now implemented per `_core/index.ts`. Worth verifying medium items are still deferred intentionally. |
| **Action** | Rerun `/security-review` after cleanup batch. |

---

## 2. Safe Cleanup First (Batch 1 — Zero Regression Risk)

These changes touch no logic, no interfaces, and no behavior. They can all land in a single PR.

| # | Item | Change |
|---|---|---|
| 1 | A1 — ComponentShowcase.tsx | `git rm client/src/pages/ComponentShowcase.tsx` |
| 2 | A2 — MOCK_PLANS | Delete lines 16–230 from `mockData.ts`; ensure no import breaks (grep confirmed none) |
| 3 | A3 — POPULAR_DOCTORS | Delete lines 1231–1284 from `mockData.ts` |
| 4 | A4 — `export calculateDrugCosts` | Remove `export` keyword in both `server/formularyCalculator.ts:474` and `api/formularyCalculator.ts:474` |
| 5 | A5 — `export DrugCostBreakdown`, `export FormularyResult` | Remove `export` from both in both copies |
| 6 | E1 — Hardcoded CMS API key | Change `?? "d687412e7b53146b2631dc01974ad0a4"` to `?? ""` in `server/plansRouter.ts:80` |
| 7 | C3 — mockData split | Extract `POPULAR_RX_DRUGS` to `client/src/lib/popularDrugs.ts`; update 2 import sites; delete or gitignore the rest of `mockData.ts` |

**Estimated effort:** 2 hours.  
**Test requirement:** Run `npm test` to confirm no test references the removed exports.

---

## 3. Needs Regression Coverage First (Batch 2)

These changes modify shared logic or cross-file imports. Each requires running the test suite (and ideally a manual smoke test of the affected feature) before merging.

| # | Item | Change | Coverage needed before merge |
|---|---|---|---|
| 8 | B1 — Delete `api/formularyCalculator.ts` | Update `api/plans.ts` to import from `../server/formularyCalculator` | Run `api/plans.ts` end-to-end: confirm drug cost enrichment still works in Vercel preview |
| 9 | B2 — Extract `PlanInputSchema` | Create `server/compare/schemas.ts`; update imports in both `compareStream.ts` and `compareRouter.ts` | Run `server/compare.test.ts` + manual SSE streaming test |
| 10 | B3 — Extract `build2PlanPrompt` / `build3PlanPrompt` | Create `server/compare/prompts.ts`; update `compareStream.ts` and `api/compare-stream.ts` | Manual compare-stream smoke test on Vercel preview |
| 11 | B4 — Extract CMS ZIP client | Create `server/plans/cmsZipClient.ts`; update 3 callers | Test ZIP → county resolution in plans search and validate-zip endpoint |
| 12 | B5 — Extract CDN loader | Create `server/plans/cdnLoader.ts`; update admin to import it | Test admin state-data view + plans search |
| 13 | B6 — Consolidate `DoctorNetworkResult` | Create `server/providers/types.ts`; update `api/provider-network.ts` | Run provider-network endpoint manually |
| 14 | B7 — Remove inline `DrugInput` in `api/plans.ts` | Import from `server/formularyCalculator` | Verify drug param parsing in `api/plans.ts` with all 6 fields |
| 15 | A6 — Delete `server/index.ts` | Update `package.json`:`start` to `server/_core/index.ts` | Test `npm run build && npm start` in a non-Vercel env |
| 16 | D1 — Confirm `compareRouter.comparePlans` is dead | Search client bundle for `comparePlans`; if confirmed, remove the procedure and the duplicate `buildComparisonPrompt` | Must check if any external integration (voice, email) calls the tRPC endpoint directly |
| 17 | C2 — pVerify mock fallback hardening | Add `console.warn` + fail-fast behavior when credentials missing | Test pVerify with and without credentials set |
| 18 | D2 — Move admin password check to `adminProcedure` | Refactor `adminRouter.ts` to use `_core/trpc.ts` `adminProcedure` | Test all admin procedures end-to-end |

---

## 4. Full Findings Summary Table

| ID | Category | File(s) | Severity | Action | Batch |
|---|---|---|---|---|---|
| A1 | Dead code | `ComponentShowcase.tsx` | 🔴 | Delete (1,437 lines) | 1 |
| A2 | Dead export | `mockData.ts:MOCK_PLANS` | 🔴 | Delete (~215 lines) | 1 |
| A3 | Dead export | `mockData.ts:POPULAR_DOCTORS` | 🔴 | Delete (~53 lines) | 1 |
| A4 | Dead export | `formularyCalculator.ts:calculateDrugCosts` | 🔴 | Remove `export` | 1 |
| A5 | Dead export | `formularyCalculator.ts:DrugCostBreakdown,FormularyResult` | 🔴 | Remove `export` | 1 |
| A6 | Dead file | `server/index.ts` | 🔴 | Delete + fix start script | 2 |
| B1 | Duplicate file | `api/formularyCalculator.ts` | 🟠 | Delete, fix import | 2 |
| B2 | Duplicate schema | `PlanInputSchema` × 2 | 🟠 | Extract to shared | 2 |
| B3 | Duplicate logic | `build2PlanPrompt` × 2 | 🟠 | Extract, fix `any` types | 2 |
| B4 | Duplicate fetch | CMS ZIP API × 3 | 🟠 | Extract to shared client | 2 |
| B5 | Duplicate config | CDN URL map × 2 | 🟠 | Extract to shared | 2 |
| B6 | Duplicate type | `DoctorNetworkResult` × 3 | 🟠 | Consolidate | 2 |
| B7 | Duplicate type | `DrugInput` × 3 | 🟠 | Consolidate after B1 | 2 |
| C1 | Overgrown | `adminRouter.ts` (596L) | 🟡 | Split into subdirectory | 2 |
| C2 | Overgrown | `pverifyRouter.ts` mock block | 🟡 | Add fail-fast warning | 2 |
| C3 | Overgrown | `mockData.ts` (1,284L) | 🟡 | Split after A2+A3 | 1 |
| D1 | Suspected dead | `compareRouter.comparePlans` | 🔵 | Verify then remove | 2 |
| D2 | Duplicate logic | Admin password check × 8+ | 🟡 | Centralize in `adminProcedure` | 2 |
| E1 | Hardcoded value | `plansRouter.ts:80` | 🔴 | Remove default key | 1 |
| F1 | Stale docs | `CLAUDE_CODE_REVIEW.md` | 🟡 | Rerun after Batch 1 | — |
| F2 | Stale docs | `SECURITY_REVIEW.md` | 🟡 | Rerun after Batch 1 | — |

---

## Dead line count if Batch 1 lands

| Item | Lines removed |
|---|---|
| ComponentShowcase.tsx | 1,437 |
| MOCK_PLANS from mockData.ts | ~215 |
| POPULAR_DOCTORS from mockData.ts | ~53 |
| mockData.ts remainder (after extracting POPULAR_RX_DRUGS) | ~976 |
| `export` keyword removals (A4, A5) | ~0 (keyword only) |
| Hardcoded key default (E1) | ~0 (string only) |
| **Total lines deleted in Batch 1** | **~2,681** |

If Batch 2 also lands:

| Item | Lines removed |
|---|---|
| `api/formularyCalculator.ts` (full delete) | 626 |
| `server/index.ts` (full delete) | 37 |
| Extracted duplicate schemas (B2) | ~55 (inline removed, new shared file is ~70 — net ~-15) |
| Extracted prompt functions (B3) | ~70 lines from `api/compare-stream.ts` |
| `compareRouter.ts` if D1 confirmed | up to 286 |
| **Total lines deleted in Batch 2** | **~1,000–1,285** |

**Combined potential reduction: ~3,700–4,000 lines** with no behavior change.
