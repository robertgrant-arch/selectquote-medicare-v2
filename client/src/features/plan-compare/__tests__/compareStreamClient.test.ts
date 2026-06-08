import { describe, test, expect } from 'vitest';
import { parseSseBlock, buildRequestBody, COMPARE_STREAM_TIMEOUT_MS } from '../lib/compareStreamClient';
import type { MedicarePlan } from '@/lib/types';

function makePlan(id: string, premium = 0): MedicarePlan {
  return {
    id, carrier:'Humana', planName:`Plan ${id}`, planType:'PPO', contractId:'H1', planId:'001',
    starRating:{overall:4.0,label:''}, premium, partBPremiumReduction:0, deductible:0, maxOutOfPocket:5500,
    copays:{primaryCare:'$0',specialist:'$40',urgentCare:'$40',emergency:'$90',inpatientHospital:'$275',outpatientSurgery:'$295'},
    rxDrugs:{tier1:'$0',tier2:'$15',tier3:'$47',tier4:'$100',deductible:'$0',gap:false,initialCoverageLimit:'$5,030'},
    extraBenefits:{dental:{covered:true,details:''},vision:{covered:false,details:''},hearing:{covered:false,details:''},
      otc:{covered:false,details:''},fitness:{covered:false,details:''},transportation:{covered:false,details:''},
      telehealth:{covered:true,details:''},meals:{covered:false,details:''}},
    networkSize:50000, enrollmentPeriod:'', effectiveDate:'', serviceArea:'',
    snpType:undefined, snpCategory:null, carrierLogoColor:'', carrierLogoTextColor:'',
  } as MedicarePlan;
}

// ─── parseSseBlock ────────────────────────────────────────────────────────────

describe('parseSseBlock', () => {
  test('delta event with JSON string', () => {
    const r = parseSseBlock('event: delta\ndata: "hello"');
    expect(r?.event).toBe('delta');
    expect(r?.data).toBe('"hello"');
  });
  test('done event', () => {
    const r = parseSseBlock('event: done\ndata: ""');
    expect(r?.event).toBe('done');
  });
  test('error event', () => {
    const r = parseSseBlock('event: error\ndata: "something went wrong"');
    expect(r?.event).toBe('error');
    expect(r?.data).toContain('something went wrong');
  });
  test('no event field → defaults to delta', () => {
    const r = parseSseBlock('data: "token"');
    expect(r?.event).toBe('delta');
  });
  test('empty block → null', () => {
    expect(parseSseBlock('')).toBeNull();
    expect(parseSseBlock('\n\n')).toBeNull();
  });
  test('block with only whitespace → null', () => {
    expect(parseSseBlock('   \n  ')).toBeNull();
  });
  test('data only, no event → event defaults to delta', () => {
    const r = parseSseBlock('data: "chunk"');
    expect(r).not.toBeNull();
    expect(r?.event).toBe('delta');
  });
});

// ─── buildRequestBody ─────────────────────────────────────────────────────────

describe('buildRequestBody', () => {
  test('2 plans → currentPlan + newPlan only', () => {
    const b = buildRequestBody([makePlan('a'), makePlan('b')]) as any;
    expect(b.currentPlan).toBeDefined();
    expect(b.newPlan).toBeDefined();
    expect(b.thirdPlan).toBeUndefined();
  });
  test('3 plans → all three fields', () => {
    const b = buildRequestBody([makePlan('a'), makePlan('b'), makePlan('c')]) as any;
    expect(b.currentPlan).toBeDefined();
    expect(b.newPlan).toBeDefined();
    expect(b.thirdPlan).toBeDefined();
  });
  test('throws on 1 plan', () => {
    expect(() => buildRequestBody([makePlan('a')])).toThrow();
  });
  test('throws on 4 plans', () => {
    expect(() => buildRequestBody([makePlan('a'),makePlan('b'),makePlan('c'),makePlan('d')])).toThrow();
  });
  test('plan fields are serialized', () => {
    const b = buildRequestBody([makePlan('p1', 50), makePlan('p2', 0)]) as any;
    expect(b.currentPlan.id).toBe('p1');
    expect(b.currentPlan.premium).toBe(50);
    expect(b.newPlan.id).toBe('p2');
  });
  test('extra plan fields stripped', () => {
    const b = buildRequestBody([makePlan('a'), makePlan('b')]) as any;
    // serviceArea is not in the API schema
    expect(b.currentPlan.serviceArea).toBeUndefined();
  });
  test('extraBenefits are present', () => {
    const b = buildRequestBody([makePlan('a'), makePlan('b')]) as any;
    expect(b.currentPlan.extraBenefits).toBeDefined();
    expect(b.currentPlan.extraBenefits.dental).toBeDefined();
  });
});

// ─── COMPARE_STREAM_TIMEOUT_MS ────────────────────────────────────────────────

describe('COMPARE_STREAM_TIMEOUT_MS', () => {
  test('is defined and reasonable (1s–60s)', () => {
    expect(COMPARE_STREAM_TIMEOUT_MS).toBeGreaterThanOrEqual(1_000);
    expect(COMPARE_STREAM_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
  });
  test('is 30 seconds', () => expect(COMPARE_STREAM_TIMEOUT_MS).toBe(30_000));
});
