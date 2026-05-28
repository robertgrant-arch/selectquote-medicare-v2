import type { ScoreTier } from '../types/matchScore';

export const SCORE_TIERS: ScoreTier[] = [
  { label: 'Excellent fit',          min: 85, max: 100, color: '#15803D', bgColor: '#DCFCE7', borderColor: '#86EFAC', barColor: '#22C55E' },
  { label: 'Strong fit',             min: 70, max: 84,  color: '#16A34A', bgColor: '#F0FDF4', borderColor: '#BBF7D0', barColor: '#4ADE80' },
  { label: 'Good fit, review details', min: 55, max: 69, color: '#B45309', bgColor: '#FFFBEB', borderColor: '#FDE68A', barColor: '#FBBF24' },
  { label: 'Possible fit',           min: 40, max: 54,  color: '#C2410C', bgColor: '#FFF7ED', borderColor: '#FED7AA', barColor: '#FB923C' },
  { label: 'Low fit',                min: 0,  max: 39,  color: '#DC2626', bgColor: '#FEF2F2', borderColor: '#FECACA', barColor: '#F87171' },
];

export function scoreTierFor(score: number): ScoreTier {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return SCORE_TIERS.find((t) => clamped >= t.min && clamped <= t.max) ?? SCORE_TIERS[SCORE_TIERS.length - 1];
}

export const scoreLabelFor    = (s: number) => scoreTierFor(s).label;
export const scoreColorFor    = (s: number) => scoreTierFor(s).color;
export const scoreBgFor       = (s: number) => scoreTierFor(s).bgColor;
export const scoreBorderFor   = (s: number) => scoreTierFor(s).borderColor;
export const scoreBarColorFor = (s: number) => scoreTierFor(s).barColor;

export function factorBarColorFor(ratio: number): string {
  if (ratio >= 0.70) return '#22C55E';
  if (ratio >= 0.45) return '#FBBF24';
  return '#F87171';
}

const FACTOR_LABELS: Record<string, string> = {
  'Doctor Network': 'Doctor Network', 'Drug Cost': 'Drug Costs',
  'Premium': 'Monthly Premium', 'Max Out-of-Pocket': 'Out-of-Pocket Risk',
  'Star Rating': 'CMS Star Rating', 'Extra Benefits': 'Extra Benefits',
  'Copay Burden': 'Copay Burden', 'Drug Deductible': 'Drug Deductible',
};
export function factorDisplayName(engineName: string): string {
  return FACTOR_LABELS[engineName] ?? engineName;
}

const FACTOR_ORDER: Record<string, number> = {
  'Doctor Network': 1, 'Drug Cost': 2, 'Premium': 3, 'Max Out-of-Pocket': 4,
  'Star Rating': 5, 'Extra Benefits': 6, 'Copay Burden': 7, 'Drug Deductible': 8,
};
export function sortBreakdown<T extends { factor: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (FACTOR_ORDER[a.factor] ?? 99) - (FACTOR_ORDER[b.factor] ?? 99));
}
