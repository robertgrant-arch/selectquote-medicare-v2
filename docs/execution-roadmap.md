# Production-Grade Execution Roadmap
**Branch:** `feat/vertical-slices-prod`
**Date:** 2026-06-28
**Purpose:** The single ordered plan an implementation agent executes to make this repository production-grade. Synthesizes all eight audits into one safe sequence.

**Source audits:** `architecture-audit`, `architecture-integrity-audit`, `code-creep-audit`, `performance-audit`, `maintainability-audit`, `shared-code-audit`, `deployment-hardening-audit`, `regression-protection-matrix`, `remediation-plan`.

---

## How to use this document

- Phases run **in order**. A phase gate must pass before the next phase starts.
- Each sub-phase is **one PR**. Never combine sub-phases.
- Every PR records: pre-check output, post-check output, rollback command.
- The four invariants below are checked on **every** PR, not just at the end.

### The four invariants (never violate)

| Invariant | How it is protected |
|---|---|
| **Vertical slice architecture stays primary** | New code goes into a slice, not a shared dumping ground. Boundary-check script (Phase 1) enforces it in CI. |
| **Hexagonal boundaries hold** | Domain logic never imports infrastructure directly; adapters sit behind ports. `_core`/`shared` may not import slices. |
| **No UX or business-rule regression** | The regression suite (Phase 2) must be green before any cleanup. Manual smoke test of all flows before each risky merge. |
| **Deployment stays stable** | The delivery model is resolved first (Phase 0). No phase changes the deploy surface without a preview-deploy validation. |

### Risk legend

🟢 Zero · 🟡 Low · 🟠 Medium · 🔴 High

---

## Phase 0 — Resolve the Delivery Model (BLOCKER)

> Nothing else is safe until this is settled. If tRPC is unreachable in production (deployment audit D1), then writing tests and refactors for tRPC routers protects code that may not run where you think it does.

### Sub-phase 0.1 — Confirm the production runtime

**Objective:** Determine, with evidence, whether production runs on Vercel serverless or the Express server on another host.

**Files/folders affected:** None (investigation only).

**Risk:** 🟢 Zero

**Dependencies:** None.

**Steps:**
1. Inspect the live deployment target (Vercel dashboard / hosting provider).
2. Hit `/api/trpc/systemRouter.health` on the production URL. 404 ⇒ tRPC is not wired for Vercel.
3. Hit `/api/plans?zip=64030` on production. Confirms which `plans` implementation is live.
4. Document the answer in `docs/DEPLOY.md`.

**Validation:** `docs/DEPLOY.md` states the confirmed runtime and which `api/*.ts` vs Express routes are actually serving traffic.

**Rollback:** N/A (read-only).

---

### Sub-phase 0.2 — Reconcile the two delivery layers

**Objective:** Make the client's `/api/trpc` calls reachable in production, with exactly one canonical implementation per endpoint.

**Files/folders affected:**
- `api/trpc/[trpc].ts` (new — tRPC catch-all serverless function), OR
- `vercel.json` + `package.json` build (if standardizing on Express)
- Likely deletions: whichever of `api/plans.ts` / `api/compare-stream.ts` duplicates the Express version (decide canonical layer)

**Risk:** 🔴 High — changes the production request surface.

**Dependencies:** 0.1.

**Decision rule:**
- **If Vercel is the target:** add `api/trpc/[trpc].ts` using the tRPC fetch/node adapter wrapping the existing `appRouter` + `createContext`. Add `api/recommend-stream.ts`. The serverless `api/plans.ts` / `api/compare-stream.ts` become canonical; the Express duplicates are dev-only.
- **If a container host is the target:** add a server bundle build step (esbuild), remove the orphaned `api/*.ts` functions, drop `vercel.json`.

**Validation:**
1. Preview deploy.
2. `/api/trpc/systemRouter.health` returns 200.
3. Manual smoke test: quote save → resume, eligibility check, admin login, AI compare, AI recommend (the tRPC-dependent flows).
4. Confirm no regression in the already-working REST endpoints (`/api/plans`, `/api/voice-webhook`).

**Rollback:** Revert the PR; Vercel "promote previous deployment" for instant cutback.

> **Protects:** deployment stability (the entire point), and all business flows that ride tRPC.

---

