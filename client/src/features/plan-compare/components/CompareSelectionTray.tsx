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
      style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:9985, backgroundColor:'#fff', borderTop:'2px solid #1C3A48', boxShadow:'0 -2px 0 rgba(11,27,36,0.06), 0 -8px 32px rgba(11,27,36,0.10)', padding:'12px 24px 16px' }}
    >
      <div style={{ maxWidth:'1280px', margin:'0 auto', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
        <span style={{ fontSize:'12px', fontWeight:700, color:'#1C3A48', whiteSpace:'nowrap', flexShrink:0, fontFamily:"'DM Sans', sans-serif" }}>
          Comparing {count}/3
        </span>

        <div style={{ display:'flex', gap:'8px', flex:1, flexWrap:'wrap' }}>
          {selected.map(plan => (
            <div key={plan.id} style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'5px 10px', borderRadius:'8px', backgroundColor:'#EEF5F7', border:'1px solid #C6DAE0' }}>
              <span style={{ fontSize:'11px', fontWeight:600, color:'#1C3A48', maxWidth:'160px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:"'DM Sans', sans-serif" }}>
                {plan.carrier} · {plan.planName}
              </span>
              <span style={{ fontSize:'10px', color:'#7A9BA6', fontFamily:"'DM Sans', sans-serif" }}>${plan.premium}/mo</span>
              <button
                onClick={() => remove(plan.id)}
                aria-label={`Remove ${plan.planName} from comparison`}
                style={{ background:'none', border:'none', cursor:'pointer', color:'#7A9BA6', padding:0, display:'flex', alignItems:'center' }}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          ))}
          {count < 3 && (
            <div style={{ display:'flex', alignItems:'center', gap:'5px', padding:'5px 10px', borderRadius:'8px', border:'1px dashed #C6DAE0', color:'#7A9BA6' }}>
              <Plus size={11} aria-hidden="true" />
              <span style={{ fontSize:'11px', fontFamily:"'DM Sans', sans-serif" }}>Add {count === 1 ? 'a 2nd' : 'a 3rd'} plan</span>
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
            padding:'10px 20px', borderRadius:'8px',
            backgroundColor: canGo ? '#1C3A48' : '#E2EAED',
            color: canGo ? '#fff' : '#7A9BA6',
            border:'none', cursor: canGo ? 'pointer' : 'default',
            fontSize:'13px', fontWeight:700, flexShrink:0,
            display:'flex', alignItems:'center', gap:'6px',
            fontFamily:"'DM Sans', sans-serif",
            transition:'background-color 0.14s',
          }}
          onMouseEnter={(e) => { if (canGo) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#112333'; }}
          onMouseLeave={(e) => { if (canGo) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1C3A48'; }}
        >
          <BarChart2 size={15} aria-hidden="true" />
          {compareButtonLabel(count)}
        </button>
      </div>

      {blocked && (
        <p
          role="status"
          aria-live="polite"
          style={{ fontSize:'11px', color:'#7A9BA6', textAlign:'center', margin:'8px 0 0', fontWeight:600, fontFamily:"'DM Sans', sans-serif" }}
        >
          {blocked}
        </p>
      )}
    </div>
  );
}
