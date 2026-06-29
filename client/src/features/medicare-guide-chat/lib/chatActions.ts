import type { ChatAction } from '../types/chat';

/**
 * Domain mapping: the assistant embeds invisible [ACTION:{…}] tags that map to
 * app-side UI events. This module parses those tags into typed actions and
 * dispatches them — keeping the AI-text→UI-event mapping in one place.
 */

/** Extracts and strips [ACTION:{…}] tags from an assistant message. */
export function parseActionTags(text: string): { cleanText: string; actions: ChatAction[] } {
  // Fresh regex per call — a shared /g regex would carry lastIndex between calls.
  const actionRegex = /\[ACTION:(\{[^}]+\})\]/g;
  const actions: ChatAction[] = [];
  let match;
  while ((match = actionRegex.exec(text)) !== null) {
    try {
      actions.push(JSON.parse(match[1]) as ChatAction);
    } catch { /* ignore malformed action tag */ }
  }
  return { cleanText: text.replace(actionRegex, '').trim(), actions };
}

/** Fires the app-side event for each parsed action. */
export function dispatchChatActions(actions: ChatAction[]): void {
  for (const action of actions) {
    if (action.type === 'OPEN_DRUGS_DOCTORS_MODAL') {
      window.dispatchEvent(new CustomEvent('openDrugsDoctorsModal'));
    } else if (action.type === 'COLLECT_PHONE') {
      window.dispatchEvent(new CustomEvent('collectPhone'));
    } else if (action.type === 'COLLECT_NAME') {
      window.dispatchEvent(new CustomEvent('collectName'));
    }
  }
}