### Sub-phase 0.3 — Fix the build/start contract

**Objective:** Make `build` and `start` honest about the chosen runtime (deployment audit D2).

**Files/folders affected:** `package.json` scripts.

**Risk:** 🟡 Low (script-only, but verify the chosen path builds).

**Dependencies:** 0.2.

**Steps:** Either delete the dead `start` script and document "production = Vercel serverless," or add the esbuild server-bundle step if Express is canonical.

**Validation:** `npm run build` succeeds and produces exactly the artifacts the chosen runtime needs.

**Rollback:** Revert script changes.

**Phase 0 gate:** Production delivery model confirmed, documented, and the tRPC surface verified reachable on a preview deploy. ✅ before Phase 1.

---

## Phase 1 — Safety Net & Secrets (no behavior change)

> Config-and-secrets hardening that is safe regardless of refactor order. These eliminate the dangerous-secret and observability gaps.

### Sub-phase 1.1 — Remove hardcoded secrets; fail loud

**Objective:** No committed API key; no dev password default in the prod path (maintainability CONST-02/03, deployment S5).

**Files affected:** `api/plans.ts`, `server/adminRouter.ts`.

**Risk:** 🟡 Low — adds mandatory env reads.

**Dependencies:** Phase 0 (so the live `plans` handler is known).

**Steps:** Replace `?? "d687412e7b53146b2631dc01974ad0a4"` and `?? "admin123"` with startup-time guards that throw if the env var is absent. Confirm both vars are set in all environments first.

**Validation:** `grep -rn "d687412e7b53146b2631dc01974ad0a4\|admin123" server/ api/` returns nothing; existing tests green.

**Rollback:** Revert the two edits.

---

### Sub-phase 1.2 — Commit `.env.example`

**Objective:** Document all 28 env vars (deployment C4, S2).

**Files affected:** `.env.example` (new).

**Risk:** 🟢 Zero — never contains real values.

**Dependencies:** None.

**Validation:** Every `process.env.*` and `import.meta.env.VITE_*` from the audit appears with a `required|optional` marker.

**Rollback:** Delete the file.

---

### Sub-phase 1.3 — Vercel function config + health endpoint

**Objective:** Stop streaming functions being killed at 60 s; add a reachable health check (deployment D6/D10, performance P1).

**Files affected:** `vercel.json` (`functions` block, remove redundant rewrite), `api/health.ts` (new).

**Risk:** 🟢 Zero (config + one trivial handler).

**Dependencies:** Phase 0.

**Validation:** Preview deploy; `api/health.ts` returns 200; `vercel functions ls` shows updated `maxDuration`.

**Rollback:** Revert `vercel.json`; delete `api/health.ts`.

---

### Sub-phase 1.4 — `invokeLLM` timeout + pVerify mock warning

**Objective:** Prevent indefinite LLM hangs; make missing pVerify creds loud not slow (performance P9/P8, deployment D8).

**Files affected:** `server/_core/llm.ts`, `server/pverifyRouter.ts`.

**Risk:** 🟡 Low — guards only fire on failure paths.

**Dependencies:** None.

**Validation:** `healthProfile.test.ts` + `pverify.test.ts` green; remove the 1.2 s/0.8 s artificial sleeps.

**Rollback:** Revert edits.

---

### Sub-phase 1.5 — CI pipeline + boundary check + Node pin

**Objective:** Make every later phase gated by automated checks (deployment Part 7, C5, C6).

**Files affected:** `.github/workflows/ci.yml` (new), `scripts/check-boundaries.sh` (new), `package.json` (`engines`), `.nvmrc` (new), `vitest.config.ts` (widen `include` — deployment C1), `tsconfig.json` (stop excluding tests — C2), ESLint config (new, minimal: `no-floating-promises` blocking, `no-explicit-any` warn).

**Risk:** 🟡 Low — additive, but will surface existing violations.

**Dependencies:** 1.1–1.4 (so the pipeline starts green).

**Critical fix:** `compare.test.ts:93` fails whenever `ANTHROPIC_API_KEY` is unset — make it conditional, or CI is red from day one. Set test crypto env vars (`ACTIVE_KEY_ID`, `KEY_k1`, `HMAC_LOOKUP_KEY`) as CI secrets.

