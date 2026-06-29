# Chatbot Regression Coverage Plan
**Branch:** `feat/vertical-slices-prod`
**Date:** 2026-06-29
**Slice:** `client/src/features/medicare-guide-chat/`

Goal: lock current behavior so the chatbot upgrade can't silently regress. This pass added **15 behavioral tests** (now **31 total** in the slice) by isolating the remaining pure logic the refactor touches, and specifies the DOM/E2E layer that requires a one-time infra decision.

---

## 1. Coverage matrix (the 10 required behaviors)

| Behavior | Test type | Status | Where |
|---|---|---|---|
| **Message rendering** — paragraphs, bullet/numbered lists, links, in-product deep links | Unit | ✅ **Covered** | `messageFormat.test.ts` (`tokenizeInline`, `splitMessageBlocks`) |
| **Message grouping / turns** | Unit | ✅ **Covered** | `messageGroups.test.ts` (`groupMessages`) |
| **Receiving a response** (stream accumulation, full text) | Unit (adapter) | ✅ **Covered** | `chatStreamClient.test.ts` |
| **Error state** (non-OK, server error event, empty stream) | Unit (adapter) | ✅ **Covered** | `chatStreamClient.test.ts` + `chatErrorMessage` mapping |
| **Error → message mapping** (offline / timeout / generic) | Unit | ✅ **Covered** | `chatStreamClient.test.ts` |
| **Action mapping** (any modal/recommendation triggers in the flow) | Unit | ✅ **Covered** | `chatActions.test.ts` (`parseActionTags`, `dispatchChatActions`) |
| **Cancellation / abort** (caller-owned controller) | Unit (adapter) | ✅ **Covered** | `chatStreamClient.test.ts` (pre-aborted controller) |
| **Sending a message** (full UI lifecycle: input → user bubble → loading → render) | Component | 🟠 **Gap** — spec ready (§3) | needs DOM infra |
| **Open / close behavior** (launcher ↔ panel, focus) | Component | 🟠 **Gap** — spec ready (§3) | needs DOM infra |
| **Loading state** (typing dots → streaming caret → settled) | Component | 🟠 **Gap** — spec ready (§3) | needs DOM infra |
| **Retry behavior** (error → "Try again" → regenerate, no duplicate turn) | Component | 🟠 **Gap** — spec ready (§3) | needs DOM infra; logic verified live |
| **Scroll behavior** (auto-scroll only when at bottom; "new messages" pill) | Component | 🟠 **Gap** — spec ready (§3) | needs DOM infra |
| **Mobile behavior** (full-height sheet vs desktop companion) | Component / E2E | 🟠 **Gap** — spec ready (§3) | needs DOM infra |
| **Plan / recommendation rendering in the chat flow** | Unit | ✅ **Covered (by design)** | The chat surfaces plans as **in-product deep links** (`/plans?zip=…`, `/ai-compare`), not embedded plan cards — covered by `messageFormat` link/deep-link tests. No card renderer exists in the chat to test. |

**Net:** the data/logic layer the refactor most likely breaks (rendering, grouping, transport, error mapping, actions, cancellation) is now unit-covered. The DOM-wiring layer (open/close, send lifecycle, scroll, mobile, retry-in-DOM) is specified but not yet automated — see §4.

---

## 2. Tests added this pass (behavior, not implementation)

To make these testable in the existing **node** environment without new tooling, the pure logic was isolated into the slice's `lib/` (behavior-preserving extractions, verified identical in-browser):

- **`lib/messageFormat.ts`** (extracted from `richText.tsx`): `tokenizeInline` + `splitMessageBlocks` → returns data, not JSX. `richText.tsx` is now a thin renderer over it.
- **`lib/messageGroups.ts`** (extracted from `ChatConversation`): `groupMessages`.

Test files (all `client/src/features/medicare-guide-chat/__tests__/`, run by the existing vitest `include`):

| File | Tests | Protects |
|---|---|---|
| `messageFormat.test.ts` | 10 | paragraphs vs lists, markdown/bare/bold deep links, external-link flagging, mixed structure, empty input |
| `messageGroups.test.ts` | 5 | turn grouping, role-change boundaries, consecutive same-role, index preservation |
| `chatStreamClient.test.ts` | 7 | response accumulation, request shape, non-OK / empty-stream / error-event throws, abort, error mapping |
| `chatActions.test.ts` | 9 | action parse/strip, multiple, malformed-safe, no regex `lastIndex` bug, event dispatch |

