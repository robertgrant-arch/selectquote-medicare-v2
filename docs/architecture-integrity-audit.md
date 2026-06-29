# Architecture Integrity Audit
**Branch:** `feat/vertical-slices-prod`  
**Date:** 2026-06-28  
**Method:** Full import-graph and export-surface analysis of every slice.

> **Scope:** Vertical slice integrity and hexagonal layer discipline.  
> This is not a feature audit — it is an architectural X-ray of what code talks to what.

---

## Table of Contents

1. [Healthy Slices](#1-healthy-slices)
2. [Boundary Leaks](#2-boundary-leaks)
3. [Shared Code That Should Move Back Into a Slice](#3-shared-code-that-should-move-back-into-a-slice)
4. [Infra Code That Should Move Outward Behind Ports](#4-infra-code-that-should-move-outward-behind-ports)
5. [Recommended Target Architecture Map](#5-recommended-target-architecture-map)

---

## Hexagonal layer legend (used throughout)

```
Domain       — pure types, validation schemas, pure functions; zero external deps
Application  — use-case orchestration; calls Domain + Ports
Port         — interface that Application talks to (never an implementation)
Adapter      — implements a Port; touches external things (DB, HTTP, LLM, queue)
Transport    — wires Ports+Adapters to a delivery mechanism (tRPC, Express, Vercel)
```

---

## 1. Healthy Slices

### 1.1 Quote Session — `server/quoteSession/`

The only slice in the codebase with correct hexagonal discipline throughout.

```
Domain      quoteSession/schemas.ts       Zod schemas; no external deps (only zod)
Domain      quoteSession/tokens.ts        Pure functions; only node:crypto
Domain      quoteSession/crypto.ts        Re-exports shared/security/crypto with
                                          PURPOSE="quote-session" — keeps AAD
                                          binding local to this slice
Adapter     quoteSession/repository.ts    DB access + enc/dec; imports getDb and
                                          drizzle/schema (infrastructure), and
                                          ./crypto (domain). Nothing from other slices.
Transport   quoteSession/router.ts        tRPC procedures; imports _core/trpc
                                          (framework port), schemas, repository,
                                          tokens. No infra beyond _core.
Tests       quoteSession/quoteSession.test.ts
            quoteSession/phi-compliance.test.ts
```

**Why it's healthy:**
- Dependency arrow is strictly inward: Transport → Application (router) → Domain
- Repository is the only place that touches the DB for this slice
- `crypto.ts` creates a purpose-scoped wrapper so the shared crypto primitive cannot be misused from this slice
- PHI only decrypts inside `repository.ts` — not in the router, not in schemas
- No other slice imports from `quoteSession/` — isolation is complete  
  *(Verified: `grep -rn "from.*quoteSession" server/ | grep -v "quoteSession/"` returns only `routers.ts:29: quoteSession: quoteSessionRouter`)*

**One minor smell:** `ipHash()` in `repository.ts` uses `require("node:crypto")` inline at runtime instead of a top-level import. This is functionally fine but inconsistent.

---

### 1.2 CMS Pipeline — `server/cmsPipeline.ts`

Self-contained infrastructure slice. Only talks to its own DB tables (`cmsDataSources`, `cmsSyncLog`). Exported functions are coarse-grained (`runCmsSync`, `startCmsPipelineCron`, `getNextScheduledRun`).

`adminRouter.ts` calls `runCmsSync()` and `getNextScheduledRun()` — this is a legitimate service dependency, not a reach into internals. ✓

---

### 1.3 Eligibility — `server/pverifyRouter.ts`

No DB access. No imports from any other slice. Only dependencies are `_core/trpc`, `_core/env`, `zod`, and the pVerify HTTP API. PHI minimization function `buildPverifyPayload` is exported and tested. Clean boundary.

---

### 1.4 AI Compare (tRPC path) — `server/compareRouter.ts`

No DB access. No imports from any other slice. Calls `_core/llm` indirectly via the `compareRouter` logic (verify: `grep "invokeLLM\|_core/llm" server/compareRouter.ts` → 0 results, uses inline `fetch` against Forge API). Self-contained scoring and prompt logic.

---

### 1.5 `shared/security/crypto.ts`

Correctly placed shared domain service:
- Only dependency: `node:crypto`
- Has a client-side guard to prevent browser import
- All consumers (quoteSession/crypto.ts, server startup) import by name — no wildcard imports
- Not a dumping ground: only exports cryptographic primitives (`encryptField`, `decryptField`, `hashForLookup`, `maskValue`, `validateCryptoEnv`)

---

## 2. Boundary Leaks

### LEAK-01 — Plans slice reaches into Formulary's internals [HIGH]

**File:** `server/plansRouter.ts:19`
```ts
import { enrichPlansWithDrugCosts, type DrugInput } from "./formularyCalculator";
```

`plansRouter.ts` reaches directly into `formularyCalculator.ts` and calls `enrichPlansWithDrugCosts()` in its own request handler. There is no port or interface between them — the Plans slice knows the Formulary slice's internal function signatures.

**Why this is a problem:** If Formulary's function signature changes, Plans breaks at the import site with no contract protecting it. More importantly, `api/plans.ts` solves the same problem by importing from its own copy of `api/formularyCalculator.ts`, meaning the two delivery layers have incompatible dependency strategies.

**Fix:** Define a Formulary port:
```ts
// server/formulary/port.ts
export interface FormularyPort {
  enrichPlansWithDrugCosts(plans: Plan[], drugs: DrugInput[]): EnrichedPlan[];
}
```
Both Plans and api/plans.ts inject this port. The implementation lives in `server/formulary/calculator.ts` (one copy, one owner).

---

### LEAK-02 — Admin slice duplicates Plans slice's CDN configuration [HIGH]

**File:** `server/adminRouter.ts:30-60`
```ts
// ─── Shared: load state plan data from CDN (same cache as plansRouter) ────────
const CDN_BASE = "https://d2xsxph8kpxj0f.cloudfront.net/...";
const STATE_CDN_URLS: Record<string, string> = { AL: ..., AR: ..., /* 50 entries */ };
// Simple in-memory cache for admin state data (separate from plansRouter cache)
```

Admin has its own private copy of the 50-state CDN URL map and its own in-memory cache. The comment explicitly acknowledges the duplication: *"same cache as plansRouter"* — but it isn't the same cache at all, it's a separate one.

**Why this is a problem:** URL changes require updates in two places. Two separate caches mean two separate CDN fetches for the same data. The admin slice is reading plan data that belongs to the Plans slice — a cross-slice reach into domain data.

**Fix:** Plans slice exposes a `getStatePlanData(state: string)` function that Admin calls. Admin never fetches CDN data directly.

---

### LEAK-03 — `server/chatBoundary.ts` and `server/voiceWebhookBoundary.ts` are delivery-layer logic stranded in the application layer [MEDIUM]

**Files:** `server/chatBoundary.ts`, `server/voiceWebhookBoundary.ts`

These files contain logic that belongs to the Chat and Voice delivery adapters:
- `sanitizeMessagesForAI`, `PHONE_RE`, `MAX_CHAT_CONTEXT_MESSAGES` → Chat Vercel handler concerns
- `buildPlanQuery`, `buildDrugQuery` → Voice Vercel handler concerns

They live in `server/` (the application layer) only because `@vercel/node` is not installed as a dev dependency, so `api/*.ts` files can't be imported in tests. The files were created as a testability workaround.

**Why this is a problem:** The dependency arrow now points wrong: `api/chat.ts → server/chatBoundary.ts`. Infrastructure concerns (what to send to the Claude API, how to construct a Vapi URL) live in the application layer. Future developers will not know where to put new Chat or Voice logic.

**Fix:** Install `@vercel/node` as a dev dependency. Move these files to their proper slice locations and import from there directly.

---

### LEAK-04 — `client/src/lib/utils.ts` contains provider-network domain logic [HIGH]

**File:** `client/src/lib/utils.ts:49-83`

```ts
export function checkDoctorNetworkForPlan(doctors: Doctor[], plan: MedicarePlan): PlanDoctorNetworkStatus
export function checkDoctorNetworkForAllPlans(doctors: Doctor[], plans: MedicarePlan[]): Map<string, PlanDoctorNetworkStatus>
```

The function `checkDoctorNetworkForPlan` implements a probabilistic network membership algorithm (hash-based, carrier weights, plan-type modifiers). This is domain logic — it determines whether a provider is in-network. It lives in `utils.ts` between `cn()` (a Tailwind class merge helper) and nothing else.

There is a full Provider Network slice: `server/providerNetwork.ts`, `api/provider-network.ts`, `api/doctors.ts`. This client function is a client-side reimplementation of the same domain.

**Why this is a problem:**
- Business logic embedded in `utils.ts` is invisible to discovery — a maintainer looking for network-check code will look in the provider-network slice, not `utils.ts`
- The probabilistic algorithm (with carrier-specific probability boosts) is now defined twice: server-side in the Provider Network slice, client-side in `utils.ts`
- The client algorithm determines what the user sees in the UI without a server round-trip — if the server and client diverge, a user may see different in-network results depending on how they navigate

**Fix:** Move `checkDoctorNetworkForPlan` and `checkDoctorNetworkForAllPlans` to `client/src/features/provider-drug-verification/` (the existing feature slice for this). `utils.ts` should contain only pure UI utilities (`cn`, format helpers). 

---

### LEAK-05 — `client/src/lib/aiRecommendationEngine.ts` is a full scoring engine in the shared lib layer [HIGH]

**File:** `client/src/lib/aiRecommendationEngine.ts`

This file contains:
- Two complete scoring models (`MODEL_A`, `MODEL_B`) with numeric weights sourced from published research
- `scoreAllPlans()` — full plan ranking algorithm
- `getActiveModel()` / `setActiveModel()` — model selection persisted to localStorage
- `ScoringWeights`, `ExtraBenefitWeights`, `ScoringModel`, `PlanScore` types

It is imported by:
- `client/src/components/AdminAIModels.tsx` — renders scoring model admin UI
- `client/src/components/AIRecommendationBanner.tsx` — shows top recommendation
- `client/src/components/AITop3Cards.tsx` — shows ranked top 3
- `client/src/pages/Plans.tsx` — scores all plans for display

**Why this is a problem:**
- The scoring algorithm with its research-backed weights is visible in the client bundle and can be inspected/gamed by anyone using browser dev tools
- The engine lives in `lib/` (shared infrastructure) but is not infrastructure — it is a complete AI domain model
- The server has `server/healthProfileRouter.ts` which also performs health scoring; there is now no single source of truth for how plans are ranked
- Components in `components/` (supposed to be shared UI) import and invoke scoring logic, creating a de facto application layer inside the shared-component layer

**Fix:** Move to `client/src/features/match-score/` (the existing feature slice for scoring). Shared components that need scores receive them as props from the feature — they do not import the scoring engine directly.

---

### LEAK-06 — `server/_core/sdk.ts` imports the database adapter [MEDIUM]

**File:** `server/_core/sdk.ts:8`
```ts
import * as db from "../db";
```

`sdk.ts` is the OAuth/authentication adapter. It imports the database directly to look up users during token exchange. The `_core/` layer should contain framework wiring, not database calls.

**Why this is a problem:** `_core/` is supposed to be the framework port layer. A port should define an interface (`UserRepository`), not import a concrete DB connection. The current arrangement means swapping the ORM or DB driver requires modifying the auth SDK.

**Fix:** Define a `UserPort` interface in `_core/context.ts` or a separate `_core/ports.ts`. The DB implementation lives in an Auth adapter. `sdk.ts` injects the port, not the concrete DB.

---

### LEAK-07 — `server/plansRouter.ts` calls `getDb()` directly with no repository layer [MEDIUM]

**File:** `server/plansRouter.ts:17,220`
```ts
import { getDb } from "./db";
// ...
const dbConn = await getDb();
```

Plans reaches the DB directly (for carrier overrides and plan overrides). Same pattern in `adminRouter.ts`. The quoteSession slice demonstrates the correct pattern: a `repository.ts` file owns all DB reads/writes for the slice.

**Why this is a problem:** There is no boundary between the Plans use-case logic and its DB access. Changing the DB schema for carrier overrides requires hunting through the route handler to find all affected query calls. There is no seam for testing the use-case logic independently of the DB.

---

### LEAK-08 — `api/compare-stream.ts` reimplements `server/compareStream.ts` with weaker types [CRITICAL]

**File:** `api/compare-stream.ts:54,77`
```ts
function build2PlanPrompt(current: any, newPlan: any): string { ... }
function build3PlanPrompt(current: any, plan2: any, plan3: any): string { ... }
```

vs `server/compareStream.ts`:
```ts
function build2PlanPrompt(current: PlanInput, newPlan: PlanInput): string { ... }
function build3PlanPrompt(current: PlanInput, plan2: PlanInput, plan3: PlanInput): string { ... }
```

The Vercel function has zero Zod validation on the request body. The Express function validates with a full `PlanInputSchema`. The prompt-building functions have diverged (confirmed by diff: different line numbers, different type signatures). The Vercel path is the production path on Vercel.

**This is not a boundary leak — it is a direct duplication of core logic that the delivery layer should not own at all.** The prompt construction is application logic that belongs in a Compare slice core module, not copy-pasted into a delivery handler.

---

### LEAK-09 — `api/formularyCalculator.ts` is a 626-line copy of `server/formularyCalculator.ts` [CRITICAL]

Same as LEAK-08 in principle. All 626 lines of formulary calculation logic exist twice with no shared reference. Any bug fixed in one file is latent in the other.

---

## 3. Shared Code That Should Move Back Into a Slice

| Code | Current location | Should be in | Reason |
|---|---|---|---|
| `checkDoctorNetworkForPlan()` | `client/src/lib/utils.ts` | `client/src/features/provider-drug-verification/` | Domain logic for the provider-network slice |
| `checkDoctorNetworkForAllPlans()` | `client/src/lib/utils.ts` | `client/src/features/provider-drug-verification/` | Same |
| `scoreAllPlans()`, `MODEL_A`, `MODEL_B`, `ScoringModel`, `PlanScore` | `client/src/lib/aiRecommendationEngine.ts` | `client/src/features/match-score/` | Complete scoring domain model; already a named feature slice |
| `sanitizeMessagesForAI()`, `PHONE_RE`, `MAX_CHAT_CONTEXT_MESSAGES` | `server/chatBoundary.ts` | `server/chat/boundary.ts` or `api/chat.ts` directly | Delivery-layer adapter concerns |
| `buildPlanQuery()`, `buildDrugQuery()` | `server/voiceWebhookBoundary.ts` | `server/voice/boundary.ts` or `api/voice-webhook.ts` directly | Delivery-layer adapter concerns |
| CDN `STATE_CDN_URLS` map and `adminStateCache` | `server/adminRouter.ts:30-60` | `server/plans/cdnLoader.ts` (single source) | Configuration data owned by Plans slice |
| `buildPverifyPayload()` | `server/pverifyRouter.ts` (exported) | Keep here but mark as package-internal; currently testable only because it was made `export` | Fine where it is as long as no other slice imports it |

**Verification — nothing outside pverify imports `buildPverifyPayload`:**  
`grep -rn "buildPverifyPayload" server/ | grep -v pverify` → 0 results ✓

---

## 4. Infra Code That Should Move Outward Behind Ports

These are infrastructure adapters currently embedded inside the `_core/` layer (which should be framework wiring only) or directly inside application-layer files.

### 4.1 `server/_core/` adapters — should be `server/infra/` or `server/adapters/`

| File | Lines | What it is | Current layer violation |
|---|---|---|---|
| `server/_core/llm.ts` | 332 | LLM inference adapter (Forge/Anthropic HTTP) | Infrastructure adapter in framework-core layer |
| `server/_core/sdk.ts` | 304 | OAuth + JWT + user-lookup adapter; imports `../db` directly | Auth adapter + DB access in framework-core layer |
| `server/_core/map.ts` | 319 | Google Maps HTTP adapter | Infrastructure adapter in framework-core layer |
| `server/_core/voiceTranscription.ts` | 284 | Speech-to-text HTTP adapter | Infrastructure adapter in framework-core layer |
| `server/_core/notification.ts` | 114 | Push notification HTTP adapter | Infrastructure adapter in framework-core layer |
| `server/_core/imageGeneration.ts` | 92 | Image generation HTTP adapter; imports `server/storage` | Infrastructure adapter in framework-core layer |
| `server/_core/dataApi.ts` | 64 | Generic Forge Data API adapter | Infrastructure adapter in framework-core layer |
| `server/storage.ts` | ~100 | S3/storage HTTP adapter; called by imageGeneration only | Infrastructure adapter in application layer |

**The correct `_core/` contents:** `trpc.ts`, `context.ts`, `cookies.ts`, `env.ts`, `index.ts`, `systemRouter.ts`, `oauth.ts`, `vite.ts` — these are framework wiring, not external service calls.

**What a port looks like:**
```ts
// server/ports/llm.ts
export interface LLMPort {
  invoke(params: InvokeParams): Promise<InvokeResult>;
}
```
```ts
// server/infra/llm.ts  (implements LLMPort using Forge/Anthropic)
export const forgeLLM: LLMPort = { invoke: ... };
```
```ts
// server/healthProfileRouter.ts  (consumes port, not implementation)
import type { LLMPort } from "../ports/llm";
// injected or imported as the named adapter
```

Currently `healthProfileRouter.ts` imports `invokeLLM` directly from `_core/llm`. This is the only slice that uses the LLM adapter — the coupling is 1:1, so the practical risk is low. But when a second LLM consumer is added (or when the Forge API endpoint changes), there is no seam.

### 4.2 `server/compareRouter.ts` — inline HTTP calls to Forge API [MEDIUM]

`compareRouter.ts` makes `fetch()` calls directly to the Forge API inside the tRPC handler. There is no port or adapter — the URL construction, error handling, and response parsing are inline application code.

**What's happening:** The Compare slice has no LLM adapter. Instead of using `_core/llm.ts` (which exists), it has its own inline fetch. This means if the Forge API auth changes, there are two places to update: `_core/llm.ts` and `compareRouter.ts`.

**Fix:** `compareRouter.ts` calls `invokeLLM()` like `healthProfileRouter.ts` does. The inline fetch is removed.

### 4.3 `server/pverifyRouter.ts` — module-level token cache as hidden state [MEDIUM]

The pVerify OAuth token is cached at module scope. This is an infrastructure concern (caching) embedded in the application layer (the router). In a serverless environment this cache has no effect. In a multi-process Express environment, each process has its own cache.

**Fix:** Extract a `PverifyClient` class with explicit `getToken()` method into `server/infra/pverify.ts`. The client manages its own cache internally. The router imports the client as a dependency.

---

## 5. Recommended Target Architecture Map

This is the target state. It does not propose a layer-based monolith — slices remain the primary organizing principle. Each slice gets hexagonal discipline inside its own directory.

```
medicare-quote-app/
│
├── shared/
│   └── security/
│       └── crypto.ts          ← Domain service (✓ already correct)
│
├── server/
│   │
│   ├── _core/                 ← Framework wiring ONLY (prune the 7 adapters out)
│   │   ├── index.ts           ← Express bootstrap + tRPC mount + Vite
│   │   ├── trpc.ts            ← publicProcedure / protectedProcedure / adminProcedure
│   │   ├── context.ts         ← TrpcContext type
│   │   ├── env.ts             ← Typed env vars
│   │   ├── oauth.ts           ← OAuth route registration only (delegates to infra/auth)
│   │   ├── cookies.ts         ← Cookie helpers
│   │   ├── systemRouter.ts    ← Health check
│   │   └── vite.ts            ← Dev server integration
│   │
│   ├── ports/                 ← Interfaces that slices depend on (NEW)
│   │   ├── llm.ts             ← LLMPort interface
│   │   ├── storage.ts         ← StoragePort interface
│   │   └── pverify.ts         ← PverifyPort interface
│   │
│   ├── infra/                 ← Adapter implementations (MOVED from _core/)
│   │   ├── llm.ts             ← Implements LLMPort via Forge/Anthropic
│   │   ├── storage.ts         ← Implements StoragePort via S3 (MOVED from server/storage.ts)
│   │   ├── pverify.ts         ← PverifyClient with token cache (EXTRACTED from pverifyRouter)
│   │   ├── map.ts             ← MOVED from _core/map.ts
│   │   ├── voiceTranscription.ts ← MOVED from _core/
│   │   ├── imageGeneration.ts ← MOVED from _core/
│   │   ├── notification.ts    ← MOVED from _core/
│   │   └── dataApi.ts         ← MOVED from _core/
│   │
│   ├── db.ts                  ← DB connection singleton (stays, used by slices' repos)
│   ├── routers.ts             ← tRPC root router (assembles slices)
│   │
│   ├── quoteSession/          ← ✓ GOLD STANDARD — already correct
│   │   ├── schemas.ts         ← Domain models
│   │   ├── tokens.ts          ← Domain: resume token primitives
│   │   ├── crypto.ts          ← Domain: purpose-scoped crypto wrapper
│   │   ├── repository.ts      ← Adapter: DB reads/writes + enc/dec
│   │   └── router.ts          ← Transport: tRPC procedures
│   │
│   ├── plans/                 ← REFACTOR from plansRouter.ts
│   │   ├── cdnLoader.ts       ← Adapter: CloudFront fetch + in-memory cache (SINGLE COPY)
│   │   ├── cdnUrls.ts         ← Config: STATE_CDN_URLS map (SINGLE COPY)
│   │   ├── overridesRepo.ts   ← Adapter: DB reads for carrier/plan overrides
│   │   └── router.ts          ← Transport: Express routes (registerPlansRoute etc.)
│   │
│   ├── formulary/             ← REFACTOR from formularyCalculator.ts
│   │   ├── calculator.ts      ← Domain: pure drug cost calculation (NO infra deps)
│   │   └── port.ts            ← Port: FormularyPort interface
│   │       (api/plans.ts and server/plans/router.ts both import FormularyPort)
│   │
│   ├── eligibility/           ← REFACTOR from pverifyRouter.ts
│   │   ├── payload.ts         ← Domain: buildPverifyPayload (pure, no deps)
│   │   └── router.ts          ← Transport: tRPC procedures; injects PverifyPort
│   │
│   ├── compare/               ← REFACTOR: merge compareRouter + compareStream
│   │   ├── prompts.ts         ← Domain: build2PlanPrompt, build3PlanPrompt (typed, tested)
│   │   ├── router.ts          ← Transport: tRPC non-streaming compare
│   │   └── stream.ts          ← Transport: Express SSE streaming compare
│   │       (api/compare-stream.ts imports from compare/prompts.ts — no duplication)
│   │
│   ├── healthProfile/         ← REFACTOR from healthProfileRouter.ts
│   │   ├── scoring.ts         ← Domain: health scoring logic
│   │   ├── profiles.ts        ← Domain: toAIHealthProfile, toDeidentifiedProfile
│   │   └── router.ts          ← Transport: tRPC + SSE; injects LLMPort
│   │
│   ├── chat/                  ← REFACTOR: give chatBoundary a proper home
│   │   └── boundary.ts        ← Domain: sanitizeMessagesForAI, PHONE_RE, window cap
│   │       (api/chat.ts imports from here; test imports from here)
│   │
│   ├── voice/                 ← REFACTOR: give voiceWebhookBoundary a proper home
│   │   └── boundary.ts        ← Domain: buildPlanQuery, buildDrugQuery
│   │       (api/voice-webhook.ts imports from here)
│   │
│   ├── providers/             ← REFACTOR from providerNetwork.ts
│   │   └── router.ts          ← Transport: Express routes
│   │
│   ├── admin/                 ← REFACTOR from adminRouter.ts
│   │   └── router.ts          ← Transport: tRPC admin procedures (no CDN fetch — calls plans/cdnLoader)
│   │
│   └── cms/                   ← REFACTOR: rename cmsPipeline to cms slice
│       └── pipeline.ts        ← Application: sync orchestration + cron
│
├── api/                       ← Vercel serverless handlers — THIN ONLY
│   ├── compare-stream.ts      ← Imports compare/prompts.ts; no business logic inline
│   ├── formularyCalculator.ts ← DELETED; consumers import from server/formulary/calculator.ts
│   ├── plans.ts               ← Imports server/formulary/port.ts; calls plans CDN loader
│   ├── chat.ts                ← Imports server/chat/boundary.ts (already done)
│   ├── voice-webhook.ts       ← Imports server/voice/boundary.ts (already done)
│   ├── bluebutton-callback.ts ← Self-contained (fine)
│   ├── doctors.ts             ← Self-contained (fine)
│   ├── provider-network.ts    ← Self-contained (fine)
│   └── validate-zip.ts        ← Self-contained (fine)
│
└── client/src/
    │
    ├── _core/                 ← tRPC client, theme, auth hooks (thin)
    │
    ├── features/              ← Client slices (already structured correctly)
    │   ├── match-score/
    │   │   ├── engine.ts      ← MOVED from lib/aiRecommendationEngine.ts
    │   │   └── components/    ← AIRecommendationBanner, AITop3Cards, AdminAIModels
    │   ├── provider-drug-verification/
    │   │   ├── networkCheck.ts ← MOVED from lib/utils.ts (checkDoctorNetworkForPlan)
    │   │   └── components/
    │   ├── quote-session/     ← (already exists)
    │   ├── plan-compare/      ← (already exists)
    │   └── ...
    │
    ├── components/            ← Shared UI ONLY (no business logic, no scoring)
    │   ├── PlanCard.tsx       ← Accepts score as a prop, does not import scoring engine
    │   └── ...
    │
    └── lib/
        ├── utils.ts           ← cn() only — NO domain logic
        ├── trpc.ts            ← tRPC client setup
        └── types.ts           ← Shared TypeScript types
```

---

### Prioritized migration sequence

The sequence below respects test stability — changes that require test updates come after the tests that would catch regressions already exist.

| Step | Change | Risk | Unlocks |
|---|---|---|---|
| 1 | Install `@vercel/node` as dev dep | None | LEAK-03 fix, api/ test coverage |
| 2 | Extract `server/formulary/` from both copies; delete `api/formularyCalculator.ts` | Low (pure logic, no infra) | api/plans.ts correctness |
| 3 | Extract `server/compare/prompts.ts` with typed signatures; have both `compareStream.ts` and `api/compare-stream.ts` import from it; delete inline `any` versions | Medium (prompt change must be validated) | api/compare-stream.ts gains Zod validation |
| 4 | Extract `server/plans/cdnUrls.ts`; update adminRouter to import from there | Low | Removes CDN URL duplication |
| 5 | Move `checkDoctorNetworkForPlan` → `client/src/features/provider-drug-verification/networkCheck.ts` | Low | Cleans utils.ts |
| 6 | Move `aiRecommendationEngine.ts` → `client/src/features/match-score/engine.ts`; update all imports | Medium (4 import sites) | Scoring logic in its slice |
| 7 | Move `_core/` adapter files to `server/infra/`; update import paths | Low (import-only change) | `_core/` becomes semantically clean |
| 8 | Move `server/chatBoundary.ts` → `server/chat/boundary.ts`; move `voiceWebhookBoundary.ts` → `server/voice/boundary.ts` | Low | Correct layer placement |

---

### Summary scorecard

| Area | Score | Notes |
|---|---|---|
| Quote Session slice integrity | ✅ 10/10 | Gold standard — use as the template |
| Other server slice isolation | ⚠️ 5/10 | Plans↔Formulary coupling; no repo layer in most slices |
| Hexagonal layer discipline (server) | ⚠️ 4/10 | 7 infra adapters in `_core/`; compareRouter has inline fetch |
| Delivery layer integrity | ❌ 2/10 | 626-line duplicate; `api/compare-stream` uses `any`, diverged prompts |
| Client slice integrity | ⚠️ 5/10 | Feature dirs exist; but scoring engine and network logic in `lib/` |
| Cross-slice isolation | ✅ 8/10 | No slice imports another slice's internals (except Plans→Formulary) |
| PHI boundary integrity | ✅ 9/10 | Encryption confined to quoteSession; minimization functions exported+tested |
| Shared code hygiene | ⚠️ 4/10 | `lib/utils.ts` has domain logic; `lib/aiRecommendationEngine.ts` is a full engine |
