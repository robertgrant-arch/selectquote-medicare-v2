import { describe, test, expect } from 'vitest';
import { factorPerformanceRatio, scoreCompletenessRatio, detectMissingDoctors, detectMissingDrugs, detectMissingData, improveSuggestionLabel } from '../lib/missingDataDetector';

const FULL_BD = [
  { factor:'Doctor Network', weight:25, contribution:20 },
  { factor:'Drug Cost', weight:20, contribution:16 },
  { factor:'Premium', weight:12, contribution:10 },
];
const NO_DOCTORS_BD = FULL_BD.map(b => b.factor==='Doctor Network' ? {...b, weight:0, contribution:0} : b);
const FULL_CTX = { hasRxDrugs:true, hasDoctors:true };
const NO_DOC   = { hasRxDrugs:true, hasDoctors:false };
const NO_RX    = { hasRxDrugs:false, hasDoctors:true };
const EMPTY    = { hasRxDrugs:false, hasDoctors:false };

describe('factorPerformanceRatio', () => {
  test('normal', () => expect(factorPerformanceRatio({factor:'',weight:12,contribution:9})).toBeCloseTo(0.75));
  test('weight 0 → 0', () => expect(factorPerformanceRatio({factor:'',weight:0,contribution:0})).toBe(0));
  test('clamps to 1', () => expect(factorPerformanceRatio({factor:'',weight:10,contribution:12})).toBe(1));
  test('clamps to 0', () => expect(factorPerformanceRatio({factor:'',weight:10,contribution:-2})).toBe(0));
});

describe('detectMissingDoctors', () => {
  test('full ctx → null', () => expect(detectMissingDoctors(FULL_BD, FULL_CTX)).toBeNull());
  test('doctor weight=0 + no doctors → notice', () => expect(detectMissingDoctors(NO_DOCTORS_BD, NO_DOC)).not.toBeNull());
  test('actionEvent correct', () => expect(detectMissingDoctors(NO_DOCTORS_BD, NO_DOC)!.actionEvent).toBe('match-score:open-doctors-modal'));
  test('hasDoctors=true → null even with weight 0', () => expect(detectMissingDoctors(NO_DOCTORS_BD, FULL_CTX)).toBeNull());
});

describe('detectMissingDrugs', () => {
  test('hasRxDrugs=true → null', () => expect(detectMissingDrugs(FULL_BD, FULL_CTX)).toBeNull());
  test('no rx + drug weight > 0 → notice', () => expect(detectMissingDrugs(FULL_BD, NO_RX)).not.toBeNull());
  test('actionEvent correct', () => expect(detectMissingDrugs(FULL_BD, NO_RX)!.actionEvent).toBe('match-score:open-rx-modal'));
});

describe('detectMissingData + improveSuggestionLabel', () => {
  test('full → 0 notices', () => expect(detectMissingData(FULL_BD, FULL_CTX)).toHaveLength(0));
  test('empty → 1 notice (drug)', () => expect(detectMissingData(FULL_BD, EMPTY)).toHaveLength(1));
  test('no doctors bd + empty → 2 notices', () => expect(detectMissingData(NO_DOCTORS_BD, EMPTY)).toHaveLength(2));
  test('0 notices → empty string', () => expect(improveSuggestionLabel([])).toBe(''));
  test('2 notices → contains &', () => expect(improveSuggestionLabel(detectMissingData(NO_DOCTORS_BD, EMPTY))).toContain('&'));
});
