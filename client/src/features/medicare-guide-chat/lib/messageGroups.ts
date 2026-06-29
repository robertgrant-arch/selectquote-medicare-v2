import type { Message } from '../types/chat';

/**
 * Groups consecutive same-role messages into turns so the view can render one
 * assistant glyph per turn with tight intra-turn spacing. Pure + node-testable.
 */
export type MessageGroup = {
  role: Message['role'];
  items: { msg: Message; index: number }[];
};

export function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  messages.forEach((msg, index) => {
    const last = groups[groups.length - 1];
    if (last && last.role === msg.role) last.items.push({ msg, index });
    else groups.push({ role: msg.role, items: [{ msg, index }] });
  });
  return groups;
}
