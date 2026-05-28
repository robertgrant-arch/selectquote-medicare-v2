export interface RankedEntry { planId: string; planName: string; rank: number; }
export interface ChangeContext { doctorsJustAdded: boolean; drugsJustAdded: boolean; addedDoctorNames?: string[]; addedDrugNames?: string[]; }
export interface RankingChange { planId: string; planName: string; previousRank: number; currentRank: number; delta: number; reasons: string[]; }

export function detectRankingChanges(before: RankedEntry[], after: RankedEntry[], ctx: ChangeContext): RankingChange[] {
  if (!before.length || !after.length) return [];
  const beforeMap = new Map(before.map(p=>[p.planId,p.rank]));
  const changes: RankingChange[] = [];
  for (const curr of after) {
    const prev = beforeMap.get(curr.planId); if (prev===undefined || prev===curr.rank) continue;
    const delta = prev - curr.rank; const reasons: string[] = [];
    if (ctx.doctorsJustAdded) reasons.push(delta>0?(ctx.addedDoctorNames?.length?`Your doctor(s) (${ctx.addedDoctorNames.slice(0,2).join(', ')}) are in-network on this plan.`:'Your doctors are in-network on this plan.'):'Your doctors are not fully in-network, lowering this plan\'s score.');
    if (ctx.drugsJustAdded) reasons.push(delta>0?(ctx.addedDrugNames?.length?`${ctx.addedDrugNames.slice(0,2).join(', ')} are covered at a lower cost tier.`:'Your prescriptions are covered at a lower cost tier.'):'Your prescriptions have higher cost-sharing on this plan.');
    if (reasons.length) changes.push({ planId:curr.planId, planName:curr.planName, previousRank:prev, currentRank:curr.rank, delta, reasons });
  }
  return changes.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
}
export function summarizeChanges(changes: RankingChange[]): string {
  if (!changes.length) return '';
  const up = changes.filter(c=>c.delta>0).length; const down = changes.filter(c=>c.delta<0).length;
  return [up>0?`${up} plan${up>1?'s':''} moved up`:'', down>0?`${down} moved down`:''].filter(Boolean).join(', ') + ' based on your providers and prescriptions.';
}
export function hasSignificantChange(changes: RankingChange[]): boolean { return changes.some(c=>Math.abs(c.delta)>=1); }
