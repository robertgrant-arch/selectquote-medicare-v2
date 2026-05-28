export type DoctorCoverageStatus = 'all_matched'|'partial_match'|'out_of_network'|'not_verified';
export type DrugCoverageStatus = 'covered'|'covered_restrictions'|'not_covered'|'not_verified';
export type PharmacyStatus = 'preferred'|'standard'|'out_of_network'|'not_verified';

export function classifyDoctorStatus(networkStatus: any, hasDoctors: boolean): DoctorCoverageStatus {
  if (!hasDoctors) return 'not_verified';
  if (!networkStatus || networkStatus.doctors.length === 0) return 'not_verified';
  const { inNetworkCount, outOfNetworkCount } = networkStatus;
  if (inNetworkCount > 0 && outOfNetworkCount === 0) return 'all_matched';
  if (inNetworkCount > 0 && outOfNetworkCount > 0) return 'partial_match';
  return 'out_of_network';
}

export function classifyDrugStatus(breakdowns: { tier: number }[], hasRxDrugs: boolean): DrugCoverageStatus {
  if (!hasRxDrugs) return 'not_verified';
  if (breakdowns.length === 0) return 'not_verified';
  if (breakdowns.some(b => b.tier === 0)) return 'not_covered';
  if (breakdowns.some(b => b.tier >= 3)) return 'covered_restrictions';
  return 'covered';
}

export function classifyPharmacyStatus(): PharmacyStatus { return 'not_verified'; }

export const DOCTOR_BADGE_CONFIG: Record<DoctorCoverageStatus, { label:string; color:string; bg:string; border:string }> = {
  all_matched:    { label:'All doctors in-network',  color:'#15803D', bg:'#DCFCE7', border:'#86EFAC' },
  partial_match:  { label:'Partial network match',   color:'#B45309', bg:'#FEF3C7', border:'#FDE68A' },
  out_of_network: { label:'Doctors out of network',  color:'#DC2626', bg:'#FEF2F2', border:'#FECACA' },
  not_verified:   { label:'Doctors not checked',     color:'#6B7280', bg:'#F9FAFB', border:'#E5E7EB' },
};
export const DRUG_BADGE_CONFIG: Record<DrugCoverageStatus, { label:string; color:string; bg:string; border:string }> = {
  covered:              { label:'Drugs covered',           color:'#15803D', bg:'#DCFCE7', border:'#86EFAC' },
  covered_restrictions: { label:'Covered, higher tier',    color:'#B45309', bg:'#FEF3C7', border:'#FDE68A' },
  not_covered:          { label:'Drug not on formulary',   color:'#DC2626', bg:'#FEF2F2', border:'#FECACA' },
  not_verified:         { label:'Drugs not checked',       color:'#6B7280', bg:'#F9FAFB', border:'#E5E7EB' },
};
export const PHARMACY_BADGE_CONFIG: Record<PharmacyStatus, { label:string; color:string; bg:string; border:string }> = {
  preferred:      { label:'Preferred pharmacy',      color:'#15803D', bg:'#DCFCE7', border:'#86EFAC' },
  standard:       { label:'Standard pharmacy',       color:'#0369A1', bg:'#E0F2FE', border:'#7DD3FC' },
  out_of_network: { label:'Pharmacy out of network', color:'#DC2626', bg:'#FEF2F2', border:'#FECACA' },
  not_verified:   { label:'Pharmacy not checked',    color:'#6B7280', bg:'#F9FAFB', border:'#E5E7EB' },
};
