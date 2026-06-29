# Shared Code Audit
**Branch:** `feat/vertical-slices-prod`  
**Date:** 2026-06-28  
**Scope:** `shared/`, `server/_core/`, `client/src/lib/`, `client/src/contexts/`, `client/src/hooks/`, `client/src/_core/`

---

## What "shared" means here

A module belongs in shared if and only if **two or more slices depend on it and it has no opinion about any slice's domain rules.**

Infrastructure adapters (crypto, HTTP clients, session management) belong in shared.  
Domain logic (plan scoring, doctor network check, SNP classification) does not.

---

## Inventory

| Location | File | Lines | Description |
|---|---|---|---|
| `shared/` | `const.ts` | 5 | Platform constants |
| `shared/` | `types.ts` | 3 | Re-export barrel |
| `shared/_core/` | `errors.ts` | 12 | HttpError base class |
| `shared/security/` | `crypto.ts` | ~400 | AES-256-GCM encryption engine |
| `server/_core/` | `env.ts` | 11 | Env config object |
| `server/_core/` | `trpc.ts` | 46 | tRPC factory + procedures |
| `server/_core/` | `context.ts` | 25 | Request context builder |
| `server/_core/` | `cookies.ts` | 40 | Cookie options helper |
| `server/_core/` | `llm.ts` | 332 | LLM invocation via Forge/Gemini |
| `server/_core/` | `sdk.ts` | 304 | OAuth + JWT + DB user sync |
| `server/_core/` | `dataApi.ts` | 57 | Generic Forge Data API client |
| `server/_core/` | `notification.ts` | 110 | Owner notification via Forge |
| `server/_core/` | `oauth.ts` | 65 | OAuth callback Express route |
| `server/_core/` | `voiceTranscription.ts` | 197 | Whisper STT adapter |
| `server/_core/` | `imageGeneration.ts` | 70 | Image generation + S3 upload |
| `server/_core/` | `map.ts` | 344 | Google Maps proxy wrapper |
| `server/_core/` | `systemRouter.ts` | 28 | Health + notifyOwner tRPC routes |
| `server/_core/types/` | `manusTypes.ts` | 70 | Auth protobuf TypeScript types |
| `client/src/lib/` | `trpc.ts` | 4 | tRPC React client factory |
| `client/src/lib/` | `utils.ts` | 80 | `cn()` + doctor network algorithm |
| `client/src/lib/` | `types.ts` | ~180 | Domain types + `classifySnpType()` |
| `client/src/lib/` | `aiRecommendationEngine.ts` | 304 | MODEL_A/B + `scoreAllPlans()` |
| `client/src/lib/` | `mockData.ts` | 1,284 | Mostly dead mock data |
| `client/src/contexts/` | `QuoteHandoffContext.tsx` | 55 | Home→Plans in-memory handoff |
| `client/src/contexts/` | `ThemeContext.tsx` | 60 | Light/dark theme |
| `client/src/hooks/` | `useComposition.ts` | 65 | IME composition handling |
| `client/src/hooks/` | `useMobile.tsx` | 22 | Mobile breakpoint |
| `client/src/hooks/` | `usePersistFn.ts` | 18 | Stable function reference |
| `client/src/hooks/` | `useSessionState.ts` | 80 | sessionStorage-backed state |
| `client/src/_core/hooks/` | `useAuth.ts` | 70 | Auth state + logout |

---

## Part 1: Shared Code That Is Appropriate

These items are correctly placed. Do not move them.

---

### `shared/security/crypto.ts` ✅

**Why it belongs:** AES-256-GCM with key rotation, AAD binding, and HMAC lookup is pure cryptographic infrastructure. No slice should re-implement this. Multiple slices depend on it: `server/quoteSession/crypto.ts` imports it, and any future slice handling PHI will also need it.

The server-only guard (`if (typeof window !== 'undefined') throw`) is correct — field-level encryption must never run in the browser. The file's location in `shared/` is slightly misleading since it can't be client-side, but since the client never imports it, it causes no harm.

**42 passing tests. Do not touch.**

---

### `shared/_core/errors.ts` ✅

**Why it belongs:** `HttpError` is a generic HTTP error primitive with no domain meaning. It's used in `sdk.ts` (`ForbiddenError`) and is the right level of abstraction for cross-cutting error handling.

**Caveat:** Currently only used in one place. If it stays at one call site forever, consider inlining it. For now it earns its keep.

