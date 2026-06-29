# Delivery & Deployment Hardening Audit
**Branch:** `feat/vertical-slices-prod`  
**Date:** 2026-06-28  
**Scope:** Vercel/serverless boundaries, env handling, build config, config drift, monitoring, health checks, timeouts, retries, fallbacks, API contract stability, migration sequencing, rollout safety.

---

## Severity legend

| Symbol | Meaning |
|---|---|
| 🔴 **Critical** | Can take down production features on deploy, or silently expose secrets |
| 🟠 **High** | Real operational risk; will cause an incident under load or rollback |
| 🟡 **Medium** | Hardening gap; not breaking today but no safety net |
| 🟢 **Low** | Polish |

---

## Part 1: Runtime / Deploy Risks

---

### [D1] 🔴 The two delivery layers expose different surfaces — tRPC and recommend-stream have NO Vercel function

**This is the highest-severity finding. Verify against your actual deploy target before anything else.**

The app has two delivery layers:

| Layer | Entry | Exposes |
|---|---|---|
| Express (`server/_core/index.ts`) | `tsx watch` (dev) | `/api/plans`, `/api/validate-zip`, `/api/compare-stream`, `/api/recommend-stream`, **`/api/trpc/*`**, OAuth callback |
| Vercel serverless (`api/*.ts`) | auto-detected functions | `plans`, `validate-zip`, `compare-stream`, `chat`, `voice-webhook`, `bluebutton-callback`, `doctors`, `provider-network` |

**The client calls `/api/trpc`** (`client/src/main.tsx:43`):
```ts
httpBatchLink({ url: "/api/trpc" })
```

But there is **no `api/trpc.ts`** serverless function, no `api/trpc/[trpc].ts` catch-all, and the SPA rewrite explicitly excludes `/api/`:
```json
{ "source": "/((?!api/).*)", "destination": "/index.html" }
```

So on Vercel, `/api/trpc/*` matches no function and is **not** rewritten to the SPA — it returns 404. Every tRPC-routed feature is dead in production:

- `quoteSession.save` / `quoteSession.resume` — **the entire quote intake + resume flow**
- `pverify.eligibilityCheck` / `pverify.lookup` / `pverify.compare` — **eligibility flow**
- `healthProfile.recommend` — **AI recommend ranking**
- `compare.comparePlans` — tRPC compare path
- `admin.*` — **all admin routes**
- `auth.me` / `auth.logout` — **authentication**
- `systemRouter.health` — the only health check

Similarly, `/api/recommend-stream` is registered only in Express. There is no `api/recommend-stream.ts`. If the client calls it in production, it 404s. (Note: the performance audit referenced `api/recommend-stream.ts` in a `vercel.json` recommendation — that file does not exist and must not be assumed.)

**Why this may not have surfaced yet:** Either (a) the app is currently deployed via the Express server on a non-Vercel host (Railway, Render, a container), in which case the `api/*.ts` functions are the dead code; or (b) tRPC features genuinely fail in the Vercel deployment and haven't been exercised. Both are serious. You cannot have both delivery layers as the source of truth.

**Root cause:** The Manus/Vercel template ships `api/*.ts` serverless functions; the quote-session/eligibility/admin work was built as tRPC routers served by Express. The two were never reconciled.

**Fix — pick ONE delivery model:**

*Option A (recommended if deploying on Vercel):* Add a tRPC catch-all serverless function so the existing routers work on Vercel:
```ts
// api/trpc/[trpc].ts
import { createNextApiHandler } from "@trpc/server/adapters/next"; // or fetch adapter
import { appRouter } from "../../server/routers";
import { createContext } from "../../server/_core/context";

export default createNextApiHandler({ router: appRouter, createContext });
```
Then delete the Express-only route registration duplicates (`api/plans.ts`, `api/compare-stream.ts` overlap with `plansRouter`/`compareStream`) — pick the serverless versions as canonical and add `api/recommend-stream.ts`.