**Validation:** CI runs green on a no-op PR: typecheck → lint → format → test → build → boundary check → `npm audit` (non-blocking).

**Rollback:** Delete the workflow file.

**Phase 1 gate:** CI green; no hardcoded secrets; health check live; `.env.example` committed. ✅ before Phase 2.

> **Protects:** deployment stability; the boundary-check script now actively enforces the slice/hexagonal invariants on every subsequent PR.

---

## Phase 2 — Regression Net (tests only, no production code change)

> Build coverage around every behavior the later phases will touch. This phase is the gate for all cleanup and refactoring. Maps 1:1 to the regression-protection-matrix "must-have" suite.

### Sub-phase 2.1 — Streaming disconnect test (write to FAIL)

**Objective:** Prove the `compareStream` missing-disconnect bug before fixing it (matrix MUST-05).

**Files:** `server/compareStream.disconnect.test.ts` (new).

**Risk:** 🟢 Zero. **Dependencies:** Phase 1.

**Validation:** Test **fails** (bug confirmed). Gates Phase 3 error-handling fix.

---

### Sub-phase 2.2 — Scoring engine tests

**Objective:** Lock `scoreAllPlans` output before memoization/move (matrix MUST-07).

**Files:** `client/src/lib/aiRecommendationEngine.test.ts` (new).

**Risk:** 🟢 Zero. **Dependencies:** Phase 1 (vitest include must already be widened — 1.5).

**Validation:** Determinism, range [0,100], MODEL_A≠MODEL_B, doctor/drug weighting, immutability — all green against current code.

---

### Sub-phase 2.3 — Formulary tests + cross-copy contract

**Objective:** Lock drug-cost behavior before moving to `shared/` (matrix MUST-02).

**Files:** `server/formulary.test.ts` (new).

**Risk:** 🟢 Zero. **Dependencies:** Phase 1.

**Validation:** OOP cap, unknown-drug graceful miss, purity/immutability; contract test asserting server and api copies produce identical output (catches the drift the deletion will resolve).

---

### Sub-phase 2.4 — Plans slice tests

**Objective:** Lock CDN cache, ZIP resolution, annotation, admin overrides before extraction (matrix MUST-01).

**Files:** `server/plans.test.ts` (new).

**Risk:** 🟢 Zero. **Dependencies:** Phase 1.

---

### Sub-phase 2.5 — Admin auth enforcement tests

**Objective:** Prove every admin route rejects missing/wrong password before centralizing the check (matrix MUST-03).

**Files:** `server/admin.test.ts` (new).

**Risk:** 🟢 Zero. **Dependencies:** Phase 1.

**Validation:** All 9 routes × {missing, wrong} password → UNAUTHORIZED, against current inline-check code.

---

### Sub-phase 2.6 — Quote session router tests

**Objective:** Cover the tRPC router layer (repository already covered) (matrix MUST-04).

**Files:** `server/quoteSession/router.test.ts` (new).

**Risk:** 🟢 Zero. **Dependencies:** Phase 0 (router must be reachable to be meaningful).

---

### Sub-phase 2.7 — Vercel handler tests (plans + voice)

**Objective:** Cover the serverless handlers before touching their error handling (matrix MUST-06/08).

**Files:** `server/api.plans.test.ts`, `server/api.voice-webhook.test.ts` (new).

**Risk:** 🟢 Zero. **Dependencies:** Phase 0, 1.5 (vitest include).

**Phase 2 gate:** All must-have tests green **except** 2.1 (disconnect) which must be **failing**. Baseline captured. ✅ before Phase 3.

> **Protects:** existing UX and business functionality — this net is what makes every later change reversible-by-evidence.

---

## Phase 3 — Low-Risk Cleanup (no behavior change)

> Dead-code removal, error-handling fixes, constant consolidation. Each is independently mergeable and individually reversible.

### Sub-phase 3.1 — Delete confirmed dead code

**Objective:** Remove proven-dead files (code-creep A-series).

**Files:** `client/src/pages/ComponentShowcase.tsx` (delete), `client/src/lib/mockData.ts` (delete `MOCK_PLANS`, `POPULAR_DOCTORS`; keep `POPULAR_RX_DRUGS`), `server/compareRouter.ts` (delete — zero callers), `server/_core/map.ts` (delete — unused template), `client/src/hooks/useMobile.tsx` (delete — duplicate of `features/mobile-results/lib/useIsMobile.ts`), `shared/types.ts` (delete — misleading barrel).

