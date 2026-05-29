import { describe, test, expect } from 'vitest';
import { nextFocusIdx, shouldTrap, starRatingLabel, inputAriaProps, FOCUSABLE_SELECTOR } from '../focusTrap';

describe('nextFocusIdx', () => {
  test('forward from last wraps to 0', () => expect(nextFocusIdx(2, 3, 'forward')).toBe(0));
  test('forward from middle goes next', () => expect(nextFocusIdx(1, 3, 'forward')).toBe(2));
  test('backward from 0 wraps to last', () => expect(nextFocusIdx(0, 3, 'backward')).toBe(2));
  test('backward from last goes prev', () => expect(nextFocusIdx(2, 3, 'backward')).toBe(1));
  test('total 1 → always 0', () => expect(nextFocusIdx(0, 1, 'forward')).toBe(0));
  test('total 0 → returns 0', () => expect(nextFocusIdx(0, 0, 'forward')).toBe(0));
  test('forward cycles', () => {
    let idx = 0;
    const visited = [idx];
    for (let i = 0; i < 4; i++) { idx = nextFocusIdx(idx, 4, 'forward'); visited.push(idx); }
    expect(visited).toEqual([0, 1, 2, 3, 0]);
  });
});

describe('shouldTrap', () => {
  test('shift+tab at 0 → trap', () => expect(shouldTrap(0, 3, true)).toBe(true));
  test('tab at last → trap', () => expect(shouldTrap(2, 3, false)).toBe(true));
  test('tab in middle → no trap', () => expect(shouldTrap(1, 3, false)).toBe(false));
  test('total 1 → never trap', () => expect(shouldTrap(0, 1, false)).toBe(false));
  test('total 0 → never trap', () => expect(shouldTrap(0, 0, false)).toBe(false));
});

describe('starRatingLabel', () => {
  test('4 out of 5', () => expect(starRatingLabel(4)).toBe('4 out of 5 stars'));
  test('4.5 out of 5', () => expect(starRatingLabel(4.5)).toBe('4.5 out of 5 stars'));
  test('0 stars', () => expect(starRatingLabel(0)).toBe('0 out of 5 stars'));
  test('with suffix', () => expect(starRatingLabel(4, 5, 'CMS Rating')).toBe('4 out of 5 stars — CMS Rating'));
  test('rounds to 1 decimal', () => expect(starRatingLabel(4.05)).toBe('4.1 out of 5 stars'));
});

describe('inputAriaProps', () => {
  test('no error → no aria-describedby', () => {
    const p = inputAriaProps({ id: 'zip', label: 'ZIP', hasError: false });
    expect(p['aria-invalid']).toBe(false);
    expect(p['aria-describedby']).toBeUndefined();
  });
  test('error + errorId → aria-describedby set', () => {
    const p = inputAriaProps({ id: 'zip', errorId: 'zip-error', label: 'ZIP', hasError: true });
    expect(p['aria-invalid']).toBe(true);
    expect(p['aria-describedby']).toBe('zip-error');
  });
});

describe('FOCUSABLE_SELECTOR', () => {
  test('is a non-empty string', () => expect(FOCUSABLE_SELECTOR.length).toBeGreaterThan(0));
  test('includes buttons', () => expect(FOCUSABLE_SELECTOR).toContain('button'));
  test('includes links', () => expect(FOCUSABLE_SELECTOR).toContain('a[href]'));
  test('excludes disabled', () => expect(FOCUSABLE_SELECTOR).toContain(':not([disabled])'));
  test('excludes tabindex -1', () => expect(FOCUSABLE_SELECTOR).toContain(':not([tabindex="-1"])'));
});
