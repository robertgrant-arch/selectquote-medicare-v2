import { scoreLabelFor } from './matchScoreLabels';
function sid(): string {
  try { let id = sessionStorage.getItem('ms_session_id'); if (!id) { id = crypto.randomUUID?.() ?? `${Date.now()}`; sessionStorage.setItem('ms_session_id', id); } return id; } catch { return 'unknown'; }
}
function emit(kind: string, planId: string, score: number, extra?: object) {
  if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function')
    (window as any).gtag('event', `match_score_${kind}`, { plan_id: planId, score, tier: scoreLabelFor(score), session_id: sid(), ...extra });
}
export const trackPanelOpened   = (id: string, name: string, s: number) => emit('panel_opened', id, s);
export const trackPanelClosed   = (id: string, name: string, s: number) => emit('panel_closed', id, s);
export const trackImproveCTA    = (id: string, name: string, s: number) => emit('improve_cta_clicked', id, s);
export const trackImproveAction = (id: string, name: string, s: number, ev: string) => emit('improve_action_fired', id, s, { action_event: ev });
