import { describe, it, expect, vi, afterEach } from 'vitest';
import { streamChat, chatErrorMessage } from '../lib/chatStreamClient';

// Build a fake /api/chat SSE Response from raw chunk strings.
function sseResponse(chunks: string[], { ok = true, status = 200 } = {}): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Response(ok ? stream : null, { status });
}

function delta(text: string) {
  return `event: delta\ndata: ${JSON.stringify(text)}\n\n`;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('streamChat', () => {
  it('accumulates deltas, reports progress, and returns the full text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      sseResponse([delta('Hello '), delta('there'), 'event: done\ndata: ""\n\n'])
    ));

    const seen: string[] = [];
    const full = await streamChat([{ role: 'user', content: 'hi' }], (acc) => seen.push(acc));

    expect(full).toBe('Hello there');
    expect(seen).toEqual(['Hello ', 'Hello there']); // incremental, accumulated
  });

  it('sends only { role, content } and POSTs to /api/chat', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([delta('ok')]));
    vi.stubGlobal('fetch', fetchMock);

    await streamChat([{ role: 'user', content: 'hi' }], () => {});

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/chat');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ messages: [{ role: 'user', content: 'hi' }] });
  });

  it('throws on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse([], { ok: false, status: 500 })));
    await expect(streamChat([{ role: 'user', content: 'hi' }], () => {})).rejects.toThrow();
  });

  it('throws when the stream yields no tokens (200 with no deltas)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(['event: done\ndata: ""\n\n'])));
    await expect(streamChat([{ role: 'user', content: 'hi' }], () => {})).rejects.toThrow(/empty/i);
  });

  it('throws when the server sends an error event', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      sseResponse(['event: error\ndata: "AI API error: 529"\n\n'])
    ));
    await expect(streamChat([{ role: 'user', content: 'hi' }], () => {})).rejects.toThrow();
  });

  it('respects a caller-provided AbortController (pre-aborted → no request)', async () => {
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      if (init.signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
      return Promise.resolve(sseResponse([delta('ok')]));
    });
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    controller.abort();
    await expect(
      streamChat([{ role: 'user', content: 'hi' }], () => {}, controller)
    ).rejects.toThrow();
  });
});

describe('chatErrorMessage', () => {
  it('reports an offline message when the browser is offline', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(chatErrorMessage(new Error('x'))).toMatch(/offline/i);
  });

  it('reports a timeout message for an AbortError', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(chatErrorMessage(new DOMException('Aborted', 'AbortError'))).toMatch(/too long/i);
  });

  it('falls back to a generic message with the advisor phone number', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(chatErrorMessage(new Error('boom'))).toMatch(/1-800-777-8002/);
  });
});
