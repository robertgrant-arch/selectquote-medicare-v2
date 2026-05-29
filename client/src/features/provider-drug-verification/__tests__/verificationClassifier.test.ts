import { describe, test, expect } from 'vitest';
import { classifyDoctorStatus, classifyDrugStatus, classifyPharmacyStatus, DOCTOR_BADGE_CONFIG, DRUG_BADGE_CONFIG } from '../lib/verificationClassifier';

const net = (i:number,o:number) => ({ doctors: Array(i+o).fill(null), inNetworkCount:i, outOfNetworkCount:o });

describe('classifyDoctorStatus', () => {
  test('no doctors → not_verified',        () => expect(classifyDoctorStatus(undefined, false)).toBe('not_verified'));
  test('hasDoctors but no status → not_verified', () => expect(classifyDoctorStatus(undefined, true)).toBe('not_verified'));
  test('all in-network → all_matched',     () => expect(classifyDoctorStatus(net(2,0), true)).toBe('all_matched'));
  test('mixed → partial_match',            () => expect(classifyDoctorStatus(net(1,1), true)).toBe('partial_match'));
  test('all out → out_of_network',         () => expect(classifyDoctorStatus(net(0,2), true)).toBe('out_of_network'));
  test('empty doctors → not_verified',     () => expect(classifyDoctorStatus({doctors:[],inNetworkCount:0,outOfNetworkCount:0}, true)).toBe('not_verified'));
});

describe('classifyDrugStatus', () => {
  test('no rx → not_verified',             () => expect(classifyDrugStatus([], false)).toBe('not_verified'));
  test('has rx but empty breakdowns → not_verified', () => expect(classifyDrugStatus([], true)).toBe('not_verified'));
  test('all tier 1 → covered',             () => expect(classifyDrugStatus([{tier:1},{tier:1}], true)).toBe('covered'));
  test('any tier 3 → covered_restrictions',() => expect(classifyDrugStatus([{tier:1},{tier:3}], true)).toBe('covered_restrictions'));
  test('tier 0 → not_covered',             () => expect(classifyDrugStatus([{tier:0}], true)).toBe('not_covered'));
  test('tier 0 beats tier 3',              () => expect(classifyDrugStatus([{tier:3},{tier:0}], true)).toBe('not_covered'));
});

describe('classifyPharmacyStatus', () => {
  test('always not_verified', () => expect(classifyPharmacyStatus()).toBe('not_verified'));
});

describe('badge config completeness', () => {
  test('all doctor statuses', () => {
    (['all_matched','partial_match','out_of_network','not_verified'] as const).forEach(s => {
      expect(DOCTOR_BADGE_CONFIG[s].label.length).toBeGreaterThan(0);
    });
  });
  test('all drug statuses', () => {
    (['covered','covered_restrictions','not_covered','not_verified'] as const).forEach(s => {
      expect(DRUG_BADGE_CONFIG[s].label.length).toBeGreaterThan(0);
    });
  });
});
