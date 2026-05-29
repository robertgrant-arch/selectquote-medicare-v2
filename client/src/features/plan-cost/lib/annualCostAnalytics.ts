function sid(): string {
  try { let id = sessionStorage.getItem('pc_session_id'); if (!id) { id = crypto.randomUUID?.() ?? `${Date.now()}`; sessionStorage.setItem('pc_session_id', id); } return id; } catch { return 'unknown'; }
}
function emit(ev: string, planId: string, confidence: string, total: number) {
  if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function')
    (window as any).gtag('event', `annual_cost_${ev}`, { plan_id:planId, confidence, total_estimate:total, session_id:sid() });
}
export const trackDrawerOpened = (planId: string, confidence: string, total: number) => emit('drawer_opened', planId, confidence, total);
export const trackDrawerClosed = (planId: string, confidence: string, total: number) => emit('drawer_closed', planId, confidence, total);
export const trackImproveCTA   = (planId: string, confidence: string, total: number) => emit('improve_cta_clicked', planId, confidence, total);
