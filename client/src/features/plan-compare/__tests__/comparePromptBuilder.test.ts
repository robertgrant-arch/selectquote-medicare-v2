import { describe, test, expect } from 'vitest';
import {
  buildComparePrompt, canStartCompare, compareButtonLabel,
  compareBlockedReason, estimateAnnualCost, missingDataSection,
} from '../lib/comparePromptBuilder';
import type { MedicarePlan } from '@/lib/types';
import type { CompareMissingData } from '../lib/comparePromptBuilder';

function makePlan(id: string, premium: number, planType = 'PPO'): MedicarePlan {
  return {
    id, carrier:'Humana', planName:`Plan ${id}`, planType, contractId:'H1', planId:'001',
    starRating:{overall:4.0,label:'4 Stars'}, premium, partBPremiumReduction:0, deductible:0, maxOutOfPocket:5500,
    copays:{primaryCare:'$0 copay',specialist:'$40 copay',urgentCare:'$40 copay',emergency:'$90 copay',inpatientHospital:'$275/day',outpatientSurgery:'$295 copay'},
    rxDrugs:{tier1:'$0',tier2:'$15',tier3:'$47',tier4:'$100',deductible:'$0',gap:false,initialCoverageLimit:'$5,030'},
    extraBenefits:{
      dental:{covered:true,details:'Up to $2,000'},vision:{covered:true,details:'Exam + allowance'},
      hearing:{covered:false,details:''},otc:{covered:true,details:'$30/qtr'},fitness:{covered:true,details:'SilverSneakers'},
      transportation:{covered:false,details:''},telehealth:{covered:true,details:'24/7'},meals:{covered:false,details:''},
    },
    networkSize:50000, enrollmentPeriod:'Oct 15–Dec 7', effectiveDate:'Jan 1, 2027',
    serviceArea:'Kansas City, MO', snpType:undefined, snpCategory:null, carrierLogoColor:'', carrierLogoTextColor:'',
  } as MedicarePlan;
}

const MISSING_NONE: CompareMissingData = { noDoctorsVerified:false, noDrugsVerified:false };
const MISSING_ALL:  CompareMissingData = { noDoctorsVerified:true,  noDrugsVerified:true  };

// ─── canStartCompare ──────────────────────────────────────────────────────────

describe('canStartCompare', () => {
  test('0 selected → false', () => expect(canStartCompare(0)).toBe(false));
  test('1 selected → false', () => expect(canStartCompare(1)).toBe(false));
  test('2 selected → true',  () => expect(canStartCompare(2)).toBe(true));
  test('3 selected → true',  () => expect(canStartCompare(3)).toBe(true));
  test('4+ → true',          () => expect(canStartCompare(4)).toBe(true));
});

// ─── compareButtonLabel ───────────────────────────────────────────────────────

describe('compareButtonLabel', () => {
  test('0 → select plans message',        () => expect(compareButtonLabel(0)).toMatch(/select/i));
  test('1 → select 1 more',              () => expect(compareButtonLabel(1)).toMatch(/1 more/i));
  test('2 → AI Compare 2 Plans',         () => expect(compareButtonLabel(2)).toMatch(/2 Plans/));
  test('3 → AI Compare 3 Plans',         () => expect(compareButtonLabel(3)).toMatch(/3 Plans/));
  test('no undefined in any label',       () => [0,1,2,3].forEach(n => expect(compareButtonLabel(n)).not.toContain('undefined')));
});

// ─── compareBlockedReason ────────────────────────────────────────────────────

describe('compareBlockedReason', () => {
  test('0 selected → required copy',   () => expect(compareBlockedReason(0)).toMatch(/at least 2/i));
  test('1 selected → required copy',   () => expect(compareBlockedReason(1)).toMatch(/at least 2/i));
  test('2 selected → null',            () => expect(compareBlockedReason(2)).toBeNull());
  test('3 selected → null',            () => expect(compareBlockedReason(3)).toBeNull());
});

// ─── estimateAnnualCost ───────────────────────────────────────────────────────