---

### `server/_core/env.ts` ✅

**Why it belongs:** Single validated access point for environment variables. All server code should import from here, not from `process.env` directly. The `ENV` object ensures that adding a new env var requires exactly one edit.

**Minor issue:** All values use `?? ""` fallback, which means missing vars silently return an empty string rather than failing at startup. The crypto module's `validateCryptoEnv()` already handles this for encryption keys; the same pattern should apply to `CMS_MARKETPLACE_API_KEY` (see maintainability audit CONST-02).

---

### `server/_core/trpc.ts` ✅

**Why it belongs:** tRPC procedure factories (`publicProcedure`, `protectedProcedure`, `adminProcedure`) are the delivery infrastructure used by every tRPC router. No slice-specific logic here.

**One note:** `adminProcedure` currently checks `ctx.user.role === 'admin'` — this is the Manus platform role, not a Medicare domain concept. The separate `adminPassword` check in `adminRouter.ts` is a different pattern that bypasses this middleware. The maintainability audit covers this (Batch 4-C). Once fixed, `adminProcedure` becomes the authoritative auth gate and remains correctly placed in `_core`.

---

### `server/_core/context.ts` ✅

**Why it belongs:** tRPC context creation is infrastructure. It calls `sdk.authenticateRequest()` and returns the hydrated context for all procedures. No slice logic here.

---

### `server/_core/cookies.ts` ✅

**Why it belongs:** Cookie option computation (httpOnly, sameSite, secure based on request protocol) is pure HTTP infrastructure. No business rules.

---

### `server/_core/dataApi.ts` ✅

**Why it belongs:** Generic Forge WebDevService proxy client. Pure HTTP adapter that knows nothing about what data it's fetching. Any slice can call it.

---

### `server/_core/types/manusTypes.ts` ✅

**Why it belongs:** Auto-generated from protobuf definitions for the Manus auth service. Infrastructure types with no domain meaning.

---

### `server/_core/oauth.ts` ✅

**Why it belongs:** OAuth callback route registration is platform infrastructure — it handles the OAuth redirect flow and calls `sdk`. No business logic.

---

### `server/_core/systemRouter.ts` ✅

**Why it belongs:** Health check + owner notification are system-level concerns that don't belong to any slice. Correctly placed.

---

### `client/src/lib/trpc.ts` ✅

**Why it belongs:** Three lines — `createTRPCReact<AppRouter>()`. The thinnest possible adapter. Correct.

---

### `client/src/contexts/ThemeContext.tsx` ✅

**Why it belongs:** Light/dark theme is pure UI infrastructure with no business rules.

---

### `client/src/hooks/useComposition.ts` ✅

**Why it belongs:** CJK IME composition handling (Safari Safari compositionEnd-before-keyDown workaround). Cross-cutting UI primitive used by chat and any text input.

---

### `client/src/hooks/usePersistFn.ts` ✅ (with one caveat)

**Why it belongs:** Stable function reference utility — a React pattern primitive.

**Caveat:** The type definition uses `(...args: any[]) => any`. Should be tightened to a generic constraint, but not worth a dedicated fix.

---

### `client/src/hooks/useSessionState.ts` ✅

**Why it belongs:** `sessionStorage`-backed `useState` is a genuinely cross-cutting persistence primitive. Multiple features use session state for different purposes. The API is domain-neutral.

---

### `client/src/_core/hooks/useAuth.ts` ✅

**Why it belongs:** Auth state + logout is platform infrastructure. The `_core/` placement is consistent with the server `_core/` convention. Correctly isolated.

---

## Part 2: Shared Code That Should Be Pushed Back Into Slices

These items are in shared because they were convenient to put there, not because they are truly cross-cutting. Business logic belongs close to the slice that owns it.

---

### `client/src/lib/aiRecommendationEngine.ts` → `client/src/features/plan-scoring/`

**Problem:** This file contains the core Medicare Advantage plan selection algorithm — `MODEL_A` and `MODEL_B` with weights derived from J.D. Power, Commonwealth Fund, and NIH research. This is domain logic, not infrastructure. Putting it in `lib/` implies it is a generic utility. It is not.

**Who uses it:**

