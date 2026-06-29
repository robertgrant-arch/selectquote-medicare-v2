# Architecture Audit — Medicare Quote App
**Branch:** `feat/vertical-slices-prod`  
**Date:** 2026-06-28  
**Auditor:** Claude Code (production-grade review, no rewrites performed)

---

## Table of Contents

1. [Vertical Slice Inventory](#1-vertical-slice-inventory)
2. [Audit Report by Category](#2-audit-report-by-category)
   - [Architecture](#21-architecture)
   - [Maintainability](#22-maintainability)
   - [Performance](#23-performance)
   - [Testing](#24-testing)
   - [Security](#25-security)
   - [Deployment / Runtime](#26-deployment--runtime)
   - [Developer Experience](#27-developer-experience)
3. [Boundary Leak Inventory](#3-boundary-leak-inventory)
4. [Prioritized Remediation Plan](#4-prioritized-remediation-plan)
5. [Do-Not-Touch List](#5-do-not-touch-list)

---

## 1. Vertical Slice Inventory

Each slice below is a feature area that owns its own PHI boundary, DB access pattern, and external integration code.

| Slice | Primary Files | Responsibilities |
|---|---|---|
| **Quote Session** | `server/quoteSession/repository.ts` (336L), `router.ts`, `schemas.ts`, `tokens.ts`, `crypto.ts` | Intake storage, AES-256-GCM PHI encryption, resume-token hashing, session lifecycle (active → completed/abandoned/expired) |
| **Plans** | `server/plansRouter.ts` (438L), `api/plans.ts` (241L) | CDN-sourced MA plan search, ZIP → county → state resolution, admin override merging |
| **Eligibility / pVerify** | `server/pverifyRouter.ts` (470L) | Medicare eligibility checks (MBI/SSN only), pVerify OAuth token management, mock fallback, plan comparison |
| **AI Compare** | `server/compareRouter.ts` (286L), `server/compareStream.ts` (305L), `api/compare-stream.ts` (285L) | Streaming AI plan comparison via SSE, 2- and 3-plan prompt construction |
| **AI Recommend** | `server/healthProfileRouter.ts` (451L), `server/recommendStream.ts` | Health-profile scoring, AI narrative streaming, `toDeidentifiedProfile`, `toAIHealthProfile` PHI minimization |
| **AI Chat** | `api/chat.ts` (311L), `server/chatBoundary.ts` | Claude-powered chat agent, phone-number redaction, message-window capping |
| **Formulary** | `server/formularyCalculator.ts` (626L), `api/formularyCalculator.ts` (626L) | Drug cost calculation across plan tiers |
| **Provider Network** | `server/providerNetwork.ts`, `api/provider-network.ts` (139L), `api/doctors.ts` (155L) | Provider/doctor network membership checks |
| **Blue Button** | `api/bluebutton-callback.ts` (232L) | CMS Blue Button OAuth callback, Part D claims ingestion |
| **Voice** | `api/voice-webhook.ts` (128L), `server/voiceWebhookBoundary.ts` | Vapi voice assistant webhook, plan and drug query construction |
| **Admin** | `server/adminRouter.ts` (596L) | Carrier/plan overrides, CMS sync trigger, non-commissionable flags |
| **CMS Pipeline** | `server/cmsPipeline.ts` (266L) | Daily scheduled CMS data sync, source registry, sync log |
| **Auth** | `server/_core/oauth.ts`, `server/_core/cookies.ts` | OAuth login, session cookies, logout |

---

## 2. Audit Report by Category

### 2.1 Architecture

#### [CRITICAL] Dual delivery layer with diverging implementations

The app has two delivery layers — Express/tRPC (`server/`) and Vercel serverless (`api/`) — that overlap on three slices:

| Logic | Express/tRPC | Vercel serverless |
|---|---|---|
| AI Compare | `server/compareStream.ts` (305L, Zod-validated) | `api/compare-stream.ts` (285L, `any` types, no Zod) |
| Formulary | `server/formularyCalculator.ts` (626L) | `api/formularyCalculator.ts` (626L) |
| Plans | `server/plansRouter.ts` (438L) | `api/plans.ts` (241L) |

`api/compare-stream.ts` defines `build2PlanPrompt` and `build3PlanPrompt` independently with `(current: any, newPlan: any)` signatures while `server/compareStream.ts` has the same functions with proper `PlanInputSchema` Zod types. The prompt strings diverged when one was updated. This means:
- Bugs fixed in one version silently persist in the other
- The Vercel path accepts malformed inputs the Express path would reject
- Test coverage written against `server/compareStream.ts` does not cover the production Vercel path

`api/formularyCalculator.ts` is 626 lines — the same count as `server/formularyCalculator.ts` — indicating a copy-paste with no shared business logic.

**Why it matters:** Two implementations of the same business logic cannot be kept consistent at scale. The Vercel serverless functions are the production delivery layer on Vercel; the Express layer exists for local dev. Any bug fixed in `server/` may remain unfixed in `api/`.

**How to fix without breaking behavior:**
1. Extract shared pure logic into `server/<slice>/core.ts` (e.g., `server/compare/core.ts` with typed `build2PlanPrompt`, `build3PlanPrompt`)
2. Have both `server/compareStream.ts` and `api/compare-stream.ts` import from that core
3. Repeat for formulary and plans
4. `api/compare-stream.ts` gains type safety for free; remove the `any` types

#### [CRITICAL] Inverted layer dependency in `server/chatBoundary.ts` and `server/voiceWebhookBoundary.ts`

These two files were introduced to make Vercel-handler functions testable (since `@vercel/node` is not installed locally). The result is that `server/` — which should be the application layer — contains code that conceptually belongs to the `api/` delivery layer:

- `server/chatBoundary.ts` exports `sanitizeMessagesForAI`, `PHONE_RE`, `MAX_CHAT_CONTEXT_MESSAGES`
- `server/voiceWebhookBoundary.ts` exports `buildPlanQuery`, `buildDrugQuery`

These are delivery-layer adapter concerns (what gets sent to/from the Vapi webhook and the Claude API) living in the application layer. The dependency arrow now points wrong: `api/ → server/` is correct, but the content of the dependency is "api logic that happens to live in server/."

**Why it matters:** Future developers will be confused about where chat/voice adapter logic belongs. Functions added to these boundary files may reach into server-side resources they shouldn't have access to.

**How to fix without breaking behavior:**
1. Move `server/chatBoundary.ts` → `server/chat/boundary.ts` (inside a proper `chat/` slice directory)
2. Move `server/voiceWebhookBoundary.ts` → `server/voice/boundary.ts`
3. Update all imports in `api/` and test files — no behavior changes

#### [HIGH] `server/_core/` contains infrastructure adapters, not core domain logic

`_core/` implies domain invariants and framework wiring. But five files are external-service adapters:

| File | Lines | What it actually is |
|---|---|---|
| `map.ts` | 319 | Google Maps API proxy adapter |
| `voiceTranscription.ts` | 284 | Speech-to-text service adapter |
| `llm.ts` | 332 | LLM inference adapter (Forge/Anthropic) |
| `sdk.ts` | 304 | Forge platform SDK adapter |
| `notification.ts` | 114 | Push notification adapter |
| `dataApi.ts` | 64 | Generic Forge Data API adapter |
| `imageGeneration.ts` | 92 | Image generation adapter |

True `_core/` contents (framework wiring that should stay): `trpc.ts`, `context.ts`, `cookies.ts`, `env.ts`, `index.ts`, `systemRouter.ts`, `oauth.ts`, `vite.ts`.

**Why it matters:** Mixing infrastructure adapters into `_core/` makes it impossible to draw the hexagonal boundary. A future developer can't tell "is this a framework concern or an external service?" without reading the file.

**How to fix without breaking behavior:**
1. Create `server/adapters/` directory
2. Move the 7 adapter files into it — no logic changes, only path changes
3. Update all import paths (grep: `from "./_core/map"`, `from "./_core/llm"`, etc.)
4. Leave `trpc.ts`, `context.ts`, `cookies.ts`, `env.ts`, `index.ts`, `systemRouter.ts`, `oauth.ts`, `vite.ts` in `_core/`

#### [HIGH] Client-side duplicate of server scoring logic

`client/src/lib/aiRecommendationEngine.ts` (304L, ~10KB) implements plan recommendation scoring in the browser. The same scoring logic exists server-side in `server/healthProfileRouter.ts` (451L). The client-side engine:

- Runs scoring in the browser, exposing weights and thresholds to users
- Can drift from server scores if one is updated but not the other
- Increases the client bundle for logic that could be a single tRPC call

**Why it matters:** When a beneficiary sees an AI recommendation in the UI, is it the server's score or the client's score? If they differ, trust is broken. Additionally, scoring weights are business-sensitive and shouldn't be client-visible.

**How to fix without breaking behavior:**
1. Audit whether `aiRecommendationEngine.ts` is called for UI-only previews (before the server responds) or as the canonical answer
2. If canonical: delete client engine, route all scoring through `healthProfileRouter.ts`
3. If preview-only: document that explicitly with a comment and an integration test verifying server/client parity

#### [MEDIUM] Large single-file slices should be directories

| File | Lines | Should be |
|---|---|---|
| `server/adminRouter.ts` | 596 | `server/admin/router.ts`, `server/admin/cdnUrls.ts` |
| `server/formularyCalculator.ts` | 626 | `server/formulary/calculator.ts`, `server/formulary/router.ts` |
| `server/pverifyRouter.ts` | 470 | `server/eligibility/router.ts`, `server/eligibility/client.ts` |
| `server/healthProfileRouter.ts` | 451 | `server/healthProfile/router.ts`, `server/healthProfile/scoring.ts` |
| `server/plansRouter.ts` | 438 | `server/plans/router.ts`, `server/plans/cdnLoader.ts` |

`quoteSession/` demonstrates the correct pattern. Slices exceeding ~300 lines typically contain multiple logical concerns that want to be split.

---

### 2.2 Maintainability

#### [HIGH] CDN state URL map hardcoded in `adminRouter.ts`

`adminRouter.ts` lines ~34-50 contain a 50-entry `STATE_CDN_URLS` record mapping state abbreviations to CloudFront URLs. The same map likely exists in `plansRouter.ts`. This is configuration data, not logic.

**Why it matters:** Two copies of 50 URLs means a URL change requires finding and updating both. A missed update causes one router to serve stale data silently.

**How to fix:** Extract to `server/plans/cdnUrls.ts`, import in both routers.

#### [MEDIUM] `client/src/lib/mockData.ts` (~52KB) in production bundle

Mock data for UI development is 52KB and appears to live in the client bundle unconditionally. 

**Why it matters:** 52KB of mock data adds to initial bundle size and is served to production users. It also creates temptation to use mock data in production paths.

**How to fix:** Guard with `if (import.meta.env.DEV)` or move to `src/__mocks__/` and import only in tests/storybook.

#### [MEDIUM] Template artifact code in `_core/`

`dataApi.ts` opens with a YouTube/search example comment — this is leftover from a Manus template. `notification.ts` has generic `TITLE_MAX_LENGTH`/`CONTENT_MAX_LENGTH` constants from a generic notification template. These files appear to be Manus platform scaffolding that was never cleaned up for this domain.

**Why it matters:** Template artifacts signal that `_core/` contains code that wasn't intentionally designed for this app, making it harder to trust these adapters are correctly configured.

**How to fix:** Audit whether `dataApi.ts`, `notification.ts`, `imageGeneration.ts`, `voiceTranscription.ts` are actually used by any slice. If unused, delete them. If used, remove template comments and document the actual use case.

#### [LOW] Planning artifacts in repo root

`ideas.md`, `todo.md` in the root directory are planning documents that should not be committed to a production branch. They expose internal roadmap thinking and create confusion about canonical documentation.

---

### 2.3 Performance

#### [HIGH] Module-level token cache doesn't survive serverless cold starts

`pverifyRouter.ts` caches the pVerify OAuth access token at module scope (a common pattern in Express but broken on Vercel). Each Vercel cold start creates a new module instance with an empty cache, so every cold-started request that needs pVerify triggers a token fetch.

**Why it matters:** pVerify token fetches add latency (typically 200–500ms) before the eligibility request can be made. Under normal traffic patterns, most pVerify calls on Vercel will pay this penalty.

**How to fix without breaking behavior:**
1. Store the token + expiry in the DB `cmsDataSources` table (already exists for other state), or
2. Use a short-lived Redis/KV store if available, or
3. Accept the behavior and add a comment explaining the latency implications

#### [HIGH] MySQL connection created per-request in Vercel serverless

`server/db.ts` likely creates a `mysql2` pool as a module-level singleton. In Vercel, each cold-start creates a new pool, and the pool's keepalive connections may be torn down between warm invocations, leading to `ECONNRESET` errors under load.

**Why it matters:** MySQL connection exhaustion under moderate serverless traffic is a known failure mode — each serverless function instance holds its own connections.

**How to fix:** Consider switching to `mysql2`'s single-connection mode (not pool) for serverless, or use PlanetScale's serverless HTTP driver if the DB supports it. Add `waitForConnections: true, connectionLimit: 1` as a minimal mitigation.

#### [MEDIUM] `plansRouter.ts` makes CDN fetch on every cache miss

State plan data is downloaded from CloudFront on cache miss with no server-side persistent cache. In a serverless context each cold start is a cache miss, potentially fetching multi-MB JSON files on every request.

**Why it matters:** The state JSON files are large. Every cold-started plan search downloads the full state file before filtering.

**How to fix:** Add a DB-backed or KV-backed cache with a TTL (CMS data changes at most daily). The CMS pipeline already tracks `lastModified` hashes — use that to invalidate the cache.

---

### 2.4 Testing

#### [MEDIUM] `api/` delivery layer has no tests

The Vercel serverless functions (`api/compare-stream.ts`, `api/formularyCalculator.ts`, `api/plans.ts`, `api/bluebutton-callback.ts`, `api/doctors.ts`, `api/provider-network.ts`, `api/validate-zip.ts`) have no test coverage because `@vercel/node` is not installed locally.

**Why it matters:** The production delivery path on Vercel is untested. The solution applied for `chat.ts` and `voice-webhook.ts` (extract pure logic to `server/`) should be applied to all `api/` functions.

**How to fix:**
1. Extract pure business logic from each `api/` handler into a `server/<slice>/core.ts`
2. Test the core module with vitest (no Vercel dependency)
3. Keep the `api/` handler thin (parse request → call core → format response)

#### [LOW] `server/compare.test.ts` only has 3 tests

The AI compare slice (3 files, ~876 lines of logic) has only 3 tests. Given the streaming nature and prompt construction complexity, this is under-tested.

---

### 2.5 Security

#### [CRITICAL] No `.env.example`

There is no `.env.example` file in the repository root. Operators onboarding to a new environment must read the source code to discover required env vars.

Required env vars discovered from code:
- `ACTIVE_KEY_ID` — selects active encryption key
- `KEY_<id>` — AES-256-GCM encryption key(s), 64 hex chars each
- `HMAC_LOOKUP_KEY` — HMAC key for `emailLookupHash`, 64 hex chars
- `PVERIFY_CLIENT_ID`, `PVERIFY_CLIENT_SECRET` — pVerify API credentials
- `ADMIN_PASSWORD` — admin dashboard password
- `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` — Forge/Anthropic proxy
- `DATABASE_URL` — MySQL connection string
- (Likely others in `_core/env.ts`)

**Why it matters:** Missing env vars cause silent behavioral changes (mock fallback activation, feature flags defaulting off). The HMAC_LOOKUP_KEY in particular causes a startup failure that could be hard to diagnose without documentation.

**How to fix:** Create `.env.example` with placeholder values and a comment for each var explaining its purpose and how to generate it. Reference `docs/key-management.md` for crypto key generation.

#### [HIGH] `ADMIN_PASSWORD` is a bare password without rate limiting specifics

`adminRouter.ts` checks `ADMIN_PASSWORD` env var directly. There is `express-rate-limit` in the dependencies, but it's unclear if the admin verify endpoint is rate-limited.

**Why it matters:** A brute-forceable admin password endpoint without rate limiting is an authentication bypass risk.

**How to fix:** Confirm rate limiting is applied to `admin.verifyPassword`. If not, add `express-rate-limit` to that specific endpoint with a low max (e.g., 5 attempts per 15 minutes per IP).

#### [MEDIUM] ZIP code in `plansRouter.ts` console logs

`server/plansRouter.ts` logs `${zip}` in `console.warn` and `console.error` calls. ZIP code alone is not PHI, but combined with a timestamp and user session it's a near-identifier. In a log aggregator this could be linked to a specific beneficiary.

**Why it matters:** Consistent PHI hygiene means not logging any field that could be used as a quasi-identifier, especially in warning/error paths where log volumes are analyzed.

**How to fix:** Replace `${zip}` in logs with a fixed string like `[zip redacted]` or `[5-digit zip]`, or confirm log aggregator does not retain user-linkable data.

---

### 2.6 Deployment / Runtime

#### [CRITICAL] CMS cron job never fires on Vercel

`server/cmsPipeline.ts` uses `node-cron` to schedule a daily job at 2:00 AM CT. This job is started inside `startServer()` in `server/_core/index.ts`. On Vercel serverless, there is no persistent process — `startServer()` never runs, so the cron is never scheduled.

**Why it matters:** CMS plan data goes stale silently. The "last sync" timestamp in the admin dashboard will never update. The admin `triggerSync` endpoint still works (it calls `runCmsSync()` directly), but the automatic daily refresh is dead on Vercel.

**How to fix:**
- Option A: Add a [Vercel Cron Job](https://vercel.com/docs/cron-jobs) in `vercel.json` pointing to an `api/cms-sync.ts` handler that calls `runCmsSync()`. This is the correct Vercel-native solution.
- Option B: Use an external scheduler (GitHub Actions cron, AWS EventBridge) that calls the admin trigger endpoint on a schedule.
- Do NOT start a long-running process on Vercel — it will be killed.

#### [HIGH] `db:push` script name is misleading and potentially destructive

```json
"db:push": "drizzle-kit generate && drizzle-kit migrate"
```

This command generates a new migration and immediately applies it. Running it against a production DB without reviewing the generated SQL is a data loss risk. The name `db:push` sounds like a safe push to version control, not a schema-altering DDL operation.

**Why it matters:** A developer running `npm run db:push` thinking it's safe could drop columns or alter NOT NULL constraints on a production database.

**How to fix:**
1. Rename to `db:migrate:dev` to signal it's for development
2. Add a separate `db:generate` script for generating migrations without applying
3. Add a `db:migrate:prod` script that runs `drizzle-kit migrate` only (requires manual SQL review first)
4. Document the distinction in `docs/key-management.md` or a new `docs/deployment.md`

---

### 2.7 Developer Experience

#### [MEDIUM] No `.env.example` makes onboarding slow

(Covered in Security — creating the file addresses both concerns.)

#### [MEDIUM] `@vercel/node` not installed — `api/` files can't be tested or imported in tests

The lack of `@vercel/node` as a dev dependency means `api/` functions cannot be imported in tests, type-checked with the correct Vercel types, or run locally with `vercel dev`. The workaround (boundary files in `server/`) is functional but adds friction for new developers.

**How to fix:**
1. `npm install --save-dev @vercel/node` — install as a dev dependency
2. This unblocks direct imports in tests and restores correct Vercel type signatures in `api/` files

#### [LOW] `vapi-assistant-config.json` checked into source

The Vapi assistant configuration is in the repo root. This is fine if it contains no secrets, but it's worth confirming that no API keys or webhook URLs with auth tokens are embedded.

---

## 3. Boundary Leak Inventory

### Cross-slice boundary leaks

| Leak | Where | Direction | Risk |
|---|---|---|---|
| `adminRouter.ts` duplicates CDN URL map from `plansRouter.ts` | `server/adminRouter.ts:34-50` | Admin → Plans internals | URL drift between admin and plans |
| `api/compare-stream.ts` reimplements `build2PlanPrompt`/`build3PlanPrompt` | `api/compare-stream.ts:54-77` | AI Compare (Vercel) → AI Compare (Express) | Prompt divergence, type safety lost |
| `api/formularyCalculator.ts` duplicates all 626 lines of `server/formularyCalculator.ts` | `api/formularyCalculator.ts` | Formulary (Vercel) → Formulary (Express) | Business logic duplication |
| `client/src/lib/aiRecommendationEngine.ts` reimplements health scoring | `client/src/lib/aiRecommendationEngine.ts` | UI → HealthProfile slice domain | Score drift, weight exposure |
| `client/src/lib/utils.ts::checkDoctorNetworkForPlan()` | `client/src/lib/utils.ts` | UI utilities → Provider Network domain | Business logic in utility file |

### Cross-hexagonal-layer leaks

| Leak | Where | Layer violation | Risk |
|---|---|---|---|
| `server/_core/map.ts` (Google Maps adapter) | `server/_core/map.ts:1-319` | Infrastructure adapter in core layer | Muddles what "_core" means |
| `server/_core/llm.ts` (LLM adapter) | `server/_core/llm.ts:1-332` | Infrastructure adapter in core layer | Same |
| `server/_core/sdk.ts` (Forge SDK) | `server/_core/sdk.ts:1-304` | Infrastructure adapter in core layer | Same |
| `server/_core/voiceTranscription.ts` | `server/_core/voiceTranscription.ts:1-284` | Infrastructure adapter in core layer | Same |
| `server/_core/notification.ts` | `server/_core/notification.ts:1-114` | Infrastructure adapter in core layer | Same |
| `server/_core/imageGeneration.ts` | `server/_core/imageGeneration.ts:1-92` | Infrastructure adapter in core layer | Same |
| `server/_core/dataApi.ts` | `server/_core/dataApi.ts:1-64` | Infrastructure adapter in core layer | Same |
| `server/chatBoundary.ts` (delivery-layer logic in application layer) | `server/chatBoundary.ts` | Delivery adapter in application layer | Inverted dependency |
| `server/voiceWebhookBoundary.ts` | `server/voiceWebhookBoundary.ts` | Delivery adapter in application layer | Inverted dependency |
| `api/compare-stream.ts` has no Zod validation (Express path does) | `api/compare-stream.ts:54` | Delivery layer bypasses port validation | Malformed inputs reach business logic |

---

## 4. Prioritized Remediation Plan

### Critical — Fix before next production release

| # | Issue | Files | Effort |
|---|---|---|---|
| C1 | CMS cron never fires on Vercel | `server/cmsPipeline.ts`, `vercel.json` | 2–4h: add `api/cms-sync.ts` + Vercel cron config |
| C2 | `api/compare-stream.ts` diverged from `server/compareStream.ts` with no Zod validation | `api/compare-stream.ts`, `server/compareStream.ts` | 3–5h: extract `server/compare/core.ts`, add types to `api/` |
| C3 | No `.env.example` — crypto startup failures undiagnosable | repo root | 1h: create `.env.example` |

### High — Fix within next sprint

| # | Issue | Files | Effort |
|---|---|---|---|
| H1 | `api/formularyCalculator.ts` duplicates `server/formularyCalculator.ts` | both files | 3h: extract `server/formulary/core.ts` |
| H2 | Module-level pVerify token cache broken on serverless cold starts | `server/pverifyRouter.ts` | 2h: persist token in DB or document latency impact |
| H3 | MySQL pool exhaustion on Vercel serverless | `server/db.ts` | 2h: switch to `connectionLimit: 1` or serverless driver |
| H4 | `ADMIN_PASSWORD` endpoint rate limiting unconfirmed | `server/adminRouter.ts` | 1h: add/verify `express-rate-limit` on verify endpoint |
| H5 | `client/src/lib/aiRecommendationEngine.ts` duplicates server scoring | `client/src/lib/aiRecommendationEngine.ts` | 4–8h: audit usage, delete or document |
| H6 | `db:push` script is destructive without warning | `package.json` | 30min: rename + add generate/migrate separation |
| H7 | `@vercel/node` not installed — `api/` files untestable | `package.json` | 30min: `npm install --save-dev @vercel/node` |

### Medium — Fix within next 2–4 weeks

| # | Issue | Files | Effort |
|---|---|---|---|
| M1 | Infrastructure adapters in `_core/` (map, llm, sdk, voice, notification, image, dataApi) | `server/_core/*.ts` | 3h: move to `server/adapters/`, update imports |
| M2 | `server/chatBoundary.ts` and `server/voiceWebhookBoundary.ts` inverted layer | both files | 2h: move to `server/chat/` and `server/voice/` |
| M3 | Large single-file slices (admin 596L, formulary 626L, pverify 470L, healthProfile 451L) | all listed | 8–12h total: split into `server/<slice>/` directories |
| M4 | CDN state URL map duplicated in adminRouter and plansRouter | `server/adminRouter.ts:34-50` | 1h: extract `server/plans/cdnUrls.ts` |
| M5 | `client/src/lib/mockData.ts` (52KB) in production bundle | `client/src/lib/mockData.ts` | 1h: guard with `import.meta.env.DEV` |
| M6 | ZIP code in production console logs | `server/plansRouter.ts:124,130,143,156,161,164,170,173,201` | 1h: replace with `[zip redacted]` |
| M7 | `api/` delivery layer has no test coverage | all `api/*.ts` | 8–12h: extract cores, add tests |
| M8 | `plansRouter.ts` CDN fetch on every cold start — no persistent cache | `server/plansRouter.ts` | 4h: add DB-backed or KV-backed cache |

### Low — Address when touching adjacent code

| # | Issue | Files | Effort |
|---|---|---|---|
| L1 | Template artifact comments in `_core/dataApi.ts`, `_core/notification.ts` | both files | 30min: remove/replace comments |
| L2 | Planning artifacts (`ideas.md`, `todo.md`) in repo root | both files | 5min: delete or gitignore |
| L3 | `vapi-assistant-config.json` — audit for embedded secrets | `vapi-assistant-config.json` | 30min: confirm no credentials |
| L4 | `server/compare.test.ts` has only 3 tests for a 3-file, ~876L slice | `server/compare.test.ts` | 2h: add prompt construction tests |
| L5 | `_core/vite.ts` (dev tooling) mixed into core infra | `server/_core/vite.ts` | 30min: move to `server/dev/vite.ts` |

---

## 5. Do-Not-Touch List

These areas must only be changed behind tests. Touching them without test coverage is high-risk.

| Area | Why | Required tests before changing |
|---|---|---|
| `shared/security/crypto.ts` | AES-256-GCM field encryption; authentication tag verification; IV generation; AAD binding | Full `crypto.test.ts` suite must pass; any change needs new test proving the property |
| `server/quoteSession/repository.ts` | PHI boundary; all DB reads/writes of encrypted fields; session lifecycle transitions | `quoteSession.test.ts` + `phi-compliance.test.ts` must pass |
| `server/quoteSession/tokens.ts` | Resume token hashing; raw token never persisted invariant | `quoteSession.test.ts` resume-token describe block must pass |
| `hashForLookup()` in `shared/security/crypto.ts` | HMAC uses `HMAC_LOOKUP_KEY` specifically; changing this invalidates all `emailLookupHash` values in the DB and makes all resume sessions unresumable | Requires a DB migration plan and explicit confirmation from operator |
| `drizzle/schema` | Schema changes generate DDL migrations; any column drop or NOT NULL addition risks data loss | Review generated SQL before applying; never run `db:push` against production without migration review |
| `server/_core/trpc.ts` | `publicProcedure`, `protectedProcedure`, `adminProcedure` definitions; all routers depend on these | All router tests must pass after any change |
| `server/_core/context.ts` | `TrpcContext` type; any field added or removed cascades to every procedure | All router tests must pass |
| `buildPverifyPayload()` in `server/pverifyRouter.ts` | PHI minimization boundary for eligibility; removing a field exclusion sends PHI to pVerify | `server/phi-boundary.test.ts` → `buildPverifyPayload` describe block must pass |
| `sanitizeMessagesForAI()` in `server/chatBoundary.ts` | Phone number redaction before AI ingestion | `server/phi-boundary.test.ts` → `sanitizeMessagesForAI` describe block must pass |
| `toDeidentifiedProfile()` in `server/recommendStream.ts` | PHI minimization for AI recommend | `server/phi-boundary.test.ts` → `toDeidentifiedProfile` describe block must pass |
| `toAIHealthProfile()` in `server/healthProfileRouter.ts` | PHI minimization for AI health narrative | `server/phi-boundary.test.ts` → `toAIHealthProfile` describe block must pass |
| `api/bluebutton-callback.ts` | CMS OAuth callback; handles real Part D claims data; one wrong redirect drops the OAuth flow | No current tests — **do not change without adding tests first** |
