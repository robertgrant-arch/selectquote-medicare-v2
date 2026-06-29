# Regression Protection Matrix
**Branch:** `feat/vertical-slices-prod`  
**Date:** 2026-06-28  
**Test baseline:** 680 pass, 1 pre-existing failure (`ANTHROPIC_API_KEY` not set in CI env)  
**Goal:** Identify what must be tested before any refactor or cleanup begins.

---

## How to read this document

**Priority column** maps to remediation-plan phases:
- **P0** — Must exist before any Phase 3+ batch merges
- **P1** — Must exist before Phase 4 (architectural boundary fixes)
- **P2** — Must exist before Phase 5 (performance changes)
- **P3** — Adds durable protection but is not a phase gate

**Test types used:**
- **Unit** — pure function, no I/O, no mocks needed
- **Integration** — real DB / real filesystem / mocked external HTTP
- **Contract** — verifies a shared interface has not silently changed shape
- **E2E** — exercises the full HTTP stack from request to response

---

## Part 1: Regression Protection Matrix

---

### 1. Quote Intake Flow

**What it is:** A beneficiary enters ZIP, contact info, medications, providers; that data is encrypted and persisted. A resume token is returned once, stored in localStorage, never re-stored.

| Feature | Current coverage | Missing coverage | Test type | Priority |
|---|---|---|---|---|
| Token generation — 64-char hex, unique | ✅ `quoteSession.test.ts` | — | Unit | — |
| Token hashing — SHA-256 deterministic | ✅ `quoteSession.test.ts` | — | Unit | — |
| `createSession` — PHI never plaintext in DB | ✅ `phi-compliance.test.ts` | — | Integration | — |
| `createSession` — raw token never stored | ✅ `quoteSession.test.ts` | — | Integration | — |
| `createSession` — all child rows written correctly | ✅ `quoteSession.test.ts` | Data integrity assertion (verify every medication/provider row persisted) | Integration | **P0** |
| `loadByTokenHash` — returns decrypted PHI | ✅ `quoteSession.test.ts` | — | Integration | — |
| `loadByTokenHash` — null on wrong/expired/abandoned/completed token | ✅ `quoteSession.test.ts` | — | Integration | — |
| `loadByTokenHash` — extends expiry on each resume | ❌ No test | Needs dedicated assertion on `expiresAt` update | Integration | **P0** |
| tRPC `quoteSession.save` — new session path | ❌ No router-level test | Router calls `createSession`; token returned to client | Integration | **P0** |
| tRPC `quoteSession.save` — resume path (existing token) | ❌ No router-level test | Router calls `loadByTokenHash` first; merges input | Integration | **P0** |
| tRPC `quoteSession.resume` — valid token | ❌ No router-level test | Decrypts and returns session to client | Integration | **P0** |
| tRPC `quoteSession.markCompleted` | ❌ No router-level test | Status transition triggers correct DB update | Integration | **P1** |
| `useQuoteSession` hook — localStorage token persistence | ❌ No test | Token written on `onSuccess`; read on mount | Unit (hook) | **P1** |
| `useQuoteSession` hook — `clearSession` | ❌ No test | localStorage cleared; refs reset | Unit (hook) | **P1** |
| Audit log — entries written, no PHI values | ✅ `quoteSession.test.ts` | — | Integration | — |
| Key rotation — old session decrypts with old key | ✅ `phi-compliance.test.ts` | — | Integration | — |

**Key risk for refactoring:** `createSession` sequential DB writes (Batch 5-E parallelizes them). Every `createSession` test must pass after the transaction wrapping is added.

---

### 2. ZIP Validation Flow

**What it is:** Client validates ZIP format → API calls CMS Marketplace API to resolve ZIP → county. Multi-county ZIPs require user selection before plans load.

| Feature | Current coverage | Missing coverage | Test type | Priority |
|---|---|---|---|---|
| ZIP format validation (5-digit, numeric) | ✅ `zipValidator.test.ts` (35 tests) | — | Unit | — |
| Error codes per validation failure | ✅ `zipValidator.test.ts` | — | Unit | — |
| County selection required when multiple counties | ✅ `zipValidator.test.ts` | — | Unit | — |
| `isSafeForDoctorSearch` guard | ✅ `zipValidator.test.ts` | — | Unit | — |
| `resolveZipToCounty` — API call, response parse | ❌ No test | Cache miss → HTTP call → county extracted | Integration | **P0** |
| `resolveZipToCounty` — cache hit (no re-fetch) | ❌ No test | Second call returns same result without HTTP | Integration | **P0** |
| `resolveZipToCounty` — error handling on non-200 | ❌ No test | Clear error thrown, not swallowed | Integration | **P0** |
| `api/validate-zip` — valid ZIP returns county list | ❌ No test | Full HTTP handler: request → CMS API → response | E2E / Integration | **P1** |
| `api/validate-zip` — invalid ZIP returns 400 | ❌ No test | Validation before CMS call | E2E / Integration | **P1** |
| `useZipValidation` hook — debounce and state transitions | ❌ No test | UI state: loading → valid / needs_county / error | Unit (hook) | **P2** |

