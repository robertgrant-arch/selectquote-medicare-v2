import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseActionTags, dispatchChatActions } from '../lib/chatActions';

describe('parseActionTags', () => {
  it('returns the text unchanged with no actions when there are no tags', () => {
    const { cleanText, actions } = parseActionTags('Just a normal reply.');
    expect(cleanText).toBe('Just a normal reply.');
    expect(actions).toEqual([]);
  });

  it('extracts a single action and strips the tag from the displayed text', () => {
    const { cleanText, actions } = parseActionTags(
      'What\'s your phone number?\n[ACTION:{"type":"COLLECT_PHONE"}]'
    );
    expect(cleanText).toBe("What's your phone number?");
    expect(actions).toEqual([{ type: 'COLLECT_PHONE' }]);
  });

  it('extracts multiple actions', () => {
    const { actions } = parseActionTags(
      'text [ACTION:{"type":"COLLECT_NAME"}] more [ACTION:{"type":"COLLECT_PHONE"}]'
    );
    expect(actions).toEqual([{ type: 'COLLECT_NAME' }, { type: 'COLLECT_PHONE' }]);
  });

  it('ignores malformed action tags without throwing', () => {
    const { cleanText, actions } = parseActionTags('hi [ACTION:{not json}] there');
    // malformed JSON yields no action; the tag is still stripped from display
    expect(actions).toEqual([]);
    expect(cleanText).not.toContain('[ACTION');
  });

  it('does not carry regex state between calls (no lastIndex bug)', () => {
    const input = 'x [ACTION:{"type":"COLLECT_NAME"}]';
    expect(parseActionTags(input).actions).toEqual([{ type: 'COLLECT_NAME' }]);
    expect(parseActionTags(input).actions).toEqual([{ type: 'COLLECT_NAME' }]);
  });
});

describe('dispatchChatActions', () => {
  const originalWindow = (globalThis as any).window;
  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  it('dispatches the mapped window event for each action', () => {
    const dispatchEvent = vi.fn();
    (globalThis as any).window = { dispatchEvent };

    dispatchChatActions([
      { type: 'OPEN_DRUGS_DOCTORS_MODAL' },
      { type: 'COLLECT_NAME' },
      { type: 'COLLECT_PHONE' },
    ]);

    const eventNames = dispatchEvent.mock.calls.map((c) => (c[0] as CustomEvent).type);
    expect(eventNames).toEqual(['openDrugsDoctorsModal', 'collectName', 'collectPhone']);
  });

  it('dispatches nothing for an empty action list', () => {
    const dispatchEvent = vi.fn();
    (globalThis as any).window = { dispatchEvent };
    dispatchChatActions([]);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});
