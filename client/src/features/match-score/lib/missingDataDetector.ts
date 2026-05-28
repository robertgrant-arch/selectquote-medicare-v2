export interface BreakdownEntry { factor: string; weight: number; contribution: number; }
export interface MissingDataNotice {
  factor: string; factorKey: string; message: string;
  severity: 'warn'|'info'; actionLabel: string; actionEvent: string;
}
export interface MatchScoreContext { hasRxDrugs: boolean; hasDoctors: boolean; }

export function factorPerformanceRatio(entry: BreakdownEntry): number {
  if (entry.weight <= 0) return 0;
  return Math.max(0, Math.min(1, entry.contribution / entry.weight));
}
export function scoreCompletenessRatio(breakdown: BreakdownEntry[], totalPossibleWeight: number): number {
  if (totalPossibleWeight <= 0) return 1;
  return Math.min(1, breakdown.reduce((s, b) => s + b.weight, 0) / totalPossibleWeight);
}
export function detectMissingDoctors(breakdown: BreakdownEntry[], ctx: MatchScoreContext): MissingDataNotice | null {
  if (ctx.hasDoctors) return null;
  const entry = breakdown.find(b => b.factor === 'Doctor Network');
  if (!entry || entry.weight > 0) return null;
  return { factor:'Doctor Network', factorKey:'doctor_network', message:'Doctor network not scored because no doctors were added. Add your doctors to see which plans keep them in-network.', severity:'warn', actionLabel:'Add your doctors', actionEvent:'match-score:open-doctors-modal' };
}
export function detectMissingDrugs(breakdown: BreakdownEntry[], ctx: MatchScoreContext): MissingDataNotice | null {
  if (ctx.hasRxDrugs) return null;
  const entry = breakdown.find(b => b.factor === 'Drug Cost');
  if (!entry || entry.weight <= 0) return null;
  return { factor:'Drug Cost', factorKey:'drug_cost', message:'Drug costs unknown because no prescriptions were added. The score assumes average drug costs, which may not match your actual spending.', severity:'warn', actionLabel:'Add prescriptions', actionEvent:'match-score:open-rx-modal' };
}
export function detectMissingData(breakdown: BreakdownEntry[], ctx: MatchScoreContext): MissingDataNotice[] {
  return [detectMissingDoctors(breakdown, ctx), detectMissingDrugs(breakdown, ctx)].filter(Boolean) as MissingDataNotice[];
}
export function improveSuggestionLabel(notices: MissingDataNotice[]): string {
  if (!notices.length) return '';
  if (notices.length === 1) return notices[0].actionLabel;
  return notices.map(n => n.actionLabel.toLowerCase()).join(' & ');
}