**Risk:** 🟡 Low. **Dependencies:** Phase 2 (so removals are net-verified); re-run dead-code greps in the PR.

**Validation:** `tsc --noEmit` clean; full suite green; boundary check green.

**Rollback:** `git revert`.

---

### Sub-phase 3.2 — Fix swallowed errors in handlers

**Objective:** Replace empty `catch {}` with logging + client signal (maintainability ERR-01/02, deployment).

**Files:** `api/chat.ts`, `api/compare-stream.ts`, `api/plans.ts`, `api/doctors.ts`, `api/provider-network.ts`, `server/providerNetwork.ts`, `server/_core/dataApi.ts`.

**Risk:** 🟡 Low — changes error paths only.

**Dependencies:** 2.1, 2.7.

**Validation:** The 2.1 disconnect test transitions **fail → pass**; full suite green.

**Rollback:** Revert edits.

---

### Sub-phase 3.3 — Consolidate `STATE_CDN_URLS` into `shared/const.ts`

**Objective:** One CDN map instead of three (maintainability CONST-01).

**Files:** `shared/const.ts` (add `CDN_BASE`, `STATE_CDN_URLS`), `server/plansRouter.ts`, `server/adminRouter.ts`, `api/plans.ts` (import instead of declare).

**Risk:** 🟡 Low — pure import redirect; diff the three copies first to confirm identical.

**Dependencies:** 2.4.

**Validation:** Only `shared/const.ts` contains `cloudfront.net`; plans tests green; boundary check confirms `shared/` still imports no slice.

> **Protects invariant:** `STATE_CDN_URLS` is cross-cutting infra config (a URL table, no business rules) — appropriate for `shared/`. This is *not* moving a business rule into shared.

---

### Sub-phase 3.4 — Type-hole closures

**Objective:** Remove the `(plan as any).estimatedAnnualDrugCost` pattern and `QuoteHandoffContext` `any[]` (maintainability `any` categories A/B).

**Files:** `client/src/lib/types.ts` (add `estimatedAnnualDrugCost?: number`), `client/src/contexts/QuoteHandoffContext.tsx` (`Doctor[]`/`RxDrug[]`), plus the ~6 cast sites.

**Risk:** 🟡 Low — type-only.

**Dependencies:** 2.2 (scoring tests guard the plan-shape consumers).

**Validation:** `tsc --noEmit` error count drops; no `as any` left in `Plans.tsx`/`PlanCard.tsx`.

**Rollback:** Revert.

**Phase 3 gate:** Dead code gone; no swallowed errors; one CDN map; disconnect test passing; `tsc` clean. ✅ before Phase 4.

---

## Phase 4 — Architectural Boundary Fixes

> Move shared logic to where it belongs, put infrastructure behind ports, centralize admin auth. This is where the slice/hexagonal invariants are actively strengthened — carefully, behind the Phase 2 net.

### Sub-phase 4.1 — Extract drug DB, then move formulary to `shared/`

**Objective:** One formulary implementation; data separated from algorithm (maintainability SRP-03/CFG-01, shared-code, code-creep B5).

**Files:** `shared/formulary/database.ts` (new — `DRUG_DATABASE`), `shared/formulary/calculator.ts` (new), delete `server/formularyCalculator.ts` + `api/formularyCalculator.ts`, update importers in `plansRouter.ts` + `api/plans.ts`.

**Risk:** 🟠 Medium — file move with two importers.

**Dependencies:** 2.3 (contract test must be green first).

**Validation:** Only `shared/formulary/calculator.ts` remains; 2.3 tests green including the now-single-source contract; `api/` contains no non-handler modules (deployment D4 resolved); boundary check green.

> **Protects invariant:** the formulary calculator is genuinely cross-cutting (server + serverless both need identical drug math, no slice owns it) — correct for `shared/`. Drug data is reference data, not a business rule embedded elsewhere.

---

### Sub-phase 4.2 — Unify compare schemas + prompt builders in `shared/compare/`

**Objective:** Remove triple-defined `PlanInputSchema`; type the `api/compare-stream.ts` builders (maintainability VAL-02, SRP-04).

