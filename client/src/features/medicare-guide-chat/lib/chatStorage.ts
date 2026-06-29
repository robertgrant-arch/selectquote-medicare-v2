import type { Message } from '../types/chat';
import { INITIAL_MESSAGE, STORAGE_KEY, MAX_PERSISTED_MESSAGES } from './chatConstants';

/**
 * Session-scoped persistence for the chat slice. Survives a page reload within
 * the same tab (consistent with the app's sessionStorage posture); cleared when
 * the tab closes. Never persists an in-flight (empty) assistant bubble.
 */

export function loadPersisted(): { messages: Message[]; isOpen: boolean } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const messages =
        Array.isArray(parsed.messages) && parsed.messages.length ? parsed.messages : [INITIAL_MESSAGE];
      const isOpen = typeof parsed.isOpen === 'boolean' ? parsed.isOpen : true;
      return { messages, isOpen };
    }
  } catch { /* corrupt storage — fall through to defaults */ }
  return { messages: [INITIAL_MESSAGE], isOpen: true };
}

export function savePersisted(messages: Message[], isOpen: boolean): void {
  try {
    const toStore = messages
      .filter((m) => !(m.role === 'assistant' && m.content === ''))
      .slice(-MAX_PERSISTED_MESSAGES);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: toStore, isOpen }));
  } catch { /* storage full / unavailable — non-fatal */ }
}
