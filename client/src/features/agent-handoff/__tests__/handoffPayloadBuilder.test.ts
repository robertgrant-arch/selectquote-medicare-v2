import { describe, test, expect } from 'vitest';
import { buildHandoffPayload, detectMissingFields, computeDataCompleteness, inferPriorities, detectUnresolvedItems } from '../lib/handoffPayloadBuilder';
import { buildAgentBriefing, buildOpeningScript, buildSuggestedFirstQuestion, serializeBriefingAsText } from '../lib/agentBriefingBuilder';
import type { HandoffContext } from '../types/handoff';

function makeScore(rank:number,planId:string): any {
  return { planId, score:82, totalScore:82, rank, isTopPick:rank===1, reasons:['Your doctors are in-network','Low max out-of-pocket'], plan:{ id:planId, carrier:'Humana', planName:`Plan ${rank}`, planType:'HMO', starRating:{overall:4.5,label:''}, premium:0, maxOutOfPocket:5500 }, breakdown:[{factor:'Doctor Network',weight:25,contribution:20},{factor:'Drug Cost',weight:20,contribution:16}] };
}

function makeFullCtx(): HandoffContext {
  return {
    zip:'64106', county:'Jackson County', state:'MO',
    doctors:[{name:'Dr. Smith',specialty:'Cardiologist',npi:'1234567890'}],
    rxDrugs:[{name:'Lisinopril',dosage:'10mg'}],
    guidedProfile:{ zip:'64106', currentPlanName:'AARP HMO 2024', currentPlanCarrier:'UnitedHealthcare', drugs:[], doctors:[], eligibility:{isDualEligible:false,hasChronicConditions:['Diabetes'],isInstitutional:false} },
    aiScores:[makeScore(1,'p1'),makeScore(2,'p2')],
    aiModelId:'model_b',
    verificationSummaries:{ p1:{doctorStatus:'all_matched',drugStatus:'covered'} },
    viewedPlanIds:['p1','p2'],
    enrollmentPeriodLabel:'Annual Enrollment Period (AEP)',
    contactPreference:{method:'phone'},
    disclosureHistory:[{kind:'ai_disclaimer_shown',timestamp:new Date().toISOString()},{kind:'consent_given',timestamp:new Date().toISOString()}],
  };
}
function makeMinimalCtx(): HandoffContext { return { zip:'64106', county:'', state:'', rxDrugs:[], doctors:[] }; }

describe('buildHandoffPayload — complete', () => {
  const ctx = makeFullCtx(); const p = buildHandoffPayload(ctx,'sess-001',new Date().toISOString());
  test('version is 1.0',               () => expect(p.version).toBe('1.0'));
  test('zip preserved',                () => expect(p.zip).toBe('64106'));
  test('isDualEligible from profile',  () => expect(p.isDualEligible).toBe(false));
  test('chronic conditions',           () => expect(p.hasChronicConditions).toContain('Diabetes'));
  test('doctors populated',            () => { expect(p.doctors).toHaveLength(1); expect(p.doctors[0].name).toBe('Dr. Smith'); });
  test('prescriptions populated',      () => { expect(p.prescriptions).toHaveLength(1); expect(p.prescriptions[0].name).toBe('Lisinopril'); });
  test('topPlans has 2',               () => expect(p.topPlans).toHaveLength(2));
  test('dataCompleteness is complete', () => expect(p.dataCompleteness).toBe('complete'));
  test('missingFields empty',          () => expect(p.missingFields).toHaveLength(0));
  test('createdAt valid ISO',          () => expect(new Date(p.createdAt).toISOString()).toBe(p.createdAt));
  test('currentPlanName from profile', () => expect(p.currentPlanName).toBe('AARP HMO 2024'));
  test('disclosureHistory preserved',  () => expect(p.disclosureHistory.length).toBeGreaterThanOrEqual(2));
});

describe('buildHandoffPayload — partial (no rx)', () => {
  const ctx = {...makeFullCtx(), rxDrugs:[]};
  const p = buildHandoffPayload(ctx,'sess-002',new Date().toISOString());
  test('dataCompleteness is partial', () => expect(p.dataCompleteness).toBe('partial'));
  test('prescriptions empty',         () => expect(p.prescriptions).toHaveLength(0));
  test('no_prescriptions in unresolved', () => expect(p.unresolvedItems.some(u=>u.id==='no_prescriptions')).toBe(true));
});

describe('buildHandoffPayload — minimal', () => {
  const p = buildHandoffPayload(makeMinimalCtx(),'sess-003',new Date().toISOString());
  test('dataCompleteness is minimal',   () => expect(p.dataCompleteness).toBe('minimal'));
  test('zip preserved',                 () => expect(p.zip).toBe('64106'));
  test('no_doctors in unresolved',      () => expect(p.unresolvedItems.some(u=>u.id==='no_doctors')).toBe(true));
  test('missingFields has 4+',          () => expect(p.missingFields.length).toBeGreaterThanOrEqual(4));
});

describe('buildOpeningScript', () => {
  const ctx = makeFullCtx(); const p = buildHandoffPayload(ctx,'s',new Date().toISOString());
  test('mentions area',          () => expect(buildOpeningScript(p)).toMatch(/64106|Jackson County/));
  test('mentions plan',          () => expect(buildOpeningScript(p)).toMatch(/Plan 1|Plan 2/));
  test('mentions doctor',        () => expect(buildOpeningScript(p)).toContain('Dr. Smith'));
  test('mentions prescription',  () => expect(buildOpeningScript(p)).toContain('Lisinopril'));
  test('ends with continuity',   () => expect(buildOpeningScript(p).toLowerCase()).toMatch(/where you left off|repeat/));
  test('no undefined/null',      () => { const s = buildOpeningScript(p); expect(s).not.toContain('undefined'); expect(s).not.toContain('null'); });
  test('minimal → non-empty',    () => { const mp = buildHandoffPayload(makeMinimalCtx(),'s',new Date().toISOString()); expect(buildOpeningScript(mp).trim().length).toBeGreaterThan(0); });
});

describe('buildSuggestedFirstQuestion', () => {
  test('ends with ?', () => { const p = buildHandoffPayload(makeFullCtx(),'s',new Date().toISOString()); expect(buildSuggestedFirstQuestion(p).trim()).toMatch(/\?$/); });
  test('minimal → asks about doctors', () => { const p = buildHandoffPayload(makeMinimalCtx(),'s',new Date().toISOString()); expect(buildSuggestedFirstQuestion(p).toLowerCase()).toMatch(/doctor|specialist|provider/); });
});

describe('serializeBriefingAsText', () => {
  test('non-empty', () => { const b = buildAgentBriefing(buildHandoffPayload(makeFullCtx(),'s',new Date().toISOString())); expect(serializeBriefingAsText(b).trim().length).toBeGreaterThan(0); });
  test('no undefined/null', () => { const b = buildAgentBriefing(buildHandoffPayload(makeFullCtx(),'s',new Date().toISOString())); const t = serializeBriefingAsText(b); expect(t).not.toContain('undefined'); expect(t).not.toContain('null'); });
  test('contains compliance', () => expect(serializeBriefingAsText(buildAgentBriefing(buildHandoffPayload(makeFullCtx(),'s',new Date().toISOString())))).toMatch(/not affiliated|carrier|verify/i));
});
