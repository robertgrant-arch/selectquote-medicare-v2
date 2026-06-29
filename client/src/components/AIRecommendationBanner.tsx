import { Sparkles, CheckCircle2, ChevronDown, ChevronUp, Info, Star } from 'lucide-react';
import { useState } from 'react';
import type { MedicarePlan } from '@/lib/types';
import type { PlanScore, ScoringModel } from '@/lib/aiRecommendationEngine';

interface Props {
  plan: MedicarePlan;
  score: PlanScore;
  model: ScoringModel;
  onViewPlan?: () => void;
}

export default function AIRecommendationBanner({ plan, score, model, onViewPlan }: Props) {
  const [expanded, setExpanded] = useState(false);

  const eb = plan.extraBenefits || {};
  const benefitCount = Object.values(eb).filter(b => b?.covered).length;
  const totalCost = plan.premium * 12 + ((plan as any).estAnnualDrugCost ?? 0);

  const carrierInitials = plan.carrier
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();

  const stars = plan.starRating.overall;

  const drugCost = (plan as any).estAnnualDrugCost ?? 0;
  const sources = model.sources || [];
  const breakdownItems = (score.breakdown || []).filter(b => b.weight > 0);

  return (
    <div
      style={{
        backgroundColor: '#1C3A48',
        borderRadius: '10px',
        marginBottom: '24px',
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(11,27,36,0.12)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Header bar */}
      <div style={{ background: 'rgba(255,255,255,0.08)', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Sparkles size={14} style={{ color: 'rgba(255,255,255,0.55)' }} />
        <span style={{ color: '#fff', fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>
          AI Recommended Plan
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginLeft: 'auto', fontFamily: "'DM Sans', sans-serif" }}>
          Powered by {model.name} Model &middot; Score {score.score.toFixed(1)}/100
        </span>
      </div>

      {/* Main content */}
      <div style={{ padding: '20px', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Carrier logo */}
        <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '16px', fontFamily: "'DM Sans', sans-serif" }}>{carrierInitials}</span>
        </div>

        {/* Plan info */}
        <div style={{ flex: 1 }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", marginBottom: '2px' }}>{plan.carrier}</div>
          <div style={{ color: 'white', fontSize: '16px', fontWeight: 700, fontFamily: "'DM Sans', sans-serif", marginBottom: '8px' }}>{plan.planName}</div>

          {/* Stars */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '10px' }}>
            {[1,2,3,4,5].map(s => (
              <Star key={s} size={14} fill={s <= stars ? '#FCD34D' : 'transparent'} stroke={s <= stars ? '#FCD34D' : 'rgba(255,255,255,0.3)'} />
            ))}
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', marginLeft: '6px', fontFamily: "'DM Sans', sans-serif" }}>&nbsp;{stars} CMS Stars</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginLeft: '8px', fontFamily: "'DM Sans', sans-serif" }}>&nbsp;{plan.planType}</span>
          </div>

          {/* Reasons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
            {score.reasons.map((reason, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={13} style={{ color: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}>{reason}</span>
              </div>
            ))}
          </div>

          {/* Key numbers */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {[
              { label: 'Monthly Premium', value: plan.premium === 0 ? '$0' : `$${plan.premium}/mo` },
              { label: 'Est. Annual Cost', value: `$${totalCost.toLocaleString()}/yr` },
              { label: 'Max Out-of-Pocket', value: `$${plan.maxOutOfPocket.toLocaleString()}` },
              { label: 'Est. Drug Cost', value: drugCost === 0 ? 'N/A' : `$${drugCost.toLocaleString()}/yr` },
              { label: 'Extra Benefits', value: `${benefitCount}/8` },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px 14px', minWidth: '120px' }}>
                <div style={{ color: 'white', fontSize: '16px', fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>{value}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {onViewPlan && (
              <button onClick={onViewPlan} style={{ background: 'rgba(255,255,255,0.95)', color: '#1C3A48', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: 700, fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
                View Plan
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '10px 16px', fontWeight: 600, fontSize: '12px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? 'Hide' : 'Why this plan?'}
            </button>
          </div>

          {/* Score breakdown (expanded) */}
          {expanded && (
            <div style={{ marginTop: '16px', background: 'rgba(11,27,36,0.25)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px', fontFamily: "'DM Sans', sans-serif" }}>
                AI Score Breakdown &mdash; {model.name} Model
              </div>
              {breakdownItems.map(b => {
                const pct = b.weight > 0 ? (b.contribution / b.weight) * 100 : 0;
                return (
                  <div key={b.factor} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}>{b.factor}</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: "'DM Sans', sans-serif" }}>{b.weight}% weight</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: pct >= 70 ? 'rgba(255,255,255,0.55)' : pct >= 40 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)', borderRadius: '2px', width: `${Math.min(100, pct)}%`, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                );
              })}

              <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <Info size={14} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0, marginTop: '1px' }} />
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', lineHeight: '1.5', fontFamily: "'DM Sans', sans-serif" }}>
                  This recommendation is based on your entered doctors and medications. Model weights can be adjusted in the Admin panel. This is not a substitute for advice from a licensed insurance agent.
                </span>
              </div>

              {sources.length > 0 && (
                <div style={{ marginTop: '10px', color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: "'DM Sans', sans-serif" }}>
                  Research sources: {sources.slice(0, 3).join(' · ')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
