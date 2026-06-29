import type { MedicarePlan } from '@/lib/types';
interface Props { plan: MedicarePlan; isSelected: boolean; isFull: boolean; onToggle: (plan: MedicarePlan) => void; }
export default function CompareCheckbox({ plan, isSelected, isFull, onToggle }: Props) {
  const disabled = isFull && !isSelected;
  return (
    <label style={{ display:'flex', alignItems:'center', gap:'7px', padding:'8px 12px', cursor:disabled?'not-allowed':'pointer', borderTop:'1px solid #E2EAED', userSelect:'none', backgroundColor:isSelected?'#EEF5F7':'transparent', opacity:disabled?0.45:1, fontFamily:"'DM Sans', sans-serif" }} aria-label={`${isSelected?'Remove':'Add'} ${plan.planName} ${isSelected?'from':'to'} comparison`}>
      <input type="checkbox" checked={isSelected} disabled={disabled} onChange={() => !disabled&&onToggle(plan)} className="sr-only" />
      <span style={{ width:'15px', height:'15px', borderRadius:'3px', flexShrink:0, border:`2px solid ${isSelected?'#237A92':'#C6DAE0'}`, backgroundColor:isSelected?'#237A92':'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', transition:'all 0.12s' }} aria-hidden="true">
        {isSelected && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </span>
      <span style={{ fontSize:'11px', fontWeight:600, color:isSelected?'#1C3A48':'#7A9BA6' }}>{isSelected?'Added to compare':disabled?'Compare full (3 max)':'Add to compare'}</span>
    </label>
  );
}
