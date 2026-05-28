import { X, BarChart2, Plus } from 'lucide-react';
import { useCompareStore } from '../lib/compareStore';
interface Props { onCompare: () => void; }
export default function CompareSelectionTray({ onCompare }: Props) {
  const { selected, selectedIds, remove, canCompare } = useCompareStore();
  if (!selected.length) return null;
  const ok = canCompare();
  return (
    <div role="region" aria-label="Plan comparison tray" data-testid="compare-tray" style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:9985, backgroundColor:'#fff', borderTop:'2px solid #1B365D', boxShadow:'0 -4px 24px rgba(0,0,0,0.12)', padding:'12px 24px' }}>
      <div style={{ maxWidth:'1280px', margin:'0 auto', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
        <span style={{ fontSize:'12px', fontWeight:700, color:'#1B365D', whiteSpace:'nowrap', flexShrink:0 }}>Comparing {selected.length}/3</span>
        <div style={{ display:'flex', gap:'8px', flex:1, flexWrap:'wrap' }}>
          {selected.map(plan => (
            <div key={plan.id} style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'5px 10px', borderRadius:'8px', backgroundColor:'#EFF6FF', border:'1px solid #BFDBFE' }}>
              <span style={{ fontSize:'11px', fontWeight:600, color:'#1B365D', maxWidth:'160px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{plan.carrier} · {plan.planName}</span>
              <span style={{ fontSize:'10px', color:'#6B7280' }}>${plan.premium}/mo</span>
              <button onClick={() => remove(plan.id)} aria-label={`Remove ${plan.planName}`} style={{ background:'none', border:'none', cursor:'pointer', color:'#6B7280', padding:0, display:'flex', alignItems:'center' }}><X size={12}/></button>
            </div>
          ))}
          {selected.length < 3 && <div style={{ display:'flex', alignItems:'center', gap:'5px', padding:'5px 10px', borderRadius:'8px', border:'1px dashed #CBD5E1', color:'#9CA3AF' }}><Plus size={11}/><span style={{ fontSize:'11px' }}>Add {selected.length===1?'a 2nd':'a 3rd'} plan</span></div>}
        </div>
        <button onClick={onCompare} disabled={!ok} data-testid="tray-compare-btn" style={{ padding:'10px 20px', borderRadius:'10px', backgroundColor:ok?'#C41E3A':'#E5E7EB', color:ok?'#fff':'#9CA3AF', border:'none', cursor:ok?'pointer':'default', fontSize:'13px', fontWeight:700, flexShrink:0, display:'flex', alignItems:'center', gap:'6px' }}>
          <BarChart2 size={15} aria-hidden="true"/>Compare {selected.length} {selected.length===1?'Plan':'Plans'}
        </button>
      </div>
      {!ok && <p style={{ fontSize:'10px', color:'#9CA3AF', textAlign:'center', margin:'6px 0 0' }}>Select at least 2 plans to compare</p>}
    </div>
  );
}
