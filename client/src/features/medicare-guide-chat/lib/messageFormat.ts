/**
 * Pure parsing for chat message rendering — no JSX, so it is unit-testable in a
 * node environment. `richText.tsx` is the thin presentational layer over this.
 *
 * Behavior owned here:
 *  - inline tokenization: markdown links, bold, and in-product deep links
 *    (bare product paths and bold product paths are intentionally linkified)
 *  - block splitting: paragraphs vs bullet / numbered lists
 */

export type InlineToken =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'link'; href: string; label: string; external: boolean; strong: boolean };

const INLINE_TOKEN_RE =
  /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\/[a-z][-a-z0-9/]*(?:\?[a-z0-9=&%_-]+)?)/gi;
const BARE_PATH_RE = /^\/[a-z][-a-z0-9/]*(?:\?[a-z0-9=&%_-]+)?$/i;

export function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];

  for (const part of text.split(INLINE_TOKEN_RE)) {
    if (!part) continue;

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      tokens.push({ kind: 'link', label: link[1], href: link[2], external: link[2].startsWith('http'), strong: false });
      continue;
    }

    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) {
      const inner = bold[1];
      if (inner.startsWith('/')) {
        tokens.push({ kind: 'link', label: inner, href: inner, external: false, strong: true });
      } else {
        tokens.push({ kind: 'bold', value: inner });
      }
      continue;
    }

    if (BARE_PATH_RE.test(part)) {
      tokens.push({ kind: 'link', label: part, href: part, external: false, strong: false });
      continue;
    }

    tokens.push({ kind: 'text', value: part });
  }

  return tokens;
}

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] };

const BULLET_RE = /^\s*[-*•]\s+/;
const NUMBER_RE = /^\s*\d+\.\s+/;

export function splitMessageBlocks(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (BULLET_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET_RE.test(lines[i])) { items.push(lines[i].replace(BULLET_RE, '')); i++; }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    if (NUMBER_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && NUMBER_RE.test(lines[i])) { items.push(lines[i].replace(NUMBER_RE, '')); i++; }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !BULLET_RE.test(lines[i]) && !NUMBER_RE.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    blocks.push({ kind: 'p', text: para.join(' ') });
  }

  return blocks;
}