**Files:** `shared/compare/schemas.ts`, `shared/compare/promptBuilder.ts` (new), update `server/compareStream.ts` + `api/compare-stream.ts`.

**Risk:** 🟠 Medium.

**Dependencies:** 3.1 (compareRouter deleted), 2.7.

**Validation:** No `any` in compare prompt builders; compare tests green; contract test on the shared schema.

---

### Sub-phase 4.3 — Centralize admin auth via `adminProcedure`

**Objective:** No admin route can skip the password check (maintainability NEST-01, integrity LEAK-07).

**Files:** `server/_core/trpc.ts` (admin password middleware), `server/adminRouter.ts` (use `adminProcedure`; delete inline `checkAdminPassword`).

**Risk:** 🟠 Medium — auth path change.

**Dependencies:** 2.5 (auth tests written first, must still pass after).

**Validation:** All 2.5 tests green via the middleware; `checkAdminPassword` gone from `adminRouter.ts`.

**Rollback:** Restore inline checks.

---

### Sub-phase 4.4 — Push business logic back into slices

**Objective:** Domain logic out of `lib/` and `_core/` into owning feature slices (shared-code Part 2).

**Files (one PR each, small):**
- `aiRecommendationEngine.ts` → `client/src/features/plan-scoring/lib/`
- `checkDoctorNetworkForPlan` (from `lib/utils.ts`) → `client/src/features/provider-network/lib/`
- `classifySnpType` (from `lib/types.ts`) → `client/src/features/plan-scoring/lib/snpClassifier.ts`
- `QuoteHandoffContext` → `client/src/features/quote-intake/contexts/`

**Risk:** 🟠 Medium — import path churn, no logic change.

**Dependencies:** 2.2 (scoring), Phase 3.

**Validation:** Imports updated; `tsc` clean; suite green; `lib/utils.ts` contains only `cn()`; boundary check confirms no business logic remains in `lib/`/`shared/`.

> **Protects invariant:** this is the *anti-flattening* phase — it actively moves domain rules **out** of generic utilities and **into** their slices, the opposite of shared-util soup.

---

### Sub-phase 4.5 — Put infrastructure behind ports

**Objective:** `sdk.ts` stops importing the DB; `notification.ts` stops throwing `TRPCError`; `invokeLLM` accepts model/thinking config (shared-code Part 3).

**Files:** `server/_core/auth/userRepository.port.ts` (new), `server/_core/sdk.ts` (inject port), `server/_core/notification.ts` (return result type; `systemRouter.ts` translates), `server/_core/llm.ts` (configurable params).

**Risk:** 🟠 Medium — touches auth and notification adapters.

**Dependencies:** Phase 2; `auth.logout.test.ts` + a new `sdk` test.

**Validation:** `_core` imports no DB directly (boundary check rule extended); auth flow smoke-tested on preview; notification returns typed result.

**Phase 4 gate:** One implementation per endpoint; admin auth centralized; domain logic in slices; `_core` clean of slice/DB imports. ✅ before Phase 5.

---

## Phase 5 — Performance Improvements

> Quick wins from the performance audit, each behind the Phase 2 net. Behavior-preserving except render performance (5.1) and load order (5.6).

| Sub | Objective | Files | Risk | Dep |
|---|---|---|---|---|
| 5.1 | Memoize `PlanCard`; debounce `FilterSidebar` (P-C2/C3) | `PlanCard.tsx`, `Plans.tsx` | 🟡 | 2.2 |
| 5.2 | TTL cache `loadAdminOverrides` (P3) | `server/plans/` loader | 🟡 | 2.4 |
| 5.3 | TTL on state CDN cache (P5) | plans loader | 🟡 | 2.4 |
| 5.4 | `res.destroyed` guard in `compareStream` (P6) | `compareStream.ts` | 🟡 | 2.1 |
| 5.5 | Parallelize `createSession` child inserts in a txn (P11) | `quoteSession/repository.ts` | 🟠 | 2.6 |
| 5.6 | Route-level code splitting (`React.lazy`) (C1) | `App.tsx` | 🟡 | — |
| 5.7 | Bounded retry on idempotent external GETs (deploy D9) | plans loader, zip, doctors | 🟡 | 2.4/2.7 |

