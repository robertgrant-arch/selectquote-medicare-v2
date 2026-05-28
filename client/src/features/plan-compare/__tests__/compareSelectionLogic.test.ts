import { describe, test, expect } from 'vitest';
import { canAdd, addId, removeId, toggleId, isFull, isSelected, canCompare, MAX_COMPARE } from '../lib/compareSelectionLogic';

describe('MAX_COMPARE', () => { test('is 3', () => expect(MAX_COMPARE).toBe(3)); });

describe('canAdd', () => {
  test('empty → can add',             () => expect(canAdd([], 'a')).toBe(true));
  test('full → cannot add',           () => expect(canAdd(['a','b','c'], 'd')).toBe(false));
  test('already in → cannot add',     () => expect(canAdd(['a'], 'a')).toBe(false));
});

describe('addId', () => {
  test('adds new plan',               () => expect(addId([], 'a')).toEqual(['a']));
  test('no duplicate',                () => expect(addId(['a'], 'a')).toEqual(['a']));
  test('no add when full',            () => expect(addId(['a','b','c'], 'd')).toEqual(['a','b','c']));
  test('does not mutate original',    () => { const o = ['a','b']; addId(o,'c'); expect(o).toEqual(['a','b']); });
});

describe('removeId', () => {
  test('removes existing',            () => expect(removeId(['a','b','c'], 'b')).toEqual(['a','c']));
  test('no-op if not present',        () => expect(removeId(['a','b'], 'c')).toEqual(['a','b']));
  test('empty stays empty',           () => expect(removeId([], 'a')).toEqual([]));
});

describe('toggleId', () => {
  test('adds when not selected',      () => expect(toggleId([], 'a')).toEqual(['a']));
  test('removes when selected',       () => expect(toggleId(['a','b'], 'a')).toEqual(['b']));
  test('full + new → no change',      () => expect(toggleId(['a','b','c'], 'd')).toEqual(['a','b','c']));
  test('double toggle = original',    () => expect(toggleId(toggleId(['a','b'], 'c'), 'c')).toEqual(['a','b']));
});

describe('isFull / isSelected / canCompare', () => {
  test('0 plans → not full',          () => expect(isFull([])).toBe(false));
  test('3 plans → full',              () => expect(isFull(['a','b','c'])).toBe(true));
  test('plan in list → selected',     () => expect(isSelected(['a','b'], 'a')).toBe(true));
  test('plan not in list → false',    () => expect(isSelected(['a'], 'c')).toBe(false));
  test('1 plan → cannot compare',     () => expect(canCompare(['a'])).toBe(false));
  test('2 plans → can compare',       () => expect(canCompare(['a','b'])).toBe(true));
});

describe('user flows', () => {
  test('add 3 → full', () => {
    let s = addId(addId(addId([], 'a'), 'b'), 'c');
    expect(isFull(s)).toBe(true); expect(canCompare(s)).toBe(true);
  });
  test('add 3 → try 4th → still 3', () => {
    let s: string[] = [];
    for (const id of ['a','b','c','d']) s = addId(s, id);
    expect(s).toHaveLength(3); expect(s).not.toContain('d');
  });
});
