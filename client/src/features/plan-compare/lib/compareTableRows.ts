import type { MedicarePlan } from '@/lib/types';
export interface CompareRow { id: string; label: string; section: string; values: string[]; nums?: number[]; lowerIsBetter?: boolean; }

export function parseCopayNum(s: string): number {
  if (!s) return 0; if (/no charge|free|n\/a/i.test(s)) return 0;
  const m = s.match(/\$(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0;
}
export function getBestIdx(nums: number[], lowerIsBetter = true): number {
  if (!nums.length) return -1; if (new Set(nums).size === 1) return -1;
  const best = lowerIsBetter ? Math.min(...nums) : Math.max(...nums);
  return nums.indexOf(best);
}

export function buildCompareRows(plans: MedicarePlan[], verificationSummaries?: Record<string, any>): CompareRow[] {
  if (!plans.length) return [];
  const fmtD = (n: number) => n===0?'$0':`$${n.toLocaleString()}`;
  const bool = (b: boolean, y: string, n: string) => b?y:n;
  return [
    { id:'premium',    label:'Monthly Premium',     section:'cost', values:plans.map(p=>fmtD(p.premium)),         nums:plans.map(p=>p.premium),         lowerIsBetter:true },
    { id:'deductible', label:'Medical Deductible',  section:'cost', values:plans.map(p=>fmtD(p.deductible)),      nums:plans.map(p=>p.deductible),      lowerIsBetter:true },
    { id:'moop',       label:'Max Out-of-Pocket',   section:'cost', values:plans.map(p=>fmtD(p.maxOutOfPocket)),  nums:plans.map(p=>p.maxOutOfPocket),  lowerIsBetter:true },
    { id:'pcp',        label:'Primary Care',        section:'copays', values:plans.map(p=>p.copays.primaryCare),  nums:plans.map(p=>parseCopayNum(p.copays.primaryCare)),  lowerIsBetter:true },
    { id:'specialist', label:'Specialist',          section:'copays', values:plans.map(p=>p.copays.specialist),   nums:plans.map(p=>parseCopayNum(p.copays.specialist)),   lowerIsBetter:true },
    { id:'urgent',     label:'Urgent Care',         section:'copays', values:plans.map(p=>p.copays.urgentCare),   nums:plans.map(p=>parseCopayNum(p.copays.urgentCare)),   lowerIsBetter:true },
    { id:'emergency',  label:'Emergency Room',      section:'copays', values:plans.map(p=>p.copays.emergency),    nums:plans.map(p=>parseCopayNum(p.copays.emergency)),    lowerIsBetter:true },
    { id:'drug_deductible', label:'Drug Deductible', section:'drugs', values:plans.map(p=>p.rxDrugs.deductible), nums:plans.map(p=>parseCopayNum(p.rxDrugs.deductible)), lowerIsBetter:true },
    { id:'tier1', label:'Tier 1 (Generic)',       section:'drugs', values:plans.map(p=>p.rxDrugs.tier1), nums:plans.map(p=>parseCopayNum(p.rxDrugs.tier1)), lowerIsBetter:true },
    { id:'tier2', label:'Tier 2 (Pref. Brand)',   section:'drugs', values:plans.map(p=>p.rxDrugs.tier2), nums:plans.map(p=>parseCopayNum(p.rxDrugs.tier2)), lowerIsBetter:true },
    { id:'tier3', label:'Tier 3 (Non-Preferred)', section:'drugs', values:plans.map(p=>p.rxDrugs.tier3), nums:plans.map(p=>parseCopayNum(p.rxDrugs.tier3)), lowerIsBetter:true },
    { id:'tier4', label:'Tier 4 (Specialty)',     section:'drugs', values:plans.map(p=>p.rxDrugs.tier4), nums:plans.map(p=>parseCopayNum(p.rxDrugs.tier4)), lowerIsBetter:true },
    { id:'gap',   label:'Gap Coverage',            section:'drugs', values:plans.map(p=>bool(p.rxDrugs.gap,'✓ Covered','— None')) },
    { id:'stars', label:'CMS Star Rating',         section:'quality', values:plans.map(p=>`${p.starRating.overall} ★`), nums:plans.map(p=>p.starRating.overall), lowerIsBetter:false },
    { id:'plan_type', label:'Plan Type',           section:'quality', values:plans.map(p=>p.planType) },
    { id:'network',   label:'Network Size',        section:'quality', values:plans.map(p=>`${p.networkSize.toLocaleString()}+`), nums:plans.map(p=>p.networkSize), lowerIsBetter:false },
    { id:'referrals', label:'Referrals Required',  section:'quality', values:plans.map(p=>/hmo/i.test(p.planType)?'Yes (HMO)':'No (PPO/PFFS)') },
    { id:'dental',  label:'Dental',         section:'benefits', values:plans.map(p=>p.extraBenefits.dental.covered?p.extraBenefits.dental.details||'✓ Included':'— None') },
    { id:'vision',  label:'Vision',         section:'benefits', values:plans.map(p=>p.extraBenefits.vision.covered?p.extraBenefits.vision.details||'✓ Included':'— None') },
    { id:'hearing', label:'Hearing',        section:'benefits', values:plans.map(p=>p.extraBenefits.hearing.covered?p.extraBenefits.hearing.details||'✓ Included':'— None') },
    { id:'otc',     label:'OTC Allowance',  section:'benefits', values:plans.map(p=>p.extraBenefits.otc.covered?p.extraBenefits.otc.details||'✓ Included':'— None') },
    { id:'fitness', label:'Fitness Benefit',section:'benefits', values:plans.map(p=>p.extraBenefits.fitness.covered?p.extraBenefits.fitness.details||'✓ Included':'— None') },
    ...(verificationSummaries ? [
      { id:'doctor_match', label:'Your Doctor Coverage', section:'coverage', values:plans.map(p=>{ const s=verificationSummaries[p.id]; if(!s) return 'Not checked'; return {all_matched:'✓ All in-network',partial_match:'⚠ Partial match',out_of_network:'✗ Out of network',not_verified:'— Not checked'}[s.doctorStatus as string]||'Not checked'; }) },
      { id:'drug_match',   label:'Your Drug Coverage',   section:'coverage', values:plans.map(p=>{ const s=verificationSummaries[p.id]; if(!s) return 'Not checked'; return {covered:'✓ Covered',covered_restrictions:'⚠ Higher tier',not_covered:'✗ Not covered',not_verified:'— Not checked'}[s.drugStatus as string]||'Not checked'; }) },
    ] : []),
  ];
}
