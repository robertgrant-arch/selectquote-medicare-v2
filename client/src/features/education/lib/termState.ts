export type TipState = 'closed'|'open';
export type TipMode = 'tooltip'|'bottomsheet';
export function nextTipState(current: TipState, action: 'open'|'close'|'toggle'): TipState {
  if (action==='open') return 'open'; if (action==='close') return 'closed';
  return current==='open'?'closed':'open';
}
export function getTipMode(viewportWidth: number): TipMode { return viewportWidth < 768 ? 'bottomsheet' : 'tooltip'; }
export function isOpen(state: TipState): boolean { return state==='open'; }
