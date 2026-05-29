import { create } from 'zustand';
import { addId, removeId, toggleId, isFull, isSelected, canCompare } from './compareSelectionLogic';
import type { MedicarePlan } from '@/lib/types';

interface CompareStore {
  selected: MedicarePlan[]; selectedIds: string[];
  add: (plan: MedicarePlan) => void;
  remove: (planId: string) => void;
  toggle: (plan: MedicarePlan) => void;
  clear: () => void;
  isSelected: (planId: string) => boolean;
  isFull: () => boolean;
  canCompare: () => boolean;
}

export const useCompareStore = create<CompareStore>((set, get) => ({
  selected: [], selectedIds: [],
  add: (plan) => set(s => {
    const nextIds = addId(s.selectedIds, plan.id);
    if (nextIds === s.selectedIds) return s;
    return { selectedIds: nextIds, selected: [...s.selected, plan] };
  }),
  remove: (planId) => set(s => ({ selectedIds: removeId(s.selectedIds, planId), selected: s.selected.filter(p => p.id !== planId) })),
  toggle: (plan) => {
    const { selectedIds, selected } = get();
    const nextIds = toggleId(selectedIds, plan.id);
    set({ selectedIds: nextIds, selected: nextIds.includes(plan.id) ? [...selected, plan] : selected.filter(p => p.id !== plan.id) });
  },
  clear: () => set({ selected: [], selectedIds: [] }),
  isSelected: (planId) => isSelected(get().selectedIds, planId),
  isFull: () => isFull(get().selectedIds),
  canCompare: () => canCompare(get().selectedIds),
}));
