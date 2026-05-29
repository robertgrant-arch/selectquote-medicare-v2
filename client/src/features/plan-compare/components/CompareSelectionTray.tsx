import { X, BarChart2, Plus } from 'lucide-react';
import { useCompareStore } from '../lib/compareStore';
import { compareBlockedReason, compareButtonLabel, canStartCompare } from '../lib/comparePromptBuilder';

interface Props { onCompare: () => void; }

export default function CompareSelectionTray({ onCompare }: Props) {
  const { selected, remove } = useCompareStore();
  const count = selected.length;
  if (count === 0) return null;

  const blocked = compareBlockedReason(count);
  const canGo = canStartCompare(count);

  return (
    <div
      role="region"
      aria-label="Plan comparison tray"
      data-testid="compare-tray"
      style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:9985, backgroundColor:'#fff', borderTop:'2px solid #1B365D', boxShadow:'0 -4px 24px rgba(0,0,0,0.12)', padding:'12px 24px 16px' }}
    >
      <div style={{ maxWidth:'1280px', margin:'0 auto', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
        <span style={{ fontSize:'12px', fontWeight:700, color:'#1B365D', whiteSpace:'nowrap', flexShrink:0 }}>
          Comparing {count}/3
        </span>

        <div style={{ display:'flex', gap:'8px', flex:1, flexWrap:'wrap' }}>
          {selected.map(plan => (
            <div key={plan.id} style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'5px 10px', borderRadius:'8px', backgroundColor:'#EFF6FF', border:'1px solid #BFDBFE' }}>
              <span style={{ fontSize:'11px', fontWeight:600, color:'#1B365D', maxWidth:'160px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {plan.carrier} · {plan.planName}
              </span>
              <span style={{ fontSize:'10px', color:'#6B7280' }}>${plan.premium}/mo</span>
              <button
                onClick={() => remove(plan.id)}
                aria-label={`Remove ${plan.planName} from comparison`}
                style={{ background:'none', border:'none', cursor:'pointer', color:'#6B7280', padding:0, display:'flex', alignItems:'center' }}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          ))}
          {count < 3 && (
            <div style={{ display:'flex', alignItems:'center', gap:'5px', padding:'5px 10px', borderRadius:'8px', border:'1px dashed #CBD5E1', color:'#9CA3AF' }}>
              <Plus size={11} aria-hidden="true" />
              <span style={{ fontSize:'11px' }}>Add {count === 1 ? 'a 2nd' : 'a 3rd'} plan</span>
            </div>
          )}
        </div>

        <button
          onClick={canGo ? onCompare : undefined}
          disabled={!canGo}
          data-testid="tray-compare-btn"
          aria-label={compareButtonLabel(count)}
          aria-disabled={!canGo}
          style={{
            padding:'10px 20px', borderRadius:'10px',
            backgroundColor: canGo ? '#C41E3A' : '#E5E7EB',
            color: canGo ? '#fff' : '#9CA3AF',
            border:'none', cursor: canGo ? 'pointer' : 'default',
            fontSize:'13px', fontWeight:700, flexShrink:0,
            display:'flex', alignItems:'center', gap:'6px',
          }}
        >
          <BarChart2 size={15} aria-hidden="true" />
          {compareButtonLabel(count)}
        </button>
      </div>

      {/* Inline message when fewer than 2 plans selected */}
      {blocked && (
        <p
          role="status"
          aria-live="polite"
          style={{ fontSize:'11px', color:'#B45309', textAlign:'center', margin:'8px 0 0', fontWeight:600 }}
        >
          {blocked}
        </p>
      )}
    </div>
  );
}