describe('estimateAnnualCost', () => {
  test('$0 premium + avg utilization → small positive number', () => {
    const p = makePlan('x',0); expect(estimateAnnualCost(p)).toBeGreaterThanOrEqual(0);
  });
  test('$50/mo premium → at least $600/yr', () => {
    const p = makePlan('x',50); expect(estimateAnnualCost(p)).toBeGreaterThanOrEqual(600);
  });
  test('result is non-negative', () => {
    expect(estimateAnnualCost(makePlan('x',0))).toBeGreaterThanOrEqual(0);
    expect(estimateAnnualCost(makePlan('x',50))).toBeGreaterThanOrEqual(0);
  });
  test('higher premium → higher annual cost (all else equal)', () => {
    expect(estimateAnnualCost(makePlan('a',100))).toBeGreaterThan(estimateAnnualCost(makePlan('b',0)));
  });
});

// ─── missingDataSection ───────────────────────────────────────────────────────

describe('missingDataSection', () => {
  test('nothing missing → "None"',     () => expect(missingDataSection(MISSING_NONE, 2)).toMatch(/none/i));
  test('doctors missing → flagged',    () => expect(missingDataSection(MISSING_ALL, 2).toLowerCase()).toMatch(/doctor/));
  test('drugs missing → flagged',      () => expect(missingDataSection(MISSING_ALL, 2).toLowerCase()).toMatch(/drug|prescription/));
});

// ─── buildComparePrompt ───────────────────────────────────────────────────────

describe('buildComparePrompt', () => {
  const p1 = makePlan('p1', 0);
  const p2 = makePlan('p2', 50);
  const p3 = makePlan('p3', 25);

  test('throws on <2 plans', () => expect(() => buildComparePrompt([p1], MISSING_NONE)).toThrow());
  test('throws on >3 plans', () => expect(() => buildComparePrompt([p1,p2,p3,p1], MISSING_NONE)).toThrow());
  test('2-plan prompt includes both plan names',   () => { const s = buildComparePrompt([p1,p2], MISSING_NONE); expect(s).toContain('Plan p1'); expect(s).toContain('Plan p2'); });
  test('3-plan prompt includes all 3 plan names',  () => { const s = buildComparePrompt([p1,p2,p3], MISSING_NONE); expect(s).toContain('Plan p1'); expect(s).toContain('Plan p2'); expect(s).toContain('Plan p3'); });

  // Required sections per spec
  test('has "Best for Lowest Cost" section',       () => expect(buildComparePrompt([p1,p2], MISSING_NONE)).toContain('Best for Lowest Cost'));
  test('has "Best for Doctor Flexibility" section', () => expect(buildComparePrompt([p1,p2], MISSING_NONE)).toContain('Best for Doctor Flexibility'));
  test('has "Best for Extra Benefits" section',    () => expect(buildComparePrompt([p1,p2], MISSING_NONE)).toContain('Best for Extra Benefits'));
  test('has "Key Tradeoffs" section',              () => expect(buildComparePrompt([p1,p2], MISSING_NONE)).toContain('Key Tradeoffs'));
  test('has "Check Before Deciding" section',      () => expect(buildComparePrompt([p1,p2], MISSING_NONE)).toContain('Check Before Deciding'));

  test('references annual cost estimate',          () => expect(buildComparePrompt([p1,p2], MISSING_NONE)).toContain('/yr'));
  test('flags missing doctors when unverified',    () => expect(buildComparePrompt([p1,p2], MISSING_ALL)).toMatch(/doctor/i));
  test('no undefined in prompt',                   () => expect(buildComparePrompt([p1,p2], MISSING_NONE)).not.toContain('undefined'));
  test('only uses data from plan payload',         () => {
    const s = buildComparePrompt([p1,p2], MISSING_NONE);
    // Should reference premium values present in the plans
    expect(s).toContain('$0/mo'); // p1 premium
    expect(s).toContain('$50/mo'); // p2 premium
  });
});