*Option B (if deploying Express on a container host):* Remove `vercel.json` and the `api/*.ts` functions; deploy the Express server. But note the `build` script can't produce a server bundle today (see D2), so this requires build changes.

**Validation:** Hit `/api/trpc/systemRouter.health` on a preview deploy. If it 404s, tRPC is not wired for Vercel.

---

### [D2] 🔴 `build` script produces no server bundle — `start` script cannot run

```json
"build": "vite build",                         // outputs client to dist/public only
"start": "NODE_ENV=production node dist/index.js"  // dist/index.js is never created
```

`vite build` builds only the client SPA into `dist/public`. There is no esbuild/tsc step that bundles `server/_core/index.ts` into `dist/index.js`. So `npm start` fails with "Cannot find module dist/index.js".

This confirms the intended production runtime is **Vercel serverless functions**, not the Express server — which makes D1 the operative risk. The `start` script is dead and misleading; a new operator running `npm run build && npm start` (the universal convention) gets a broken server.

**Fix:** Either:
- Delete the `start` script and document "production = Vercel serverless," or
- If you need the Express server in prod, add a server bundle step:
  ```json
  "build": "vite build && esbuild server/_core/index.ts --bundle --platform=node --format=esm --outfile=dist/index.js --packages=external"
  ```

---

### [D3] 🔴 `VITE_FRONTEND_FORGE_API_KEY` ships a secret into the browser bundle

The client reads `import.meta.env.VITE_FRONTEND_FORGE_API_KEY`. Any `VITE_`-prefixed variable is **inlined into the client bundle at build time** and is fully visible to anyone who opens DevTools. If this is a real Forge API credential, it is publicly exposed on every page load.

**Inventory of client-exposed env vars (all public by design):**
```
VITE_APP_ID
VITE_BB_CLIENT_ID
VITE_FRONTEND_FORGE_API_KEY     ← if this is a secret, it is leaked
VITE_FRONTEND_FORGE_API_URL
VITE_OAUTH_PORTAL_URL
VITE_VAPI_PUBLIC_KEY            ← "public" key, OK by design
VITE_VAPI_ASSISTANT_ID         ← OK
```

`VITE_VAPI_PUBLIC_KEY` and `VITE_BB_CLIENT_ID` are designed to be public (OAuth client IDs, Vapi public keys). `VITE_FRONTEND_FORGE_API_KEY` needs review — if it grants any privileged Forge access, it must be proxied through a serverless function instead of called directly from the browser.

**Fix:** Confirm what `VITE_FRONTEND_FORGE_API_KEY` authorizes. If it is anything other than a public/throttled key, move the calls server-side behind an `api/` function and remove the `VITE_` exposure.

---

### [D4] 🟠 `api/formularyCalculator.ts` is in the functions directory but is not a handler

`api/formularyCalculator.ts` (34 KB) has no `export default handler` — it is the drug-calculation module copied so `api/plans.ts` can import it. But Vercel auto-detects every `.ts` file under `api/` as a serverless function. This file will either fail function compilation or deploy as a useless zero-route function, consuming a function slot and adding build time.

**Fix:** Move shared logic out of `api/` (see shared-code/maintainability audits — move to `shared/formulary/`). Files under `api/` should only ever be request handlers.

---

### [D5] 🟠 No error monitoring anywhere

```bash
grep -rn "Sentry|datadog|captureException" → no results
```

The only observability is `console.*` (40+ tagged calls). On Vercel, `console` output goes to function logs, which are ephemeral (retained briefly, not alerting). There is no way to know a production error occurred unless someone is watching the log stream. For a PHI-handling healthcare app, silent failures in the eligibility or quote-session flow are a compliance and trust risk.

**Fix (lightweight, pays for itself):** Add Sentry for serverless functions and the React client. It is a single SDK, captures unhandled errors + stack traces, and has a free tier sufficient for this scale. Wrap each `api/` handler:
```ts
import * as Sentry from "@sentry/node";
Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
// wrap handler body in try/catch → Sentry.captureException(err)
```
PHI note: configure `beforeSend` to scrub MBI/SSN/email — the existing `sanitizeMessagesForAI` and `maskValue` patterns give you the redaction primitives.

