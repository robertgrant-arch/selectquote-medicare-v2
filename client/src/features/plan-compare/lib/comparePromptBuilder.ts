// Pure — builds the AI compare prompt used by the compare stream.
// Testable in node. Matches the sections required by the spec.

import type { MedicarePlan } from '@/lib/types';

export interface CompareMissingData {
  noDoctorsVerified: boolean;
  noDrugsVerified: boolean;
  verificationSummaries?: Record<string, { doctorStatus: string; drugStatus: string }>;
}

function benefitList(p: MedicarePlan): string {
  const b = p.extraBenefits;
  const included: string[] = [];
  if (b.dental.covered)         included.push(`Dental (${b.dental.details || 'Included'})`);
  if (b.vision.covered)         included.push(`Vision (${b.vision.details || 'Included'})`);
  if (b.hearing.covered)        included.push(`Hearing (${b.hearing.details || 'Included'})`);
  if (b.otc.covered)            included.push(`OTC (${b.otc.details || 'Included'})`);
  if (b.fitness.covered)        included.push('Fitness');
  if (b.transportation.covered) included.push('Transportation');
  if (b.telehealth.covered)     included.push('Telehealth');
  return included.join(', ') || 'None';
}

function planBlock(p: MedicarePlan, label: string): string {
  return `${label}: ${p.planName} (${p.carrier}, ${p.planType})
  Premium: $${p.premium}/mo | Deductible: $${p.deductible} | Max OOP: $${p.maxOutOfPocket.toLocaleString()}/yr
  PCP: ${p.copays.primaryCare} | Specialist: ${p.copays.specialist} | ER: ${p.copays.emergency}
  Rx: T1 ${p.rxDrugs.tier1} / T2 ${p.rxDrugs.tier2} / T3 ${p.rxDrugs.tier3} / T4 ${p.rxDrugs.tier4} | Gap: ${p.rxDrugs.gap ? 'Yes' : 'No'}
  Stars: ${p.starRating.overall}/5 | Network: ${p.networkSize.toLocaleString()}+ providers
  Extra benefits: ${benefitList(p)}`;
}

/** Estimate rough annual cost from plan data alone */
export function estimateAnnualCost(p: MedicarePlan): number {
  const parseCopay = (s: string) => { const m = s.match(/\$(\d+)/); return m ? parseInt(m[1]) : 0; };
  return Math.round(
    p.premium * 12 +
    parseCopay(p.copays.primaryCare) * 6 +
    parseCopay(p.copays.specialist) * 2 +
    parseCopay(p.rxDrugs.tier1) * 12 +
    parseCopay(p.rxDrugs.tier2) * 6,
  );
}

export function missingDataSection(missing: CompareMissingData, planCount: number): string {
  const items: string[] = [];
  if (missing.noDoctorsVerified) items.push('Doctor/provider network coverage has not been verified for any plan.');
  if (missing.noDrugsVerified)   items.push('Prescription drug coverage has not been verified for any plan.');

  if (missing.verificationSummaries) {
    for (let i = 0; i < planCount; i++) {
      const s = Object.values(missing.verificationSummaries)[i];
      if (s?.doctorStatus === 'not_verified') items.push(`Plan ${i + 1}: Doctor network status not checked.`);
      if (s?.drugStatus === 'not_verified')   items.push(`Plan ${i + 1}: Drug formulary not verified.`);
    }
  }

  if (items.length === 0) return 'None — all plan data is from CMS records.';
  if (!missing.verificationSummaries && items.length === 0) {
    return 'No personalization data (doctors or drugs) was added — cost and coverage estimates use averages.';
  }
  return items.join('\n');
}

export function buildComparePrompt(
  plans: MedicarePlan[],
  missing: CompareMissingData,
): string {
  if (plans.length < 2 || plans.length > 3) {
    throw new Error(`buildComparePrompt requires 2 or 3 plans, got ${plans.length}`);
  }

  const labels = plans.length === 2
    ? ['PLAN A', 'PLAN B']
    : ['PLAN A', 'PLAN B', 'PLAN C'];

  const planBlocks = plans.map((p, i) => planBlock(p, labels[i])).join('\n\n');

  const annualCosts = plans
    .map((p, i) => `${labels[i]}: ~$${estimateAnnualCost(p).toLocaleString()}/yr`)
    .join(' | ');

  const missingStr = missingDataSection(missing, plans.length);

  return `You are a Medicare Advantage expert helping a beneficiary compare plans. The user sees a full data table — provide ONLY the narrative analysis below.

${planBlocks}

ESTIMATED ANNUAL COSTS (premium + avg utilization): ${annualCosts}

Respond in EXACTLY this format (keep each section to 2-4 bullet points):

## Best for Lowest Cost
Which plan has the lowest estimated annual cost and why. Reference actual premium + OOP numbers.

## Best for Doctor Flexibility
Which plan type (HMO/PPO) gives more access flexibility and network size comparison.

## Best for Extra Benefits
Which plan wins on dental, vision, hearing, OTC, and other extras. Name specific benefits.

## Key Tradeoffs
What you give up with each option. Be direct — name the plans.

## Check Before Deciding
${missingStr}
Flag any data that was not verified. If doctors or drugs were not added, tell the user to verify coverage before enrolling.`;
}

/** Pure: determine if compare can start */
export function canStartCompare(selectedCount: number): boolean {
  return selectedCount >= 2;
}

export function compareButtonLabel(selectedCount: number): string {
  if (selectedCount === 0) return 'Select plans to compare';
  if (selectedCount === 1) return 'Select 1 more plan to compare';
  return `AI Compare ${selectedCount} Plans`;
}

export function compareBlockedReason(selectedCount: number): string | null {
  if (selectedCount === 0) return 'Select at least 2 plans to compare.';
  if (selectedCount === 1) return 'Select at least 2 plans to compare.';
  return null;
}