| File | Import |
|---|---|
| `client/src/pages/Plans.tsx` | `scoreAllPlans`, `MODEL_B`, `getActiveModel` |
| `client/src/components/AIRecommendationBanner.tsx` | `PlanScore`, `ScoringModel` types |
| `client/src/components/AITop3Cards.tsx` | `PlanScore`, `ScoringModel` types |
| `client/src/components/AdminAIModels.tsx` | `scoreAllPlans`, `MODEL_A_CONFIG`, `MODEL_B_CONFIG`, `ScoringModel` |
| `client/src/components/PlanDetailsModal.tsx` | `PlanScore` type |

All consumers are in the plan display/selection slice. None of the feature slices outside plans use this.

**Why it matters:** The scoring algorithm will need to change when CMS updates weighting guidelines or SelectQuote updates business priorities. Engineers should be able to find this logic in `features/plan-scoring/`, not buried in a `lib/` directory alongside Tailwind utilities.

**Action:**
```
client/src/features/plan-scoring/
  lib/
    scoringEngine.ts    ← aiRecommendationEngine.ts moved here
    scoringModels.ts    ← MODEL_A and MODEL_B config objects extracted here
  types/
    scoring.ts          ← PlanScore, ScoringModel, ScoringWeights interfaces
```

All imports update from `@/lib/aiRecommendationEngine` to `@/features/plan-scoring/lib/scoringEngine`.

---

### `client/src/lib/utils.ts:checkDoctorNetworkForPlan()` → `client/src/features/provider-network/lib/`

**Problem:** `utils.ts` is the home of `cn()` (a 2-line Tailwind class merger). It also contains `checkDoctorNetworkForPlan()` and `checkDoctorNetworkForAllPlans()` — a 50-line probabilistic network membership algorithm that uses NPI + contract ID hashing, carrier heuristics, and plan type adjustments. Domain logic with no business being in `utils.ts`.

**Specific issues:**
1. The algorithm uses carrier names (`"unitedhealth"`, `"humana"`, `"aetna"`) as magic strings inline
2. The `majorCarriers` array is an undocumented business rule embedded in a utility file
3. The probability thresholds (`0.65`, `0.15`, `0.10`, `0.08`) are undocumented

**Who uses it:** `client/src/pages/Plans.tsx` only.

**Action:**
```
client/src/features/provider-network/lib/
  networkMembership.ts   ← checkDoctorNetworkForPlan(), checkDoctorNetworkForAllPlans()
  constants.ts           ← MAJOR_CARRIERS array, BASE_PROBABILITY, etc.
```

`utils.ts` retains only `cn()`. The file drops to 3 lines.

---

### `client/src/lib/types.ts:classifySnpType()` → `client/src/features/plan-scoring/lib/`

**Problem:** `types.ts` should be a pure type declaration file. `classifySnpType()` is a function that classifies CMS SNP plan types from raw string data. Business logic does not belong in a type file.

```ts
// Current location: client/src/lib/types.ts
export function classifySnpType(snpType?: string, planName?: string): SnpCategory {
  const raw = ((snpType || '') + ' ' + (planName || '')).toUpperCase();
  if (raw.includes('D-SNP') || raw.includes('DSNP') || raw.includes('DUAL')) return 'DSNP';
  // ...
}
```

This parses CMS data field strings — a plans-slice responsibility.

**Action:** Move `classifySnpType()` to `client/src/features/plan-scoring/lib/snpClassifier.ts`. Keep the `SnpCategory` type in `client/src/lib/types.ts` (it is a domain type needed by multiple components). Update the one import site.

---

### `client/src/contexts/QuoteHandoffContext.tsx` → `client/src/features/quote-intake/`

**Problem:** `QuoteHandoffContext` is the in-memory handoff mechanism that carries `{ hasMA, verifyResult, doctors, drugs }` from the Home page through navigation to the Plans page. This is feature logic for the quote intake flow — it belongs with the other quote intake code.

**Secondary problem:** The context types `doctors: any[]` and `drugs: any[]` instead of `Doctor[]` and `RxDrug[]` (covered in the maintainability audit).

**Action:**
```
client/src/features/quote-intake/
  contexts/
    QuoteHandoffContext.tsx   ← moved from client/src/contexts/
  hooks/
    useQuoteHandoff.ts        ← the useQuoteHandoff() hook extracted from the context file
```

The `QuoteHandoffProvider` is still registered in `App.tsx` — import path updates only.

---

### `server/_core/voiceTranscription.ts` → `server/voice/`

**Problem:** The Whisper STT adapter is in `_core/` but only the voice webhook uses it. `_core/` should contain infrastructure that any slice might use. Voice transcription is specific to the voice feature.

