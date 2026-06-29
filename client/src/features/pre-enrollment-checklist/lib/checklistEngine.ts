export type ChecklistItemStatus = 'pending'|'confirmed'|'flagged'|'skipped';
export type ChecklistCategory = 'eligibility'|'service_area'|'doctors'|'prescriptions'|'costs'|'plan_type'|'benefits'|'ai_disclosure'|'handoff';
export interface ChecklistItem { id:string; category:ChecklistCategory; label:string; detail:string; isBlocking:boolean; status:ChecklistItemStatus; riskIfFlagged:string; complianceNote?:string; }

function item(id:string, category:ChecklistCategory, label:string, detail:string, riskIfFlagged:string, isBlocking=false, complianceNote?:string): ChecklistItem {
  return { id, category, label, detail, riskIfFlagged, isBlocking, status:'pending', complianceNote };
}

export function buildChecklistItems(ctx: { zip:string; county:string; plan:any; doctors:any[]; rxDrugs:any[]; enrollmentPeriodLabel?:string; estimatedAnnualCost?:number; doctorCoverageStatus?:string; drugCoverageStatus?:string; }): ChecklistItem[] {
  const { zip, county, plan, doctors, rxDrugs, enrollmentPeriodLabel, estimatedAnnualCost, doctorCoverageStatus, drugCoverageStatus } = ctx;
  const doctorNames = doctors.map(d=>d.name).slice(0,3).join(', ');
  const drugNames = rxDrugs.map(d=>d.name).slice(0,4).join(', ');
  const annualStr = estimatedAnnualCost ? `~$${Math.round(estimatedAnnualCost).toLocaleString()}/yr estimated` : 'annual cost not yet calculated';
  const requiresReferral = /hmo/i.test(plan.planType);
  return [
    item('eligibility','eligibility','I am in a valid enrollment period', `${enrollmentPeriodLabel ?? 'Enrollment period not confirmed'}.`, 'You have not confirmed your enrollment eligibility. Enrolling at the wrong time can cause gaps in coverage.', true, 'Per CMS guidelines, enrollment is only permitted during designated enrollment periods.'),
    item('service_area','service_area','This plan covers my ZIP code and county', `ZIP ${zip} · ${county||'County not confirmed'}. ${plan.planName} is available in your area.`, 'Service area not confirmed. Plans only cover care within their defined territory.', true),
    item('doctors','doctors', doctors.length>0?`My doctor(s) are in this plan's network`:'I have confirmed my doctors are in-network (or I have no specific doctors)', doctors.length>0?`Doctors added: ${doctorNames}. Status: ${doctorCoverageStatus??'not verified'}.`:'No doctors added. If you have preferred providers, verify they are in-network.', doctors.length>0?'Doctor coverage not confirmed. You may lose access to current providers.':'No doctors added or verified.'),
    item('prescriptions','prescriptions', rxDrugs.length>0?`My prescriptions are on this plan's formulary`:'I have confirmed my prescriptions are covered (or I take no regular medications)', rxDrugs.length>0?`Prescriptions added: ${drugNames}. Status: ${drugCoverageStatus??'not verified'}.`:'No prescriptions added.', rxDrugs.length>0?'Drug coverage not confirmed. Your prescriptions may not be covered.':'No prescriptions verified.'),
    item('costs','costs','I understand my costs on this plan', [`Premium: $${plan.premium}/mo`, `Deductible: $${plan.deductible}`, `Max OOP: $${plan.maxOutOfPocket.toLocaleString()}/yr`, `PCP copay: ${plan.copays?.primaryCare}`, `Specialist copay: ${plan.copays?.specialist}`, annualStr].join(' · '), 'You have not confirmed you understand the cost structure.', true),
    item('plan_type','plan_type','I understand this plan type and its network rules', requiresReferral?`${plan.planType} plan — specialist referrals required. Out-of-network care generally not covered except emergencies.`:`${plan.planType} plan — no referrals required. Some out-of-network coverage available.`, requiresReferral?'HMO network rules not confirmed.':'Network rules not confirmed.'),
    item('benefits','benefits','I have reviewed the extra benefits included and excluded', [`Dental: ${plan.extraBenefits?.dental?.covered?plan.extraBenefits.dental.details||'Included':'Not included'}`, `Vision: ${plan.extraBenefits?.vision?.covered?plan.extraBenefits.vision.details||'Included':'Not included'}`, `Hearing: ${plan.extraBenefits?.hearing?.covered?'Included':'Not included'}`, `OTC: ${plan.extraBenefits?.otc?.covered?'Included':'Not included'}`].join(' · '), 'Extra benefits not reviewed. You may be switching away from benefits you rely on.'),
    item('ai_disclosure','ai_disclosure','I understand the AI assistant is not a licensed insurance agent', 'The AI tools on this site are for comparison purposes only. They do not provide insurance advice. Licensed SelectQuote agents are available: 1-800-777-8002.', 'AI disclosure has not been confirmed. Required before proceeding.', true, 'CMS Medicare Marketing Guidelines require clear disclosure that AI comparisons are not agent advice.'),
    item('handoff','handoff','I have chosen how I want to proceed', "Select: Call a licensed agent (recommended) or complete application online.", 'You have not selected your enrollment path.', true),
  ];
}

export function detectRisks(items: ChecklistItem[]) {
  return items.filter(i=>i.status==='flagged').map(i=>({
    itemId:i.id,
    severity:(i.isBlocking?'blocking':i.category==='doctors'||i.category==='prescriptions'?'high':'medium') as 'blocking'|'high'|'medium'|'low',
    message:i.riskIfFlagged,
    action:i.isBlocking?'You must confirm this item before proceeding.':'Review with a licensed agent before enrolling.',
  })).sort((a,b)=>({blocking:0,high:1,medium:2,low:3}[a.severity]??3)-({blocking:0,high:1,medium:2,low:3}[b.severity]??3));
}

export function hasBlockingRisk(items: ChecklistItem[]): boolean { return items.some(i=>i.isBlocking&&i.status!=='confirmed'); }
export function canProceed(items: ChecklistItem[]): boolean { return items.every(i=>i.status!=='pending') && !hasBlockingRisk(items); }
export function completionPct(items: ChecklistItem[]): number { if (!items.length) return 0; return Math.round(items.filter(i=>i.status!=='pending').length/items.length*100); }
export function confirmedCount(items: ChecklistItem[]): number { return items.filter(i=>i.status==='confirmed').length; }
export function flaggedCount(items: ChecklistItem[]): number { return items.filter(i=>i.status==='flagged').length; }
export function updateItemStatus(items: ChecklistItem[], id: string, status: ChecklistItemStatus): ChecklistItem[] { return items.map(i=>i.id===id?{...i,status}:i); }
export function setHandoffRoute(items: ChecklistItem[], route: 'agent_call'|'online_application'): ChecklistItem[] { return items.map(i=>i.id==='handoff'?{...i,status:'confirmed',detail:`Selected: ${route==='agent_call'?'Call a licensed agent':'Complete application online'}`}:i); }
export const CATEGORY_LABELS: Record<ChecklistCategory,string> = { eligibility:'Enrollment Eligibility', service_area:'Coverage Area', doctors:'Doctor & Facility Coverage', prescriptions:'Prescriptions & Pharmacy', costs:'Costs & Financials', plan_type:"Plan Type & Network Rules", benefits:'Extra Benefits', ai_disclosure:'AI & Compliance Disclosure', handoff:"How You'll Enroll" };