**Status:** 31/31 slice tests pass; full suite 736 pass / 1 skipped; typecheck 0 errors.

---

## 3. Minimum must-have BEFORE riskier refactors

These are the regression gates. ✅ items exist now; 🟠 items are the recommended next layer.

1. ✅ **Rendering structure** (`messageFormat`) — guards the markdown/deep-link/list behavior any rendering refactor would touch.
2. ✅ **Grouping** (`messageGroups`) — guards turn layout.
3. ✅ **Transport contract + failures** (`chatStreamClient`) — guards request shape and every failure path.
4. ✅ **Action mapping** (`chatActions`) — guards the AI-text → UI-event contract.
5. 🟠 **Send + render lifecycle** (component) — the one DOM test most worth adding before touching the hook/view wiring.
6. 🟠 **Error → retry in the DOM** (component) — guards the recovery affordance.

Items 1–4 are sufficient to safely refactor the `lib/` and rendering layers. Items 5–6 should be added before refactoring `useChatSession`/the view tree.

---

## 4. Coverage gaps & how to close them

**The one infra decision:** the repo has **no component-test environment** — all 736 tests are pure node-env logic by design. The DOM behaviors (open/close, full send lifecycle, scroll/auto-scroll + pill, mobile sheet, retry click) genuinely require rendering, which needs `jsdom` + `@testing-library/react`. I did **not** add that infra inside this scoped pass (it's a codebase-wide change against the established pattern), but here are ready-to-run specs once the team approves it:

**Component tests** (`MedicareGuideChat.test.tsx`, per-file `// @vitest-environment jsdom`):
- **Open/close:** renders launcher when collapsed; clicking opens the panel (`role="dialog"`); close returns to launcher; focus moves to input on open.
- **Send lifecycle:** type + submit → user bubble appears, composer disables, typing indicator shows; mock `streamChat` to emit deltas → assistant bubble fills; settles to enabled.
- **Loading/streaming:** typing dots before first token; streaming caret while streaming; both gone when settled.
- **Error + retry:** mock `streamChat` to reject → destructive error bubble + "Try again"; click → regenerates from last user message; assert **exactly one** user turn (no duplicate).
- **Scroll:** with `streamChat` deltas while scrolled up (mock `scrollHeight`/`scrollTop`), assert "New messages" pill appears and auto-scroll is suppressed.
- **Mobile:** at <640px, panel uses the full-height sheet classes; ≥640px, the companion card. (Or assert layout via `preview_resize` in E2E.)
- These mock the slice's own `streamChat`/`useChatSession` seams — no network, aligned with slice ownership.

**E2E test** (Playwright against a Vercel preview — also closes deployment audit **T1**):
- Real `/api/chat` stream renders a multi-paragraph answer; refresh restores the conversation (sessionStorage); mobile viewport shows the sheet. This is the only layer that exercises the true streaming path end-to-end.

**Why E2E for the live path:** local dev doesn't serve `/api/chat` (Express vs Vercel split, audit T1), so a real streamed-response regression can only be caught on a preview deploy. Component tests with a mocked `streamChat` cover the UI wiring; E2E covers the integration.

---

## 5. Constraint check

- **Behavior, not implementation:** tests assert outputs (token kinds, block structure, group shape, accumulated text, error copy, dispatched event names) — not internal calls or markup details. Extractions preserved exact rendering (verified in-browser: identical 2-paragraph greeting, links, grouping).
- **Slice ownership:** every test lives in the chatbot slice's `__tests__/` and targets the slice's own `lib/`; no cross-slice or shared-area tests added; no new shared primitives.
- **No tooling creep:** added zero dependencies; reused the existing vitest node env. The DOM/E2E layer is specified, not silently bolted on.

---

## Summary

The refactor-sensitive logic — **message rendering, grouping, transport, error mapping, actions, and cancellation** — is now protected by 31 slice unit tests (15 added this pass), all behavior-level. The remaining gap is the DOM-wiring layer (open/close, send lifecycle, scroll, mobile, retry-in-DOM), which is fully specified and gated behind a single, deferred decision to add `jsdom` + `@testing-library/react`; the true streaming path should be covered by an E2E test on a Vercel preview (which also resolves the local-dev `/api/chat` gap).
