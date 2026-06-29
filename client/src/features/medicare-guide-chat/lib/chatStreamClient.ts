import { CHAT_IDLE_TIMEOUT_MS } from './chatConstants';
import type { ConversationPhase, UserProfile } from '../types/chat';

const ERROR_GENERIC =
  "I couldn't reach the assistant just now. Please try again, or call 1-800-777-8002 to speak with a licensed SelectQuote advisor.";
const ERROR_OFFLINE = 'You appear to be offline. Check your connection and try again.';
const ERROR_TIMEOUT = 'That response took too long to come back. Please try again.';

export function chatErrorMessage(err: unknown): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return ERROR_OFFLINE;
  if (err instanceof DOMException && err.name === 'AbortError') return ERROR_TIMEOUT;
  return ERROR_GENERIC;
}

export interface ApiMessage {
  role: string;
  content: string;
}

export interface ChatMeta {
  chips?: string[];
  phase?: ConversationPhase;
  profileUpdate?: Partial<UserProfile>;
  cta?: { label: string; href: string };
  recommendation?: import('../types/chat').RecommendationHandoff;
}

export interface TopPlan {
  id: string;
  name: string;
  carrier: string;
  premium: number;
  stars: number;
  type: string;
}

export async function streamChat(
  apiMessages: ApiMessage[],
  onDelta: (accumulated: string) => void,
  controller: AbortController = new AbortController(),
  phase?: ConversationPhase,
  userProfile?: Partial<UserProfile>,
  topPlans?: TopPlan[],
): Promise<{ text: string; meta: ChatMeta }> {
  let idleTimer = setTimeout(() => controller.abort(), CHAT_IDLE_TIMEOUT_MS);
  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), CHAT_IDLE_TIMEOUT_MS);
  };

  // Build history: all messages except the last (which is the current user turn)
  const history = apiMessages.slice(0, -1);
  const lastMsg = apiMessages[apiMessages.length - 1];

  let accumulated = '';
  let meta: ChatMeta = {};

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: lastMsg?.content ?? '',
        history,
        userProfile: userProfile ?? {},
        phase: phase ?? 'welcome',
        ...(topPlans && topPlans.length > 0 ? { topPlans } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Chat request failed (${res.status})`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let currentEventType = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resetIdle();

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEventType = line.slice(7).trim();
          continue;
        }
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          if (currentEventType === 'error') throw new Error(dataStr);
          if (currentEventType === 'delta') {
            try {
              const token = JSON.parse(dataStr);
              if (token && typeof token === 'string') {
                accumulated += token;
                onDelta(accumulated);
              }
            } catch { /* skip parse errors */ }
          }
          if (currentEventType === 'replace') {
            try {
              const clean = JSON.parse(dataStr);
              if (typeof clean === 'string') {
                accumulated = clean;
                onDelta(accumulated);
              }
            } catch { /* ignore */ }
          }
          if (currentEventType === 'meta') {
            try { meta = JSON.parse(dataStr); } catch { /* ignore */ }
          }
          currentEventType = '';
        }
      }
    }

    if (accumulated.trim() === '') throw new Error('Empty response stream');
    return { text: accumulated, meta };
  } finally {
    clearTimeout(idleTimer);
  }
}
