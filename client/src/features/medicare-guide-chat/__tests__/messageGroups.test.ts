import { describe, it, expect } from 'vitest';
import { groupMessages } from '../lib/messageGroups';
import type { Message } from '../types/chat';

const a = (content: string): Message => ({ role: 'assistant', content });
const u = (content: string): Message => ({ role: 'user', content });

describe('groupMessages', () => {
  it('returns no groups for an empty conversation', () => {
    expect(groupMessages([])).toEqual([]);
  });

  it('puts a single greeting in one assistant group', () => {
    const groups = groupMessages([a('hi')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].role).toBe('assistant');
    expect(groups[0].items).toHaveLength(1);
  });

  it('creates a new group on each role change (typical alternating turns)', () => {
    const groups = groupMessages([a('hi'), u('costs'), a('here are plans')]);
    expect(groups.map((g) => g.role)).toEqual(['assistant', 'user', 'assistant']);
    expect(groups.every((g) => g.items.length === 1)).toBe(true);
  });

  it('groups consecutive same-role messages into one turn', () => {
    const groups = groupMessages([a('one'), a('two'), u('q')]);
    expect(groups).toHaveLength(2);
    expect(groups[0].items).toHaveLength(2); // two assistant bubbles, one glyph
    expect(groups[1].role).toBe('user');
  });

  it('preserves original message indices for keying', () => {
    const groups = groupMessages([a('hi'), u('costs')]);
    expect(groups[0].items[0].index).toBe(0);
    expect(groups[1].items[0].index).toBe(1);
  });
});