**Key risk for refactoring:** `resolveZipToCounty` is extracted to `server/plans/planLoader.ts` in Batch 4-F. Tests must exist and pass before extraction.

---

### 3. Plans Display / Selection Flow

**What it is:** Given a valid ZIP + county, the server fetches state plan data from CloudFront CDN, applies admin overrides, optionally enriches with drug costs, ranks plans, and returns them. Client applies filters, sorts, and renders PlanCards.

| Feature | Current coverage | Missing coverage | Test type | Priority |
|---|---|---|---|---|
| `getStateData` — CDN fetch, JSON parse | ❌ No test | HTTP call → parsed plan array | Integration | **P0** |
| `getStateData` — cache hit (no re-fetch) | ❌ No test | Second call for same state: no HTTP | Integration | **P0** |
| `getStateData` — cache FIFO eviction at STATE_CACHE_MAX | ❌ No test | 21st state evicts oldest | Integration | **P0** |
| `getStateData` — CDN error handling | ❌ No test | Non-200 or network error → thrown, not swallowed | Integration | **P0** |
| `loadAdminOverrides` — fetches disabled carriers + plan overrides | ❌ No test | DB queries; returns correct shape | Integration | **P0** |
| `loadAdminOverrides` — disabled carrier excludes plans | ❌ No test | Plan from disabled carrier not in results | Integration | **P0** |
| `annotatePlans` — adds rank starting at 1 | ❌ No test | First plan in returned array has rank=1 | Unit | **P0** |
| `annotatePlans` — sorts by premium ascending (default) | ❌ No test | Array order matches expected sort | Unit | **P0** |
| `enrichPlansWithDrugCosts` — adds `estimatedAnnualDrugCost` | ❌ No test | Field present on every returned plan | Unit | **P0** |
| `enrichPlansWithDrugCosts` — zero cost for unknown drug | ❌ No test | Unrecognized drug → 0 cost, no throw | Unit | **P0** |
| `enrichPlansWithDrugCosts` — OOP cap enforcement | ❌ No test | High-cost drug capped at OOP_CAP_2026 | Unit | **P0** |
| `enrichPlansWithDrugCosts` — immutability (no plan mutation) | ❌ No test | Original plans array unchanged | Unit | **P0** |
| `api/plans` handler — valid request returns plan array | ❌ No test | Full HTTP handler with mocked CDN and DB | E2E / Integration | **P0** |
| `api/plans` handler — missing zip returns 400 | ❌ No test | Validation guard | E2E / Integration | **P0** |
| `api/plans` handler — CDN failure returns 500 | ❌ No test | Error path from `getStateData` | E2E / Integration | **P0** |
| `aiRecommendationEngine.scoreAllPlans` — output range 0–100 | ❌ No test | Every score is in valid range | Unit | **P0** |
| `aiRecommendationEngine.scoreAllPlans` — rank order stable | ❌ No test | Same input → same order (deterministic) | Unit | **P0** |
| `aiRecommendationEngine.scoreAllPlans` — MODEL_A vs MODEL_B differ | ❌ No test | Same plans, different model → different ranking | Unit | **P0** |
| `aiRecommendationEngine.scoreAllPlans` — doctor weight applies | ❌ No test | Plans with in-network doctors score higher | Unit | **P0** |
| `aiRecommendationEngine.scoreAllPlans` — drug weight applies | ❌ No test | Plans with lower drug cost score higher | Unit | **P0** |
| Client filter — by plan type (HMO/PPO/PFFS) | ❌ No test | Filter returns only matching plan types | Unit | **P1** |
| Client filter — by carrier | ❌ No test | Filter excludes unselected carriers | Unit | **P1** |
| Client filter — by SNP category | ❌ No test | Only CSNP/ISNP/DSNP plans returned | Unit | **P1** |
| Client filter — premium cap | ❌ No test | Plans above threshold excluded | Unit | **P1** |
| Client sort — by premium ascending | ❌ No test | Lowest premium first | Unit | **P1** |
| Client sort — by drug cost | ❌ No test | Lowest `estimatedAnnualDrugCost` first | Unit | **P1** |
| Client sort — by star rating | ❌ No test | Highest rating first | Unit | **P1** |
| `checkDoctorNetworkForPlan` — in-network detection | ❌ No test | Doctor NPI in state → true | Unit | **P1** |
| `checkDoctorNetworkForPlan` — out-of-network detection | ❌ No test | Doctor NPI not in state → false | Unit | **P1** |

**Key risks for refactoring:** This flow has the most Phase 3–5 changes — cache extraction (4-F), CDN map consolidation (3-C), admin override caching (5-B), state TTL (5-C), PlanCard memoization (5-A). All must be covered before any of those batches.

---

### 4. Eligibility Flow

**What it is:** Beneficiary enters MBI (preferred) or SSN. Server calls pVerify, returns eligibility status and current plan info. PHI minimization: only the identifier type used is forwarded; name/DOB/address never leave the server.

