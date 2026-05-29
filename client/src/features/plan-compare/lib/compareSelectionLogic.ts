export const MAX_COMPARE = 3 as const;

export function canAdd(selectedIds: string[], planId: string): boolean {
  return selectedIds.length < MAX_COMPARE && !selectedIds.includes(planId);
}
export function addId(selectedIds: string[], planId: string): string[] {
  if (!canAdd(selectedIds, planId)) return selectedIds;
  return [...selectedIds, planId];
}
export function removeId(selectedIds: string[], planId: string): string[] {
  return selectedIds.filter(id => id !== planId);
}
export function toggleId(selectedIds: string[], planId: string): string[] {
  return selectedIds.includes(planId) ? removeId(selectedIds, planId) : addId(selectedIds, planId);
}
export function isFull(selectedIds: string[]): boolean { return selectedIds.length >= MAX_COMPARE; }
export function isSelected(selectedIds: string[], planId: string): boolean { return selectedIds.includes(planId); }
export function canCompare(selectedIds: string[]): boolean { return selectedIds.length >= 2; }