---

### [D6] 🟠 No production health check reachable on Vercel

The only health endpoint is `systemRouter.health` (tRPC) — which is unreachable on Vercel per D1. There is no `api/health.ts`. Vercel has no built-in liveness probe, but uptime monitors (and your own smoke tests) need a cheap, dependency-light endpoint.

**Fix:** Add a standalone function:
```ts
// api/health.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, ts: Date.now() });
}
```
Optionally add `api/health/deep.ts` that checks DB connectivity (`getDb()` + `SELECT 1`) and CDN reachability — but keep the shallow one dependency-free so it always answers.

---

### [D7] 🟠 `node-cron` CMS pipeline is dead on serverless

`server/_core/index.ts` calls `startCmsPipelineCron()` at Express startup. On Vercel serverless there is no persistent process — functions are invoked per request and frozen between. The cron never fires in production. The daily CMS data sync silently does not run.

**Fix:** Replace with a Vercel Cron Job (declared in `vercel.json`) pointing at a dedicated function:
```json
{
  "crons": [{ "path": "/api/cron/cms-sync", "schedule": "0 6 * * *" }]
}
```
```ts
// api/cron/cms-sync.ts — guard with CRON_SECRET header check
```

---

### [D8] 🟡 `pverifyRouter.ts` artificial delays ship to production

Lines 448 and 466: `await new Promise(r => setTimeout(r, 1200))` and `setTimeout(r, 800)` in the mock-fallback path. On a cold serverless invocation with missing credentials, these add 1.2 s/0.8 s of pure latency while returning fake eligibility data. Covered in the performance audit (P8); repeated here because it is a deploy-safety issue — misconfigured credentials produce slow fake data instead of a fast, loud failure.

---

### [D9] 🟡 No retry on transient external calls; fallback only on AI chat

Retry/fallback inventory:
- `api/chat.ts` — tries Anthropic, falls back to OpenAI ✅ (the only fallback path)
- `plansRouter.ts:194` — county "partial match fallback" (data fallback, good)
- Everything else (CDN fetch, CMS ZIP API, pVerify, NPPES doctors) — **single attempt, no retry**

CDN and CMS APIs are external dependencies with their own transient failures. A single 503 from the CMS Marketplace API fails the entire plans request. For idempotent GETs (CDN state data, ZIP resolution, NPPES lookup), one bounded retry would materially improve reliability.

**Fix (targeted, not blanket):** Add a small retry helper for idempotent external GETs only:
```ts
async function fetchWithRetry(url: string, opts: RequestInit, retries = 1): Promise<Response> {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, opts);
      if (res.ok || i >= retries || res.status < 500) return res;
    } catch (err) { if (i >= retries) throw err; }
    await new Promise(r => setTimeout(r, 200 * (i + 1)));
  }
}
```
Do **not** add retries to non-idempotent calls (pVerify eligibility writes, DB writes, AI streaming).

---

### [D10] 🟡 Timeout vs Vercel function limit mismatch (cross-ref performance audit P1)

Code-level timeouts exceed the default Vercel function ceiling:

| Handler | Code timeout | Vercel default | Outcome |
|---|---|---|---|
| `api/compare-stream.ts` | 120 s | 60 s (Hobby) | Killed at 60 s; client sees a raw connection drop |
| `api/chat.ts` | 60 s | 60 s | Right at the edge — any overhead kills it |
| `api/plans.ts` | 8 s + 15 s = 23 s worst case | 60 s | OK, but cold-start sensitive |

`vercel.json` has no `functions` block, so all functions get defaults. Streaming handlers need explicit `maxDuration`.

**Fix:** (same as performance P1)
```json
"functions": {
  "api/compare-stream.ts": { "maxDuration": 300, "memory": 1024 },
  "api/chat.ts":           { "maxDuration": 300, "memory": 1024 },
  "api/plans.ts":          { "maxDuration": 30 }
}
```