| Feature | Current coverage | Missing coverage | Test type | Priority |
|---|---|---|---|---|
| `buildPverifyPayload` — MBI forwarded correctly | ✅ `phi-boundary.test.ts` | — | Unit | — |
| `buildPverifyPayload` — SSN fallback when MBI absent | ✅ `phi-boundary.test.ts` | — | Unit | — |
| `buildPverifyPayload` — null when no identifier | ✅ `phi-boundary.test.ts` | — | Unit | — |
| `buildPverifyPayload` — no name/DOB/address | ✅ `phi-boundary.test.ts` | — | Unit | — |
| `eligibilityCheck` — MBI success path | ✅ `pverify.test.ts` | — | Integration | — |
| `eligibilityCheck` — SSN fallback path | ✅ `pverify.test.ts` | — | Integration | — |
| `eligibilityCheck` — rejects no-identifier input | ✅ `pverify.test.ts` | — | Integration | — |
| Token cache — cached token reused before expiry | ❌ No test | `getPverifyToken` second call skips HTTP | Unit | **P0** |
| Token cache — new token fetched when within 60s buffer | ❌ No test | Token fetched before `expiresAt - 60_000` | Unit | **P0** |
| Token cache — null cache triggers fetch | ❌ No test | Cold start → always fetches | Unit | **P0** |
| `eligibilityCheck` — real pVerify API call structure | ❌ No test | Full request → pVerify → response shape valid | Integration | **P1** |
| Mock fallback — warning logged when credentials missing | ❌ No test | After Batch 6-B fix: warning present in logs | Unit | **P1** |
| MBI/SSN never logged | ✅ `phi-logging.test.ts` | — | Integration | — |

**Key risk for refactoring:** Token cache extracted to `pVerifyClient.ts` in Batch 4-eligibility slice work. Token cache tests must exist before the move.

---

### 5. AI Compare Flow

**What it is:** Beneficiary selects 2–3 plans. Client sends them via SSE to `api/compare-stream.ts` (Vercel) or `server/compareStream.ts` (Express). Claude Haiku streams a narrative comparison. Client renders markdown in real time.

| Feature | Current coverage | Missing coverage | Test type | Priority |
|---|---|---|---|---|
| `canAdd` / `toggleId` / `isFull` — selection logic | ✅ `compareSelectionLogic.test.ts` | — | Unit | — |
| `buildComparePrompt` — required sections present | ✅ `comparePromptBuilder.test.ts` | — | Unit | — |
| `estimateAnnualCost` — premium + copay math | ✅ `comparePromptBuilder.test.ts` | — | Unit | — |
| `parseSseBlock` — delta/done/error event parsing | ✅ `compareStreamClient.test.ts` | — | Unit | — |
| `buildRequestBody` — field serialization | ✅ `compareStreamClient.test.ts` | — | Unit | — |
| `compareStream` handler — validates same-plan rejection | ✅ `compare.test.ts` | — | Integration | — |
| `compareStream` handler — SSE stream produces delta events | ❌ No test | Handler streams events; client receives delta | Integration | **P0** |
| `compareStream` handler — `done` event sent at end | ❌ No test | Final event type is `done` | Integration | **P0** |
| `compareStream` handler — aborts when `res.destroyed` | ❌ No test | Disconnect → Anthropic call aborted (bug confirmed by Batch 2-A) | Integration | **P0** |
| `PlanInputSchema` — validates required plan fields | ❌ No test | Zod parse rejects missing fields | Contract | **P0** |
| `api/compare-stream` — request body validated with schema | ❌ No test | Malformed body → 400; valid body → 200 streaming | E2E | **P1** |
| `compareStreamClient` — `abortRef.abort()` stops stream | ✅ `compareStreamClient.test.ts` | — | Unit | — |
| 3-plan comparison prompt has distinct structure | ❌ No test | `build3PlanPrompt` output differs from 2-plan | Unit | **P1** |
| `PlanInputSchema` same in server + api (contract) | ❌ No test | Shared schema: field-by-field match | Contract | **P0** |

**Key risk for refactoring:** Schema consolidation (Batch 4-B) moves `PlanInputSchema` to `shared/compare/schemas.ts`. The contract test locks that the shape doesn't silently shrink.

---

### 6. Admin Authentication Flow

**What it is:** Admin routes accept `adminPassword` on every tRPC input. `checkAdminPassword` is called inline in each handler. There is no `adminProcedure` middleware enforcing this centrally.

| Feature | Current coverage | Missing coverage | Test type | Priority |
|---|---|---|---|---|
| Admin routes reject missing password | ❌ No test | Every route tested: missing password → UNAUTHORIZED | Integration | **P0** |
| Admin routes reject wrong password | ❌ No test | Every route tested: wrong password → UNAUTHORIZED | Integration | **P0** |
| Admin routes accept correct password | ❌ No test | Correct password → proceeds to handler | Integration | **P0** |
| `getCarrierOverrides` — returns current overrides | ❌ No test | DB state matches response | Integration | **P0** |
| `setCarrierOverride` — enable/disable carrier | ❌ No test | Toggle reflects in subsequent `getCarrierOverrides` | Integration | **P0** |
| `getPlansPage` — returns paginated results | ❌ No test | Page 1 returns first N plans | Integration | **P1** |
| `getPlansPage` — search filter by name | ❌ No test | Search term filters results | Integration | **P1** |
| `triggerSync` — creates a sync log entry | ❌ No test | After trigger, sync log has new entry | Integration | **P1** |
| `upsertPlanOverride` — write then read round-trip | ❌ No test | Upserted plan appears in `getPlansPage` | Integration | **P1** |
| `getCarriersForState` — returns carriers from CDN | ❌ No test | CDN mocked; carrier list extracted correctly | Integration | **P2** |
| `getPlansForState` — returns plans from CDN | ❌ No test | CDN mocked; plan list extracted correctly | Integration | **P2** |
| After Batch 4-C: `adminProcedure` enforces auth | ❌ No test (must exist before Batch 4-C) | Same auth assertions, now via middleware | Integration | **P0** |

