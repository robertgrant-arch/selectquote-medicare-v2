import { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Star, Sparkles } from 'lucide-react';
import type { MedicarePlan, PlanDoctorNetworkStatus } from '@/lib/types';
import type { PlanScore } from '@/lib/aiRecommendationEngine';

interface Props {
  plans: PlanScore[] | MedicarePlan[];
  selectedIndex: number | null;
  isOpen: boolean;
  onClose: () => void;
  onChangeIndex: (idx: number) => void;
  onEnroll: (plan: MedicarePlan) => void;
  doctorNetworkMap?: Record<string, PlanDoctorNetworkStatus>;
  doctors?: { name: string }[];
  isAiContext?: boolean;
}

function getPlan(item: PlanScore | MedicarePlan): MedicarePlan {
  return 'plan' in item ? (item as PlanScore).plan : (item as MedicarePlan);
}
function getScore(item: PlanScore | MedicarePlan): number | null {
  return 'score' in item ? (item as PlanScore).score : null;
}
function getReasons(item: PlanScore | MedicarePlan): string[] {
  return 'reasons' in item ? (item as PlanScore).reasons : [];
}

const BENEFIT_LABELS: Record<string, string> = {
  dental: 'Dental', vision: 'Vision', hearing: 'Hearing', otc: 'OTC',
  fitness: 'Fitness', transportation: 'Transportation', telehealth: 'Telehealth', meals: 'Meals',
};

