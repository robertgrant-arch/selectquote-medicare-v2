import { scoreTierFor } from '../lib/matchScoreLabels';

interface Props {
  score: number;
  variant?: 'full' | 'compact' | 'inline';
  onWhyClick?: () => void;
}

export default function MatchScoreBadge({ score, variant = 'full', onWhyClick }: Props) {
  const tier = scoreTierFor(score);
  const n = Math.round(score);

  if (variant === 'compact') {
    return (
      <span aria-label={`Match Score ${n} — ${tier.label}`} style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:'999px', backgroundColor:tier.bgColor, border:`1px solid ${tier.borderColor}`, fontSize:'11px', fontWeight:800, color:tier.color, whiteSpace:'nowrap' }}>
        {n} · {tier.label}
      </span>
    );
  }

  if (variant === 'inline') {
    return (
      <span aria-label={`Match Score ${n} out of 100 — ${tier.label}`} style={{ fontSize:'13px', fontWeight:700, color:tier.color }}>
        {n}
        <span style={{ fontWeight:400, color:'#6B7280', marginLeft:'4px', fontSize:'11px' }}>— {tier.label}</span>
        {onWhyClick && (
          <button onClick={onWhyClick} aria-label="Why this score?" style={{ marginLeft:'6px', background:'none', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:600, color:'#1B365D', textDecoration:'underline', padding:0 }}>
            Why?
          </button>
        )}
      </span>
    );
  }

  return (
    <div style={{ display:'inline-flex', flexDirection:'column', alignItems:'center', padding:'8px 14px', borderRadius:'12px', backgroundColor:tier.bgColor, border:`1px solid ${tier.borderColor}`, minWidth:'80px', textAlign:'center' }} aria-label={`Match Score ${n} out of 100 — ${tier.label}`}>
      <span style={{ fontSize:'26px', fontWeight:800, color:tier.color, lineHeight:1 }}>{n}</span>
      <span style={{ fontSize:'9px', fontWeight:700, color:tier.color, marginTop:'3px', letterSpacing:'0.3px' }}>MATCH SCORE</span>
      <span style={{ fontSize:'10px', color:tier.color, opacity:0.9, marginTop:'3px', lineHeight:1.3 }}>{tier.label}</span>
      {onWhyClick && (
        <button onClick={onWhyClick} aria-label="Explain this match score" style={{ marginTop:'6px', background:'none', border:'none', cursor:'pointer', fontSize:'10px', fontWeight:600, color:'#1B365D', textDecoration:'underline', padding:0 }}>
          Why this score?
        </button>
      )}
    </div>
  );
}