**Key risk for refactoring:** Batch 4-C moves auth enforcement to `adminProcedure`. These tests must be written first, then verify they still pass after the middleware change.

---

### 7. Session/Resume Flow

**What it is:** The resume token (stored in `localStorage`) allows a beneficiary to continue a partially-completed quote. The token is a one-time credential; the hash is stored in DB.

| Feature | Current coverage | Missing coverage | Test type | Priority |
|---|---|---|---|---|
| Raw token in localStorage, hash in DB | ✅ `quoteSession.test.ts` | — | Integration | — |
| Correct PHI decrypts on resume | ✅ `quoteSession.test.ts` | — | Integration | — |
| Expired token → null | ✅ `quoteSession.test.ts` | — | Integration | — |
| Completed/abandoned session → null | ✅ `phi-compliance.test.ts` | — | Integration | — |
| `expiresAt` extended on every resume | ❌ No test | DB row `expiresAt` updated after each `loadByTokenHash` | Integration | **P0** |
| tRPC `resume` → contact + medications + providers returned | ❌ No router test | Router layer: decode and return all child rows | Integration | **P0** |
| tRPC `save` with existing token → updates session | ❌ No router test | Same token, new medication → appended | Integration | **P0** |
| `useQuoteSession.save` — writes token to localStorage | ❌ No test | `onSuccess` callback sets localStorage | Unit (hook) | **P1** |
| `useQuoteSession.clearSession` — clears token | ❌ No test | `localStorage.removeItem` called | Unit (hook) | **P1** |
| `useQuoteSession.hasExistingSession` — true when token exists | ❌ No test | Returns true on mount if token in localStorage | Unit (hook) | **P2** |

---

### 8. Vercel Production API Endpoints

**What it is:** Eight deployed Vercel serverless functions handle production traffic independently of the Express server. None have integration tests.

| Endpoint | Current coverage | Missing coverage | Test type | Priority |
|---|---|---|---|---|
| `api/plans` — valid zip → plan array | ❌ No test | Mock CDN + DB; verify response shape | Integration | **P0** |
| `api/plans` — missing zip → 400 | ❌ No test | Validation guard | Integration | **P0** |
| `api/plans` — unknown state → 400 or empty | ❌ No test | `STATE_CDN_URLS` lookup miss | Integration | **P0** |
| `api/plans` — CDN timeout → 500 | ❌ No test | AbortSignal fires; error surfaced | Integration | **P0** |
| `api/compare-stream` — valid body → SSE stream | ❌ No test | Streams `delta` + `done` events | Integration | **P0** |
| `api/compare-stream` — malformed body → 400 | ❌ No test | After Batch 4-D: Zod rejects | Integration | **P0** |
| `api/chat` — valid messages → stream | ❌ No test | Anthropic or fallback path returns stream | Integration | **P1** |
| `api/chat` — fallback to Forge when Anthropic fails | ❌ No test | First provider fails; second succeeds | Integration | **P1** |
| `api/voice-webhook` — `get_plan_recommendations` tool | ❌ No test | Tool routing → plans fetch → Vapi response | Integration | **P0** |
| `api/voice-webhook` — `check_drug_coverage` tool | ❌ No test | Drug lookup → coverage result → Vapi response | Integration | **P0** |
| `api/voice-webhook` — unknown tool → 200 empty result | ❌ No test | Unknown tool handled gracefully | Integration | **P1** |
| `api/bluebutton-callback` — valid state/code → exchange | ❌ No test | OAuth exchange mocked; token stored | Integration | **P2** |
| `api/bluebutton-callback` — missing state → 400 | ❌ No test | Guard before token exchange | Integration | **P1** |
| `api/bluebutton-callback` — EOB pagination | ❌ No test | Multi-page fetch assembles all entries | Integration | **P2** |
| `api/doctors` — name search returns ranked results | ❌ No test | NPPES mocked; name matching + distance sort | Integration | **P1** |
| `api/provider-network` — in-network determination | ❌ No test | Plans × doctors → network status per plan | Integration | **P1** |
| `api/validate-zip` — 5-digit zip → county list | ❌ No test | CMS API mocked; county array returned | Integration | **P1** |
| `api/validate-zip` — non-numeric zip → 400 | ❌ No test | Validation before CMS call | Integration | **P1** |

**Key risk:** All Vercel API handlers are completely untested. Batch 3-B fixes error swallowing in these handlers — the tests must exist first to confirm behavior before and after.

---

### 9. Formulary / Drug Cost Flow

