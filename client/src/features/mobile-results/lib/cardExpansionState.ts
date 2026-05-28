export type CardSection = 'copays'|'drugs'|'benefits';
export type CardExpansionState = Set<CardSection>;
export const SECTION_LABELS: Record<CardSection,string> = { copays:'Visit Copays', drugs:'Drug Coverage', benefits:'Extra Benefits' };
export function toggleSection(state: CardExpansionState, section: CardSection): CardExpansionState {
  const next = new Set(state);
  next.has(section) ? next.delete(section) : next.add(section);
  return next;
}
export function isExpanded(state: CardExpansionState, section: CardSection): boolean { return state.has(section); }
export function collapseAll(): CardExpansionState { return new Set(); }
export function expandAll(): CardExpansionState { return new Set<CardSection>(['copays','drugs','benefits']); }
