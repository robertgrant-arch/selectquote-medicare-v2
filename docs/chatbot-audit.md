# Chatbot Current-State Audit & UI/UX Upgrade Plan
**Branch:** `feat/vertical-slices-prod`
**Date:** 2026-06-29
**Scope:** Read-only audit. No code changed. Goal: prepare the "Medicare Guide" chatbot for a production-grade UI/UX upgrade without breaking architecture, functionality, or the PHI boundary.

---

## 1. Current-State Audit (summary)

The chatbot in production is **`ChatWidget.tsx`** — a single 458-line component, entirely inline-styled with hardcoded hex colors and emoji, mounted globally in `App.tsx`. It works functionally (SSE streaming, markdown links, PHI-safe transport) but is **visually disconnected from the rest of the site** and contains a **dead action-event mechanism** and a **second, unused chat component** (`AIChatBox.tsx`) that is ironically the design-system-aligned one.

There is **no formal chatbot slice**. The pieces are scattered as two flat client components plus a Vercel API handler and a PHI boundary module. The transport and PHI layers are sound and tested; the problems are concentrated in the **client UI layer** and one **cross-component event leak**.

**Headline findings:**

| # | Finding | Severity |
|---|---|---|
| H1 | Live `ChatWidget` ignores the design system entirely (hardcoded `#2563eb` blue gradient vs the site's navy `oklch(0.28 0.08 250)`; emoji icons vs lucide; no DM Sans). | 🔴 Visual |
| H2 | The AI's `[ACTION:...]` tags (open drugs/doctors modal, collect name/phone) fire `window` CustomEvents that **no component listens for** — the feature is dead at the consumer end. | 🔴 Functional + Arch |
| H3 | `AIChatBox.tsx` (335 lines, design-system-aligned, uses `Streamdown` + shadcn) is **dead code** — zero imports. Two chat implementations, the wrong one shipped. | 🟠 Creep |
| H4 | Chat auto-opens (`isOpen` defaults to `true`) on every page load — intrusive; no persistence, so history resets on navigation/refresh. | 🟠 UX |
| H5 | No real slice/hex structure: markdown rendering, SSE parsing, action parsing, and presentation are all fused inside one component. | 🟠 Arch |

**What is healthy (do not disturb):**
- **Transport** (`api/chat.ts`): Anthropic-primary / OpenAI-fallback SSE streaming with `event: delta|done|error`, 60s timeout. Solid.
- **PHI boundary** (`server/chatBoundary.ts`): phone redaction + 20-message sliding window, **covered by `phi-boundary.test.ts`** (9 compliance tests). This is a clean hexagonal port — leave it exactly where it is.

---

## 2. File-by-File Map

### Client

| File | Lines | Role | State |
|---|---|---|---|
| `client/src/components/ChatWidget.tsx` | 458 | **LIVE chatbot.** Floating button + window, message list, input, SSE client, inline `renderMarkdown`, `parseActionTags`, action-event dispatch. All inline styles. | 🔴 Needs upgrade |
| `client/src/components/AIChatBox.tsx` | 335 | **DEAD.** A design-system-aligned chat box (shadcn `Button`/`Textarea`/`ScrollArea`, `Streamdown` markdown, lucide icons, empty/loading states, suggested prompts). Zero imports anywhere. | 🟠 Dead — harvest then delete |
| `client/src/App.tsx` (L6, L120) | — | Mounts `<ChatWidget />` globally alongside `<VoiceWidget />`. | OK (mount point) |

### Server / API

| File | Lines | Role | State |
|---|---|---|---|
| `api/chat.ts` | 311 | Vercel serverless SSE handler. Inline `SYSTEM_PROMPT` (persona, 7-step conversation flow, action-tag spec, plan knowledge, compliance). Anthropic→OpenAI fallback. Calls `sanitizeMessagesForAI` before any provider. | ✅ Healthy |
| `server/chatBoundary.ts` | 39 | PHI port: `PHONE_RE`, `MAX_CHAT_CONTEXT_MESSAGES=20`, `sanitizeMessagesForAI()`. Pure, testable. | ✅ Healthy, tested |
| `server/phi-boundary.test.ts` | — | Tests `sanitizeMessagesForAI` (phone redaction variants, 20-msg window, non-string passthrough). | ✅ Keep green |

### Shared / Design system

| File | Role | Relevance |
|---|---|---|
| `client/src/index.css` | Design tokens: `--primary: oklch(0.28 0.08 250)` (navy), `--secondary`, `--accent`, `--muted`, `--card`, `--border`, `--ring`, `--destructive`, `--radius: 0.5rem`; fonts **DM Sans** (body) / **Lora** (headings); `.dark` variant defined. | ChatWidget uses **none** of these. |
| `client/src/components/ui/*` | shadcn primitives (Button, Textarea, ScrollArea, Dialog, etc.) used by 38 components. | ChatWidget uses none; AIChatBox uses several. |

### Data flow (end-to-end)

```
ChatWidget (useState messages)
  → fetch POST /api/chat  { messages: history.slice(1) }   // drops the local greeting
    → api/chat.ts handler
      → sanitizeMessagesForAI()      // server/chatBoundary.ts  (PHI port)
      → Anthropic (claude-haiku-4-5) stream  ||  OpenAI (gpt-4o) fallback
    ← SSE: event: delta {text} … event: done
  ← ChatWidget accumulates deltas → setMessages
  → parseActionTags() on final message
    → window.dispatchEvent('openDrugsDoctorsModal' | 'collectPhone' | 'collectName')
       → ⚠️ NO LISTENER EXISTS  (dead branch)
```

**State management:** local `useState` only (`messages`, `input`, `isLoading`, `isOpen`). No store, no context, no tRPC.
**Persistence/session:** none. History lives only while mounted; lost on refresh/navigation. `isOpen` defaults `true`.
**Message rendering:** ChatWidget has a hand-rolled `renderMarkdown` (links, bold, bare paths only). AIChatBox (dead) uses `Streamdown`. Two different renderers.

---

## 3. UX Issues

| ID | Issue | Detail |
|---|---|---|
| UX1 | **Off-brand visuals** | Bright blue gradient `#2563eb→#1d4ed8` clashes with the site's navy primary. Emoji (💬 🏥 ✕ ▲) where the rest of the site uses lucide icons. Not DM Sans. |
| UX2 | **Auto-opens on every load** | `isOpen` starts `true`; the 400×600 panel covers content on first paint of every page. Should start collapsed (or remember user choice). |
| UX3 | **No persistence** | Refresh/navigation wipes the conversation. Senior users who scroll away lose context. |
| UX4 | **Weak loading state** | Custom CSS `pulse` dots reference an animation that may not be defined in scope; assistant bubble shows plain "Thinking…". No skeleton, no streaming cursor. |
| UX5 | **No error recovery** | On failure the assistant bubble is replaced with a static apology + phone number; no retry affordance, no distinct error styling. |
| UX6 | **No empty/first-run affordance** | The single hardcoded greeting carries everything; no suggested-prompt chips (AIChatBox already implements these — currently unused). |
| UX7 | **Input ergonomics** | Single-line `<input>` (no multiline/Enter-vs-Shift+Enter); send button is a `▲` glyph; disabled states are color-only (a11y contrast risk). |
| UX8 | **Spacing/typography/hierarchy** | Hardcoded px throughout; bubble radii, font sizes, and the footer disclosure don't track the site's `--radius`/type scale. |
| UX9 | **Accessibility gaps** | Emoji buttons rely on `aria-label` only; no `role="log"`/`aria-live` on the message stream for screen readers; focus management on open/close is partial. |
| UX10 | **Mobile** | Fixed `400px`/`600px` with `24px` offsets; no responsive/full-screen treatment on small viewports. |

---

## 4. Architecture Issues

| ID | Issue | Detail | Constraint impact |
|---|---|---|---|
| A1 | **Dead cross-component event bus** | `ChatWidget` dispatches `openDrugsDoctorsModal`/`collectPhone`/`collectName` on `window`; **no listeners exist**. The AI's documented action-tag feature does nothing. Untyped global events are also a hidden coupling mechanism. | The action handling belongs in the chat slice via a typed, explicit contract — not stringly-typed window events. |
| A2 | **No chatbot slice** | UI + SSE parsing + markdown + action parsing are fused in one 458-line component. There is no `features/…chat/` slice with `components/ hooks/ lib/ types/` like the rest of the app (`plan-compare`, `zip-validation`, etc.). | Goal explicitly asks to **strengthen vertical slices**. |
| A3 | **Duplicate chat implementations** | `ChatWidget` (live, custom) vs `AIChatBox` (dead, design-system). Two markdown renderers (`renderMarkdown` vs `Streamdown`), two layouts. | Shared-component-soup risk if naively merged. Consolidate into the slice, not into `components/`. |
| A4 | **Presentation/transport fusion** | SSE read-loop, buffer parsing, delta accumulation, and JSX all live in `sendMessage`. Hard to test; the streaming client should be a slice `lib/` function (mirrors `features/plan-compare/lib/compareStreamClient.ts`, which already exists as a model). | Hexagonal: isolate the transport adapter behind a small client port. |
| A5 | **Untyped action payloads** | `parseActionTags` returns `any[]`; `JSON.parse` of model output with empty `catch`. | Type the action union in the slice. |
| A6 | **System prompt location** | The full persona/flow/compliance prompt is inline in `api/chat.ts`. Fine for now (server owns it), but note it encodes the *same* action-tag contract the client must understand — the contract should be a single shared definition the slice and server agree on. | Keep prompt server-side; extract the **action-tag contract** as the shared truth. |

**Explicitly NOT problems (do not "fix"):**
- `api/chat.ts` transport and `server/chatBoundary.ts` PHI boundary — healthy, tested, correctly placed. The PHI port must not move.
- Server owning the system prompt — correct.

---

## 5. Recommended Implementation Plan

**Guiding principle:** form a real **client chatbot slice**, move the *presentation and client-side orchestration* into it, leave the *transport* (`api/chat.ts`) and *PHI port* (`server/chatBoundary.ts`) where they are. Re-skin with design tokens. Replace the dead window-event bus with a typed in-slice contract. No shared-component soup — new pieces live in the slice, not in `components/`.

### Target structure (proposed)

```
client/src/features/medicare-guide-chat/
  components/
    ChatLauncher.tsx        # floating button (collapsed state)
    ChatPanel.tsx           # window shell: header, body, footer (design tokens)
    MessageList.tsx         # role="log" aria-live, bubbles
    MessageBubble.tsx       # user/assistant, Streamdown rendering
    ChatComposer.tsx        # multiline input + send (shadcn)
    states/                 # EmptyState, LoadingDots, ErrorRetry
  hooks/
    useChatSession.ts       # messages, send, streaming state, open/persist
  lib/
    chatStreamClient.ts     # SSE fetch + parse (port; mirrors compareStreamClient)
    chatActions.ts          # typed action union + parser (replaces parseActionTags)
  types/
    chat.ts                 # Message, ChatAction (shared contract shape)
  index.ts                  # public surface: <MedicareGuideChat />
```

`App.tsx` mounts `<MedicareGuideChat />` (one import) — same mount point, stable external behavior.

### Phased execution (each phase = one reviewable PR, behavior-preserving except where noted)

**Phase 0 — Characterization tests first (no UI change).**
Add tests around the parts that will move:
- `chatStreamClient` parse: delta/done/error SSE framing (extract current loop logic, test it).
- `chatActions` parser: the `[ACTION:{…}]` extraction + clean-text (lock current behavior).
- Confirm `phi-boundary.test.ts` stays green.
*Gate:* tests green before any move. Protects the streaming + action-parse behavior.

**Phase 1 — Establish the slice scaffold; move logic in, no visual change.**
- Extract SSE read-loop → `lib/chatStreamClient.ts` (typed events). Mirror the existing `features/plan-compare/lib/compareStreamClient.ts` so the codebase stays consistent.
- Extract action parsing → `lib/chatActions.ts` with a typed `ChatAction` union; drop `any`.
- Wrap state in `hooks/useChatSession.ts`.
- `ChatWidget` becomes a thin composition that still renders the *current* look. No pixels change yet.
*Risk:* 🟡 — pure refactor behind Phase 0 tests.

**Phase 2 — Resolve the dead action mechanism (A1/H2) with a typed contract.**
- Replace `window.dispatchEvent` with an explicit callback prop / slice-local handler: `onAction(action: ChatAction)`.
- Wire the real consumers (open drugs/doctors modal, collect name/phone) through the slice's public surface so the feature actually works — OR, if product confirms it's deprecated, remove the emitter and the system-prompt action spec together. **Decision needed from product** before choosing; do not silently delete a documented AI capability.
*Risk:* 🟠 — first behavior change; needs the modal owners' input. Manual smoke test.

**Phase 3 — Re-skin with the design system (the actual UI/UX upgrade).**
- Replace hardcoded hex with tokens (`bg-primary`, `text-primary-foreground`, `bg-card`, `bg-muted`, `border-border`, `--radius`); DM Sans inherited.
- Swap emoji → lucide (`MessageCircle`, `X`, `Send`, `Stethoscope`/brand mark).
- Adopt `Streamdown` for assistant messages (retire the hand-rolled `renderMarkdown`); harvest AIChatBox's empty-state, suggested-prompt chips, and loading treatment.
- Proper states: streaming cursor, distinct error bubble + **retry**, `aria-live` message log, focus management.
- Responsive: full-screen sheet on mobile, panel on desktop.
- `isOpen` defaults **collapsed**; persist open/closed + recent history to `sessionStorage` (no PHI beyond what the user already typed; honor the existing server-side windowing).
*Risk:* 🟡 — visual; verify on preview, screenshot before/after.

**Phase 4 — Delete dead code & document.**
- Remove `AIChatBox.tsx` (after harvesting its empty-state/prompt patterns into the slice). Confirm zero imports (already true).
- Note the shared **action-tag contract** so `api/chat.ts`'s system prompt and the slice's `ChatAction` type stay in sync.
*Risk:* 🟢.

### What stays put (boundary preservation)
- `api/chat.ts` — transport/delivery. Unchanged (except possibly removing the action-tag prompt section in Phase 2 *if* product deprecates it).
- `server/chatBoundary.ts` + `phi-boundary.test.ts` — PHI port. **Untouched.**
- System prompt — remains server-owned.

### Non-goals (enforced)
- No moving chat business logic into `client/src/lib/` or `components/` generic buckets — it lives in the slice.
- No new shared component library; slice-private components only.
- No change to the SSE wire format or the PHI guarantees.
- No rewrite of `api/chat.ts` provider logic.

---

## Appendix — Quick reference

- **Live component:** `client/src/components/ChatWidget.tsx` (mounted `App.tsx:120`).
- **Dead component to harvest+remove:** `client/src/components/AIChatBox.tsx`.
- **Transport:** `api/chat.ts` (SSE, Anthropic→OpenAI).
- **PHI port (keep):** `server/chatBoundary.ts` (tested in `server/phi-boundary.test.ts`).
- **Design tokens:** `client/src/index.css` (navy `--primary`, DM Sans/Lora, `--radius 0.5rem`, `.dark`).
- **Model to mirror for the slice's stream client:** `client/src/features/plan-compare/lib/compareStreamClient.ts`.