---

## Part 2: Config Inconsistencies

---

### [C1] 🔴 `vitest.config.ts` does not include `api/` or root `server` tests directories that the regression matrix requires

Current `test.include`:
```ts
include: [
  "server/**/*.test.ts",
  "server/**/*.spec.ts",
  "shared/**/*.test.ts",
  "client/src/features/**/__tests__/*.test.ts",
  "client/src/lib/a11y/__tests__/*.test.ts",
]
```

`server/**/*.test.ts` does cover the planned `server/api.plans.test.ts` and `server/api.voice-webhook.test.ts` (the regression matrix puts API handler tests under `server/`, which is correct given this config). But:
- `client/src/lib/**/__tests__` other than `a11y` is **not** included — `client/src/lib/aiRecommendationEngine.test.ts` (regression matrix MUST-07) would not run unless placed precisely, or the glob is widened.
- No `client/src/**/*.test.tsx` — any component/hook test (`useQuoteSession`, etc.) is excluded.

**Fix:** Widen the client glob before writing the Phase 2 tests:
```ts
include: [
  "server/**/*.test.ts",
  "shared/**/*.test.ts",
  "client/src/**/*.test.ts",
  "client/src/**/*.test.tsx",
]
```

---

### [C2] 🟠 `tsconfig` excludes test files from typecheck

```json
"exclude": ["node_modules", "build", "dist", "**/*.test.ts"]
```

`npm run check` (`tsc --noEmit`) does not typecheck test files. Type errors in tests (wrong mock shapes, stale fixtures) are invisible until the test runs — and a test that fails to compile in vitest gives a worse error than tsc would. For a test-first remediation plan, the tests are first-class code and should be typechecked.

**Fix:** Remove `**/*.test.ts` from `exclude`, or add a second `tsconfig.test.json` that includes them and run both in CI.

---

### [C3] 🟠 `vercel.json` redundant rewrite + missing functions/crons config

```json
{ "source": "/api/plans", "destination": "/api/plans" }
```
This rewrite is a no-op (rewrites a path to itself). Vercel auto-detects `api/plans.ts` already. It signals confusion about how serverless routing works and should be removed. The file is also missing `functions` (D10) and `crons` (D7) blocks.

---

### [C4] 🟠 No `.env.example` for 28 environment variables

The app reads **21 server-side** and **7 client-side** env vars, none documented:

**Server (must be set in Vercel project settings):**
```
DATABASE_URL, JWT_SECRET, OAUTH_SERVER_URL, OWNER_OPEN_ID, VITE_APP_ID,
ACTIVE_KEY_ID, KEY_<id>, HMAC_LOOKUP_KEY,
CMS_MARKETPLACE_API_KEY, ADMIN_PASSWORD,
ANTHROPIC_API_KEY, OPENAI_API_KEY,
BUILT_IN_FORGE_API_KEY, BUILT_IN_FORGE_API_URL,
PVERIFY_CLIENT_ID, PVERIFY_CLIENT_SECRET, PVERIFY_API_KEY,
PORT, NODE_ENV, VERCEL_URL (auto)
```
**Client (VITE_-prefixed, inlined into bundle):**
```
VITE_APP_ID, VITE_BB_CLIENT_ID, VITE_FRONTEND_FORGE_API_KEY,
VITE_FRONTEND_FORGE_API_URL, VITE_OAUTH_PORTAL_URL,
VITE_VAPI_PUBLIC_KEY, VITE_VAPI_ASSISTANT_ID
```

A new deploy (or a new engineer) has no way to know which vars are required. Missing `HMAC_LOOKUP_KEY` or `ACTIVE_KEY_ID` will fail crypto validation at startup (good — that one fails loud); missing `CMS_MARKETPLACE_API_KEY` silently uses a committed fallback (bad — see maintainability CONST-02).

