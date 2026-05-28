import type { HandoffContext, HandoffPayload, HandoffPlanSummary, UnresolvedItem, DataCompleteness } from '../types/handoff';

export function buildDoctorSummaries(ctx: HandoffContext) {
  return ctx.doctors.map(d => {
    const topId = ctx.aiScores?.[0]?.planId;
    const s = topId ? ctx.verificationSummaries?.[topId] : undefined;
    return { name:d.name, specialty:d.specialty||'', networkStatus:s?.doctorStatus??'not_verified' };
  });
}

export function buildPrescriptionSummaries(ctx: HandoffContext) {
  return ctx.rxDrugs.map(d => {
    const topId = ctx.aiScores?.[0]?.planId;
    const s = topId ? ctx.verificationSummaries?.[topId] : undefined;
    return { name:d.name, dosage:d.dosage, coverageStatus:s?.drugStatus??'not_verified' };
  });
}

export function buildTopPlanSummaries(ctx: HandoffContext): HandoffPlanSummary[] {
  return (ctx.aiScores??[]).slice(0,3).map(s => ({
    rank:s.rank, planId:s.planId, planName:s.plan.planName, carrier:s.plan.carrier,
    planType:s.plan.planType, premiumMonthly:s.plan.premium, maxOutOfPocket:s.plan.maxOutOfPocket,
    starRating:s.plan.starRating.overall, matchScore:Math.round(s.score),
    topReasons:(s.reasons??[]).slice(0,3), isTopPick:s.isTopPick,
  }));
}

export function inferPriorities(ctx: HandoffContext): string[] {
  const top = ctx.aiScores?.[0]; if (!top) return ['Finding a quality plan'];
  const priorities: string[] = [];
  const bd = (top.breakdown??[]).sort((a:any,b:any)=>b.weight-a.weight);
  if (ctx.doctors.length>0 && bd.find((f:any)=>f.factor==='Doctor Network'&&f.weight>0)) priorities.push('Keeping current doctors in-network');
  if (ctx.rxDrugs.length>0) priorities.push('Minimizing prescription drug costs');
  if (bd.find((f:any)=>f.factor==='Max Out-of-Pocket'&&f.weight>15)) priorities.push('Limiting financial exposure with a low max out-of-pocket');
  if (!priorities.length && top.reasons?.length) priorities.push(top.reasons[0]);
  return priorities.slice(0,3);
}

export function detectUnresolvedItems(ctx: HandoffContext): UnresolvedItem[] {
  const items: UnresolvedItem[] = [];
  if (!ctx.doctors.length) items.push({ id:'no_doctors', category:'doctor_network', message:'No doctors were added — provider network compatibility is unknown.', agentAction:'Ask which doctors and specialists the client needs to keep. Verify network status before recommending a plan.' });
  if (!ctx.rxDrugs.length) items.push({ id:'no_prescriptions', category:'drug_coverage', message:'No prescriptions were entered — drug coverage compatibility is unknown.', agentAction:'Ask for a complete medication list. Check formulary coverage and tier levels for the recommended plans.' });
  if (!ctx.aiScores?.length) items.push({ id:'no_plan_evaluation', category:'other', message:'No plans were evaluated by the AI matching engine.', agentAction:'Ask the client about ZIP code, eligibility, and key priorities to run a fresh plan evaluation.' });
  if (ctx.checklistPayload) {
    const flagged = (ctx.checklistPayload.checklistItems??[]).filter((i:any)=>i.status==='flagged');
    for (const f of flagged) items.push({ id:`checklist_${f.id}`, category:'other', message:`Checklist item flagged: "${f.label}"`, agentAction:'Review this item with the client before completing enrollment.' });
  }
  return items;
}

export function detectMissingFields(ctx: HandoffContext): string[] {
  const m: string[] = [];
  if (!ctx.zip) m.push('ZIP code');
  if (!ctx.county) m.push('County');
  if (!ctx.doctors.length) m.push('Doctor/provider preferences');
  if (!ctx.rxDrugs.length) m.push('Prescription medications');
  if (!ctx.aiScores?.length) m.push('AI plan evaluation');
  if (!ctx.guidedProfile?.eligibility) m.push('Eligibility information');
  if (!ctx.contactPreference?.method) m.push('Contact preference');
  return m;
}

export function computeDataCompleteness(ctx: HandoffContext): DataCompleteness {
  const m = detectMissingFields(ctx);
  if (m.length===0) return 'complete'; if (m.length<=3) return 'partial'; return 'minimal';
}

export function buildHandoffPayload(ctx: HandoffContext, sessionId: string, consentTimestamp: string): HandoffPayload {
  const gp = ctx.guidedProfile;
  return {
    version:'1.0', sessionId, createdAt:new Date().toISOString(),
    zip:ctx.zip||'', county:ctx.county||'', state:ctx.state||'',
    isDualEligible:gp?.eligibility?.isDualEligible??false, hasChronicConditions:gp?.eligibility?.hasChronicConditions??[], isInstitutional:gp?.eligibility?.isInstitutional??false,
    enrollmentPeriodLabel:ctx.enrollmentPeriodLabel, currentPlanName:gp?.currentPlanName, currentPlanCarrier:gp?.currentPlanCarrier,
    doctors:buildDoctorSummaries(ctx), hasDoctorVerification:ctx.doctors.length>0&&(()=>{ const id=ctx.aiScores?.[0]?.planId; const s=id?ctx.verificationSummaries?.[id]:undefined; return s?.doctorStatus!=='not_verified'; })(),
    prescriptions:buildPrescriptionSummaries(ctx), hasRxVerification:ctx.rxDrugs.length>0&&(()=>{ const id=ctx.aiScores?.[0]?.planId; const s=id?ctx.verificationSummaries?.[id]:undefined; return s?.drugStatus!=='not_verified'; })(),
    topPlans:buildTopPlanSummaries(ctx), viewedPlanIds:ctx.viewedPlanIds??[],
    aiModelId:ctx.aiModelId??'unknown', inferredPriorities:inferPriorities(ctx),
    aiRationale:(ctx.aiScores??[]).slice(0,3).map(s=>`${s.plan.planName} (#${s.rank}, score ${Math.round(s.score)}): ${(s.reasons??[]).slice(0,2).join('; ')||'matched based on your profile'}.`),
    unresolvedItems:detectUnresolvedItems(ctx), contactPreference:ctx.contactPreference??{method:'phone'},
    consentTimestamp, disclosureHistory:ctx.disclosureHistory??[],
    checklistCompletionPct:ctx.checklistPayload?.completionPct, checklistHasBlockingRisk:ctx.checklistPayload?.risks?.some((r:any)=>r.severity==='blocking'), aiDisclosureConfirmed:ctx.checklistPayload?.aiDisclosureConfirmed,
    dataCompleteness:computeDataCompleteness(ctx), missingFields:detectMissingFields(ctx),
  };
}
