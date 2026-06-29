import { describe, it, expect } from 'vitest';
import { tokenizeInline, splitMessageBlocks } from '../lib/messageFormat';

describe('tokenizeInline', () => {
  it('returns a single text token for plain prose', () => {
    expect(tokenizeInline('just words')).toEqual([{ kind: 'text', value: 'just words' }]);
  });

  it('linkifies a bare in-product path (deep link)', () => {
    const tokens = tokenizeInline('See /plans?zip=66208 now');
    const link = tokens.find((t) => t.kind === 'link');
    expect(link).toMatchObject({ kind: 'link', href: '/plans?zip=66208', label: '/plans?zip=66208', external: false });
  });

  it('parses a markdown link and flags external http links', () => {
    const internal = tokenizeInline('[plans](/plans)').find((t) => t.kind === 'link');
    expect(internal).toMatchObject({ href: '/plans', label: 'plans', external: false });
    const external = tokenizeInline('[medicare.gov](https://medicare.gov)').find((t) => t.kind === 'link');
    expect(external).toMatchObject({ href: 'https://medicare.gov', external: true });
  });

  it('treats **text** as bold but **/path** as a strong link', () => {
    expect(tokenizeInline('**important**')).toContainEqual({ kind: 'bold', value: 'important' });
    const strongLink = tokenizeInline('**/ai-compare**').find((t) => t.kind === 'link');
    expect(strongLink).toMatchObject({ kind: 'link', href: '/ai-compare', strong: true });
  });

  it('preserves order across mixed tokens', () => {
    const kinds = tokenizeInline('Go to /plans or [compare](/ai-compare).').map((t) => t.kind);
    expect(kinds).toContain('text');
    expect(kinds.filter((k) => k === 'link')).toHaveLength(2);
  });
});

describe('splitMessageBlocks', () => {
  it('splits double-newline prose into separate paragraphs', () => {
    const blocks = splitMessageBlocks('First para.\n\nSecond para.');
    expect(blocks).toEqual([
      { kind: 'p', text: 'First para.' },
      { kind: 'p', text: 'Second para.' },
    ]);
  });

  it('detects bullet lists', () => {
    const blocks = splitMessageBlocks('Options:\n- A\n- B\n- C');
    expect(blocks[0]).toEqual({ kind: 'p', text: 'Options:' });
    expect(blocks[1]).toEqual({ kind: 'ul', items: ['A', 'B', 'C'] });
  });

  it('detects numbered lists', () => {
    const blocks = splitMessageBlocks('1. First\n2. Second');
    expect(blocks).toEqual([{ kind: 'ol', items: ['First', 'Second'] }]);
  });

  it('returns an empty array for empty/whitespace text', () => {
    expect(splitMessageBlocks('')).toEqual([]);
    expect(splitMessageBlocks('\n\n  \n')).toEqual([]);
  });

  it('handles a paragraph followed by a list (mixed structure)', () => {
    const blocks = splitMessageBlocks('Here are picks:\n- Plan A\n- Plan B\nCall us to enroll.');
    expect(blocks.map((b) => b.kind)).toEqual(['p', 'ul', 'p']);
  });
});
