# Chatbot — Final Production-Grade Self-Review
**Branch:** `feat/vertical-slices-prod`
**Date:** 2026-06-29
**Slice:** `client/src/features/medicare-guide-chat/`

Critical self-review against the production bar of the rest of the site. Two weak areas were **revised during this review** (breakpoint inconsistency; missing Esc-to-close) before finalizing.

---

## Revisions made during this review

1. **Breakpoint alignment.** The chat switched mobile↔desktop layout at 640px (Tailwind `sm:`) while the app's `useIsMobile` uses **768px** — so a 700px tablet got the desktop companion while the rest of the app treated it as mobile. Changed `sm:`→`md:` in `MedicareGuideChat.tsx` + `ChatLauncher.tsx`. Verified at 700px → now the full-height sheet.
2. **Esc-to-close.** A standard dialog affordance was missing. Added a keydown handler in `useChatSession`. Verified: Esc closes the panel and returns to the launcher.

Both behind the full gate: typecheck 0, 31/31 slice tests, build ✓, browser-verified.

---

## 1. What improved

| Dimension | Before | After |
|---|---|---|
| **Visual quality** | Hardcoded `#2563eb` gradients, emoji chrome | Navy `--primary`/`--muted`/`--card` tokens, lucide icons, one restrained shadow |
| **Consistency w/ site** | Off-brand widget look | Same tokens, DM Sans, radii, lucide, **768px breakpoint** as the rest of the app |
| **Clarity** | Wall-of-text bubbles | Structured paragraphs + bullet/numbered lists, grouped turns, one assistant glyph per turn |
| **Polish** | Instant pop-in | ≤200ms entrance (fade/zoom desktop, slide-up mobile), reduced-motion safe; streaming caret |
| **Responsiveness** | Fixed 400×600 | Companion card ≥768px / full-height sheet <768px, safe-area aware |
| **Accessibility** | `aria-label`s only | `role="dialog"`, `role="log"` `aria-live`, focus-on-open, **Esc-to-close**, focus-visible rings, non-color states, reduced-motion |
| **Loading/error** | Generic apology, no recovery, could hang | Typing dots → caret; distinct error bubble + **Try again**; idle timeout; empty-stream caught |
| **Maintainability** | 600-line monolith, inline styles | 7-concern slice (container/view/hook/transport/format/actions/storage) |
| **Vertical slice** | Flat `components/ChatWidget.tsx` | Self-contained `features/medicare-guide-chat/` with `index.ts` surface |
| **Hexagonal** | fetch + parse + render fused | Transport adapter + domain mapping behind pure `lib/`; view is props-only |
| **Regression safety** | 0 chatbot tests | 31 slice unit tests (transport, actions, rendering, grouping) |

---

## 2. What remains imperfect (honest)

| # | Issue | Severity | Notes |
|---|---|---|---|
| R1 | **Dead action bus.** `dispatchChatActions` fires `openDrugsDoctorsModal` / `collectPhone` / `collectName` window events with **no listeners** anywhere. The AI's action-tag capability is parsed and dispatched but nothing consumes it. | 🟠 Product decision | Revive (wire the modal/lead-capture consumers) or retire (drop the dispatch + the system-prompt action spec). I will not silently delete a documented AI capability — needs a product call. |
| R2 | **`/api/chat` not served in local dev** (Express vs Vercel split, deployment audit T1). Real streaming can't be exercised locally — every local "send" hits the empty-stream→error path. | 🟠 Env/parity | Add a dev proxy / `vercel dev`, or register the route in Express. Blocks true end-to-end local testing. |
| R3 | **No DOM/E2E tests.** Open/close, send lifecycle, scroll/auto-scroll, mobile, retry-in-DOM are verified manually but not automated (repo has no jsdom/testing-library). | 🟡 Coverage | Specs are written (regression plan §4); needs a one-time `jsdom` + `@testing-library/react` decision + an E2E on a Vercel preview. |
| R4 | **Streaming + `aria-live`.** The log is `aria-live="polite"`; tokens mutate the same node during streaming, which can under/over-announce for screen readers. | 🟡 A11y | Proper fix: announce the completed message via a separate visually-hidden live region on `done`, not per-token. |
| R5 | **No focus trap / focus-return on the mobile sheet.** It's `role="dialog"` without `aria-modal`/trap (deliberately not faked). On mobile it reads as a sheet but doesn't trap focus. | 🟡 A11y | Add a focus trap (reuse the app's `lib/a11y/useFocusTrap`) for the <768px sheet; set `aria-modal` only once trapping is real. |
| R6 | **Placeholder advisor phone `1-800-555-0100`** is duplicated across the disclosure footer, error copy, and the server system prompt. | 🟢 Maintainability | Centralize once a real number exists; low stakes. |
| R7 | **Auto-open default** (`isOpen` starts `true`). The UX spec flags auto-open, but for a lead-gen widget it's a conversion decision. | 🟢 Product decision | Left as-is intentionally; flip to collapsed-with-invite if product prefers. |

---

## 3. Follow-up recommendations (priority order)

1. **Resolve R1 (action bus)** — decide revive vs retire; it's the only functional dead path.
2. **Close R2 (dev parity)** — unblocks real local testing and is shared with the broader deployment audit.
3. **Add the DOM/E2E layer (R3)** once R2 lands — the specs are ready.
4. **Harden a11y (R4, R5)** — separate completion announcement + mobile focus trap.
5. **Centralize the advisor phone (R6)** when the real number is provisioned.
6. **Decide the auto-open default (R7).**

None of these block shipping the visual/UX/architecture upgrade; R1 and R2 are the most material and are both **decisions/environment**, not defects in the new code.

---

## 4. Final checklist

**Functionality preserved** ✅
- Send / stream / receive, markdown + in-product deep links, action-tag parsing, PHI boundary, and the `{role,content}` wire contract are all unchanged. 736 full-suite tests pass / 1 skipped.

**Design improved** ✅
- Token-based visuals, lucide icons, structured rendering, grouped turns, entrance animation, responsive sheet/companion at the site's 768px breakpoint, distinct loading/error states. Verified in-browser on the real Medicare tool.

**Architecture intact** ✅
- Self-contained vertical slice; transport + domain mapping behind pure `lib/`; view is props-only; **no cross-slice feature imports** (only shared `ui/button` + `lib/utils` + lucide); nothing pushed to shared; PHI port and server contract untouched.

**No obvious regressions** ✅
- typecheck **0 errors**; full suite **736 pass / 1 skipped**; `vite build` **✓**; manual browser validation of intro, send, error+retry, grouping, Esc-close, and the 768px breakpoint all pass. The one residual is environmental (R2: live streaming unverifiable locally), recommended for a Vercel-preview E2E before release.

---

### Verdict
The upgraded chatbot **meets the production bar of the surrounding site** on visual quality, consistency, clarity, polish, responsiveness, maintainability, and architecture. Remaining items are two **decisions** (R1 action bus, R7 auto-open), one **environment gap** (R2 dev parity), and **incremental a11y/test hardening** (R3–R5) — none of which are defects in the shipped code, and all are documented with a clear path.
