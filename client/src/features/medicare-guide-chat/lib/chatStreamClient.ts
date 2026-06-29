import { CHAT_IDLE_TIMEOUT_MS } from './chatConstants';

/**
 * Transport adapter for the chat slice.
 *
 * Owns the HTTP + SSE details of talking to /api/chat: request shape, stream
 * parsing, idle-timeout, and failure detection. The server contract is
 * unchanged — only { role, content } is sent.
 */

const ERROR_GENERIC =
  "I couldn't reach the assistant just now. Please try again, or call 1-800-555-0100 to speak with a licensed advisor.";
const ERROR_OFFLINE = 'You appear to be offline. Check your connection and try again.';
const ERROR_TIMEOUT = 'That response took too long to come back. Please try again.';

/** Maps a transport failure to honest, user-facing copy (no failure-hiding). */
export function chatErrorMessage(err: unknown): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return ERROR_OFFLINE;
  if (err instanceof DOMException && err.name === 'AbortError') return ERROR_TIMEOUT;
  return ERROR_GENERIC;
}

export interface ApiMessage {
  role: string;
  content: string;
}

/**
 * POSTs the message history to /api/chat and streams the SSE response,
 * invoking `onDelta` with the accumulated text as tokens arrive.
 *
 * Resolves with the full text on success. Throws on transport failure, an
 * `error` event, or an empty stream (e.g. a 200 that yields no tokens).
 */
export async function streamChat(
  apiMessages: ApiMessage[],
  onDelta: (accumulated: string) => void,
  // Caller-owned controller so the orchestrator can cancel (e.g. on unmount);
  // streamChat also fires it on idle-timeout. Defaults to a private one.
  controller: AbortController = new AbortController(),
): Promise<string> {
  let idleTimer = setTimeout(() => controller.abort(), CHAT_IDLE_TIMEOUT_MS);
  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), CHAT_IDLE_TIMEOUT_MS);
  };

  let accumulated = '';
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: apiMessages }),
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
              const data = JSON.parse(dataStr);
              if (data && typeof data === 'string') {
                accumulated += data;
                onDelta(accumulated);
              }
            } catch { /* skip parse errors */ }
          }
          currentEventType = '';
        }
      }
    }

    // A 200 that yields no tokens (e.g. a proxy returning non-SSE HTML) is a
    // failure, not a finished turn.
    if (accumulated.trim() === '') throw new Error('Empty response stream');
    return accumulated;
  } finally {
    clearTimeout(idleTimer);
  }
}
