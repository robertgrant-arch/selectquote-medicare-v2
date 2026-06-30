import { useState } from 'react';
import { Sparkles, Star, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { MedicarePlan, PlanDoctorNetworkStatus } from '@/lib/types';
import type { PlanScore, ScoringModel } from '@/lib/aiRecommendationEngine';

interface Props {
  scores: PlanScore[];
  model: ScoringModel;
  doctorNetworkMap: Record<string, PlanDoctorNetworkStatus>;
  doctors: { name: string }[];
  onEnroll: (plan: MedicarePlan) => void;
  onOpenDetails: (plans: PlanScore[], index: number) => void;
}

export default function AITop3Cards({ scores, model, doctorNetworkMap, doctors, onEnroll, onOpenDetails }: Props) {
  const top3 = scores.slice(0, 3);

  // All 3 "Why this plan?" breakdowns start expanded by default
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set([0, 1, 2]));

  const toggleCard = (idx: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const RANK_LABELS = ['#1 Best Match', '#2 Runner Up', '#3 Top Pick'];
  const RANK_COLORS = ['#00353E', '#303030', '#8C8C8C'];

  if (top3.length === 0) return null;

  return (
    <>
      {/* Header */}
      <div style={{ backgroundColor: '#00353E', borderRadius: '10px 10px 0 0', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: 0 }}>
        <Sparkles size={14} style={{ color: 'rgba(255,255,255,0.55)' }} />
        <span style={{ color: '#fff', fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' as const, fontFamily: "'Montserrat', sans-serif" }}>AI-Recommended Plans</span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginLeft: 'auto', fontFamily: "'Montserrat', sans-serif" }}>{model.name} model</span>
      </div>

      {/* 3-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0', backgroundColor: '#F9F9F9', border: '1px solid #E8E8E8', borderTop: 'none', overflow: 'hidden', marginBottom: '24px' }}>
        {top3.map((s, idx) => {
          const plan = s.plan;
          const eb = plan.extraBenefits || ({} as Record<string, { covered?: boolean }>);
          const benefitCount = Object.values(eb).filter((b: any) => b?.covered).length;
          const drugCost = (plan as any).estimatedAnnualDrugCost ?? 0;
          const net = doctorNetworkMap[plan.planId];
          const stars = plan.starRating.overall;
          const isExpanded = expandedCards.has(idx);

          return (
            <div key={plan.id} style={{ padding: '16px', borderRight: idx < 2 ? '1px solid #E8E8E8' : 'none', background: idx === 0 ? '#E6F7F9' : 'white', position: 'relative' }}>
              {/* Rank badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <span style={{ background: RANK_COLORS[idx], color: 'white', fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.02em', textTransform: 'uppercase' as const }}>
                  {RANK_LABELS[idx]}
                </span>
                <span style={{ fontSize: '10px', color: '#8C8C8C', marginLeft: 'auto' }}>{s.score.toFixed(0)}/100</span>
              </div>

              {/* Carrier + Plan name */}
              <div style={{ fontSize: '11px', color: '#8C8C8C', fontWeight: 600, marginBottom: '2px' }}>{plan.carrier}</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#00353E', marginBottom: '8px', lineHeight: 1.3 }}>{plan.planName}</div>

              {/* Stars */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '12px' }}>
                {[1,2,3,4,5].map(st => <Star key={st} size={10} style={{ color: st <= Math.round(stars) ? '#FCD34D' : '#E8E8E8' }} fill={st <= Math.round(stars) ? '#FCD34D' : 'none'} />)}
                <span style={{ fontSize: '10px', color: '#8C8C8C', marginLeft: '2px' }}>{stars}</span>
                <span style={{ fontSize: '9px', color: '#303030', marginLeft: '4px', background: '#E6F7F9', padding: '1px 5px', borderRadius: '4px' }}>{plan.planType}</span>
              </div>

              {/* Key numbers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
                <div style={{ background: '#F9F9F9', borderRadius: '8px', padding: '8px', textAlign: 'center' as const }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: plan.premium === 0 ? '#059669' : '#00353E' }}>{plan.premium === 0 ? '$0' : `$${plan.premium}`}</div>
                  <div style={{ fontSize: '9px', color: '#8C8C8C', marginTop: '2px' }}>Monthly Premium</div>
                </div>
                <div style={{ background: '#F9F9F9', borderRadius: '8px', padding: '8px', textAlign: 'center' as const }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#00353E' }}>${plan.maxOutOfPocket.toLocaleString()}</div>
                  <div style={{ fontSize: '9px', color: '#8C8C8C', marginTop: '2px' }}>Max Out-of-Pocket</div>
                </div>
                <div style={{ background: '#F9F9F9', borderRadius: '8px', padding: '8px', textAlign: 'center' as const }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: drugCost >= 70 ? '#B45309' : '#059669' }}>{drugCost === 0 ? 'N/A' : `$${drugCost.toLocaleString()}`}</div>
                  <div style={{ fontSize: '9px', color: '#8C8C8C', marginTop: '2px' }}>Est. Drug Cost/yr</div>
                </div>
                <div style={{ background: '#F9F9F9', borderRadius: '8px', padding: '8px', textAlign: 'center' as const }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#00353E' }}>{benefitCount}/8</div>
                  <div style={{ fontSize: '9px', color: '#8C8C8C', marginTop: '2px' }}>Extra Benefits</div>
                </div>
              </div>

              {/* Doctor Network */}
              {doctors.length > 0 && (
                <div style={{ background: '#E6F7F9', borderRadius: '8px', padding: '8px', marginBottom: '10px', border: '1px solid #E8E8E8' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#00353E', marginBottom: '6px' }}>Your Doctors</div>
                  {net ? net.doctors.map((d, di) => (
                    <div key={di} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', marginBottom: '3px' }}>
                      <span style={{ color: '#303030', fontWeight: 500 }}>{d.doctorName}</span>
                      {d.inNetwork
                        ? <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '2px' }}><CheckCircle2 size={10} /> In Network</span>
                        : <span style={{ color: '#DC2626', display: 'flex', alignItems: 'center', gap: '2px' }}><XCircle size={10} /> Out of Network</span>}
                    </div>
                  )) : <div style={{ fontSize: '10px', color: '#8C8C8C' }}>Checking network...</div>}
                  {net && <div style={{ fontSize: '10px', color: '#059669', fontWeight: 600, marginTop: '4px' }}>{net.inNetworkCount}/{net.inNetworkCount + net.outOfNetworkCount} In Network</div>}
                </div>
              )}

              {/* AI Reasons — always shown in collapsed state as a teaser */}
              {!isExpanded && s.reasons.slice(0, 2).map((r, ri) => (
                <div key={ri} style={{ fontSize: '10px', color: '#303030', marginBottom: '4px', paddingLeft: '8px', borderLeft: '2px solid #00353E' }}>{r}</div>
              ))}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
                <button onClick={() => onEnroll(plan)} style={{ flex: 1, background: '#00353E', color: 'white', border: 'none', borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Enroll Now</button>
                <button
                  onClick={() => onOpenDetails(top3, idx)}
                  style={{ flex: 1, background: 'white', color: '#00353E', border: '1px solid #E8E8E8', borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >Details</button>
              </div>

              {/* "Why this plan?" toggle — starts expanded for all 3 */}
              <button
                onClick={() => toggleCard(idx)}
                style={{ width: '100%', background: 'none', border: 'none', color: '#8C8C8C', fontSize: '10px', cursor: 'pointer', marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {isExpanded ? 'Hide breakdown' : 'Why this plan?'}
              </button>

              {/* Expanded AI Score Breakdown — all 3 open by default */}
              {isExpanded && (
                <div style={{ marginTop: '8px', background: '#F9F9F9', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#00353E', marginBottom: '8px' }}>Why This Plan?</div>

                  {/* All AI reasons */}
                  {s.reasons.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      {s.reasons.map((r, ri) => (
                        <div key={ri} style={{ fontSize: '10px', color: '#303030', marginBottom: '5px', paddingLeft: '8px', borderLeft: '2px solid #00353E', lineHeight: 1.4 }}>{r}</div>
                      ))}
                    </div>
                  )}

                  {/* Score factor bars */}
                  {(s.breakdown || []).filter(b => b.weight > 0).length > 0 && (
                    <>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#8C8C8C', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Score Breakdown</div>
                      {(s.breakdown || []).filter(b => b.weight > 0).map(b => {
                        const pct = b.weight > 0 ? (b.contribution / b.weight) * 100 : 0;
                        return (
                          <div key={b.factor} style={{ marginBottom: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                              <span style={{ color: '#303030' }}>{b.factor}</span>
                              <span style={{ color: '#8C8C8C' }}>{b.weight}%</span>
                            </div>
                            <div style={{ height: '4px', background: '#E8E8E8', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: pct >= 70 ? '#34D399' : pct >= 40 ? '#FCD34D' : '#F87171', borderRadius: '2px', width: `${Math.min(100, pct)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
