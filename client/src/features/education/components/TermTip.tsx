import { useState, useRef, useId } from 'react';
import { Info } from 'lucide-react';
import { getTerm } from '../data/terms';

interface Props { termKey: string; children?: React.ReactNode; iconOnly?: boolean; }

export default function TermTip({ termKey, children, iconOnly = false }: Props) {
  const term = getTerm(termKey);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  if (!term) return iconOnly ? null : <>{children}</>;

  const handleClick = () => {
    setRect(btnRef.current?.getBoundingClientRect() ?? null);
    setOpen(v => !v);
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const icon = (
    <button ref={btnRef} type="button" onClick={handleClick} aria-label={`Learn about ${term.title}`} aria-expanded={open} aria-haspopup="dialog" aria-controls={panelId}
      style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', verticalAlign:'middle', marginLeft:'3px', width:'14px', height:'14px', borderRadius:'50%', border:'none', backgroundColor:'transparent', cursor:'pointer', padding:0, color:'#7A9BA6' }}>
      <Info size={12} aria-hidden="true" />
    </button>
  );

  const panel = open ? (
    isMobile ? (
      <div style={{ position:'fixed', inset:0, zIndex:9998, backgroundColor:'rgba(0,0,0,0.4)' }} onClick={() => setOpen(false)}>
        <div id={panelId} role="dialog" aria-modal="true" aria-label={term.title} style={{ position:'fixed', bottom:0, left:0, right:0, backgroundColor:'#fff', borderRadius:'12px 12px 0 0', padding:'20px 20px 32px', maxHeight:'60vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ fontSize:'16px', fontWeight:800, color:'#1C3A48', margin:'0 0 8px' }}>{term.title}</h3>
          <p style={{ fontSize:'14px', color:'#3E5560', lineHeight:1.65, margin:0 }}>{term.definition}</p>
          {term.relevance && <div style={{ marginTop:'10px', padding:'8px 12px', borderRadius:'8px', backgroundColor:'#EEF5F7', border:'1px solid #C6DAE0' }}><p style={{ fontSize:'12px', color:'#237A92', margin:0 }}>💡 {term.relevance}</p></div>}
          <p style={{ fontSize:'9px', color:'#C6DAE0', marginTop:'14px' }}>v{term.version} · {term.lastReviewedAt}</p>
        </div>
      </div>
    ) : rect ? (
      <div id={panelId} role="tooltip" aria-label={term.title} style={{ position:'fixed', top:`${Math.max(4, rect.top - 130)}px`, left:`${Math.min(rect.left, window.innerWidth - 290)}px`, width:'280px', zIndex:9999, backgroundColor:'#fff', border:'1px solid #E2EAED', borderRadius:'10px', boxShadow:'0 8px 32px rgba(11,27,36,0.14)', padding:'12px 14px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
          <p style={{ fontSize:'11px', fontWeight:800, color:'#1C3A48', margin:0 }}>{term.title}</p>
          <button onClick={() => setOpen(false)} aria-label="Close" style={{ background:'none', border:'none', cursor:'pointer', color:'#7A9BA6', fontSize:'14px', padding:0 }}>×</button>
        </div>
        <p style={{ fontSize:'11px', color:'#3E5560', margin:0, lineHeight:1.55 }}>{term.definition}</p>
        {term.relevance && <p style={{ fontSize:'10px', color:'#7A9BA6', margin:'5px 0 0', lineHeight:1.45, fontStyle:'italic' }}>{term.relevance}</p>}
        <p style={{ fontSize:'9px', color:'#C6DAE0', margin:'8px 0 0' }}>v{term.version}</p>
      </div>
    ) : null
  ) : null;

  if (iconOnly) return <>{icon}{panel}</>;
  return <span style={{ display:'inline', whiteSpace:'nowrap' }}>{children}{icon}{panel}</span>;
}
