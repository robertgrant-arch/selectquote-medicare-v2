import { DRUG_DATABASE, type DrugProfile } from "./database";

function classifyUnknownDrug(name: string, dosage: string): DrugProfile {
  const lower = name.toLowerCase();
  const genericSuffixes = ["pril", "olol", "sartan", "statin", "prazole", "tidine", "dipine", "azepam", "oxetine", "pram", "azole", "mycin", "cillin", "cycline", "gliptin", "gliflozin", "glutide", "mab", "nib", "tinib", "zomib", "parib", "lisib", "fenac", "profen", "coxib", "olone", "asone", "onide", "lukast", "phylline", "tropium", "terol", "amide", "thiazide", "pamine", "setron", "pride"];
  const isLikelyGeneric = genericSuffixes.some(s => lower.endsWith(s));
  if (isLikelyGeneric) {
    return { tier: 1, avgMonthlyCost: 15, isGeneric: true };
  }
  // Check for common brand name patterns
  const brandIndicators = ["xr", "er", "sr", "cr", "la", "xl", "hfa"];
  const hasBrandSuffix = brandIndicators.some(s => lower.endsWith(s));
  if (hasBrandSuffix) {
    return { tier: 2, avgMonthlyCost: 200, isGeneric: false };
  }
  return { tier: 2, avgMonthlyCost: 200, isGeneric: false };
}

// — Copay/coinsurance parsers ——————————————————————————————
function parseCopayAmount(copayStr: string): { type: "flat" | "percent"; value: number } {
  if (!copayStr) return { type: "flat", value: 0 };
  const str = copayStr.toLowerCase().trim();
  const pctMatch = str.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pctMatch) return { type: "percent", value: parseFloat(pctMatch[1]) };
  const dollarMatch = str.match(/\$\s*(\d+(?:\.\d+)?)/);
  if (dollarMatch) return { type: "flat", value: parseFloat(dollarMatch[1]) };
  const numMatch = str.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) return { type: "flat", value: parseFloat(numMatch[1]) };
  return { type: "flat", value: 0 };
}

function parseDeductible(deductStr: string | number | undefined): number {
  if (typeof deductStr === "number") return deductStr;
  if (!deductStr) return 0;
  const match = String(deductStr).match(/\$?\s*(\d+(?:,\d{3})*)/);
  if (match) return parseInt(match[1].replace(/,/g, ""), 10);
  return 0;
}

// — Core types ———————————————————————————————————
export interface DrugInput {
  name: string;
  dosage: string;
}

export interface DrugCostBreakdown {
  drugName: string;
  tier: number;
  monthlyRetailCost: number;
  monthlyCopay: number;
  annualCost: number;
  phase: string;
}

export interface FormularyResult {
  estimatedAnnualDrugCost: number;
  drugBreakdowns: DrugCostBreakdown[];
  deductibleApplied: number;
  reachesCatastrophic: boolean;
  monthCatastrophicReached: number | null;
  totalRetailCost: number;
  oopBreakdown: {
    deductiblePhase: number;
    initialCoveragePhase: number;
    catastrophicPhase: number;
  };
}

// — 2026 Medicare Part D Parameters ————————————————————————
const OOP_CAP_2026 = 2100;
const MAX_DEDUCTIBLE_2026 = 615;

