export interface TermEntry {
  key: string; title: string; definition: string; relevance?: string;
  version: string; lastReviewedAt: string;
  category: 'plan_type'|'coverage_type'|'financial_assistance'|'drug_coverage'|'cost_sharing'|'access_rules';
}
export interface GlossaryMeta { version: string; effectiveDate: string; reviewCycleDays: number; }