**Fix:** Commit a `.env.example` with every var, a one-line comment, and a `required|optional` marker. Group server vs client. Never commit real values.

---

### [C5] 🟡 Node version not pinned

No `.nvmrc`, no `engines` field. Vercel picks its current default Node (changes over time); local dev uses whatever the developer has. `@types/node` is `^24`, implying Node 24 intent, but nothing enforces it. A Vercel default bump could change runtime behavior (e.g., `AbortSignal.timeout` availability, fetch semantics) without a code change.

**Fix:**
```json
"engines": { "node": ">=20.0.0" }
```
plus a `.nvmrc` with the exact version, and set the Node version in Vercel project settings.

---

### [C6] 🟡 No ESLint — only Prettier

`.prettierrc` exists (formatting) but there is no ESLint config. There is no automated check for: unused imports, `no-floating-promises` (critical for the fire-and-forget `.catch()` patterns in `index.ts`), `no-explicit-any` (the maintainability audit found ~85 `any`s), exhaustive-deps on React hooks, or accidental `console.log` of PHI.

**Fix (lightweight, high value):** Add `eslint` with `typescript-eslint` and a *small* ruleset focused on correctness, not style (Prettier owns style):
```
@typescript-eslint/no-floating-promises    (error)  ← catches unhandled async
@typescript-eslint/no-explicit-any         (warn)   ← tracks the any debt
react-hooks/exhaustive-deps                 (warn)
no-console                                   (off; or custom rule for PHI)
```
Avoid the full airbnb/strict preset — it would generate thousands of style warnings that bury the real findings.

---

### [C7] 🟢 `tsconfig.node.json` has stricter rules than the main tsconfig

`tsconfig.node.json` (for `vite.config.ts`) enables `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` — but the main `tsconfig.json` does not. So the build tooling file is held to a higher standard than the entire application. Inconsistent, and the app would benefit from those three flags (they catch real dead-code and switch bugs).

**Fix:** Promote `noUnusedLocals` / `noFallthroughCasesInSwitch` to the main tsconfig (after a cleanup pass — they will surface existing violations).

---

## Part 3: Recommended Production Safeguards

Prioritized, fitted to a small-team Vercel deployment. None are heavyweight.

| # | Safeguard | Effort | Why it pays off |
|---|---|---|---|
| S1 | **Resolve the tRPC/Vercel delivery gap (D1)** | 2–4 h | Without this, core flows are either dead or running on an undocumented host. Everything else is secondary. |
| S2 | **Commit `.env.example` (C4)** | 30 min | Makes deploys reproducible; prevents silent missing-var failures. |
| S3 | **Add `api/health.ts` (D6)** | 15 min | Enables uptime monitoring + deploy smoke tests. |
| S4 | **Add `vercel.json` `functions` block (D10)** | 30 min | Stops streaming functions being killed mid-response. |
| S5 | **Remove hardcoded secret fallbacks; fail loud (maint. CONST-02/03)** | 30 min | No committed CMS key; no `admin123` default. |
| S6 | **Add Sentry to functions + client (D5)** | 2 h | First real visibility into production errors. |
| S7 | **Convert CMS cron to Vercel Cron (D7)** | 2 h | Restores the daily data sync that is currently dead. |
| S8 | **Bounded retry on idempotent external GETs (D9)** | 1 h | Survives transient CDN/CMS/NPPES 5xx. |
| S9 | **Pin Node version (C5)** | 15 min | Prevents silent runtime drift on Vercel default bumps. |
| S10 | **Review `VITE_FRONTEND_FORGE_API_KEY` exposure (D3)** | 1 h | Closes a potential public secret leak. |

---

## Part 4: API Contract Stability

### [API1] 🟠 Duplicate, divergent handlers for the same logical endpoint

The same endpoint is implemented twice with different validation and prompt logic:

