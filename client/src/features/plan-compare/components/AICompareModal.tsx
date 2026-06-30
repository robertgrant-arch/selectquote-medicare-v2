import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Sparkles, Loader2, AlertTriangle, RotateCcw, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import { streamCompare, type CompareStreamPhase } from '../lib/compareStreamClient';
import { compareBlockedReason, compareButtonLabel } from '../lib/comparePromptBuilder';
import type { MedicarePlan } from '@/lib/types';

// ── Lightweight markdown renderer for the 5 required sections ──────────────
function renderSection(text: string, title: string): string | null {
  const re = new RegExp(`## ${title}([\\s\\S]*?)(?=## |$)`);
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

const SECTIONS = [
  { key:'Best for Lowest Cost',         color:'#15803D', bg:'#F0FDF4', border:'#BBF7D0' },
  { key:'Best for Doctor Flexibility',  color:'#0369A1', bg:'#F0F9FF', border:'#BAE6FD' },
  { key:'Best for Extra Benefits',      color:'#7E22CE', bg:'#FAF5FF', border:'#E9D5FF' },
  { key:'Key Tradeoffs',                color:'#C2410C', bg:'#FFF7ED', border:'#FED7AA' },
  { key:'Check Before Deciding',        color:'#B45309', bg:'#FFFBEB', border:'#FDE68A' },
] as const;

interface Props {
  open: boolean;
  plans: MedicarePlan[];
  onClose: () => void;
}

export default function AICompareModal({ open, plans, onClose }: Props) {
  const [phase, setPhase]       = useState<CompareStreamPhase>('idle');
  const [text, setText]         = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [expanded, setExpanded] = useState<Record<string,boolean>>({});
  const abortRef = useRef<AbortController | null>(null);
  const cacheKey = plans.map(p => p.id).sort().join('__');

  const selectedCount = plans.length;
  const blocked = compareBlockedReason(selectedCount);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [open, onClose]);

  // Auto-start when modal opens with valid plans
  useEffect(() => {
    if (open && !blocked && phase === 'idle') {
      // Check sessionStorage cache (tab-scoped; cleared on close)
      try {
        const cached = sessionStorage.getItem(`ai-compare-${cacheKey}`);
        if (cached) { setText(cached); setPhase('done'); return; }
      } catch {}
      startStream();
    }
    if (!open) { abortRef.current?.abort(); setPhase('idle'); setText(''); setErrorMsg(''); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const startStream = useCallback(() => {
    if (blocked || plans.length < 2) return;
    setText(''); setErrorMsg('');
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    streamCompare(plans, {
      onPhaseChange: setPhase,
      onToken: (t) => setText(prev => prev + t),
      onDone: (full) => {
        setPhase('done');
        try { sessionStorage.setItem(`ai-compare-${cacheKey}`, full); } catch {}
      },
      onError: (msg) => { setPhase('error'); setErrorMsg(msg); },
    }, abortRef.current.signal);
  }, [plans, blocked, cacheKey]);

  const handleRetry = () => {
    try { sessionStorage.removeItem(`ai-compare-${cacheKey}`); } catch {}
    setPhase('idle');
    startStream();
  };

  if (!open) return null;

  const isLoading   = phase === 'loading';
  const isStreaming = phase === 'streaming';
  const isDone      = phase === 'done';
  const isError     = phase === 'error' || phase === 'timeout';

  const planHeaders = plans.map(p => `${p.planName} (${p.carrier})`);

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:9991, display:'flex', alignItems:'flex-end', justifyContent:'center', backgroundColor:'rgba(11,27,36,0.5)', backdropFilter:'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`AI plan comparison: ${planHeaders.join(' vs ')}`}
        data-testid="ai-compare-modal"
        style={{ width:'100%', maxWidth:'620px', maxHeight:'90vh', backgroundColor:'#fff', borderRadius:'12px 12px 0 0', display:'flex', flexDirection:'column', boxShadow:'0 -4px 32px rgba(11,27,36,0.14)', overflowY:'auto' }}
      >
        {/* Header */}
        <div style={{ position:'sticky', top:0, zIndex:10, flexShrink:0, backgroundColor:'#00353E', padding:'14px 16px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <Sparkles size={15} style={{ color:'#93C5FD' }} aria-hidden="true" />
              <span style={{ color:'#fff', fontWeight:800, fontSize:'15px' }}>AI Plan Comparison</span>
            </div>
            <button onClick={onClose} aria-label="Close comparison" style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:30, height:30, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {plans.map((p, i) => (
              <span key={p.id} style={{ fontSize:'10px', fontWeight:600, padding:'2px 8px', borderRadius:'999px', backgroundColor:`rgba(255,255,255,${i===0?0.25:0.15})`, color:'#fff' }}>
                {p.planName} · ${p.premium}/mo
              </span>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding:'16px', flex:1 }}>

          {/* Blocked state — < 2 plans */}
          {blocked && (
            <div role="alert" style={{ display:'flex', alignItems:'center', gap:'10px', padding:'14px', borderRadius:'10px', backgroundColor:'#FFFBEB', border:'1px solid #FDE68A' }}>
              <BarChart2 size={18} style={{ color:'#B45309', flexShrink:0 }} aria-hidden="true" />
              <p style={{ fontSize:'13px', color:'#92400E', margin:0, fontWeight:600 }}>{blocked}</p>
            </div>
          )}

          {/* Loading / streaming */}
          {(isLoading || isStreaming) && (
            <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 0 14px', color:'#00353E' }}>
              <Loader2 size={16} style={{ animation:'spin 1s linear infinite', flexShrink:0 }} aria-hidden="true" />
              <span style={{ fontSize:'12px', fontWeight:600 }}>
                {isLoading ? 'Connecting to AI…' : 'Analyzing plans…'}
              </span>
              <span style={{ fontSize:'10px', color:'#8C8C8C', marginLeft:'auto' }}>30s max</span>
            </div>
          )}

          {/* Error state */}
          {isError && (
            <div role="alert" style={{ padding:'12px 14px', borderRadius:'10px', backgroundColor:'#FEF2F2', border:'1px solid #FECACA', marginBottom:'12px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                <AlertTriangle size={15} style={{ color:'#DC2626', flexShrink:0 }} aria-hidden="true" />
                <span style={{ fontSize:'12px', fontWeight:700, color:'#991B1B' }}>Comparison failed</span>
              </div>
              <p style={{ fontSize:'11px', color:'#DC2626', margin:'0 0 10px', lineHeight:1.5 }}>{errorMsg}</p>
              <button onClick={handleRetry} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'7px 14px', borderRadius:'8px', backgroundColor:'#DC2626', color:'#fff', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:700 }}>
                <RotateCcw size={12} aria-hidden="true" /> Try Again
              </button>
            </div>
          )}

          {/* Streaming / done — render sections as they arrive */}
          {(isStreaming || isDone) && text && (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {SECTIONS.map(sec => {
                const content = renderSection(text, sec.key);
                if (!content && !isStreaming) return null;
                if (!content) {
                  // Show placeholder while streaming
                  return (
                    <div key={sec.key} style={{ height:'48px', borderRadius:'10px', backgroundColor:sec.bg, border:`1px solid ${sec.border}`, animation:'pulse 1.5s infinite' }} />
                  );
                }
                const isOpen = expanded[sec.key] !== false; // default expanded
                return (
                  <div key={sec.key} style={{ borderRadius:'10px', backgroundColor:sec.bg, border:`1px solid ${sec.border}`, overflow:'hidden' }}>
                    <button
                      onClick={() => setExpanded(p => ({...p, [sec.key]: !isOpen}))}
                      aria-expanded={isOpen}
                      aria-controls={`section-${sec.key.replace(/\s/g,'-')}`}
                      style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'none', border:'none', cursor:'pointer' }}
                    >
                      <span style={{ fontSize:'12px', fontWeight:700, color:sec.color }}>{sec.key}</span>
                      {isOpen ? <ChevronUp size={14} style={{ color:sec.color }} aria-hidden="true" /> : <ChevronDown size={14} style={{ color:sec.color }} aria-hidden="true" />}
                    </button>
                    {isOpen && (
                      <div id={`section-${sec.key.replace(/\s/g,'-')}`} style={{ padding:'0 14px 12px' }}>
                        <p style={{ fontSize:'12px', color:'#303030', margin:0, lineHeight:1.65, whiteSpace:'pre-wrap' }}>{content}</p>
                      </div>
                    )}
                  </div>
                );
              })}

              {isDone && (
                <p style={{ fontSize:'9px', color:'#8C8C8C', textAlign:'center', marginTop:'8px', lineHeight:1.4 }}>
                  AI analysis is for comparison purposes only. Verify all plan details with the carrier before enrolling.
                  Not affiliated with Medicare.gov or CMS.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Retry button when done */}
        {isDone && (
          <div style={{ position:'sticky', bottom:0, backgroundColor:'#fff', borderTop:'1px solid #E8E8E8', padding:'10px 16px', display:'flex', gap:'8px' }}>
            <button onClick={handleRetry} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 14px', borderRadius:'8px', backgroundColor:'#F9F9F9', border:'1px solid #E8E8E8', cursor:'pointer', fontSize:'11px', fontWeight:600, color:'#303030' }}>
              <RotateCcw size={12} aria-hidden="true" /> Refresh
            </button>
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1;}50%{opacity:0.5;} }`}</style>
      </div>
    </div>
  );
}
