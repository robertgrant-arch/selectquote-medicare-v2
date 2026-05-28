export const AVERAGE_ANNUAL_DRUG_COST = 600;
export const ASSUMED_PCP_VISITS_PER_YEAR = 6;
export const ASSUMED_SPECIALIST_VISITS_PER_YEAR = 2;
export const DEDUCTIBLE_UTILIZATION_FRACTION = 0.5;

export function parseCopayString(s: string): number {
  if (!s) return 0;
  if (/no charge|free|included|n\/a|not covered/i.test(s)) return 0;
  const m = s.match(/\$(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

export function determineConfidence(hasRxDrugs: boolean, hasDoctors: boolean): 'high'|'medium'|'low' {
  if (hasRxDrugs && hasDoctors) return 'high';
  if (hasRxDrugs || hasDoctors) return 'medium';
  return 'low';
}

export function confidenceReasonFor(hasRxDrugs: boolean, hasDoctors: boolean): string {
  if (hasRxDrugs && hasDoctors) return 'Personalized estimate using your prescriptions and doctor network.';
  if (hasRxDrugs) return 'Drug costs personalized. Copay burden uses average utilization assumptions.';
  if (hasDoctors) return 'Network confirmed. Drug costs use population average ($600/yr).';
  return 'All costs use population averages — add prescriptions and doctors to personalize.';
}

export function improvementHintFor(hasRxDrugs: boolean, hasDoctors: boolean): string | null {
  if (hasRxDrugs && hasDoctors) return null;
  if (!hasRxDrugs && !hasDoctors) return 'Estimate improves if you add prescriptions and doctors.';
  if (!hasRxDrugs) return 'Add your prescriptions for a personalized drug cost estimate.';
  return 'Add your doctors to check for potential out-of-network costs.';
}

export interface CostCalculationInputs {
  premiumAnnual: number; deductible: number; maxOutOfPocket: number;
  primaryCareCopay: string; specialistCopay: string;
  estimatedAnnualDrugCost: number | null;
  hasDrugCoverage: boolean; hasRxDrugs: boolean; hasDoctors: boolean;
}

export interface CostComponent {
  id: string; label: string; amount: number; isEstimated: boolean; assumption: string;
}
export interface AnnualCostEstimate {
  totalEstimate: number; premiumAnnual: number; oopEstimate: number;
  isOopCappedByMoop: boolean; components: CostComponent[];
  confidence: 'high'|'medium'|'low'; confidenceReason: string; improvementHint: string|null;
}

export function calculateAnnualCost(inputs: CostCalculationInputs): AnnualCostEstimate {
  const { premiumAnnual, deductible, maxOutOfPocket, primaryCareCopay, specialistCopay,
    estimatedAnnualDrugCost, hasDrugCoverage, hasRxDrugs, hasDoctors } = inputs;

  const premComp: CostComponent = { id:'premium', label:'Annual Premium', amount:premiumAnnual, isEstimated:false, assumption:'Monthly premium × 12 months.' };

  let drugAmount: number; let drugIsEst: boolean; let drugAssumption: string;
  if (!hasDrugCoverage) {
    drugAmount = 0; drugIsEst = false; drugAssumption = 'This plan does not include Part D drug coverage.';
  } else if (hasRxDrugs && estimatedAnnualDrugCost !== null) {
    drugAmount = estimatedAnnualDrugCost; drugIsEst = false; drugAssumption = "Calculated from your prescriptions using this plan's formulary.";
  } else {
    drugAmount = AVERAGE_ANNUAL_DRUG_COST; drugIsEst = true;
    drugAssumption = `Drug costs unknown because no prescriptions were added. Using average Medicare beneficiary spend of $${AVERAGE_ANNUAL_DRUG_COST}/year (CMS 2024).`;
  }
  const drugComp: CostComponent = { id:'drug', label:'Estimated Drug Costs', amount:drugAmount, isEstimated:drugIsEst, assumption:drugAssumption };

  const pcpCopay = parseCopayString(primaryCareCopay);
  const specCopay = parseCopayString(specialistCopay);
  const copayBurden = Math.round(pcpCopay * ASSUMED_PCP_VISITS_PER_YEAR + specCopay * ASSUMED_SPECIALIST_VISITS_PER_YEAR);
  const copayComp: CostComponent = { id:'copay', label:'Medical Copay Burden', amount:copayBurden, isEstimated:true, assumption:`Assumes ${ASSUMED_PCP_VISITS_PER_YEAR} PCP + ${ASSUMED_SPECIALIST_VISITS_PER_YEAR} specialist visits/year.` };

  const deductiblePortion = Math.round(deductible * DEDUCTIBLE_UTILIZATION_FRACTION);
  const dedComp: CostComponent = { id:'deductible', label:'Estimated Deductible', amount:deductiblePortion, isEstimated:deductible>0, assumption:deductible===0?'No medical deductible.':`${Math.round(DEDUCTIBLE_UTILIZATION_FRACTION*100)}% of $${deductible.toLocaleString()} deductible applied.` };

  const rawOop = drugAmount + copayBurden + deductiblePortion;
  const isOopCappedByMoop = rawOop > maxOutOfPocket;
  const oopEstimate = Math.min(rawOop, maxOutOfPocket);
  const totalEstimate = premiumAnnual + oopEstimate;

  return { totalEstimate, premiumAnnual, oopEstimate, isOopCappedByMoop,
    components: [premComp, drugComp, copayComp, dedComp],
    confidence: determineConfidence(hasRxDrugs, hasDoctors),
    confidenceReason: confidenceReasonFor(hasRxDrugs, hasDoctors),
    improvementHint: improvementHintFor(hasRxDrugs, hasDoctors) };
}
