import { describe, test, expect } from 'vitest';
import { buildChecklistItems, detectRisks, hasBlockingRisk, canProceed, completionPct, confirmedCount, flaggedCount, updateItemStatus, setHandoffRoute, CATEGORY_LABELS } from '../lib/checklistEngine';

function makePlan(planType='HMO') {
  return { id:'p1', planName:'Test Plan', carrier:'Humana', planType, premium:0, deductible:0, maxOutOfPocket:5500, copays:{ primaryCare:'$0', specialist:'$40' }, extraBenefits:{ dental:{covered:true,details:'$2k'}, vision:{covered:false,details:''}, hearing:{covered:false,details:''}, otc:{covered:false,details:''} } };
}
function makeCtx(overrides:any={}) {
  return { zip:'64106', county:'Jackson County', plan:makePlan(), doctors:[], rxDrugs:[], ...overrides };
}

describe('buildChecklistItems', () => {
  test('returns 9 items', () => expect(buildChecklistItems(makeCtx())).toHaveLength(9));
  test('all start as pending', () => expect(buildChecklistItems(makeCtx()).every(i=>i.status==='pending')).toBe(true));
  test('all 9 categories present', () => {
    const cats = new Set(buildChecklistItems(makeCtx()).map(i=>i.category));
    ['eligibility','service_area','doctors','prescriptions','costs','plan_type','benefits','ai_disclosure','handoff'].forEach(c=>expect(cats.has(c as any)).toBe(true));
  });
  test('ai_disclosure is blocking', () => expect(buildChecklistItems(makeCtx()).find(i=>i.id==='ai_disclosure')!.isBlocking).toBe(true));
  test('eligibility is blocking',   () => expect(buildChecklistItems(makeCtx()).find(i=>i.id==='eligibility')!.isBlocking).toBe(true));
  test('costs is blocking',         () => expect(buildChecklistItems(makeCtx()).find(i=>i.id==='costs')!.isBlocking).toBe(true));
  test('HMO mentions referrals',    () => expect(buildChecklistItems(makeCtx({plan:makePlan('HMO')})).find(i=>i.id==='plan_type')!.detail.toLowerCase()).toMatch(/referral/));
  test('PPO says no referrals',     () => expect(buildChecklistItems(makeCtx({plan:makePlan('PPO')})).find(i=>i.id==='plan_type')!.detail.toLowerCase()).toMatch(/no referral/));
  test('doctor names in detail',    () => expect(buildChecklistItems(makeCtx({doctors:[{name:'Dr. Smith',specialty:'PCP'}]})).find(i=>i.id==='doctors')!.detail).toContain('Dr. Smith'));
  test('drug names in detail',      () => expect(buildChecklistItems(makeCtx({rxDrugs:[{name:'Lisinopril',dosage:'10mg'}]})).find(i=>i.id==='prescriptions')!.detail).toContain('Lisinopril'));
  test('all items have non-empty fields', () => {
    buildChecklistItems(makeCtx()).forEach(i=>{
      expect(i.label.trim().length).toBeGreaterThan(0);
      expect(i.detail.trim().length).toBeGreaterThan(0);
      expect(i.riskIfFlagged.trim().length).toBeGreaterThan(0);
    });
  });
});

describe('detectRisks', () => {
  test('no flagged → no risks', () => expect(detectRisks(buildChecklistItems(makeCtx()))).toHaveLength(0));
  test('flagged item → risk', () => {
    const items = updateItemStatus(buildChecklistItems(makeCtx()), 'doctors', 'flagged');
    expect(detectRisks(items).some(r=>r.itemId==='doctors')).toBe(true);
  });
  test('blocking flagged → blocking severity', () => {
    const items = updateItemStatus(buildChecklistItems(makeCtx()), 'ai_disclosure', 'flagged');
    expect(detectRisks(items).find(r=>r.itemId==='ai_disclosure')!.severity).toBe('blocking');
  });
  test('sorted blocking before high', () => {
    let items = buildChecklistItems(makeCtx());
    items = updateItemStatus(items, 'benefits', 'flagged');
    items = updateItemStatus(items, 'ai_disclosure', 'flagged');
    const risks = detectRisks(items);
    expect(risks[0].severity).toBe('blocking');
  });
});

describe('hasBlockingRisk / canProceed', () => {
  test('all pending → has blocking risk', () => expect(hasBlockingRisk(buildChecklistItems(makeCtx()))).toBe(true));
  test('all confirmed → no blocking risk', () => expect(hasBlockingRisk(buildChecklistItems(makeCtx()).map(i=>({...i,status:'confirmed' as const})))).toBe(false));
  test('all pending → cannot proceed', () => expect(canProceed(buildChecklistItems(makeCtx()))).toBe(false));
  test('all confirmed → can proceed', () => expect(canProceed(buildChecklistItems(makeCtx()).map(i=>({...i,status:'confirmed' as const})))).toBe(true));
  test('non-blocking flagged OK to proceed if blocking confirmed', () => {
    const items = buildChecklistItems(makeCtx()).map(i=>i.isBlocking?{...i,status:'confirmed' as const}:{...i,status:'flagged' as const});
    expect(canProceed(items)).toBe(true);
  });
});

describe('completionPct / counts', () => {
  test('0 done → 0%', () => expect(completionPct(buildChecklistItems(makeCtx()))).toBe(0));
  test('all confirmed → 100%', () => expect(completionPct(buildChecklistItems(makeCtx()).map(i=>({...i,status:'confirmed' as const})))).toBe(100));
  test('confirmedCount', () => {
    let items = buildChecklistItems(makeCtx());
    items = updateItemStatus(items, 'eligibility', 'confirmed');
    items = updateItemStatus(items, 'service_area', 'confirmed');
    expect(confirmedCount(items)).toBe(2);
  });
  test('flaggedCount', () => {
    const items = updateItemStatus(buildChecklistItems(makeCtx()), 'doctors', 'flagged');
    expect(flaggedCount(items)).toBe(1);
  });
});

describe('updateItemStatus / setHandoffRoute', () => {
  test('updates only target', () => {
    const items = updateItemStatus(buildChecklistItems(makeCtx()), 'doctors', 'confirmed');
    expect(items.find(i=>i.id==='doctors')!.status).toBe('confirmed');
    expect(items.filter(i=>i.id!=='doctors').every(i=>i.status==='pending')).toBe(true);
  });
  test('does not mutate original', () => {
    const items = buildChecklistItems(makeCtx());
    updateItemStatus(items, 'doctors', 'confirmed');
    expect(items.find(i=>i.id==='doctors')!.status).toBe('pending');
  });
  test('setHandoffRoute agent_call → confirmed', () => {
    const updated = setHandoffRoute(buildChecklistItems(makeCtx()), 'agent_call');
    expect(updated.find(i=>i.id==='handoff')!.status).toBe('confirmed');
  });
});

describe('CATEGORY_LABELS', () => {
  test('all 9 categories have labels', () => {
    ['eligibility','service_area','doctors','prescriptions','costs','plan_type','benefits','ai_disclosure','handoff'].forEach(c=>{
      expect(CATEGORY_LABELS[c as any].length).toBeGreaterThan(0);
    });
  });
});