**Validation per sub:** the relevant Phase 2 test stays green; for 5.1 confirm render-count drop in React DevTools; for 5.6 confirm every route still navigates with a Suspense fallback (no blank screen).

**Rollback:** each is a self-contained revert.

**Phase 5 gate:** No regression in any flow; bundle size reduced; render counts down. ✅ before Phase 6.

> **Protects invariant:** caching/memoization are adapter-level and UI-level concerns — no business rule moves. `createSession` parallelization is wrapped in a transaction to preserve data integrity.

---

## Phase 6 — Production Hardening & Observability

### Sub-phase 6.1 — Error monitoring

**Objective:** Real visibility into production errors (deployment D5/S6).

**Files:** Sentry init in `api/*` handlers + client entry; `beforeSend` PHI scrubber reusing `maskValue`/`sanitizeMessagesForAI`.

**Risk:** 🟡 Low — additive.

**Dependencies:** Phase 0 (handlers stable).

**Validation:** A forced error appears in Sentry with MBI/SSN scrubbed.

---

### Sub-phase 6.2 — CMS sync as Vercel Cron

**Objective:** Restore the daily sync dead on serverless (deployment D7).

**Files:** `vercel.json` `crons`, `api/cron/cms-sync.ts` (new, `CRON_SECRET`-guarded), remove `startCmsPipelineCron()` from Express startup (or guard to dev-only).

**Risk:** 🟠 Medium — scheduled job behavior change.

**Dependencies:** Phase 0.

**Validation:** Manual trigger of the cron function runs the sync; sync-history log entry appears.

---

### Sub-phase 6.3 — Structured logging + migration runbook + feature kill-switch

**Objective:** Consistent tagged logs; documented deploy/migration sequence; kill-switch for risky AI flows (maintainability observability, deployment M1/R1).

**Files:** module-level `log` helpers across `server/`+`api/`; `docs/DEPLOY.md` (migration-before-code sequence, Vercel rollback path); minimal `featureFlags` table + admin query gating AI recommend/compare/eligibility.

**Risk:** 🟡 Low.

**Dependencies:** Phases 0–5.

**Validation:** Logs filterable by tag in Vercel; kill-switch toggles a flow off without redeploy.

---

### Sub-phase 6.4 — Final regression + docs

**Objective:** Confirm nothing regressed across all phases; record the architecture standard.

**Files:** `CLAUDE.md`/`docs/ARCHITECTURE.md` (slice convention, naming rules, PHI boundary list, do-not-touch list).

**Risk:** 🟢 Zero.

**Validation:** Full suite green; `tsc` clean; **manual smoke test of all 10 flows** (regression matrix Part 6 checklist) on a preview deploy before promoting.

**Phase 6 gate:** Monitoring live; cron restored; runbook written; all flows smoke-tested. ✅ DONE.

---

## Fastest Safe Wins

Do these first — high value, low risk, mostly hours not days. (All are zero/low risk and behind existing tests or config-only.)

1. **1.1 Remove hardcoded secrets** — closes a committed-key and dev-password exposure (~30 min).
2. **1.2 `.env.example`** — unblocks reproducible deploys (~30 min).
3. **1.3 Vercel `functions` block + `api/health.ts`** — stops 60 s stream kills; enables uptime checks (~45 min).
4. **1.4 `invokeLLM` timeout + drop pVerify sleeps** — removes a hang risk and 1.2 s of fake latency (~30 min).
5. **3.1 Delete dead code** — `ComponentShowcase`, `MOCK_PLANS`, `compareRouter`, `_core/map.ts`, duplicate `useMobile`, `shared/types.ts` (~1 h, after Phase 2).
6. **3.3 Consolidate CDN map** — kills the triplicated config that will drift on the next CMS release (~30 min).
7. **1.5 CI pipeline** — every later change becomes gated (~2 h, including fixing the `ANTHROPIC_API_KEY` test that would otherwise red CI).

---

## High-Risk But High-Value

Sequence carefully, behind the regression net, with preview-deploy validation. These move the needle most but can break things if rushed.