**What it is:** Given a plan and a list of drugs, the formulary calculator looks up each drug's tier, calculates 12 months of costs using CMS cost-sharing rules, and applies OOP and MOOP caps.

| Feature | Current coverage | Missing coverage | Test type | Priority |
|---|---|---|---|---|
| `enrichPlansWithDrugCosts` — adds cost field to each plan | ❌ No test | Field present, non-negative | Unit | **P0** |
| `enrichPlansWithDrugCosts` — zero cost for unknown drug | ❌ No test | Graceful miss | Unit | **P0** |
| `enrichPlansWithDrugCosts` — OOP cap applied | ❌ No test | Costs capped at `OOP_CAP_2026` | Unit | **P0** |
| `enrichPlansWithDrugCosts` — pure function (no mutation) | ❌ No test | Input array unchanged after call | Unit | **P0** |
| `enrichPlansWithDrugCosts` — identical results on repeat call | ❌ No test | Deterministic; no global state | Unit | **P0** |
| `calculateDrugCosts` — Tier 1 generic cost | ❌ No test | Known drug, known tier → correct monthly total | Unit | **P0** |
| `calculateDrugCosts` — deductible phase applied | ❌ No test | Cost correct in deductible phase vs post-deductible | Unit | **P0** |
| `calculateDrugCosts` — coverage gap handling | ❌ No test | Plans with gap coverage vs without | Unit | **P0** |
| Drug database — known drugs present | ❌ No test | `lisinopril`, `metformin`, `atorvastatin` in DRUG_DATABASE | Unit | **P0** |
| `api/formularyCalculator` matches `server/formularyCalculator` | ❌ No test | Contract: same inputs → same outputs | Contract | **P0** |

**Key risk for refactoring:** Batch 4-A moves this to `shared/formulary/`. Both the server and API copies must produce identical output before deletion. The contract test catches divergence.

---

### 10. AI Recommend / Health Profile Flow

**What it is:** Beneficiary's health preferences are scored into a de-identified profile, sent to Gemini 2.5 Flash via Forge, and a ranked plan list with AI narrative is returned.

| Feature | Current coverage | Missing coverage | Test type | Priority |
|---|---|---|---|---|
| `toAIHealthProfile` — correct 14 fields | ✅ `phi-boundary.test.ts` | — | Unit | — |
| `toDeidentifiedProfile` — no PHI fields | ✅ `phi-boundary.test.ts` | — | Unit | — |
| `healthProfile.recommend` — rank order by score | ✅ `healthProfile.test.ts` | — | Integration | — |
| `healthProfile.recommend` — `aiNarrative` graceful degradation | ✅ `healthProfile.test.ts` | — | Integration | — |
| Recommend stream — SSE `delta` events produced | ❌ No test | Handler streams events | Integration | **P1** |
| Recommend stream — `res.destroyed` aborts generation | ❌ No test | Disconnect → stream aborted | Integration | **P1** |
| Recommend stream — `done` event sent at end | ❌ No test | Completion event type | Integration | **P1** |
| `invokeLLM` — timeout aborts after 60s | ❌ No test | After Batch 1-C: AbortSignal fires on slow mock | Unit | **P1** |
| `invokeLLM` — logs error on timeout | ❌ No test | Error logged with `[llm]` tag | Unit | **P2** |

---

## Part 2: Coverage Summary by Flow

| Flow | Test files | Tests today | P0 gaps | P1 gaps | Total gaps |
|---|---|---|---|---|---|
| Quote Intake | `quoteSession.test.ts`, `phi-compliance.test.ts` | 50 | 5 | 4 | 9 |
| ZIP Validation | `zipValidator.test.ts` | 35 | 3 | 2 | 5+ |
| Plans Display | *(none)* | 0 | **14** | **10** | **24+** |
| Eligibility | `pverify.test.ts`, `phi-boundary.test.ts` | 23 | 3 | 1 | 4 |
| AI Compare | `compare*.test.ts` (4 files) | 63 | 5 | 3 | 8 |
| Admin Auth | *(none)* | 0 | **3** | **5** | **8+** |
| Session/Resume | `quoteSession.test.ts` | 10 | 3 | 2 | 5 |
| Vercel API Endpoints | *(none)* | 0 | **6** | **8** | **14+** |
| Formulary/Drug | *(none)* | 0 | **10** | 0 | **10** |
| AI Recommend | `healthProfile.test.ts`, `phi-boundary.test.ts` | 15 | 0 | 3 | 3 |
| **Total** | | **196 relevant** | **52** | **38** | **90+** |

---

## Part 3: Must-Have Before Cleanup Suite

These are the minimum tests that must be written and passing before any Phase 3 batch merges. They protect the behaviors most likely to break during refactoring.

---

### MUST-01: `server/plans.test.ts` (new file) — Plans slice unit tests

**Protects:** Batches 3-C (CDN map consolidation), 4-F (planLoader extraction), 5-B (override cache), 5-C (state TTL)