**Current callers:** Search the codebase — this module does not appear to be imported by any production file currently (the voice webhook at `api/voice-webhook.ts` uses Vapi, not Whisper directly). It may be aspirational infrastructure.

**Action:**
1. If unused: delete (per code-creep audit pattern — confirm before deletion).
2. If used: move to `server/voice/whisperClient.ts`.

---

### `server/_core/imageGeneration.ts` → wherever image generation is used

**Problem:** `imageGeneration.ts` imports `storagePut` from `server/storage` — a slice-level infrastructure import — making it not truly shared. It's also a feature adapter rather than a cross-cutting primitive.

**Current callers:** No production code appears to import this module (another aspirational holdover from the Manus template).

**Action:** If unused: delete. If used: move to the slice that owns image generation.

---

## Part 3: Shared Code That Should Become Infrastructure Adapters

These items are attempting to be infrastructure but have implementation details that belong behind a port.

---

### `server/_core/sdk.ts` — imports the database directly

**Problem:** `SDKServer` is supposed to be the OAuth + session management adapter. But `authenticateRequest()` does this:

```ts
// server/_core/sdk.ts:180-220
import * as db from "../db";  // ← Direct DB import in _core

async authenticateRequest(req: Request): Promise<User> {
  const session = await this.verifySession(sessionCookie);
  let user = await db.getUserByOpenId(session.openId);  // ← DB query
  if (!user) {
    const userInfo = await this.getUserInfoWithJwt(sessionCookie);
    await db.upsertUser({ ... });                       // ← DB write
    user = await db.getUserByOpenId(userInfo.openId);  // ← DB query
  }
  await db.upsertUser({ openId: user.openId, lastSignedIn: ... }); // ← DB write every request
}
```

`_core/sdk.ts` imports from `../db` — this is a dependency inversion violation. The SDK (an OAuth adapter) should not directly call the database. It creates:
- Circular potential: `_core` is meant to be infrastructure that slices import; slices import from `_core`; `_core` now imports from the DB layer (which slices also use)
- Tight coupling: Changing the user schema requires touching the SDK adapter
- Testability hazard: Testing `authenticateRequest` requires a real or mocked DB

**What should happen:** Inject a user repository port:

```ts
// server/_core/auth/userRepository.port.ts
export interface UserRepository {
  getUserByOpenId(openId: string): Promise<User | null>;
  upsertUser(data: UpsertUserInput): Promise<void>;
}

// server/_core/sdk.ts — constructor accepts the port
class SDKServer {
  constructor(
    private readonly client: AxiosInstance,
    private readonly users: UserRepository  // ← injected
  ) {}
}
```

The concrete DB adapter (`server/db.ts`) implements `UserRepository`. The SDK never imports the DB directly.

---

### `server/_core/notification.ts` — throws `TRPCError` from an infrastructure adapter

**Problem:** `notifyOwner()` calls `validatePayload()` which throws `TRPCError`:

```ts
// server/_core/notification.ts:45
throw new TRPCError({
  code: "BAD_REQUEST",
  message: "Notification title is required.",
});
```

`TRPCError` is an HTTP/RPC transport concern. An infrastructure adapter should not know about the transport protocol. This means:
1. `notifyOwner` can only be called from tRPC contexts
2. Using it from a Vercel API handler or a background job requires catching TRPCError and translating
3. Testing requires mocking tRPC internals

**What should happen:** Return a discriminated union:

```ts
type NotifyResult =
  | { ok: true }
  | { ok: false; error: "VALIDATION_ERROR"; message: string }
  | { ok: false; error: "SERVICE_UNAVAILABLE" };

export async function notifyOwner(payload: NotificationPayload): Promise<NotifyResult> {
  if (!isNonEmptyString(payload.title)) {
    return { ok: false, error: "VALIDATION_ERROR", message: "title is required" };
  }
  // ...
}
```

The tRPC handler in `systemRouter.ts` translates the result into a `TRPCError`. The notification adapter stays transport-agnostic.

---

### `server/_core/llm.ts` — hardcodes model and thinking config as infrastructure defaults

**Problem:** `invokeLLM()` hardcodes the model selection and thinking budget in the infrastructure adapter:

```ts
// server/_core/llm.ts:268-272
payload.model = "gemini-2.5-flash";
payload.max_tokens = 32768;
payload.thinking = { "budget_tokens": 128 };
```

