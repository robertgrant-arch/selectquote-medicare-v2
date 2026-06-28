import { useState, useCallback } from 'react';
import { Info, TrendingUp, X } from 'lucide-react';
import { calculateFromPlan } from '../lib/annualCostCalculator';
import { trackDrawerOpened, trackDrawerClosed, trackImproveCTA } from '../lib/annualCostAnalytics';
import type { MedicarePlan } from '@/lib/types';

const CONF_BADGE = {
  high:   { label:'High confidence',   bg:'#DCFCE7', color:'#15803D', border:'#86EFAC' },
  medium: { label:'Medium confidence', bg:'#FEF3C7', color:'#B45309', border:'#FDE68A' },
  low:    { label:'Low confidence',    bg:'#FEF2F2', color:'#DC2626', border:'#FECACA' },
};

interface Props { plan: MedicarePlan; hasRxDrugs: boolean; hasDoctors: boolean; }

export default function AnnualCostDisplay({ plan, hasRxDrugs, hasDoctors }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const est = calculateFromPlan(plan, hasRxDrugs, hasDoctors);
  const conf = CONF_BADGE[est.confidence];
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

  const open  = useCallback(() => { setDrawerOpen(true);  trackDrawerOpened(plan.id, est.confidence, est.totalEstimate); }, [plan.id, est]);
  const close = useCallback(() => { setDrawerOpen(false); trackDrawerClosed(plan.id, est.confidence, est.totalEstimate); }, [plan.id, est]);

  const handleImprove = () => {
    trackImproveCTA(plan.id, est.confidence, est.totalEstimate);
    if (!hasRxDrugs) window.dispatchEvent(new CustomEvent('annual-cost:open-rx-modal'));
    if (!hasDoctors) window.dispatchEvent(new CustomEvent('annual-cost:open-doctors-modal'));
  };

  return (
    <>
      <div style={{ margin:'0 12px 8px', padding:'11px 14px', borderRadius:'10px', backgroundColor:'#EEF5F7', border:'1px solid #C6DAE0' }} data-testid={`annual-cost-${plan.id}`}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'10px' }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'2px' }}>
              <p style={{ fontSize:'10px', fontWeight:700, color:'#1C3A48', margin:0, textTransform:'uppercase', letterSpacing:'0.4px', fontFamily:"'DM Sans', sans-serif" }}>Estimated Annual Cost</p>
              <span style={{ fontSize:'9px', fontWeight:700, padding:'2px 7px', borderRadius:'999px', backgroundColor:conf.bg, color:conf.color, border:`1px solid ${conf.border}` }}>{conf.label}</span>
            </div>
            <p style={{ fontSize:'22px', fontWeight:800, color:'#0B1B24', margin:0, lineHeight:1, fontFamily:"'DM Sans', sans-serif" }}>
              {fmt(est.totalEstimate)}<span style={{ fontSize:'11px', fontWeight:400, color:'#7A9BA6', marginLeft:'4px' }}>/year</span>
            </p>
            <p style={{ fontSize:'10px', color:'#3E5560', margin:'4px 0 0', fontFamily:"'DM Sans', sans-serif" }}>
              {fmt(est.premiumAnnual)} premium + {fmt(est.oopEstimate)} est. out-of-pocket{est.isOopCappedByMoop ? ' (MOOP cap)' : ''}
            </p>
          </div>
          <button onClick={drawerOpen ? close : open} aria-label={`How we calculated the annual cost for ${plan.planName}`} style={{ background:'none', border:'1px solid #C6DAE0', borderRadius:'8px', cursor:'pointer', padding:'5px 9px', display:'flex', alignItems:'center', gap:'3px', color:'#237A92', fontSize:'10px', fontWeight:600, flexShrink:0, fontFamily:"'DM Sans', sans-serif" }}>
            <Info size={11} aria-hidden="true" /> How?
          </button>
        </div>
        {est.improvementHint && (
          <div style={{ marginTop:'7px', paddingTop:'7px', borderTop:'1px solid #C6DAE0', display:'flex', alignItems:'center', gap:'6px' }}>
            <p style={{ fontSize:'10px', color:'#3E5560', margin:0, flex:1, fontFamily:"'DM Sans', sans-serif" }}>{est.improvementHint}</p>
            <button onClick={handleImprove} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:'3px', color:'#237A92', fontSize:'10px', fontWeight:700, textDecoration:'underline', fontFamily:"'DM Sans', sans-serif" }}>
              <TrendingUp size={11} aria-hidden="true" /> Add data
            </button>
          </div>
        )}
      </div>

      {drawerOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center', backgroundColor:'rgba(11,27,36,0.45)' }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div style={{ width:'100%', maxWidth:'520px', backgroundColor:'#fff', borderRadius:'12px 12px 0 0', maxHeight:'80vh', overflowY:'auto', boxShadow:'0 -4px 32px rgba(11,27,36,0.14)' }}>
            <div style={{ backgroundColor:'#1C3A48', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', borderRadius:'12px 12px 0 0' }}>
              <div>
                <p style={{ color:'#fff', fontWeight:700, fontSize:'14px', margin:0, fontFamily:"'DM Sans', sans-serif" }}>How we calculated this</p>
                <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'11px', margin:'2px 0 0', fontFamily:"'DM Sans', sans-serif" }}>{plan.planName}</p>
              </div>
              <button onClick={close} aria-label="Close" style={{ background:'rgba(255,255,255,0.15)', border:'none', width:30, height:30, borderRadius:'50%', cursor:'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <X size={15} />
              </button>
            </div>
            <div style={{ padding:'16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
                <span style={{ fontSize:'10px', fontWeight:700, padding:'2px 8px', borderRadius:'999px', backgroundColor:conf.bg, color:conf.color, border:`1px solid ${conf.border}` }}>{conf.label}</span>
              </div>
              <div style={{ borderRadius:'10px', overflow:'hidden', border:'1px solid #E2EAED', marginBottom:'12px' }}>
                {est.components.map((c, i) => (
                  <div key={c.id} style={{ padding:'10px 14px', borderBottom:i<est.components.length-1?'1px solid #F1F5F9':'none', backgroundColor:i%2===0?'#FAF9F5':'#fff', display:'flex', alignItems:'flex-start', gap:'10px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                        <span style={{ fontSize:'12px', fontWeight:600, color:'#1C3A48', fontFamily:"'DM Sans', sans-serif" }}>{c.label}</span>
                        <span style={{ fontSize:'13px', fontWeight:800, color:'#0B1B24', fontFamily:"'DM Sans', sans-serif" }}>{c.amount===0&&!c.isEstimated?'$0':`$${Math.round(c.amount).toLocaleString()}`}</span>
                      </div>
                      <p style={{ fontSize:'10px', color:'#7A9BA6', margin:'3px 0 0', lineHeight:1.4, fontFamily:"'DM Sans', sans-serif" }}>
                        {c.isEstimated && <strong style={{ color:'#B45309' }}>Estimated · </strong>}{c.assumption}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:'9px', color:'#7A9BA6', margin:'8px 0 0', lineHeight:1.4, fontFamily:"'DM Sans', sans-serif" }}>
                Estimates for comparison only. Actual costs depend on your utilization. Data: CMS 2024, AHIP 2024, MedPAC 2025.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