```ts
// Test file: server/plans.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getStateData,
  resolveZipToCounty,
  annotatePlans,
} from "./plansRouter"; // or ./plans/planLoader after Batch 4-F

describe("getStateData", () => {
  it("fetches from CDN on first call and returns a non-empty plan array");
  it("returns cached data on second call for the same state (fetch called once)");
  it("evicts the oldest entry when cache size exceeds STATE_CACHE_MAX");
  it("throws a descriptive error when CDN returns non-200");
  it("throws a descriptive error when CDN fetch times out");
});

describe("resolveZipToCounty", () => {
  it("returns a county name for a known ZIP");
  it("returns the cached county on a second call (no re-fetch)");
  it("throws a descriptive error when CMS API returns non-200");
  it("handles a ZIP that maps to multiple counties by returning all");
});

describe("annotatePlans", () => {
  it("adds a rank field to each plan, starting at 1");
  it("sorts plans by premium ascending before ranking");
  it("returns an empty array when given an empty input");
  it("excludes plans from disabled carriers (admin override applied)");
  it("excludes plans matching a disabled planId override");
  it("does not mutate the original plans array");
});

describe("loadAdminOverrides", () => {
  it("returns disabled carrier list and plan overrides from DB");
  it("returns empty arrays when no overrides are configured");
});
```

---

### MUST-02: `server/formulary.test.ts` (new file) — Formulary unit tests

**Protects:** Batch 3-F (drug database extraction), Batch 4-A (move to shared/), both copies of the calculator

```ts
// Test file: server/formulary.test.ts

import { describe, it, expect } from "vitest";
import {
  enrichPlansWithDrugCosts,
  calculateDrugCosts,
} from "./formularyCalculator"; // path changes after Batch 4-A

const KNOWN_DRUG = { name: "lisinopril", dosage: "10mg" };
const UNKNOWN_DRUG = { name: "xyzfakedrugnotreal", dosage: "10mg" };

const SAMPLE_PLAN = {
  id: "plan-1",
  premium: 0,
  deductible: 0,
  maxOutOfPocket: 3000,
  rxDrugs: {
    tier1: "$0 copay",
    tier2: "$10 copay",
    tier3: "$47 copay",
    tier4: "$100 copay",
    deductible: "$0",
    gap: true,
  },
};

describe("enrichPlansWithDrugCosts", () => {
  it("adds estimatedAnnualDrugCost to each plan in the array");
  it("returns 0 drug cost for an unknown drug (graceful miss)");
  it("caps annual drug cost at OOP_CAP_2026 for very expensive regimens");
  it("does not mutate the original plans array");
  it("produces the same output on two calls with the same inputs (pure function)");
  it("handles an empty drugs array (all plans get 0 cost)");
  it("handles an empty plans array without throwing");
});

describe("calculateDrugCosts", () => {
  it("returns correct monthly cost for a known Tier 1 generic");
  it("applies plan deductible before coverage begins");
  it("returns 0 for an unrecognized drug name");
  it("never returns a negative cost");
  it("respects gap coverage flag on the plan");
});

describe("formulary contract: server vs api", () => {
  it("enrichPlansWithDrugCosts produces identical output regardless of which copy is imported", async () => {
    // Import both before Batch 4-A deletes the api/ copy
    // After Batch 4-A, this test verifies the shared/ version matches
  });
});
```

---

### MUST-03: `server/admin.test.ts` (new file) — Admin route auth tests

**Protects:** Batch 4-C (adminProcedure enforcement) — tests must be written first, then must still pass after the refactor

```ts
// Test file: server/admin.test.ts

import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const ctx = { /* minimal context */ } as TrpcContext;
const CORRECT_PASSWORD = process.env.ADMIN_PASSWORD ?? "test-admin-password";
const WRONG_PASSWORD = "wrong-password-abc";

// Test every admin route for auth enforcement
const ADMIN_ROUTES_REQUIRING_AUTH = [
  { route: "admin.getCarrierOverrides",   input: { adminPassword: WRONG_PASSWORD } },
  { route: "admin.setCarrierOverride",    input: { adminPassword: WRONG_PASSWORD, carrierName: "UHC", isEnabled: false } },
  { route: "admin.getPlansPage",          input: { adminPassword: WRONG_PASSWORD, page: 1, pageSize: 20 } },
  { route: "admin.upsertPlanOverride",    input: { adminPassword: WRONG_PASSWORD, planId: "x", isEnabled: false } },
  { route: "admin.getDataSources",        input: { adminPassword: WRONG_PASSWORD } },
  { route: "admin.getSyncLogs",           input: { adminPassword: WRONG_PASSWORD, page: 1, pageSize: 20 } },
  { route: "admin.triggerSync",           input: { adminPassword: WRONG_PASSWORD } },
  { route: "admin.getCarriersForState",   input: { adminPassword: WRONG_PASSWORD, state: "MO" } },
  { route: "admin.getPlansForState",      input: { adminPassword: WRONG_PASSWORD, state: "MO" } },
] as const;

describe("admin route — authentication enforcement", () => {
  for (const { route, input } of ADMIN_ROUTES_REQUIRING_AUTH) {
    it(`${route}: rejects missing adminPassword`, async () => {
      const caller = appRouter.createCaller(ctx);
      const { adminPassword: _, ...inputWithoutPassword } = input;
      await expect(
        (caller as any)[route.replace("admin.", "")](inputWithoutPassword)
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it(`${route}: rejects wrong adminPassword`, async () => {
      const caller = appRouter.createCaller(ctx);
      await expect(
        (caller as any)[route.replace("admin.", "")](input)
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  }
});

describe("admin.getCarrierOverrides — read behavior", () => {
  it("returns an array of carrier overrides with correct shape");
  it("returns empty array when no overrides exist");
});

describe("admin.setCarrierOverride — write + read round-trip", () => {
  it("disabling a carrier is reflected in the next getCarrierOverrides call");
  it("re-enabling a carrier restores it");
});
```

