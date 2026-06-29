// Medicare Advantage Plan Quote Engine — Type Definitions
// Design: Bold Civic Design | Primary: #1B365D | CTA: #C41E3A

export type PlanType = "HMO" | "PPO" | "PFFS" | "SNP";

// SNP sub-types for proper grouping
export type SnpCategory = "DSNP" | "CSNP" | "ISNP" | "OTHER_SNP" | null;

// Carrier is a string to support any CMS carrier name (e.g., "Aetna Medicare", "Devoted Health", etc.)
export type Carrier = string;

export interface StarRating {
  overall: number; // 1-5, supports .5 increments
  label: string;
}

export interface CopayInfo {
  primaryCare: string;
  specialist: string;
  urgentCare: string;
  emergency: string;
  inpatientHospital: string;
  outpatientSurgery: string;
}

export interface RxDrugCoverage {
  tier1: string; // Generic
  tier2: string; // Preferred Brand
  tier3: string; // Non-Preferred Brand
  tier4: string; // Specialty
  deductible: string;
  gap: boolean; // Has gap coverage
  initialCoverageLimit: string;
}

export interface BenefitDetail {
  covered: boolean;
  details: string;
  annualLimit?: string;
}

export interface ExtraBenefits {
  dental: BenefitDetail;
  vision: BenefitDetail;
  hearing: BenefitDetail;
  otc: BenefitDetail; // Over-the-counter
  fitness: BenefitDetail;
  transportation: BenefitDetail;
  telehealth: BenefitDetail;
  meals: BenefitDetail;
}

export interface MedicarePlan {
  id: string;
  carrier: string;
  planName: string;
  planType: PlanType;
  contractId: string;
  planId: string;
  starRating: StarRating;
  premium: number; // Monthly premium in dollars
  partBPremiumReduction: number; // Monthly Part B premium reduction
  deductible: number; // Annual medical deductible
  maxOutOfPocket: number; // Annual MOOP
  copays: CopayInfo;
  rxDrugs: RxDrugCoverage;
  extraBenefits: ExtraBenefits;
  networkSize: number; // Number of in-network providers
  isBestMatch?: boolean;
  isMostPopular?: boolean;
  isNewPlan?: boolean;
  isNonCommissionable?: boolean;
  enrollmentPeriod: string;
  effectiveDate: string;
  serviceArea: string;
  snpType?: string; // Raw SNP type string from CMS data
  snpCategory?: SnpCategory; // Normalized SNP category for grouping
  carrierLogoColor: string; // Brand color for carrier
  carrierLogoTextColor: string;
  // Drug plan structure
  hasDrugCoverage?: boolean; // true = MAPD (with Part D), false = MA-Only (no Part D)
  estimatedAnnualDrugCost?: number; // Pre-calculated annual drug cost for user's Rx list
}

export interface FilterState {
  planType: PlanType[];
  carriers: string[];
  premiumRange: [number, number];
  benefits: string[];
  snpCategories: SnpCategory[]; // SNP sub-type filters (DSNP | CSNP | ISNP)
  quickFilter: "all" | "ppo" | "zero-premium" | "hmo";
  sortBy:
    | "best-match"
    | "premium-low"
    | "premium-high"
    | "star-rating"
    | "moop-low"
    | "total-cost"
    | "doctors-network"
    | "drug-cost"      // NEW — Sort by estimated annual drug cost (lowest first)
    | "benefits-max"   // NEW — Sort by extra benefits count (most first)
    | "deductible-low"; // NEW — Sort by drug deductible (lowest first)
  // NEW filter fields
  planStructure: string[]; // "MAPD" | "MA-Only"
  drugCostRange: [number, number]; // Estimated annual drug cost range in dollars
}

export interface SavedPlan {
  planId: string;
  savedAt: string;
}

export interface RxDrug {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  isGeneric: boolean;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  npi: string;
  address: string;
  phone?: string;
  acceptingPatients?: boolean;
}

// Eligibility flags for SNP plan filtering
export interface EligibilityFlags {
  isDualEligible: boolean;        // Has both Medicare + Medicaid → eligible for DSNP
  hasChronicConditions: string[]; // e.g. ["diabetes", "CHF", "ESRD"] → eligible for CSNP
  isInstitutional: boolean;       // Lives in institution → eligible for ISNP
}

// Guided workflow user profile
export interface GuidedProfile {
  zip: string;
  currentPlanName?: string;
  currentPlanId?: string;
  currentPlanCarrier?: string;
  drugs: RxDrug[];
  doctors: Doctor[];
  eligibility: EligibilityFlags;
}

// Helper to classify SNP type from raw CMS string
export function classifySnpType(snpType?: string, planName?: string): SnpCategory {
  if (!snpType && !planName) return null;
  const raw = ((snpType || '') + ' ' + (planName || '')).toUpperCase();
  if (raw.includes('D-SNP') || raw.includes('DSNP') || raw.includes('DUAL')) return 'DSNP';
  if (raw.includes('C-SNP') || raw.includes('CSNP') || raw.includes('CHRONIC')) return 'CSNP';
  if (raw.includes('I-SNP') || raw.includes('ISNP') || raw.includes('INSTITUTIONAL')) return 'ISNP';
  // If plan type is SNP but doesn't match above, it's other
  if (raw.includes('SNP')) return 'OTHER_SNP';
  return null;
}


// Doctor network status for plan cards
export interface DoctorNetworkResult {
  npi: string;
  doctorName: string;
  specialty: string;
  inNetwork: boolean;
}

export interface PlanDoctorNetworkStatus {
  planId: string;
  contractId: string;
  doctors: DoctorNetworkResult[];
  allInNetwork: boolean;
  inNetworkCount: number;
  outOfNetworkCount: number;
}
