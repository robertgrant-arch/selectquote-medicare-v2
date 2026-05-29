import { describe, test, expect } from 'vitest';
import { parseCopayString, determineConfidence, calculateAnnualCost, AVERAGE_ANNUAL_DRUG_COST } from '../lib/annualCostCalculator';
import type { CostCalculationInputs } from '../lib/annualCostCalculator';

function makeInputs(o: Partial<CostCalculationInputs> = {}): CostCalculationInputs {
  return { premiumAnnual:0, deductible:0, maxOutOfPocket:6700, primaryCareCopay:'$0 copay',
    specialistCopay:'$40 copay', estimatedAnnualDrugCost:null, hasDrugCoverage:true,
    hasRxDrugs:false, hasDoctors:false, ...o };
}

describe('parseCopayString', () => {
  test('"$40 copay" → 40',  () => expect(parseCopayString('$40 copay')).toBe(40));
  test('"$0 copay" → 0',   () => expect(parseCopayString('$0 copay')).toBe(0));
  test('"No charge" → 0',  () => expect(parseCopayString('No charge')).toBe(0));
  test('"N/A" → 0',        () => expect(parseCopayString('N/A')).toBe(0));
  test('empty → 0',        () => expect(parseCopayString('')).toBe(0));
});

describe('determineConfidence', () => {
  test('both → high',   () => expect(determineConfidence(true,true)).toBe('high'));
  test('rx only → med', () => expect(determineConfidence(true,false)).toBe('medium'));
  test('doc only → med',() => expect(determineConfidence(false,true)).toBe('medium'));
  test('none → low',    () => expect(determineConfidence(false,false)).toBe('low'));
});

describe('calculateAnnualCost — never $0 when drugs unknown', () => {
  test('$0 premium + unknown drugs → total > 0', () => {
    const r = calculateAnnualCost(makeInputs({ premiumAnnual:0 }));
    expect(r.totalEstimate).toBeGreaterThan(0);
  });
  test('drug component uses AVERAGE when no Rx', () => {
    const r = calculateAnnualCost(makeInputs());
    const drug = r.components.find(c=>c.id==='drug')!;
    expect(drug.amount).toBe(AVERAGE_ANNUAL_DRUG_COST);
    expect(drug.isEstimated).toBe(true);
  });
  test('drug message mentions prescriptions', () => {
    const r = calculateAnnualCost(makeInputs());
    expect(r.components.find(c=>c.id==='drug')!.assumption.toLowerCase()).toMatch(/prescription/);
  });
});

describe('calculateAnnualCost — MOOP cap', () => {
  test('OOP capped when raw exceeds MOOP', () => {
    const r = calculateAnnualCost(makeInputs({ estimatedAnnualDrugCost:8000, hasRxDrugs:true, maxOutOfPocket:2000 }));
    expect(r.isOopCappedByMoop).toBe(true);
    expect(r.oopEstimate).toBeLessThanOrEqual(2000);
  });
  test('total never exceeds premiumAnnual + MOOP', () => {
    const r = calculateAnnualCost(makeInputs({ premiumAnnual:1200, maxOutOfPocket:3000, estimatedAnnualDrugCost:10000, hasRxDrugs:true }));
    expect(r.totalEstimate).toBeLessThanOrEqual(1200+3000);
  });
});

describe('calculateAnnualCost — always 4 components', () => {
  test('4 components', () => expect(calculateAnnualCost(makeInputs()).components).toHaveLength(4));
  test('IDs are unique', () => {
    const ids = calculateAnnualCost(makeInputs()).components.map(c=>c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  test('has premium, drug, copay, deductible', () => {
    const ids = calculateAnnualCost(makeInputs()).components.map(c=>c.id);
    expect(ids).toContain('premium'); expect(ids).toContain('drug');
    expect(ids).toContain('copay');   expect(ids).toContain('deductible');
  });
});