---

### MUST-04: `server/quoteSession/router.test.ts` (new file) — Router layer tests

**Protects:** Batch 4-eligibility and any changes to the tRPC surface

```ts
// Test file: server/quoteSession/router.test.ts

import { describe, it, expect } from "vitest";
import { appRouter } from "../routers";

describe("quoteSession.save — new session", () => {
  it("returns sessionId and resumeToken on first save");
  it("resumeToken is 64 hex chars");
  it("sessionId is a valid UUID");
  it("calling save without a token creates a new session each time");
});

describe("quoteSession.save — resume path", () => {
  it("returns the same sessionId when called with an existing valid token");
  it("appended medication is retrievable via quoteSession.resume");
  it("returns error on expired token");
});

describe("quoteSession.resume", () => {
  it("returns decrypted contact info for a valid token");
  it("returns null for an unknown token");
  it("returns null for an expired token");
  it("extends session expiresAt on each call");
});

describe("quoteSession.markCompleted", () => {
  it("completed session cannot be resumed (loadByTokenHash returns null)");
});
```

---

### MUST-05: `server/compareStream.disconnect.test.ts` (new file) — Streaming disconnect test

**Protects:** Batch 3-B (error handling fix), Batch 5-D (disconnect guard)

```ts
// Test file: server/compareStream.disconnect.test.ts
// This test should FAIL before Batch 3-B/5-D and PASS after.

import { describe, it, expect, vi } from "vitest";

describe("compareStream — client disconnect handling", () => {
  it("aborts the Anthropic stream when res.destroyed becomes true mid-stream", async () => {
    // Arrange: mock Anthropic client to return a slow async iterator
    // that yields one chunk per 100ms and records if abort was called
    const abortSpy = vi.fn();
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 100));
          yield { type: "content_block_delta", delta: { text: `chunk${i}` } };
        }
      },
    };

    // Mock res — starts not-destroyed; call destroy() after 250ms
    const writes: string[] = [];
    const mockRes = {
      destroyed: false,
      writableEnded: false,
      write: (chunk: string) => { writes.push(chunk); return true; },
      end: vi.fn(),
    };

    // Act: start streaming; destroy res after 2 chunks
    setTimeout(() => { mockRes.destroyed = true; }, 250);
    await runCompareStream(mockRes as any, { currentPlan: basePlan, newPlan: differentPlan });

    // Assert: stream stopped before all 10 chunks; abort was signaled
    expect(writes.length).toBeLessThan(5);
    expect(mockRes.end).toHaveBeenCalled();
  });

  it("does NOT abort when res remains open for the full stream duration");
});
```

---

### MUST-06: `server/api.plans.test.ts` (new file) — Vercel handler integration tests

**Protects:** Batch 3-B (error fix in api/plans.ts), Batch 3-C (CDN map move), Batch 4-D (Zod validation)

```ts
// Test file: server/api.plans.test.ts
// Uses a test-harness pattern: import the handler function, provide mock req/res

import { describe, it, expect, vi, beforeEach } from "vitest";
import handler from "../api/plans";

// Mock fetch globally to avoid real CDN/CMS calls
global.fetch = vi.fn();

function mockReq(query: Record<string, string>) {
  return { query, body: {} } as any;
}

function mockRes() {
  const data: { status?: number; body?: unknown } = {};
  return {
    status: (code: number) => { data.status = code; return res; },
    json: (body: unknown) => { data.body = body; return res; },
    setHeader: vi.fn(),
    _data: data,
  } as any;
}

describe("api/plans handler", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 400 when zip is missing");
  it("returns 400 when zip is not 5 digits");
  it("returns 400 when zip state is not in STATE_CDN_URLS");
  it("returns 200 with plan array when CDN and CMS API succeed");
  it("returns 500 when CDN fetch fails (after Batch 3-B: error not swallowed)");
  it("returns 500 when ZIP resolution fails (after Batch 3-B: error not swallowed)");
  it("includes estimatedAnnualDrugCost on each plan when drugs param is provided");
  it("returns plans without drug enrichment when drugs param is omitted");
  it("applies disabled-carrier filter from admin overrides");
});
```

---

### MUST-07: `client/src/lib/aiRecommendationEngine.test.ts` (new file) — Scoring engine

**Protects:** Batch 5-A (memoization), Batch 5-B (debounce) — `scoreAllPlans` must produce identical output before and after the filter changes

