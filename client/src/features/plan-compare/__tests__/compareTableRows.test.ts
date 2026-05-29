import { describe, test, expect } from 'vitest';
import { parseCopayNum, getBestIdx, buildCompareRows } from '../lib/compareTableRows';
import type { MedicarePlan } from '@/lib/types';

function p(id: string, premium: number, extra?: Partial<MedicarePlan>): MedicarePlan {
  return { id, carrier:'Test', planName:`Plan ${id}`, planType:'PPO', contractId:'H1', planId:'001', starRating:{overall:4.0,label:'4 Stars'}, premium, partBPremiumReduction:0, deductible:0, maxOutOfPocket:5500, copays:{primaryCare:'$0',specialist:'$40',urgentCare:'$40',emergency:'$90',inpatientHospital:'$275',outpatientSurgery:'$295'}, rxDrugs:{tier1:'$0',tier2:'$15',tier3:'$47',tier4:'$100',deductible:'$0',gap:false,initialCoverageLimit:'$5,030'}, extraBenefits:{dental:{covered:true,details:''},vision:{covered:false,details:''},hearing:{covered:false,details:''},otc:{covered:false,details:''},fitness:{covered:false,details:''},transportation:{covered:false,details:''},telehealth:{covered:true,details:''},meals:{covered:false,details:''}}, networkSize:50000, enrollmentPeriod:'', effectiveDate:'', serviceArea:'', snpType:undefined, snpCategory:null, carrierLogoColor:'', carrierLogoTextColor:'', ...extra } as MedicarePlan;
}

describe('parseCopayNum', () => {
  test('"$40 copay" → 40', () => expect(parseCopayNum('$40 copay')).toBe(40));
  test('"No charge" → 0', () => expect(parseCopayNum('No charge')).toBe(0));
  test('empty → 0',       () => expect(parseCopayNum('')).toBe(0));
  test('"N/A" → 0',       () => expect(parseCopayNum('N/A')).toBe(0));
});

describe('getBestIdx', () => {
  test('lower better: picks lowest', () => expect(getBestIdx([100,50,75])).toBe(1));
  test('higher better: picks highest', () => expect(getBestIdx([3,5,4],false)).toBe(1));
  test('all same → -1', () => expect(getBestIdx([100,100,100])).toBe(-1));
  test('empty → -1',    () => expect(getBestIdx([])).toBe(-1));
  test('$0 wins vs $20', () => expect(getBestIdx([0,20,40])).toBe(0));
});

describe('buildCompareRows', () => {
  test('empty → empty', () => expect(buildCompareRows([])).toHaveLength(0));
  test('2 plans: each row has 2 values', () => { buildCompareRows([p('1',0),p('2',50)]).forEach(r => expect(r.values).toHaveLength(2)); });
  test('3 plans: each row has 3 values', () => { buildCompareRows([p('1',0),p('2',50),p('3',25)]).forEach(r => expect(r.values).toHaveLength(3)); });
  test('premium row reflects plan values', () => { const rows = buildCompareRows([p('1',0),p('2',50)]); const pr = rows.find(r=>r.id==='premium')!; expect(pr.values[0]).toBe('$0'); expect(pr.values[1]).toBe('$50'); });
  test('star rating lowerIsBetter=false', () => expect(buildCompareRows([p('1',0)]).find(r=>r.id==='stars')!.lowerIsBetter).toBe(false));
  test('all rows have id, label, section, values', () => { buildCompareRows([p('1',0),p('2',50)]).forEach(r => { expect(r.id.length).toBeGreaterThan(0); expect(r.label.length).toBeGreaterThan(0); expect(r.section.length).toBeGreaterThan(0); }); });
  test('adds doctor/drug rows when summaries provided', () => {
    const rows = buildCompareRows([p('1',0)], { '1': { doctorStatus:'all_matched', drugStatus:'covered' } });
    expect(rows.some(r=>r.id==='doctor_match')).toBe(true);
    expect(rows.some(r=>r.id==='drug_match')).toBe(true);
  });
});
