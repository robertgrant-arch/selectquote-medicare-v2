# Medicare Guide — Production-Grade Chatbot UX & Component Spec
**Branch:** `feat/vertical-slices-prod`
**Date:** 2026-06-29
**Builds on:** `docs/chatbot-audit.md`
**Scope:** Target experience definition only. No code in this document. Functionality, transport (`api/chat.ts`), and the PHI port (`server/chatBoundary.ts`) are preserved unchanged. All new UI is owned by the `features/medicare-guide-chat/` slice.

---

## Design north star

> A calm, trustworthy product surface — not a widget. It should read as *part of the Medicare quote app*, using the same navy, the same DM Sans, the same radii and lucide icons as the plan cards and modals. Premium through restraint: generous whitespace, one accent, quiet motion, no novelty.

**Tone words → concrete rules:**
- **Calm / high-trust** → muted surfaces (`--card`, `--muted`), one navy accent (`--primary`), no gradients, no emoji, persistent licensed-advisor disclosure.
- **Premium** → 8px spacing rhythm, `--radius` (0.5rem) consistency, soft single-layer shadow, real lucide iconography.
- **Lightweight / fast** → text-first, streaming-first, no avatars-per-message clutter, no sound, no confetti, motion ≤ 200ms.
- **Integrated** → same tokens as the site; in-product deep links (`/plans?zip=…`, `/ai-compare`) rendered as native link affordances, not external-looking buttons.

**Token contract (from `client/src/index.css` — use these, never hex):**

| Purpose | Token |
|---|---|
| Brand accent / user bubble | `--primary` (navy `oklch(0.28 0.08 250)`) / `--primary-foreground` |
| Panel surface | `--card` / `--card-foreground` |
| Assistant bubble / quiet fills | `--muted` / `--muted-foreground` |
| Hairlines, borders | `--border` |
| Focus ring | `--ring` |
| Error | `--destructive` / `--destructive-foreground` |
| Corner radius | `--radius` (0.5rem), bubbles `--radius-lg`, launcher full |
| Body type | DM Sans (inherited) |

---

## 1. Production-Grade UX Spec (by surface)

### 1.1 Launcher / button
- **Default state: collapsed.** (Fixes audit UX2 — no auto-open.) Bottom-right, `24px` desktop inset / `16px` mobile.
- Circular `56px` button, `--primary` fill, single lucide `MessageCircle` (no emoji). One soft shadow (`0 4px 16px` at ~12% navy), no glow, no gradient.
- **Unobtrusive invite:** on first session only, a small one-line label chip ("Questions? Ask Medicare Guide") may appear once, auto-dismiss after ~6s or on scroll. Never re-nags. No bouncing, no pulsing ring.
- Hover: subtle scale `1.04` + shadow lift, 150ms. Focus-visible: 2px `--ring` offset ring.
- Badge: a small unread dot appears only if the assistant streamed a message while collapsed (rare). No numeric counters.

