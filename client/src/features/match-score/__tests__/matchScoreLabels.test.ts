import { describe, test, expect } from 'vitest';
import { SCORE_TIERS, scoreTierFor, scoreLabelFor, factorBarColorFor, sortBreakdown } from '../lib/matchScoreLabels';

describe('SCORE_TIERS integrity', () => {
  test('exactly 5 tiers', () => expect(SCORE_TIERS).toHaveLength(5));
  test('covers 0-100 with no gaps', () => {
    const sorted = [...SCORE_TIERS].sort((a,b)=>a.min-b.min);
    expect(sorted[0].min).toBe(0);
    expect(sorted.at(-1)!.max).toBe(100);
    for (let i=1;i<sorted.length;i++) expect(sorted[i].min).toBe(sorted[i-1].max+1);
  });
  test('has all required spec labels', () => {
    const labels = SCORE_TIERS.map(t=>t.label);
    expect(labels).toContain('Excellent fit');
    expect(labels).toContain('Strong fit');
    expect(labels).toContain('Good fit, review details');
    expect(labels).toContain('Possible fit');
    expect(labels).toContain('Low fit');
  });
});

describe('scoreTierFor boundaries', () => {
  test('100 → Excellent fit', () => expect(scoreTierFor(100).label).toBe('Excellent fit'));
  test('85  → Excellent fit', () => expect(scoreTierFor(85).label).toBe('Excellent fit'));
  test('84  → Strong fit',    () => expect(scoreTierFor(84).label).toBe('Strong fit'));
  test('70  → Strong fit',    () => expect(scoreTierFor(70).label).toBe('Strong fit'));
  test('69  → Good fit',      () => expect(scoreTierFor(69).label).toBe('Good fit, review details'));
  test('55  → Good fit',      () => expect(scoreTierFor(55).label).toBe('Good fit, review details'));
  test('54  → Possible fit',  () => expect(scoreTierFor(54).label).toBe('Possible fit'));
  test('40  → Possible fit',  () => expect(scoreTierFor(40).label).toBe('Possible fit'));
  test('39  → Low fit',       () => expect(scoreTierFor(39).label).toBe('Low fit'));
  test('0   → Low fit',       () => expect(scoreTierFor(0).label).toBe('Low fit'));
  test('clamps <0',           () => expect(scoreTierFor(-5).label).toBe('Low fit'));
  test('clamps >100',         () => expect(scoreTierFor(110).label).toBe('Excellent fit'));
  test('all integers 0-100 valid', () => {
    const valid = SCORE_TIERS.map(t=>t.label);
    for (let s=0;s<=100;s++) expect(valid).toContain(scoreTierFor(s).label);
  });
});

describe('factorBarColorFor', () => {
  test('1.0 → green',  () => expect(factorBarColorFor(1.0)).toBe('#22C55E'));
  test('0.70 → green', () => expect(factorBarColorFor(0.70)).toBe('#22C55E'));
  test('0.69 → amber', () => expect(factorBarColorFor(0.69)).toBe('#FBBF24'));
  test('0.44 → red',   () => expect(factorBarColorFor(0.44)).toBe('#F87171'));
  test('0.0 → red',    () => expect(factorBarColorFor(0.0)).toBe('#F87171'));
});

describe('sortBreakdown', () => {
  const unsorted = [
    { factor: 'Star Rating', weight: 10, contribution: 8 },
    { factor: 'Doctor Network', weight: 25, contribution: 20 },
  ];
  test('Doctor Network before Star Rating', () => {
    const s = sortBreakdown(unsorted);
    expect(s[0].factor).toBe('Doctor Network');
  });
  test('does not mutate input', () => {
    const orig = [...unsorted];
    sortBreakdown(unsorted);
    expect(unsorted[0].factor).toBe(orig[0].factor);
  });
  test('empty returns empty', () => expect(sortBreakdown([])).toHaveLength(0));
});
