import type { HandoffPayload, AgentBriefing } from '../types/handoff';

export function buildOpeningScript(p: HandoffPayload): string {
  if (!p.zip) return "I see you were exploring Medicare Advantage plans. Let me pick up right where you left off.";
  const area = p.county ? `${p.county} area (ZIP ${p.zip})` : `ZIP code ${p.zip}`;
  const parts = [`I see you were looking at Medicare Advantage plans in the ${area}.`];
  if (p.inferredPriorities[0]) parts.push(`Your biggest priority was ${p.inferredPriorities[0].toLowerCase()}.`);
  const [p1,p2,p3] = p.topPlans;
  if (p1 && p2) { parts.push(`You were comparing ${p1.planName} and ${p2.planName}${p3?` and ${p3.planName}`:''}.`); if (p1.topReasons[0]) parts.push(`${p1.planName} scored highest because ${p1.topReasons[0].toLowerCase()}.`); }
  else if (p1) parts.push(`You were most interested in ${p1.planName}, which scored ${p1.matchScore} out of 100.`);
  if (p.doctors.length>0) { const names = p.doctors.slice(0,2).map(d=>d.name).join(' and'); parts.push(`You wanted to keep ${names}${p.doctors.length>2?` and ${p.doctors.length-2} others`:''} — ${p.hasDoctorVerification?'network status confirmed':'network status not yet verified'}.`); }
  if (p.prescriptions.length>0) { const names = p.prescriptions.slice(0,2).map(r=>r.name).join(' and'); parts.push(`You listed ${names}${p.prescriptions.length>2?` and ${p.prescriptions.length-2} others`:''} as your prescriptions.`); }
  parts.push("Let me pick up right where you left off — you won't need to repeat anything.");
  const result = parts.join(' ');
  return result.includes('undefined')||result.includes('null') ? result.replace(/undefined|null/g,'') : result;
}

export function buildContextSummary(p: HandoffPayload): string {
  const parts = [`Profile: ${p.doctors.length} doctor(s), ${p.prescriptions.length} prescription(s).`];
  if (p.isDualEligible) parts.push('Dual-eligible (Medicare + Medicaid) — D-SNP plans may apply.');
  if (p.hasChronicConditions.length>0) parts.push(`Chronic conditions: ${p.hasChronicConditions.join(', ')}.`);
  if (p.currentPlanName) parts.push(`Currently on: ${p.currentPlanName} (${p.currentPlanCarrier??'carrier unknown'}).`);
  parts.push(`Data completeness: ${p.dataCompleteness}.`);
  return parts.join(' ');
}

export function buildMissingVerificationTasks(p: HandoffPayload): string[] {
  const tasks: string[] = [];
  if (!p.hasDoctorVerification && p.doctors.length>0) tasks.push(`Verify network status for ${p.doctors.length} doctor(s): ${p.doctors.map(d=>d.name).join(', ')}`);
  if (!p.hasRxVerification && p.prescriptions.length>0) tasks.push(`Run formulary check for ${p.prescriptions.length} prescription(s): ${p.prescriptions.map(r=>r.name).join(', ')}`);
  p.missingFields.forEach(f => tasks.push(`Collect missing info: ${f}`));
  return tasks;
}

export function buildSuggestedFirstQuestion(p: HandoffPayload): string {
  const blocking = p.unresolvedItems.find(u => u.category==='doctor_network'||u.category==='drug_coverage');
  if (blocking?.category==='doctor_network'&&p.doctors.length===0) return "Which doctors and specialists are most important for you to keep seeing?";
  if (blocking?.category==='drug_coverage'&&p.prescriptions.length===0) return "Can you tell me all the prescription medications you take regularly?";
  if (p.topPlans.length>0) return `Looking at ${p.topPlans[0].planName} — does the $${p.topPlans[0].premiumMonthly}/month premium work for your budget?`;
  return "What's most important to you in a Medicare plan — keeping your doctors, lowering costs, or getting extra benefits like dental?";
}

export function buildAgentBriefing(p: HandoffPayload): AgentBriefing {
  return { openingScript:buildOpeningScript(p), contextSummary:buildContextSummary(p), topPlans:p.topPlans, missingVerificationTasks:buildMissingVerificationTasks(p), unresolvedItems:p.unresolvedItems, disclosureHistory:p.disclosureHistory, suggestedFirstQuestion:buildSuggestedFirstQuestion(p) };
}

export function serializeBriefingAsText(briefing: AgentBriefing): string {
  const lines = ['AGENT BRIEFING — Medicare Plan Handoff', `Generated: ${new Date().toLocaleString()}`, '', '── OPENING SCRIPT ──', briefing.openingScript, '', '── CONTEXT ──', briefing.contextSummary, ''];
  if (briefing.topPlans.length) { lines.push('── TOP PLANS ──'); briefing.topPlans.forEach(p=>lines.push(`#${p.rank} ${p.planName} (${p.carrier}) — Score: ${p.matchScore}/100\n  $${p.premiumMonthly}/mo | $${p.maxOutOfPocket.toLocaleString()} OOP | ${p.starRating}★\n  Reasons: ${p.topReasons.join(' · ')}`)); lines.push(''); }
  if (briefing.missingVerificationTasks.length) { lines.push('── AGENT TASKS ──'); briefing.missingVerificationTasks.forEach(t=>lines.push(`  ⬜ ${t}`)); lines.push(''); }
  if (briefing.unresolvedItems.length) { lines.push('── UNRESOLVED ──'); briefing.unresolvedItems.forEach(u=>lines.push(`  • ${u.message}\n    → ${u.agentAction}`)); lines.push(''); }
  if (briefing.disclosureHistory.length) { lines.push('── DISCLOSURES ──'); briefing.disclosureHistory.forEach(d=>lines.push(`  [${new Date(d.timestamp).toLocaleString()}] ${d.kind}${d.detail?` — ${d.detail}`:''}`)); lines.push(''); }
  lines.push(`SUGGESTED FIRST QUESTION: "${briefing.suggestedFirstQuestion}"`, '', 'Not affiliated with Medicare.gov. Verify all plan details with carrier before enrollment.');
  return lines.join('\n');
}
