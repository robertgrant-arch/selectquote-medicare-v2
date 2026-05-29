import { describe, test, expect } from 'vitest';
import { TERMS, GLOSSARY_META, ALL_TERM_KEYS, getTermsNeedingReview, getTerm, termExists } from '../data/terms';

const REQUIRED = ['hmo','ppo','hmo_pos','pffs','snp','isnp','dsnp','csnp','mapd','ma_only','part_d','medigap','lis','extra_help','medicaid','msp','formulary','tier','preferred_pharmacy','gap_coverage','deductible','copay','coinsurance','moop','prior_auth','referral','network','out_of_network'];
const ENTRIES = Object.entries(TERMS);
const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;

describe('required coverage', () => {
  for (const key of REQUIRED) {
    test(`term "${key}" is defined`, () => expect(TERMS[key]).toBeDefined());
  }
});

describe('content quality', () => {
  for (const [key, t] of ENTRIES) {
    test(`"${key}" has non-empty title+definition`, () => {
      expect(t.title.trim().length).toBeGreaterThan(0);
      expect(t.definition.trim().length).toBeGreaterThan(0);
    });
    test(`"${key}" definition ≤ 3 sentences`, () => {
      const n = t.definition.split(/[.!?]+/).filter(s=>s.trim().length>0).length;
      expect(n).toBeLessThanOrEqual(3);
    });
  }
});

describe('compliance', () => {
  for (const [key, t] of ENTRIES) {
    test(`"${key}" has valid semver`, () => expect(t.version).toMatch(/^\d+\.\d+\.\d+$/));
    test(`"${key}" not overdue (< 6 months)`, () => {
      const age = Date.now() - new Date(t.lastReviewedAt).getTime();
      expect(age).toBeLessThan(SIX_MONTHS_MS);
    });
  }
  test('no terms overdue', () => expect(getTermsNeedingReview()).toHaveLength(0));
  test('GLOSSARY_META valid', () => { expect(GLOSSARY_META.version).toMatch(/^\d+\.\d+\.\d+$/); expect(GLOSSARY_META.reviewCycleDays).toBe(180); });
});

describe('utilities', () => {
  test('termExists known → true',  () => expect(termExists('hmo')).toBe(true));
  test('termExists unknown → false', () => expect(termExists('xyz_unknown')).toBe(false));
  test('getTerm known → TermEntry', () => { const t = getTerm('deductible')!; expect(t.key).toBe('deductible'); });
  test('getTerm unknown → null',   () => expect(getTerm('nope')).toBeNull());
  test('ALL_TERM_KEYS has 28+ keys', () => expect(ALL_TERM_KEYS.length).toBeGreaterThanOrEqual(28));
});

describe('no forbidden abbreviations', () => {
  for (const [key, t] of ENTRIES) {
    test(`"${key}" no unexplained CMS/SSA/PCP/ER`, () => {
      [/\bCMS\b/, /\bSSA\b/, /\bPCP\b/, /\bER\b/].forEach(p => {
        expect(p.test(t.definition)).toBe(false);
      });
    });
  }
});