export function calculateDrugCosts(
  drugs: DrugInput[],
  planRx: {
    tier1: string;
    tier2: string;
    tier3: string;
    tier4: string;
    deductible: string | number;
    gap: boolean;
    initialCoverageLimit?: string;
  }
): FormularyResult {
  if (!drugs || drugs.length === 0) {
    return {
      estimatedAnnualDrugCost: 0,
      drugBreakdowns: [],
      deductibleApplied: 0,
      reachesCatastrophic: false,
      monthCatastrophicReached: null,
      totalRetailCost: 0,
      oopBreakdown: { deductiblePhase: 0, initialCoveragePhase: 0, catastrophicPhase: 0 },
    };
  }

  const drugDeductible = Math.min(parseDeductible(planRx.deductible), MAX_DEDUCTIBLE_2026);
  const tierCopays = {
    1: parseCopayAmount(planRx.tier1),
    2: parseCopayAmount(planRx.tier2),
    3: parseCopayAmount(planRx.tier3),
    4: parseCopayAmount(planRx.tier4),
  };

  const drugProfiles = drugs.map(drug => {
    const key = drug.name.toLowerCase().trim();
    const profile = DRUG_DATABASE[key] || classifyUnknownDrug(drug.name, drug.dosage);
    return { drug, profile };
  });

  let cumulativeOOP = 0;
  let deductibleRemaining = drugDeductible;
  let totalRetailAnnual = 0;
  let deductiblePhaseCost = 0;
  let initialCoveragePhaseCost = 0;
  let catastrophicPhaseCost = 0;
  let monthCatastrophicReached: number | null = null;

  const drugAnnualCosts: Map<string, number> = new Map();
  for (const { drug } of drugProfiles) {
    drugAnnualCosts.set(drug.name, 0);
  }

  for (let month = 0; month < 12; month++) {
    if (cumulativeOOP >= OOP_CAP_2026) {
      if (monthCatastrophicReached === null) monthCatastrophicReached = month;
      for (const { drug, profile } of drugProfiles) {
        totalRetailAnnual += profile.avgMonthlyCost;
      }
      continue;
    }

    for (const { drug, profile } of drugProfiles) {
      const retailCost = profile.avgMonthlyCost;
      totalRetailAnnual += retailCost;
      let memberPays = 0;

      if (cumulativeOOP >= OOP_CAP_2026) {
        catastrophicPhaseCost += 0;
        continue;
      }

      if (deductibleRemaining > 0 && profile.tier > 1) {
        const deductiblePortion = Math.min(retailCost, deductibleRemaining);
        memberPays = deductiblePortion;
        deductibleRemaining -= deductiblePortion;
        deductiblePhaseCost += memberPays;
      } else {
        const copay = tierCopays[profile.tier as 1 | 2 | 3 | 4];
        if (copay.type === "flat") {
          memberPays = copay.value;
        } else {
          memberPays = retailCost * (copay.value / 100);
        }
        initialCoveragePhaseCost += memberPays;
      }

      const remainingToOOPCap = OOP_CAP_2026 - cumulativeOOP;
      if (memberPays > remainingToOOPCap) {
        memberPays = remainingToOOPCap;
        if (monthCatastrophicReached === null) monthCatastrophicReached = month + 1;
      }

      cumulativeOOP += memberPays;
      const prev = drugAnnualCosts.get(drug.name) || 0;
      drugAnnualCosts.set(drug.name, prev + memberPays);
    }
  }

  const breakdowns: DrugCostBreakdown[] = drugProfiles.map(({ drug, profile }) => {
    const copay = tierCopays[profile.tier as 1 | 2 | 3 | 4];
    const monthlyCopay = copay.type === "flat" ? copay.value : profile.avgMonthlyCost * (copay.value / 100);
    const annualCost = drugAnnualCosts.get(drug.name) || 0;
    return {
      drugName: drug.name,
      tier: profile.tier,
      monthlyRetailCost: profile.avgMonthlyCost,
      monthlyCopay: Math.round(monthlyCopay * 100) / 100,
      annualCost: Math.round(annualCost),
      phase: cumulativeOOP >= OOP_CAP_2026 ? "catastrophic" : "initial",
    };
  });

  return {
    estimatedAnnualDrugCost: Math.round(cumulativeOOP),
    drugBreakdowns: breakdowns,
    deductibleApplied: drugDeductible - deductibleRemaining,
    reachesCatastrophic: cumulativeOOP >= OOP_CAP_2026,
    monthCatastrophicReached,
    totalRetailCost: Math.round(totalRetailAnnual),
    oopBreakdown: {
      deductiblePhase: Math.round(deductiblePhaseCost),
      initialCoveragePhase: Math.round(initialCoveragePhaseCost),
      catastrophicPhase: Math.round(catastrophicPhaseCost),
    },
  };
}

export function enrichPlansWithDrugCosts(
  plans: any[],
  drugs: DrugInput[]
): any[] {
  if (!drugs || drugs.length === 0) return plans;

  return plans.map(plan => {
    const rxStructure = {
      tier1: plan.rxDrugs?.tier1 ?? "$0",
      tier2: plan.rxDrugs?.tier2 ?? "$10",
      tier3: plan.rxDrugs?.tier3 ?? "$42",
      tier4: plan.rxDrugs?.tier4 ?? "25%",
      deductible: plan.rxDrugs?.deductible ?? "$0",
      gap: plan.rxDrugs?.gap ?? false,
    };

    const result = calculateDrugCosts(drugs, rxStructure);
    const annualPremium = (plan.premium ?? 0) * 12;

    return {
      ...plan,
      formularyDrugCost: result,
      estimatedAnnualDrugCost: result.estimatedAnnualDrugCost,
      estimatedTotalAnnualCost: annualPremium + result.estimatedAnnualDrugCost,
    };
  });
}