### 1.2 Open / close animation
- **Quiet, fast, origin-anchored.** Panel scales/fades in from the launcher corner: `opacity 0→1`, `translateY 8px→0` + `scale 0.98→1`, **180ms ease-out**. Close reverses at 140ms.
- Respect `prefers-reduced-motion`: cross-fade only, no transform.
- No spring/bounce, no slide-across-screen, no backdrop dim on desktop (it's a companion, not a modal). Mobile sheet may use a light scrim (see 1.13).

### 1.3 Panel / sheet layout
- **Desktop:** fixed card, `min(400px, calc(100vw - 48px))` wide × `min(640px, calc(100vh - 48px))` tall, anchored bottom-right. `--card` background, `1px --border`, `--radius` corners, one soft shadow. Three rows: **Header (fixed) · Conversation (flex, scrolls) · Composer (fixed)**, with a slim **footer disclosure** under the composer.
- **Mobile:** full-height bottom sheet (see 1.13).
- Internal padding rhythm: `16px` gutters, `12px` inter-message gap, `8px` micro-spacing.

### 1.4 Header
- Height ~`64px`, `--card` (or a very subtle `--muted` tint), bottom `1px --border`. **No gradient.**
- Left: a small `36px` rounded brand mark in `--primary/10` with a lucide `Stethoscope` (or the SelectQuote mark) in `--primary`.
- Title block: **"Medicare Guide"** (DM Sans 15px/600, `--foreground`) + subline **"SelectQuote AI assistant"** (12px, `--muted-foreground`).
- Right: lucide `X` close button (icon button, `--muted-foreground`, hover `--foreground`, focus ring). Optional `Minus` to collapse without losing state. No "expand fullscreen" gimmick on desktop.

### 1.5 Assistant identity area
- A persistent **trust line** is non-negotiable for compliance and tone: identity is stated in the header subline *and* reinforced in the first message ("…not a human or licensed agent…", already in the system prompt) — keep both.
- Do **not** render a per-message avatar on every assistant turn. Use **one** small assistant glyph at the start of a contiguous assistant group only (reduces clutter, audit UX1/UX8). User messages need no avatar.

### 1.6 Conversation area
- Scrollable region, `role="log"` `aria-live="polite"`, `--card` surface (calmer than the audit's `#f8fafc`). Auto-scroll to bottom on new content **unless** the user has scrolled up — then show a small "↓ New message" pill instead of yanking them down.
- Comfortable measure: bubbles `max-width: 85%`. Vertical gap `12px`; tighter `4px` between consecutive same-role bubbles (grouping).
- In-product links (e.g., `/plans?zip=66208`) render as inline text links in `--primary` with underline — native, not external-looking. Internal links navigate in-app; external (`http…`) get `target="_blank"` + `rel`.

### 1.7 Message bubbles
- **Assistant:** `--muted` fill, `--foreground` text, `--radius-lg` with one squared corner toward the glyph. Markdown via `Streamdown` (retire the hand-rolled renderer). DM Sans 14px/1.55.
- **User:** `--primary` fill, `--primary-foreground` text, `--radius-lg` with squared corner toward the trailing edge.
- Shadow: none or a single 1px hairline; no heavy drop shadows. Selectable text. Long tokens wrap (`overflow-wrap: anywhere`).

### 1.8 Response cards / recommendation snippets
- The chat surfaces plans by **deep-linking into the real product**, not by re-rendering plan cards inside the bubble (keeps it lightweight and avoids duplicating `PlanCard`). When the assistant references plans/tools, render a compact **in-bubble action chip row** (e.g., "View plans for 66208 →", "Compare with AI →") styled as quiet `--secondary` chips with a lucide trailing `ArrowRight`. Tapping routes in-app.
- Optional, restrained **"smart reply" chips** for the empty/first-run state and after a question (harvested from the dead `AIChatBox` suggested-prompts), e.g. *Keep my doctors · Lower my costs · Drug coverage · Extra benefits*. Max 4, single row/wrap, `--secondary` fill. These map to the system prompt's Step-1 preference question.
- **No** rich plan tables, carousels, charts, or images inside the chat. Snippets are pointers into the product, not a second UI.

### 1.9 Typing / loading states
- **Streaming-first:** as soon as the first delta arrives, render text with a subtle blinking caret at the tail. This is the primary "it's working" signal.
- **Pre-first-token:** a single calm three-dot indicator (`--muted-foreground`) in an assistant bubble — quiet pulse, ~1s loop, honors reduced-motion (static dots). No spinner-on-button-only.
- Composer send button shows a small lucide `Loader2` spin while awaiting; input remains readable (not greyed to illegibility).

### 1.10 Error states
- Distinct, not disguised as a normal message: an assistant-aligned bubble with a `--destructive`-tinted left accent / icon (`AlertCircle`), `--foreground` text. Copy stays calm and routes to help: *"I couldn't reach the assistant just now."* plus the existing advisor phone link.
- Errors do **not** silently overwrite a partially streamed message; they append below it.

### 1.11 Reconnect / retry states
- The error bubble includes an explicit **"Try again"** affordance (text button, `--primary`) that re-sends the last user message (the audit noted no retry path exists). While retrying, show the pre-first-token indicator.
- If the network is offline, show a one-line inline notice ("You appear to be offline") and disable send until input changes — no infinite spinner.
- Transport contract is unchanged (`event: delta|done|error`, 60s timeout); retry is a client-slice concern in `useChatSession`.

### 1.12 Empty state
- First open shows the assistant's greeting (from the system prompt) **plus** the smart-reply chips (1.8). Calm, centered hierarchy: brand glyph, one-line "How can I help with your Medicare options?", chips. No marketing copy, no illustration-heavy hero.
- The single hardcoded local greeting is preserved as the seeded first message (kept out of the API history exactly as today — `messages.slice(1)`).

### 1.13 Mobile layout
- Launcher `16px` inset. On open, a **full-height bottom sheet**: `100dvh` minus safe-area, `--card`, top corners `--radius-xl`, light scrim behind. Drag-handle affordance at top; swipe-down or `X` closes.
- Composer pinned above the keyboard (`env(safe-area-inset-bottom)` aware). Header compact (`56px`). Smart-reply chips horizontally scrollable.
- Tap targets ≥ `44px`. No hover-only affordances.

### 1.14 Desktop layout
- Companion panel (1.3), never a full-screen takeover, never centered-modal. Does not block page scroll behind it. Remembers open/closed within the session.

### 1.15 Accessibility states
- See §4 for the full list. Every interactive element has a visible focus ring (`--ring`), an accessible name, and a non-color state cue.

### 1.16 Keyboard behavior
- See §6.

---

## 2. Component Hierarchy

All slice-private under `features/medicare-guide-chat/`. No new entries in global `components/`.

```
<MedicareGuideChat/>                     (index.ts public surface; mounted once in App.tsx)
├─ <ChatLauncher/>                       collapsed FAB + first-run invite chip + unread dot
└─ <ChatPanel/>                          open/close animation wrapper; desktop card | mobile sheet
   ├─ <ChatHeader/>                      brand mark, identity, minimize/close
   ├─ <ChatConversation/>               role="log" aria-live; scroll mgmt; "new message" pill
   │  ├─ <MessageGroup/>                 groups consecutive same-role messages (one glyph)
   │  │  ├─ <AssistantMessage/>          Streamdown markdown + streaming caret
   │  │  │  └─ <InlineActionChips/>      in-product deep-link chips (View plans → etc.)
   │  │  └─ <UserMessage/>
   │  ├─ <TypingIndicator/>              pre-first-token dots
   │  ├─ <ErrorMessage/>                 destructive-accented bubble + <RetryButton/>
   │  └─ <EmptyState/>                   greeting + <SmartReplyChips/>
   └─ <ChatComposer/>                    multiline Textarea + send (shadcn), char/disabled states
      └─ <ChatDisclosureFooter/>         "AI assistant · Not a licensed agent · 1-800…"
```

**Slice internals (non-visual):**
```
hooks/useChatSession.ts      messages, open state, send/retry, streaming flags, sessionStorage persistence
lib/chatStreamClient.ts      SSE fetch + parse (transport adapter; mirrors compareStreamClient.ts)
lib/chatActions.ts           typed ChatAction union + parser (replaces window-event bus)
types/chat.ts                Message, ChatAction, ChatStatus
```

Reuses existing shadcn primitives (`Button`, `Textarea`, `ScrollArea`) and lucide — does **not** wrap them in new shared abstractions.

---

## 3. State Inventory

**Session/UI state (in `useChatSession`):**
| State | Type | Notes |
|---|---|---|
| `isOpen` | `boolean` | Default **false**; persisted to `sessionStorage`. |
| `hasSeenInvite` | `boolean` | First-run invite chip shown once per session. |
| `messages` | `Message[]` | Seeded with local greeting (index 0, never sent to API). |
| `input` | `string` | Composer value. |
| `status` | `'idle' \| 'streaming' \| 'awaiting-first-token' \| 'error' \| 'offline'` | Single source of truth for indicators. |
| `lastUserMessage` | `Message \| null` | For retry. |
| `unread` | `boolean` | Set if a message completes while collapsed. |
| `userScrolledUp` | `boolean` | Suppresses auto-scroll; drives "new message" pill. |

**Per-message render state:** `role`, `content`, `isStreaming` (tail caret), `actions?: ChatAction[]`.

**Status → surface mapping:**
| status | Conversation | Composer |
|---|---|---|
| `idle` | messages / empty state | enabled |
| `awaiting-first-token` | `<TypingIndicator/>` | send → `Loader2`, input editable |
| `streaming` | streaming caret on last assistant bubble | send disabled |
| `error` | `<ErrorMessage/>` + retry (appended, not overwriting) | enabled |
| `offline` | inline offline notice | send disabled until input changes |

**Persistence:** `isOpen`, `hasSeenInvite`, and recent `messages` (≤ same window as server, no extra PHI) in `sessionStorage`. Cleared on tab close — consistent with the app's existing session-only posture. The server-side PHI windowing/redaction is unchanged and remains authoritative.

---

## 4. Accessibility Requirements

- **Launcher:** `<button>` with `aria-label="Open Medicare Guide chat"`; `aria-expanded` reflects panel state; unread dot conveyed via `aria-label` ("…, new message").
- **Panel:** `role="dialog"` `aria-modal="false"` (desktop companion) / `aria-modal="true"` (mobile sheet) with `aria-labelledby` → header title. Focus moves to the panel on open; on close, focus returns to the launcher.
- **Conversation:** `role="log"` `aria-live="polite"` `aria-relevant="additions"`. Streaming updates announce the completed message (avoid spamming SR with every token — announce on `done`, or debounce).
- **Messages:** assistant/user distinguished by accessible text, not color alone (e.g., visually-hidden "You said:" / "Medicare Guide said:").
- **Identity/compliance:** the "not a licensed agent" disclosure is in the accessible name path (header subline + footer), readable by SR at all times.
- **Icon buttons:** every lucide-only control has an accessible name; state changes (loading, disabled) are announced or have text equivalents.
- **Contrast:** all text ≥ WCAG AA (4.5:1) against its surface; disabled states use opacity *plus* an accessible cue, not color-only (fixes audit UX7/UX9). Verify `--muted-foreground` on `--muted` meets AA.
- **Focus visible:** 2px `--ring` ring on every focusable element; never `outline:none` without a replacement.
- **Reduced motion:** `prefers-reduced-motion` disables transforms, caret blink, and dot pulse (static equivalents).
- **Touch targets:** ≥ 44×44px on mobile.
- **Error/retry:** errors are announced via `aria-live`; the retry button is a real `<button>` with a clear name.

---

## 5. Responsive Behavior Rules

| Breakpoint | Launcher | Panel | Header | Motion |
|---|---|---|---|---|
| **≥ 768px (desktop)** | 56px FAB, 24px inset | Companion card `min(400px, 100vw-48px)` × `min(640px, 100vh-48px)`, bottom-right, no backdrop | 64px | scale/fade from corner |
| **< 768px (mobile)** | 56px FAB, 16px inset | Full-height bottom sheet, `100dvh - safe-area`, top `--radius-xl`, light scrim, drag handle | 56px compact | slide-up from bottom |

- Use the existing `useIsMobile` hook (768px breakpoint) — do not introduce a new breakpoint system.
- Panel never exceeds viewport; conversation scrolls internally; composer pinned (keyboard/safe-area aware on mobile).
- Smart-reply/action chips wrap on desktop, horizontally scroll on mobile.
- No layout that depends on hover (mobile parity).

---

## 6. Keyboard Behavior

| Key | Context | Action |
|---|---|---|
| `Enter` | Composer | Send message (if non-empty & not streaming). |
| `Shift+Enter` | Composer | Newline (multiline input). |
| `Esc` | Panel open | Close panel (return focus to launcher). On mobile sheet, same. |
| `Tab` / `Shift+Tab` | Panel open | Cycle focusable elements; **focus trapped on mobile** (`aria-modal=true`); on desktop, focus is contained but page remains reachable (companion, not modal). |
| `↑` (optional, empty composer) | Composer | Recall last sent message for quick edit/retry. |
| `Enter`/`Space` | Launcher, chips, retry, links | Activate. |

- Reuse the app's existing focus-trap utility (`lib/a11y/useFocusTrap`) for the mobile sheet — do not write a new one.
- Composition/IME safe (reuse `useComposition` so Enter doesn't submit mid-composition — the app already has this).

---

## 7. "Must Not Do" — anti-gimmick guardrails

- ❌ **No emoji** as UI chrome or persona decoration (replace 💬🏥✕▲ with lucide).
- ❌ **No gradients**, glows, neon, or rainbow accents — one navy accent only.
- ❌ **No auto-open** on page load; no repeated nag/bounce/pulsing-ring invites.
- ❌ **No sound effects, haptics-as-toy, confetti, or celebratory animation.**
- ❌ **No animated avatar / mascot / "AI is thinking…" anthropomorphic theatrics.** One quiet typing indicator + streaming caret is enough.
- ❌ **No fake typing delays** to simulate humanity — stream real tokens as they arrive.
- ❌ **No rich plan tables/carousels/charts/images inside bubbles** — deep-link into the real product instead.
- ❌ **No third-party-widget look** (no "Powered by", no foreign font/shadow language, no chat-SaaS chrome).
- ❌ **No motion > ~200ms**, no spring/bounce, no slide-across-screen.
- ❌ **No dark-pattern urgency** ("offer expires", "agent waiting") — and the system prompt already prohibits this language; the UI must not reintroduce it via banners.
- ❌ **No persistent unread badges/counters** to manufacture engagement.
- ❌ **No blocking modal backdrop on desktop** — it's a companion, not a takeover.
- ❌ **No new shared component library or global CSS** — slice-private components + existing tokens only.

---

## 8. Functional & architectural invariants (carried from the audit)

- Transport unchanged: `fetch POST /api/chat`, SSE `event: delta|done|error`, Anthropic→OpenAI, 60s timeout.
- PHI port unchanged: `server/chatBoundary.ts` (phone redaction + 20-msg window), `phi-boundary.test.ts` stays green.
- System prompt remains server-owned; the **action-tag contract** is the single shared truth between the prompt and the slice's typed `ChatAction`.
- The dead `window`-event action bus is replaced by an in-slice typed handler (pending the product decision noted in the audit: revive vs retire the action capability).
- All new logic lives in `features/medicare-guide-chat/`; nothing leaks into generic `lib/`/`components/`.
- `AIChatBox.tsx`'s useful patterns (empty state, suggested prompts, Streamdown, shadcn composer) are **harvested into the slice**, then that dead file is removed.

---

### One open decision (unchanged from the audit)
The in-product **action chips / modal triggers** (open drugs-doctors modal, collect name/phone) are currently non-functional. This spec assumes they will be **revived** via the typed `ChatAction` handler. If product instead retires them, drop §1.8's modal-trigger chips and the corresponding system-prompt section together — the smart-reply and deep-link chips remain regardless.