| Endpoint | Express version | Vercel version | Divergence |
|---|---|---|---|
| `/api/plans` | `plansRouter.ts` | `api/plans.ts` | Different error handling; `any` types in Vercel copy |
| `/api/compare-stream` | `compareStream.ts` (Zod-validated) | `api/compare-stream.ts` (`any`, no Zod) | Different prompt builders, different validation |
| drug calc | `server/formularyCalculator.ts` | `api/formularyCalculator.ts` | Byte-identical copy that will drift |

Whichever layer is live, the other is dead — but both are maintained, so a bug fix lands in one and not the other. This is an API contract stability hazard: the "same" endpoint behaves differently depending on which file an engineer edits.

**Fix:** After resolving D1, delete the dead layer's duplicates. Move shared logic (prompt builders, formulary) to `shared/` so there is one definition (cross-ref maintainability VAL-02, CFG-01).

### [API2] 🟡 No API versioning or contract test

tRPC gives end-to-end type safety client↔server (strong contract within the app). But the raw `api/*.ts` REST handlers (consumed by the client via `fetch`, and `api/voice-webhook.ts` consumed by Vapi externally) have no schema contract. A change to the voice webhook response shape could silently break the Vapi integration.

**Fix:** The regression matrix already specifies contract tests for shared schemas (MUST-02 formulary, compare schema). Add one for the voice-webhook response shape since it has an *external* consumer (Vapi) you don't control.

---

## Part 5: Migration & Deploy Sequencing

### [M1] 🟠 Migrations are not gated to run before code deploy

```json
"db:push": "drizzle-kit generate && drizzle-kit migrate"
```

This is a manual local command. There is no deploy hook that runs migrations before the new code goes live. On Vercel, a deploy that ships code expecting a new column will fail at runtime if the migration wasn't manually run first. Four migrations exist (`0000`–`0003`), the latest being `0003_schema_hardening.sql` (PHI columns) — schema changes that the new code depends on.

**Sequencing rule for this app (forward-compatible migrations):**
1. Run `drizzle-kit migrate` against production DB **first** (additive changes only — new nullable columns, new tables, new indexes)
2. Deploy code **second**
3. For destructive changes (drop column/table): deploy code that stops using it first, then drop in a later migration

**Fix:**
- Document this sequence in the deploy runbook (CLAUDE.md or `docs/DEPLOY.md`).
- Add a CI step that runs migrations against the production/staging DB as an explicit, gated job *before* promoting the Vercel deploy — not inside a serverless function (functions are the wrong place to run DDL).
- Never auto-run `migrate` from `api/` function cold-start code.

### [M2] 🟡 `drizzle-kit generate && migrate` chained in one script blurs review