These are business decisions (which model to use, whether extended thinking is needed) being made in the infrastructure layer. The health profile router calls `invokeLLM()` and gets Gemini with 128-token thinking whether or not that's appropriate for the task.

**What should happen:** Accept model and config from callers:

```ts
export type InvokeParams = {
  messages: Message[];
  model?: string;              // default: "gemini-2.5-flash"
  maxTokens?: number;          // default: 4096 (not 32768)
  enableThinking?: boolean;    // default: false
  thinkingBudget?: number;     // only used when enableThinking: true
  // ... existing params
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const model = params.model ?? "gemini-2.5-flash";
  const maxTokens = params.maxTokens ?? 4096;
  
  payload.model = model;
  payload.max_tokens = maxTokens;
  
  if (params.enableThinking) {
    payload.thinking = { budget_tokens: params.thinkingBudget ?? 128 };
  }
  // ...
}
```

This lets the health profile router opt in to extended thinking for complex AI narrative tasks, while structured scoring tasks (if they used `invokeLLM`) would not pay the extended thinking penalty.

---

## Part 4: Shared Code to Delete

---

### `server/_core/map.ts` — unused template holdover

**Evidence:** No production file imports `server/_core/map.ts`. Running:
```bash
grep -rn "from.*_core/map\|from.*map" server/ --include="*.ts" | grep -v node_modules | grep -v "map.ts"
# → no results
```

**What it is:** A 344-line Google Maps proxy adapter left over from the Manus template. Includes full type definitions for Directions, DistanceMatrix, Geocoding, Places, Elevation, TimeZone, and Roads APIs — none of which are used in a Medicare plan quote app.

**Action:** Delete `server/_core/map.ts`.

---

### `client/src/hooks/useMobile.tsx` — duplicate of `features/mobile-results/lib/useIsMobile.ts`

**Evidence:**
```ts
// client/src/hooks/useMobile.tsx
const MOBILE_BREAKPOINT = 768;
export function useIsMobile() { /* uses matchMedia */ }

// client/src/features/mobile-results/lib/useIsMobile.ts
// (identical logic, same breakpoint)
```

Two implementations of the same hook with identical behavior. The one in `hooks/` at root level was retained when the feature slice version was created.

**Action:** Delete `client/src/hooks/useMobile.tsx`. Update any imports to use the feature version. (Check: `client/src/components/Header.tsx` and `client/src/pages/Plans.tsx` likely import from the root hooks version.)

---

### `shared/types.ts` — misleading barrel that re-exports DB schema as shared types

**What it does:**
```ts
// shared/types.ts
export type * from "../drizzle/schema";   // ← all DB table types, server-only
export * from "./_core/errors";           // ← HttpError
```

**Problems:**
1. Re-exporting `drizzle/schema` as "shared types" implies these types can be used anywhere. They cannot — they are Drizzle ORM types that only make sense on the server.
2. No client code imports from `shared/types.ts` (client uses `client/src/lib/types.ts`).
3. No server code currently imports from `shared/types.ts` either — they import directly from `drizzle/schema` or from `shared/_core/errors`.

**Action:** Delete `shared/types.ts`. It has no active importers and its purpose is misleading. Callers import from the actual source (`drizzle/schema`, `shared/_core/errors`) directly.

---

### `shared/const.ts:UNAUTHED_ERR_MSG` and `NOT_ADMIN_ERR_MSG` — single-use strings

**What they are:**
```ts
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
```

**Who uses them:**
- `UNAUTHED_ERR_MSG` → `server/_core/trpc.ts` (one location) + `client/src/main.tsx` (one location, for an error boundary message)
- `NOT_ADMIN_ERR_MSG` → `server/_core/trpc.ts` (one location)

The error codes `10001` / `10002` are Manus platform conventions, not Medicare domain codes. They should be inlined at their one call site. Keeping them in `shared/const.ts` gives the impression these strings are a stable API contract shared across many modules, when they are not.

**Action:** Inline `UNAUTHED_ERR_MSG` and `NOT_ADMIN_ERR_MSG` in `server/_core/trpc.ts`. Remove from `shared/const.ts`. For `client/src/main.tsx`, inline the string or replace it with a generic "Please sign in" message.

**What remains in `shared/const.ts` after this:** `COOKIE_NAME`, `ONE_YEAR_MS`, `AXIOS_TIMEOUT_MS` — these three are legitimately shared between server OAuth and client auth flows.