1. **0.2 Reconcile delivery layers** — 🔴 the single most valuable item; without it, core flows may be dead in prod. Requires preview smoke test of all tRPC flows.
2. **4.3 Centralize admin auth** — 🟠 eliminates the silent-auth-bypass class of bug, but is an auth-path change; the 2.5 test suite is the safety harness.
3. **4.5 Infrastructure behind ports** — 🟠 removes the `sdk.ts → DB` dependency inversion and `TRPCError`-in-adapter coupling; touches the auth path.
4. **5.5 Parallelize `createSession`** — 🟠 big latency win on the PHI write path; must stay transactional to preserve data integrity.
5. **6.2 CMS cron migration** — 🟠 restores a currently-dead scheduled job; changes runtime behavior.

---

## Do Later

Valuable but not blocking; schedule after the production-grade baseline is reached.

- **Full page decomposition** — `AdminDashboard.tsx` (1,112), `PlanRecommender.tsx` (1,293), `Plans.tsx` (753) into feature panels/hooks (maintainability M16–M20). Big ergonomic win, no functional change, large diff — do after the net and structure are solid.
- **`InlineCompare.tsx` → `features/plan-compare/`** — fold the 927-line re-implementation into the feature slice.
- **Client-side drug enrichment** (performance SF3) — eliminate the plans re-fetch on drug change; meaningful UX win but reshapes a data flow.
- **Virtual scrolling for large plan grids** (performance C8) — only matters for CA/FL/TX scale.
- **Vercel KV for cross-cold-start caches** (performance SF5/SF7) — pVerify token + admin overrides + state data survival.
- **ESLint ruleset ratchet** — tighten `no-explicit-any` from warn to error as the `any` debt is paid down.
- **`noUnusedLocals`/`noFallthroughCasesInSwitch`** promoted to main tsconfig (deployment C7) after a cleanup pass.
- **Full-text index for admin plan search** (performance D1/maintainability NEST) — only at much larger override-table scale.

---

## Non-Goals (explicitly out of scope)

These are **forbidden** in this roadmap. An implementation agent must not do them.

1. **No layer-cake / monolith rewrite.** Vertical slices stay the primary organizing principle. Do not reorganize into `controllers/`, `services/`, `models/`.
2. **No "shared util soup."** Business rules (scoring weights, SNP classification, doctor-network probability, drug math) stay in their owning slices. `shared/` is for cross-cutting *infrastructure* and *primitives* only. The boundary-check script blocks regressions here.
3. **No functionality or UX regression.** Every flow that works today must work identically after. The regression net (Phase 2) and the manual smoke checklist (6.4) enforce this. Behavior changes only where a bug is *explicitly* being fixed (e.g., swallowed errors, stream disconnect).
4. **No giant PRs.** One sub-phase per PR. If a change feels large, split it further.
5. **No new heavyweight tooling.** No Nx, no dependency-cruiser, no Husky, no coverage-threshold gate, no LaunchDarkly. The grep-based boundary check, a minimal ESLint ruleset, and Sentry are the ceiling — each must pay for itself.
6. **No touching the crypto / PHI core without test sign-off.** `shared/security/crypto.ts` and `quoteSession/` PHI handling are do-not-touch except behind their existing 42 + 50 compliance tests, with explicit PHI sign-off.
7. **No premature micro-optimization.** Only the performance items with production impact (Phase 5) are in scope. Do not hand-optimize hot loops that aren't on a measured hot path.
8. **No deploy-surface change without a preview validation.** Any PR that alters `vercel.json`, `api/` routing, or the build must be smoke-tested on a preview deploy before promotion.

---

## Phase Dependency Summary

```
Phase 0  (delivery model)        ── BLOCKER, must be first
   │
Phase 1  (secrets, CI, config)   ── depends on 0; establishes the CI gate
   │
Phase 2  (regression net)        ── depends on 1; gates everything after
   │
Phase 3  (low-risk cleanup)      ── depends on 2
   │
Phase 4  (boundary fixes)        ── depends on 2 + 3
   │
Phase 5  (performance)           ── depends on 2 + relevant Phase 4 extractions
   │
Phase 6  (hardening/observ.)     ── depends on 0–5
```

**One-line execution order:** Confirm where prod runs → wire tRPC for it → lock secrets & stand up CI → write the regression net → delete dead code & fix error handling → move logic into slices behind ports → apply perf wins → add monitoring and a runbook. Never break a flow; never flatten the architecture; never let a business rule leak into shared.
