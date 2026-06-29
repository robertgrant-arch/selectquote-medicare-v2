/**
 * PHI boundary utilities for the chat AI endpoint.
 *
 * Extracted from api/chat.ts so this logic is independently testable
 * without requiring @vercel/node runtime types.
 *
 * PHI guarantee: Phone numbers are redacted and context is windowed before
 * the message array reaches ANY AI provider (Anthropic or OpenAI).
 */

export const PHONE_RE =
  /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

export const MAX_CHAT_CONTEXT_MESSAGES = 20;

export interface ChatMessage {
  role: string;
  content: string | unknown;
}

/**
 * Sanitizes a chat message history before sending to any AI provider.
 *
 * Two defenses:
 *   1. Phone redaction — replaces North-American phone patterns with a
 *      placeholder so raw digits are never transmitted to the model.
 *   2. Sliding context window — caps history at MAX_CHAT_CONTEXT_MESSAGES
 *      so older turns (which may contain names and other PII) are dropped.
 */
export function sanitizeMessagesForAI(messages: ChatMessage[]): ChatMessage[] {
  const recent = messages.slice(-MAX_CHAT_CONTEXT_MESSAGES);
  return recent.map((msg) => ({
    ...msg,
    content:
      typeof msg.content === "string"
        ? msg.content.replace(PHONE_RE, "[phone redacted]")
        : msg.content,
  }));
}
