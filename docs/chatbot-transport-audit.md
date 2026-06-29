# Chatbot Backend Integration & Transport Audit
**Branch:** `feat/vertical-slices-prod`
**Date:** 2026-06-29
**Slice:** `client/src/features/medicare-guide-chat/`
**Server:** `api/chat.ts` (Vercel) + `server/chatBoundary.ts` (PHI port)

This audit reviews how the chatbot frontend talks to the backend, the resilience of that flow, and applies two narrow, behavior-preserving improvements (explicit cancellation + the slice's first transport tests).

---

## 1. How data flows today

**Mechanism: direct `fetch` to a route handler, streamed via SSE.** Not tRPC, not a server action.

```
useChatSession (orchestration)
  └─ streamChat()                      lib/chatStreamClient.ts  ── TRANSPORT ADAPTER
       └─ fetch POST /api/chat  { messages:[{role,content}] }   (SSE, AbortController)
            └─ api/chat.ts (Vercel serverless)
                 ├─ sanitizeMessagesForAI()   server/chatBoundary.ts  ── PHI PORT (tested)
                 └─ Anthropic (claude-haiku-4-5) stream  ‖  OpenAI (gpt-4o) fallback
            ← SSE: event: delta | done | error
       ← streamChat resolves with full text  (throws on failure/empty)
  └─ parseActionTags + dispatchChatActions   lib/chatActions.ts  ── DOMAIN MAPPING
```

**Why direct fetch (and why that's correct here):** the response is a **token stream**. tRPC v11 has no first-class SSE/streaming story in this codebase, and the rest of the app already uses raw SSE for the comparable streaming features (`compareStream`, `recommendStream`). A direct `fetch` behind an isolated adapter is the right, consistent choice — adding tRPC here would fight the streaming model for no gain. The non-streaming tRPC procedures (`quoteSession`, `pverify`, etc.) remain the right tool for their request/response shapes; chat is correctly the exception.

---

## 2. Review by dimension

| Dimension | State | Assessment |
|---|---|---|
| **Request shaping** | Hook maps history to `{role, content}` only (strips internal `error` field), excludes the local greeting (`slice(1)`), POSTs `{messages}`. System prompt is server-owned. | ✅ Clean, minimal, contract-stable. |
| **Response shaping** | `streamChat` parses SSE line protocol (`event:`/`data:`), JSON-decodes `delta` payloads, accumulates, calls `onDelta(accumulated)`. | ✅ Isolated in the adapter; presentation never sees the wire format. |
| **Error mapping** | `chatErrorMessage()` → offline / timeout (AbortError) / generic, each with the advisor phone number. `error` SSE event throws; non-200 throws; **empty stream throws** (catches a 200 that yields no tokens, e.g. a proxy returning HTML). | ✅ Honest, distinct, no failure-hiding. ⚠️ Does not distinguish HTTP 429/5xx (see §4). |
| **Retries** | Manual only: `retry()` drops the failed turn and regenerates from the last user message. No automatic retry. | ✅ Correct — no retry storms; user-initiated recovery via "Try again". |
| **Loading coordination** | Single `isLoading` flag in the hook drives composer disable, typing indicator, and streaming caret. | ✅ One source of truth. |
| **Cancellation / abort** | **Improved this pass.** `streamChat` now takes a caller-owned `AbortController`; the hook owns it, replaces it per turn, and **aborts on unmount**. Idle-timeout fires the same controller. | ✅ Explicit and testable (was: private controller, no external cancel). |
| **Timeouts** | Inactivity-based: aborts after 30s of no bytes (resets on each chunk) — catches true hangs without cutting a slow-but-active stream. Server has its own 60s `AbortSignal.timeout`. | ✅ Appropriate; idle model is better than a fixed total cap for streaming. |
| **Session continuity** | Server is **stateless** (no session). Client owns full history, sends a windowed slice; server-side PHI windowing caps at 20 (`MAX_CHAT_CONTEXT_MESSAGES`). Client persists history + open state to `sessionStorage` → survives reload. | ✅ Clean stateless model; restoration verified live. |

---

## 3. Improvements applied this pass (narrow, behavior-preserving)

1. **Explicit, caller-owned cancellation.** `streamChat(apiMessages, onDelta, controller?)` now accepts an `AbortController`. `useChatSession` holds it in `abortRef`, swaps it per request, and aborts on unmount (`useEffect(() => () => abortRef.current?.abort(), [])`). Previously the controller was private to `streamChat`, so an in-flight request couldn't be cancelled and a dangling fetch could outlive the component. No change to outcomes in normal use (the widget is app-root and rarely unmounts) — this is hygiene + testability.

2. **First transport tests for the slice** (the slice had zero tests):
   - `__tests__/chatActions.test.ts` — `parseActionTags` (extract/strip, multiple, malformed-safe, no `lastIndex` carryover) + `dispatchChatActions` (correct window events). 9 tests.
   - `__tests__/chatStreamClient.test.ts` — accumulation/progress/return, request shape (`POST /api/chat`, `{role,content}` only), non-OK throws, **empty-stream throws**, error-event throws, caller-`AbortController` respected, and `chatErrorMessage` offline/timeout/generic mapping. 7 tests.
   - These are now possible *because* transport was isolated into the adapter — the payoff of the prior refactor.

**Verification:** typecheck 0 errors; 721 tests pass (+16) / 1 skipped; live smoke confirmed the user-turn → transport → error mapping → error bubble → retry path still works after the controller wiring.

---

## 4. Remaining gaps & recommendations (not changed — flagged)

| # | Gap | Severity | Recommendation |
|---|---|---|---|
| T1 | **Delivery-layer split:** `/api/chat` is a Vercel serverless function; the Express dev server (`server/_core/index.ts`) does **not** register it. Locally `fetch('/api/chat')` falls through to the SPA → no streaming in local dev. | 🟠 High (dev/prod parity; matches deployment audit **D1**) | Decide the canonical runtime. If Vercel: add a dev proxy or `vercel dev` for local chat; if Express: register a `/api/chat` route that reuses the same handler. Either way, make local dev exercise the real path. |
| T2 | **No HTTP-status differentiation** in `chatErrorMessage` — 429 (rate limit) and 5xx both map to generic. `/api/chat` currently has no rate limiter, so 429 can't occur today. | 🟡 Low | If/when a rate limiter is added to `/api/chat` (recommended for prod — the Express AI limiter covers compare/recommend but not chat), surface 429 distinctly ("high demand, try again in a moment"). Thread `res.status` into the thrown error. |
| T3 | **No automated test of the live integration** (only the adapter is unit-tested). | 🟡 Low | Once T1 is resolved, add one integration/E2E test hitting a mocked or preview `/api/chat` to assert a real streamed turn renders. |
| T4 | **`done` SSE event is parsed but unused** — completion is inferred from stream close. Harmless, but the explicit signal is ignored. | 🟢 Info | Optional: treat `done` as authoritative completion. No behavior change needed; current handling is correct. |
| T5 | **Action-tag contract is duplicated knowledge:** the server system prompt defines the `[ACTION:…]` shapes; the client `ChatAction` union must mirror them by hand. | 🟡 Low | Keep the client `ChatAction` union as the single typed source and reference it from the prompt docs; revisit if the action set grows (and resolve the still-open product question on whether the action→modal capability is revived or retired — see chatbot audit). |

---

## 5. Architecture & constraint check

- **Transport stays out of presentation.** All HTTP/SSE/abort/timeout logic lives in `lib/chatStreamClient.ts`; the hook orchestrates; the view components are pure props-driven render. ✅
- **Backend contract preserved.** The wire format (`POST /api/chat { messages:[{role,content}] }`, SSE `delta|done|error`) is unchanged. The only change is an internal frontend adapter parameter. ✅
- **PHI port untouched.** `server/chatBoundary.ts` + its compliance tests are unchanged. ✅
- **Slice intact, no cross-slice imports.** The slice imports only shared `Button`/`cn` + lucide; nothing from other feature slices; nothing new pushed to shared. ✅
- **Outcomes unchanged.** Same requests, same responses, same rendering; added cancellation only affects unmount/abort, and added tests are inert. ✅

---

## Summary

The chatbot's backend integration is **production-shaped**: a single isolated transport adapter (`streamChat`), honest layered error mapping, idle-timeout, manual retry, a stateless server with client-owned + persisted history, and clean separation from presentation. This pass made cancellation **explicit and testable** and added the slice's **first transport/action tests** (16). The one material gap is environmental, not code: **`/api/chat` isn't served in local dev (T1)** — the same Vercel-vs-Express delivery split flagged in the deployment audit — which should be closed so the real streaming path is exercised before release.
