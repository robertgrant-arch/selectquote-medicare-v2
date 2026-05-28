import { describe, test, expect } from 'vitest';
import { buildCRMPayload, buildAgentBriefing, serializeCRMPayload } from '../lib/crmPayload';
import { buildChecklistItems, updateItemStatus } from '../lib/checklistEngine';
function makePlan() { return { id:'p1', planName:'Test Plan', carrier:'Humana', planType:'HMO', premium:0, deductible:0, maxOutOfPocket:5500, copays:{primaryCare:'$0',specialist:'$40'}, extraBenefits:{dental:{covered:true,details:''},vision:{covered:false,details:''},hearing:{covered:false,details:''},otc:{covered:false,details:''}} }; }
function makeCtx(o:any={}) { return { zip:'64106', county:'Jackson County', plan:makePlan(), doctors:[{name:'Dr. Smith'}], rxDrugs:[{name:'Lisinopril'}], ...o }; }

describe('buildCRMPayload', () => {
  test('required fields present', () => {
    const ctx = makeCtx(); const items = buildChecklistItems(ctx).map((i:any)=>({...i,status:'confirmed'}));
    const p = buildCRMPayload(items,[],ctx,'agent_call',false,'sess-1');
    expect(p.planId).toBe('p1'); expect(p.planName).toBe('Test Plan'); expect(p.zip).toBe('64106');
    expect(p.handoffRoute).toBe('agent_call'); expect(p.sessionId).toBe('sess-1');
  });
  test('completionPct 100 when all confirmed', () => {
    const ctx = makeCtx(); const items = buildChecklistItems(ctx).map((i:any)=>({...i,status:'confirmed'}));
    expect(buildCRMPayload(items,[],ctx,'agent_call',false,'x').completionPct).toBe(100);
  });
  test('completionPct 0 when all pending', () => {
    const ctx = makeCtx(); const items = buildChecklistItems(ctx);
    expect(buildCRMPayload(items,[],ctx,'pending',false,'x').completionPct).toBe(0);
  });
  test('aiDisclosureConfirmed true when confirmed', () => {
    const ctx = makeCtx(); let items = buildChecklistItems(ctx); items = updateItemStatus(items,'ai_disclosure','confirmed');
    expect(buildCRMPayload(items,[],ctx,'pending',false,'x').aiDisclosureConfirmed).toBe(true);
  });
  test('doctors array has names', () => {
    const ctx = makeCtx(); const items = buildChecklistItems(ctx).map((i:any)=>({...i,status:'confirmed'}));
    expect(buildCRMPayload(items,[],ctx,'agent_call',false,'x').doctors).toContain('Dr. Smith');
  });
  test('generatedAt is valid ISO', () => {
    const ctx = makeCtx(); const items = buildChecklistItems(ctx).map((i:any)=>({...i,status:'confirmed'}));
    const p = buildCRMPayload(items,[],ctx,'agent_call',false,'x');
    expect(new Date(p.generatedAt).toISOString()).toBe(p.generatedAt);
  });
});

describe('buildAgentBriefing', () => {
  test('non-empty string', () => {
    const ctx = makeCtx(); const items = buildChecklistItems(ctx).map((i:any)=>({...i,status:'confirmed'}));
    const p = buildCRMPayload(items,[],ctx,'agent_call',false,'x');
    expect(buildAgentBriefing(p).trim().length).toBeGreaterThan(0);
  });
  test('warns when AI disclosure not confirmed', () => {
    const ctx = makeCtx(); const items = buildChecklistItems(ctx);
    const p = buildCRMPayload(items,[],ctx,'pending',false,'x');
    expect(buildAgentBriefing(p)).toContain('NO — AGENT MUST CONFIRM');
  });
});

describe('serializeCRMPayload', () => {
  test('valid JSON', () => {
    const ctx = makeCtx(); const items = buildChecklistItems(ctx).map((i:any)=>({...i,status:'confirmed'}));
    const p = buildCRMPayload(items,[],ctx,'agent_call',false,'x');
    expect(() => JSON.parse(serializeCRMPayload(p))).not.toThrow();
  });
});