---

## Part 5: Proposed Standard — What Is Allowed vs Forbidden in Shared

### Allowed in `shared/`

A module belongs in `shared/` if it satisfies **all three conditions**:

1. **Used by ≥2 independent consumers** (not the same slice calling itself)
2. **Zero domain knowledge** — it contains no Medicare, eligibility, plan, or PHI business rules
3. **No imports from any slice** — it does not import from `server/plansRouter`, `server/quoteSession`, `server/adminRouter`, `client/src/features/*`, or any other slice

```
shared/
  security/
    crypto.ts       ✅  AES-256-GCM, HMAC, key rotation — pure crypto primitive
  _core/
    errors.ts       ✅  HttpError — generic HTTP error primitive
  const.ts          ✅  COOKIE_NAME, ONE_YEAR_MS, AXIOS_TIMEOUT_MS — platform constants
```

**Not allowed in `shared/`:**
- Domain types (Medicare plan types, SNP classification, filter state) → `client/src/lib/types.ts` (client-only) or inline in the slice
- DB schema re-exports → import from `drizzle/schema` directly
- Error message strings used in one place → inline them
- Feature adapters (voice transcription, image generation) → move to the owning slice

---

### Allowed in `server/_core/`

A module belongs in `server/_core/` if it satisfies **all three conditions**:

1. **Infrastructure** — HTTP clients, session management, request context, dev tooling
2. **No slice imports** — does not import from `server/quoteSession`, `server/plansRouter`, `server/adminRouter`, etc.
3. **No DB imports** — does not import from `server/db` directly (the DB belongs to slices via their repositories)

```
server/_core/
  env.ts              ✅  Env config — platform infrastructure
  trpc.ts             ✅  tRPC procedures — delivery infrastructure
  context.ts          ✅  Request context — delivery infrastructure
  cookies.ts          ✅  Cookie options — HTTP infrastructure
  dataApi.ts          ✅  Forge Data API adapter — external API client
  llm.ts              ✅  LLM invocation adapter — external API client (fix model config)
  sdk.ts              🔧  OAuth + JWT — OK, but remove DB import (inject UserRepository)
  notification.ts     🔧  Forge notification — OK, but remove TRPCError (use result type)
  oauth.ts            ✅  OAuth route registration — platform infrastructure
  systemRouter.ts     ✅  Health + notify — system-level tRPC routes
  types/manusTypes.ts ✅  Auth protobuf types — infrastructure types
  vite.ts             ✅  Dev server setup — tooling
```

**Not allowed in `server/_core/`:**
- Feature adapters used by a single slice (voice transcription, image generation) → move to the slice
- Unused template modules (map.ts) → delete
- Direct DB imports → inject a repository port

---

### Allowed in `client/src/lib/`

`client/src/lib/` is the client equivalent of `server/_core/`. It should contain only:

```
client/src/lib/
  trpc.ts             ✅  tRPC React client — delivery infrastructure
  utils.ts            ✅  cn() only after moving doctor network functions out
  types.ts            ✅  Domain type interfaces (MedicarePlan, Doctor, etc.) — TYPES ONLY
  a11y/               ✅  Accessibility primitives (focus trap) — UI infrastructure
```

**Not allowed in `client/src/lib/`:**
- Business logic functions (scoring engine, doctor network algorithm, SNP classifier) → move to owning feature
- Mock data → move to test fixtures or delete
- `classifySnpType()` — domain logic — belongs in features/plan-scoring

---

### Allowed in `client/src/contexts/`

Contexts belong here if they are **UI infrastructure** (theme, locale, layout) or **platform concerns** (auth, navigation state).

```
client/src/contexts/
  ThemeContext.tsx    ✅  UI infrastructure
```

**Not allowed in `client/src/contexts/`:**
- Feature-specific handoff state (QuoteHandoffContext) → move to `features/quote-intake/contexts/`

---

### Allowed in `client/src/hooks/`

Root-level hooks belong here only if they are **genuinely cross-cutting** and have **no domain knowledge**.

```
client/src/hooks/
  useComposition.ts   ✅  IME handling — UI primitive
  usePersistFn.ts     ✅  Stable function reference — React primitive
  useSessionState.ts  ✅  sessionStorage state — storage primitive
```

**Not allowed in `client/src/hooks/`:**
- Duplicate hooks (`useMobile.tsx` → delete; use `features/mobile-results/lib/useIsMobile.ts`)
- Feature-specific state hooks → move to `features/{feature}/hooks/`