```ts
// Test file: client/src/lib/aiRecommendationEngine.test.ts

import { describe, it, expect } from "vitest";
import { scoreAllPlans, MODEL_A, MODEL_B } from "./aiRecommendationEngine";

describe("scoreAllPlans", () => {
  it("returns one score entry per plan");
  it("all scores are in [0, 100] range");
  it("produces the same ranking when called twice with identical inputs (deterministic)");
  it("does not mutate the input plans array");
  it("MODEL_A and MODEL_B produce different rankings for the same input");
  it("a plan with a doctor the user wants scores higher than an otherwise-identical plan without that doctor");
  it("a plan with lower drug cost scores higher than an otherwise-identical higher-cost plan");
  it("a plan with lower premium scores higher when premium weight is highest");
  it("returns empty array for empty plan input without throwing");
  it("handles a single plan without throwing");
  it("score increases monotonically as relevant benefits are added to the winning plan");
});

describe("scoreAllPlans — MODEL_B weights", () => {
  it("drug cost factor has a higher weight in MODEL_B than MODEL_A");
  it("doctor coverage factor is present in both models");
});
```

---

### MUST-08: `server/api.voice-webhook.test.ts` (new file) — Voice webhook handler

**Protects:** PHI boundary (already tested), but handler routing is untested

```ts
// Test file: server/api.voice-webhook.test.ts

import { describe, it, expect, vi } from "vitest";
import handler from "../api/voice-webhook";

describe("api/voice-webhook — tool routing", () => {
  it("routes get_plan_recommendations to the plans fetch and returns plan summaries");
  it("routes check_drug_coverage to the formulary lookup and returns coverage status");
  it("returns 200 with empty result for an unknown tool name");
  it("returns 200 (not 4xx) even on internal fetch error — Vapi expects 200");
  it("COMPLIANCE: ZIP and planType only forwarded to plans API (PHI boundary)");
  it("COMPLIANCE: ZIP and drugName only forwarded to drug API (PHI boundary)");
});
```

---

## Part 4: Test Infrastructure Requirements

Before writing the must-have suite, the following test infrastructure must be in place:

### Mock CDN fetch helper
```ts
// test-utils/mockCdn.ts
export function mockCdnSuccess(plans: unknown[]) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ "MOCK COUNTY": plans }),
  } as Response);
}

export function mockCdnFailure(status = 500) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: false,
    status,
    statusText: "Internal Server Error",
  } as Response);
}
```

### Mock admin DB helper
```ts
// test-utils/mockAdminDb.ts
export function mockAdminOverrides(
  disabledCarriers: string[] = [],
  disabledPlanIds: string[] = []
) {
  // Returns the shape that loadAdminOverrides() returns
  return { disabledCarriers: new Set(disabledCarriers), disabledPlanIds: new Set(disabledPlanIds) };
}
```

### Vitest environment note
The existing tests use a real DB connection (mocked at the Drizzle level). Maintain the same approach — do not switch to in-memory SQLite, which would diverge from the MySQL dialect in production.

---

## Part 5: Execution Order

Write and pass these tests in this order — each gate blocks the batches listed:

| Step | Test to write | Blocks until passing |
|---|---|---|
| 1 | MUST-05 (compareStream disconnect — must FAIL) | Batch 3-B |
| 2 | MUST-07 (aiRecommendationEngine) | Batch 5-A (PlanCard memo + debounce) |
| 3 | MUST-02 (formulary) | Batches 3-F, 4-A |
| 4 | MUST-01 (plans slice) | Batches 3-C, 4-F, 5-B, 5-C |
| 5 | MUST-03 (admin auth) | Batch 4-C |
| 6 | MUST-04 (quoteSession router) | Any quoteSession change |
| 7 | MUST-06 (api/plans handler) | Batches 3-B, 3-C, 4-D |
| 8 | MUST-08 (voice webhook handler) | Batch 4-D (voice validation) |

**Phase 2 from the remediation plan maps 1:1 to this execution order.** Complete steps 1–8 above = Phase 2 complete = all Phase 3+ batches unblocked.

---

## Part 6: What Already Covered Well (Do Not Regress)

These areas have solid coverage. Do not modify them as part of cleanup — only touch if a bug is being explicitly fixed:

| Area | Coverage | Test files |
|---|---|---|
| Field-level encryption (AES-256-GCM) | 42 tests | `crypto.test.ts` |
| PHI never plaintext in DB | 8 critical tests | `quoteSession.test.ts`, `phi-compliance.test.ts` |
| HMAC lookup key separated from encryption key | 3 tests | `phi-compliance.test.ts` |
| pVerify PHI minimization (no name/DOB/address) | 7 tests | `phi-boundary.test.ts` |
| AI PHI boundaries (recommend, chat, voice) | 18 tests | `phi-boundary.test.ts` |
| MBI/SSN never logged | 5 tests | `phi-logging.test.ts` |
| Key rotation — old session decrypts with old key | 2 tests | `phi-compliance.test.ts` |
| Compare selection logic (MAX=3, duplicate guard) | 17 tests | `compareSelectionLogic.test.ts` |
| ZIP format validation | 35 tests | `zipValidator.test.ts` |
| Pre-enrollment checklist engine | 25 tests | `checklistEngine.test.ts` |
| Annual cost calculation + MOOP cap | 17 tests | `annualCostCalculator.test.ts` |
| Auth logout cookie flags | 1 test | `auth.logout.test.ts` |