export default function PlanDetailsModal({
  plans, selectedIndex, isOpen, onClose, onChangeIndex, onEnroll,
  doctorNetworkMap = {}, doctors = [], isAiContext = false,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && selectedIndex !== null && selectedIndex > 0) onChangeIndex(selectedIndex - 1);
      if (e.key === 'ArrowRight' && selectedIndex !== null && selectedIndex < plans.length - 1) onChangeIndex(selectedIndex + 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, selectedIndex, plans.length, onClose, onChangeIndex]);

  if (!isOpen || selectedIndex === null) return null;

  const item = plans[selectedIndex];
  const plan = getPlan(item);
  const score = getScore(item);
  const reasons = getReasons(item);
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex < plans.length - 1;
  const net = doctorNetworkMap[plan.planId];
  const eb = plan.extraBenefits || {};
  const benefitKeys = Object.keys(BENEFIT_LABELS);
  const drugCost = (plan as any).estimatedAnnualDrugCost ?? 0;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,27,36,0.5)', backdropFilter: 'blur(3px)', padding: '16px' }}
      onClick={onClose}
    >
      <div
        style={{ position: 'relative', background: 'white', borderRadius: '10px', width: '100%', maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(11,27,36,0.16)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ backgroundColor: '#00353E', borderRadius: '10px 10px 0 0', padding: '20px 24px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              {isAiContext && score !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Sparkles size={14} style={{ color: '#FCD34D' }} />
                  <span style={{ color: '#FCD34D', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>AI Recommended</span>
                  <span style={{ background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', marginLeft: '4px' }}>Score {score.toFixed(0)}/100</span>
                </div>
              )}
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>{plan.carrier}</div>
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{plan.planName}</h2>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' as const }}>
                <span style={{ background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '11px', padding: '2px 8px', borderRadius: '12px' }}>{plan.planType}</span>
                {[1,2,3,4,5].map(st => <Star key={st} size={11} style={{ color: st <= Math.round(plan.starRating.overall) ? '#FCD34D' : 'rgba(255,255,255,0.3)' }} fill={st <= Math.round(plan.starRating.overall) ? '#FCD34D' : 'none'} />)}
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>{plan.starRating.overall} stars</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: 'white', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {/* AI Reasons */}
          {isAiContext && reasons.length > 0 && (
            <div style={{ background: '#E6F7F9', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', borderLeft: '3px solid #00353E', border: '1px solid #E8E8E8' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#00353E', marginBottom: '8px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Why AI Recommends This Plan</div>
              {reasons.map((r, i) => <div key={i} style={{ fontSize: '13px', color: '#303030', marginBottom: '4px' }}>• {r}</div>)}
            </div>
          )}

          {/* Cost Grid */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#00353E', marginBottom: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Costs</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { label: 'Monthly Premium', value: plan.premium === 0 ? '$0' : `$${plan.premium}`, highlight: plan.premium === 0 },
                { label: 'Deductible', value: `$${plan.deductible}` },
                { label: 'Max Out-of-Pocket', value: `$${plan.maxOutOfPocket.toLocaleString()}` },
                { label: 'Est. Drug Cost/yr', value: drugCost === 0 ? 'N/A' : `$${drugCost.toLocaleString()}`, warn: drugCost > 500 },
                { label: 'Drug Deductible', value: plan.rxDrugs?.deductible || '$0' },
                { label: 'Extra Benefits', value: `${Object.values(eb).filter((b: any) => b?.covered).length}/8` },
              ].map(({ label, value, highlight, warn }) => (
                <div key={label} style={{ background: '#F9F9F9', borderRadius: '10px', padding: '12px', textAlign: 'center' as const }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: highlight ? '#059669' : warn ? '#B45309' : '#00353E' }}>{value}</div>
                  <div style={{ fontSize: '10px', color: '#8C8C8C', marginTop: '2px' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Two-column: Copays + Rx */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#00353E', marginBottom: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Copays</h3>
              {[
                ['Primary Care', plan.copays.primaryCare],
                ['Specialist', plan.copays.specialist],
                ['Urgent Care', plan.copays.urgentCare],
                ['Emergency', plan.copays.emergency],
                ['Inpatient Hospital', plan.copays.inpatientHospital],
                ['Outpatient Surgery', plan.copays.outpatientSurgery],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(226,234,237,0.6)', fontSize: '13px' }}>
                  <span style={{ color: '#8C8C8C' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: '#00353E' }}>{val}</span>
                </div>
              ))}
            </div>
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#00353E', marginBottom: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Rx Drug Coverage</h3>
              {[
                ['Tier 1 (Generic)', plan.rxDrugs?.tier1 || 'N/A'],
                ['Tier 2 (Pref Brand)', plan.rxDrugs?.tier2 || 'N/A'],
                ['Tier 3 (Non-Pref)', plan.rxDrugs?.tier3 || 'N/A'],
                ['Tier 4 (Specialty)', plan.rxDrugs?.tier4 || 'N/A'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(226,234,237,0.6)', fontSize: '13px' }}>
                  <span style={{ color: '#8C8C8C' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: '#00353E' }}>{val}</span>
                </div>
              ))}
              {plan.rxDrugs?.gap && <div style={{ fontSize: '11px', color: '#059669', marginTop: '8px', fontWeight: 600 }}>✓ Gap Coverage Included</div>}
            </div>
          </div>

          {/* Doctor Network */}
          {doctors.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#00353E', marginBottom: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Your Doctors</h3>
              <div style={{ background: '#E6F7F9', border: '1px solid #E8E8E8', borderRadius: '10px', padding: '12px' }}>
                {net ? net.doctors.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < net.doctors.length - 1 ? '1px solid #E0F2FE' : 'none', fontSize: '13px' }}>
                    <span style={{ color: '#303030', fontWeight: 500 }}>{d.doctorName}</span>
                    {d.inNetwork
                      ? <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}><CheckCircle2 size={13} /> In Network</span>
                      : <span style={{ color: '#DC2626', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}><XCircle size={13} /> Out of Network</span>}
                  </div>
                )) : <div style={{ fontSize: '13px', color: '#8C8C8C' }}>Checking network status...</div>}
                {net && <div style={{ fontSize: '12px', color: '#059669', fontWeight: 700, marginTop: '8px' }}>{net.inNetworkCount}/{net.inNetworkCount + net.outOfNetworkCount} Doctors In Network</div>}
              </div>
            </div>
          )}

          {/* Extra Benefits */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#00353E', marginBottom: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Extra Benefits</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {benefitKeys.map(key => {
                const benefit = (eb as any)[key];
                const covered = benefit?.covered;
                return (
                  <div key={key} style={{ background: covered ? '#F0FDF4' : '#F9FAFB', border: `1px solid ${covered ? '#86EFAC' : '#E8E8E8'}`, borderRadius: '8px', padding: '8px', textAlign: 'center' as const }}>
                    <div style={{ fontSize: '16px', marginBottom: '2px' }}>{covered ? '✓' : '✕'}</div>
                    <div style={{ fontSize: '11px', color: covered ? '#059669' : '#8C8C8C', fontWeight: 600 }}>{BENEFIT_LABELS[key]}</div>
                    {covered && benefit?.details && <div style={{ fontSize: '10px', color: '#8C8C8C', marginTop: '2px' }}>{benefit.details}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plan Info */}
          <div style={{ background: '#F9F9F9', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
              {[
                ['Contract ID', `${plan.contractId}/${plan.planId}`],
                ['Network Size', `${plan.networkSize?.toLocaleString() || 'N/A'}+ providers`],
                ['Enrollment Period', plan.enrollmentPeriod],
                ['Effective Date', plan.effectiveDate],
              ].map(([label, val]) => (
                <div key={label}>
                  <span style={{ color: '#8C8C8C' }}>{label}: </span>
                  <span style={{ color: '#303030', fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div style={{ position: 'sticky', bottom: 0, background: 'white', borderTop: '1px solid #E8E8E8', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderRadius: '0 0 10px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => hasPrev && onChangeIndex(selectedIndex! - 1)}
              disabled={!hasPrev}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #E8E8E8', background: hasPrev ? 'white' : '#F9FAFB', color: hasPrev ? '#00353E' : '#D1D5DB', fontSize: '13px', fontWeight: 600, cursor: hasPrev ? 'pointer' : 'not-allowed' }}
            >
              <ChevronLeft size={15} /> Previous
            </button>
            <span style={{ fontSize: '12px', color: '#8C8C8C' }}>{selectedIndex! + 1} of {plans.length}</span>
            <button
              onClick={() => hasNext && onChangeIndex(selectedIndex! + 1)}
              disabled={!hasNext}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #E8E8E8', background: hasNext ? 'white' : '#F9FAFB', color: hasNext ? '#00353E' : '#D1D5DB', fontSize: '13px', fontWeight: 600, cursor: hasNext ? 'pointer' : 'not-allowed' }}
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{ padding: '10px 20px', borderRadius: '8px', border: '1.5px solid #E8E8E8', background: 'white', color: '#303030', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Back to Plans
            </button>
            <button
              onClick={() => { onEnroll(plan); onClose(); }}
              style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#00353E', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
            >
              Enroll Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