---

## Summary Table

| Module | Current location | Classification | Action |
|---|---|---|---|
| `shared/security/crypto.ts` | `shared/security/` | ✅ Appropriate | No change |
| `shared/_core/errors.ts` | `shared/_core/` | ✅ Appropriate | No change |
| `shared/const.ts:COOKIE_NAME,ONE_YEAR_MS,AXIOS_TIMEOUT_MS` | `shared/` | ✅ Appropriate | No change |
| `shared/const.ts:UNAUTHED_ERR_MSG,NOT_ADMIN_ERR_MSG` | `shared/` | ❌ Delete | Inline at call site |
| `shared/types.ts` | `shared/` | ❌ Delete | Remove file; callers import from sources |
| `server/_core/env.ts` | `server/_core/` | ✅ Appropriate | No change |
| `server/_core/trpc.ts` | `server/_core/` | ✅ Appropriate | No change |
| `server/_core/context.ts` | `server/_core/` | ✅ Appropriate | No change |
| `server/_core/cookies.ts` | `server/_core/` | ✅ Appropriate | No change |
| `server/_core/dataApi.ts` | `server/_core/` | ✅ Appropriate | No change |
| `server/_core/oauth.ts` | `server/_core/` | ✅ Appropriate | No change |
| `server/_core/systemRouter.ts` | `server/_core/` | ✅ Appropriate | No change |
| `server/_core/types/manusTypes.ts` | `server/_core/types/` | ✅ Appropriate | No change |
| `server/_core/llm.ts` | `server/_core/` | 🔧 Needs fix | Make model + thinking configurable by callers |
| `server/_core/sdk.ts` | `server/_core/` | 🔧 Needs fix | Inject UserRepository port; remove DB import |
| `server/_core/notification.ts` | `server/_core/` | 🔧 Needs fix | Return result type instead of throwing TRPCError |
| `server/_core/voiceTranscription.ts` | `server/_core/` | 📦 Push to slice | Move to `server/voice/` (or delete if unused) |
| `server/_core/imageGeneration.ts` | `server/_core/` | 📦 Push to slice | Move to owning slice (or delete if unused) |
| `server/_core/map.ts` | `server/_core/` | ❌ Delete | Unused template holdover |
| `client/src/lib/trpc.ts` | `client/src/lib/` | ✅ Appropriate | No change |
| `client/src/lib/types.ts` (types) | `client/src/lib/` | ✅ Appropriate | Keep types; remove `classifySnpType()` |
| `client/src/lib/types.ts:classifySnpType()` | `client/src/lib/` | 📦 Push to slice | Move to `features/plan-scoring/lib/snpClassifier.ts` |
| `client/src/lib/utils.ts:cn()` | `client/src/lib/` | ✅ Appropriate | No change |
| `client/src/lib/utils.ts:checkDoctorNetworkForPlan()` | `client/src/lib/` | 📦 Push to slice | Move to `features/provider-network/lib/` |
| `client/src/lib/aiRecommendationEngine.ts` | `client/src/lib/` | 📦 Push to slice | Move to `features/plan-scoring/lib/` |
| `client/src/lib/mockData.ts` | `client/src/lib/` | 🔴 Partially dead | Delete MOCK_PLANS + POPULAR_DOCTORS; keep POPULAR_RX_DRUGS |
| `client/src/contexts/ThemeContext.tsx` | `client/src/contexts/` | ✅ Appropriate | No change |
| `client/src/contexts/QuoteHandoffContext.tsx` | `client/src/contexts/` | 📦 Push to slice | Move to `features/quote-intake/contexts/` |
| `client/src/hooks/useComposition.ts` | `client/src/hooks/` | ✅ Appropriate | No change |
| `client/src/hooks/usePersistFn.ts` | `client/src/hooks/` | ✅ Appropriate | No change |
| `client/src/hooks/useSessionState.ts` | `client/src/hooks/` | ✅ Appropriate | No change |
| `client/src/hooks/useMobile.tsx` | `client/src/hooks/` | ❌ Delete | Duplicate; use `features/mobile-results/lib/useIsMobile.ts` |
| `client/src/_core/hooks/useAuth.ts` | `client/src/_core/` | ✅ Appropriate | No change |

**Legend:** ✅ Appropriate · 🔧 Needs fix in-place · 📦 Move to slice · ❌ Delete
