import { describe, test, expect } from 'vitest';

// Pure state machine for tooltip open/close/mode
type TipState = 'closed' | 'open';
function nextTipState(current: TipState, action: 'open'|'close'|'toggle'): TipState {
  if (action === 'open') return 'open';
  if (action === 'close') return 'closed';
  return current === 'open' ? 'closed' : 'open';
}
function getTipMode(viewportWidth: number): 'tooltip'|'bottomsheet' {
  return viewportWidth < 768 ? 'bottomsheet' : 'tooltip';
}

describe('nextTipState', () => {
  test('closed + open → open',    () => expect(nextTipState('closed','open')).toBe('open'));
  test('closed + close → closed', () => expect(nextTipState('closed','close')).toBe('closed'));
  test('closed + toggle → open',  () => expect(nextTipState('closed','toggle')).toBe('open'));
  test('open + toggle → closed',  () => expect(nextTipState('open','toggle')).toBe('closed'));
  test('double toggle = original', () => expect(nextTipState(nextTipState('closed','toggle'),'toggle')).toBe('closed'));
});

describe('getTipMode', () => {
  test('375px → bottomsheet',  () => expect(getTipMode(375)).toBe('bottomsheet'));
  test('767px → bottomsheet',  () => expect(getTipMode(767)).toBe('bottomsheet'));
  test('768px → tooltip',      () => expect(getTipMode(768)).toBe('tooltip'));
  test('1440px → tooltip',     () => expect(getTipMode(1440)).toBe('tooltip'));
});