`generate` (creates migration SQL from schema diff) and `migrate` (applies it) in a single command means a developer can generate and apply in one step without reviewing the generated SQL. For a PHI schema, generated DDL must be reviewed (e.g., to confirm a column rename didn't generate as drop+add, which loses data).

**Fix:** Split into `db:generate` and `db:migrate`. Review the SQL between them.

---

## Part 6: Feature Rollout Safety

### [R1] 🟡 No feature flag mechanism — rollout is all-or-nothing per deploy

There is no flag system. Every change goes live for 100% of users on deploy. The AI scoring model selection (`MODEL_A`/`MODEL_B`) is the closest thing — it is persisted in `localStorage` per user, not server-controlled. For a regulated product, the ability to dark-launch or kill-switch a flow (e.g., disable the AI recommend stream if it misbehaves) without a redeploy is valuable.

**Fix (proportionate — do not add LaunchDarkly):** A single server-read env-var-backed flag table is enough at this scale. You already have `cmsDataSources` and admin override tables; add a small `featureFlags` table read by an admin-gated tRPC query, cached 60 s. Gate only the risky flows (AI recommend, AI compare, eligibility) behind it. This doubles as a kill switch during an incident.

### [R2] 🟡 No staged rollout / canary on Vercel

Vercel deploys are atomic (instant 100% cutover) with instant rollback via the dashboard. That is acceptable for this app's scale, but the team should know the rollback path: **promote the previous deployment in the Vercel dashboard**, which is faster than reverting + rebuilding. Document it.

### [R3] 🟢 Preview deploys are the natural canary — use them

Vercel gives every PR a preview URL. The regression matrix's manual smoke-test checklist (Phase 6, Batch 6-E) should be run against the **preview URL** before merging to the production branch. This is the lightweight canary that fits the app.

---

## Part 7: Recommended CI/CD Quality Gates

**There is no CI today** (`.github/workflows` does not exist). Every check is manual. For a PHI-handling app on a test-first remediation plan, this is the single biggest process gap after D1.

Recommended: one GitHub Actions workflow, using the scripts that already exist, ordered cheapest-to-most-expensive so it fails fast.

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
  push: { branches: [main] }

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc', cache: 'npm' }
      - run: npm ci

      # Gate 1 — typecheck (fast, catches most regressions)
      - name: Typecheck
        run: npm run check          # tsc --noEmit (after C2: include tests)

      # Gate 2 — lint (after C6 adds eslint)
      - name: Lint
        run: npx eslint . --max-warnings=0   # start permissive, ratchet down

      # Gate 3 — format check (Prettier already configured)
      - name: Format check
        run: npx prettier --check .

      # Gate 4 — tests (with required crypto env for the PHI suite)
      - name: Tests
        run: npm test
        env:
          ACTIVE_KEY_ID: k1
          KEY_k1: ${{ secrets.TEST_KEY_K1 }}        # 64-hex test key
          HMAC_LOOKUP_KEY: ${{ secrets.TEST_HMAC }}  # 64-hex test key
          # NOTE: ANTHROPIC_API_KEY test currently fails in CI (compare.test.ts:93)
          # → make that assertion skip when the key is absent, or set the secret

      # Gate 5 — build (proves the client bundle compiles)
      - name: Build
        run: npm run build

      # Gate 6 — architecture boundary check (lightweight, see below)
      - name: Boundary check
        run: bash scripts/check-boundaries.sh

      # Gate 7 — dependency audit (non-blocking warn)
      - name: Dependency audit
        run: npm audit --omit=dev --audit-level=high || true
```

### Gate-by-gate rationale (fitted to this app)

| Gate | Tool | Config note |
|---|---|---|
| **Typecheck** | `tsc --noEmit` (existing `npm run check`) | Fix C2 first so tests are typechecked too |
| **Lint** | `eslint` + `typescript-eslint` (add per C6) | Start with `--max-warnings` high, ratchet down each sprint. The one rule worth blocking on day one: `no-floating-promises` |
| **Format** | `prettier --check` (already configured) | Zero new tooling |
| **Tests** | `vitest run` (existing `npm test`) | **Must set crypto env vars** or the PHI suite fails. **Fix the `ANTHROPIC_API_KEY` assertion** (`compare.test.ts:93`) — it currently fails when the key is unset, which will red every CI run. Make it conditional. Fix C1 (vitest include) so all planned tests actually run. |
| **Build** | `vite build` (existing) | Catches client compile errors and bundle issues |
| **Architecture boundary** | small grep script (below) | No new dependency; enforces the slice rules the audits established |
| **Dependency audit** | `npm audit` | Non-blocking (`\|\| true`) to start — many transitive advisories are noise; review high/critical manually |

### Lightweight architecture boundary check (no new tooling)

A 20-line shell script enforces the rules the structural audits defined, with zero added dependencies:

```bash
# scripts/check-boundaries.sh
set -e
fail=0

# Rule 1: shared/ must not import from slices
if grep -rn "from ['\"].*\(plansRouter\|quoteSession\|adminRouter\|pverifyRouter\)" shared/ --include="*.ts"; then
  echo "❌ shared/ imports from a slice"; fail=1
fi

# Rule 2: server/_core must not import from slices (sdk.ts DB import is the known exception to fix)
if grep -rn "from ['\"]\.\./\(plansRouter\|quoteSession\|adminRouter\)" server/_core/ --include="*.ts"; then
  echo "❌ _core imports from a slice"; fail=1
fi

# Rule 3: no hardcoded CDN keys / passwords reintroduced
if grep -rn "d687412e7b53146b2631dc01974ad0a4\|admin123" server/ api/ --include="*.ts"; then
  echo "❌ hardcoded secret reintroduced"; fail=1
fi

# Rule 4: api/ files must export a handler (no stray modules like formularyCalculator.ts)
for f in api/*.ts; do
  grep -q "export default" "$f" || { echo "❌ $f has no default handler export"; fail=1; }
done

# Rule 5: no PHI fields in console.log (basic heuristic)
if grep -rn "console\.\(log\|warn\|error\).*\(mbi\|ssn\|firstName\|lastName\)" server/ api/ --include="*.ts" -i; then
  echo "❌ possible PHI in a log statement"; fail=1
fi

exit $fail
```

This codifies the audit findings as an executable gate. As the codebase matures, rules can be added (e.g., "no `any` in `api/` handlers" after the type cleanup).

### What NOT to add

- **No `dependency-cruiser` / `nx` / module-boundary frameworks** — the grep script covers the rules that matter at this size; a full graph tool is maintenance overhead the team won't sustain.
- **No Husky pre-commit hooks** — CI is the gate; pre-commit hooks slow local work and are bypassed with `--no-verify`. Run checks in CI where they can't be skipped.
- **No code-coverage threshold gate yet** — the regression matrix targets specific high-risk flows. A blanket coverage % would incentivize testing trivial code. Add a coverage *report* (visible, non-blocking) but don't gate on a number until the must-have suite exists.

---

## Summary of Findings

| ID | Sev | Area | Finding |
|---|---|---|---|
| D1 | 🔴 | Serverless boundary | tRPC + recommend-stream have no Vercel function — core flows dead or on undocumented host |
| D2 | 🔴 | Build | `build` produces no server bundle; `start` script is broken |
| D3 | 🔴 | Env / secrets | `VITE_FRONTEND_FORGE_API_KEY` may leak a secret into the client bundle |
| D4 | 🟠 | Serverless boundary | `api/formularyCalculator.ts` is a module, not a handler, in the functions dir |
| D5 | 🟠 | Monitoring | No error monitoring — only ephemeral console logs |
| D6 | 🟠 | Health check | No Vercel-reachable health endpoint |
| D7 | 🟠 | Runtime | `node-cron` CMS sync is dead on serverless |
| D8 | 🟡 | Runtime | pVerify mock-path artificial delays ship to prod |
| D9 | 🟡 | Reliability | No retry on idempotent external GETs |
| D10 | 🟡 | Timeouts | Code timeouts (120 s) exceed Vercel default (60 s) |
| C1 | 🔴 | Config drift | vitest `include` misses planned client tests |
| C2 | 🟠 | Config drift | tsconfig excludes tests from typecheck |
| C3 | 🟠 | Config drift | vercel.json redundant rewrite; no functions/crons block |
| C4 | 🟠 | Env | No `.env.example` for 28 env vars |
| C5 | 🟡 | Config drift | Node version unpinned |
| C6 | 🟡 | Tooling | No ESLint (no `no-floating-promises` enforcement) |
| C7 | 🟢 | Config drift | tsconfig.node stricter than main tsconfig |
| API1 | 🟠 | Contract | Duplicate divergent handlers for same endpoint |
| API2 | 🟡 | Contract | No contract test for external Vapi webhook |
| M1 | 🟠 | Migrations | Migrations not gated before code deploy |
| M2 | 🟡 | Migrations | generate+migrate chained; SQL unreviewed |
| R1 | 🟡 | Rollout | No feature flag / kill switch |
| R2 | 🟡 | Rollout | Rollback path (Vercel promote) undocumented |
| R3 | 🟢 | Rollout | Preview deploys unused as canary |

**The first move is D1.** Until the production delivery model is confirmed and the tRPC surface is reachable, the other safeguards are protecting a system whose core flows may not be running where you think they are.
