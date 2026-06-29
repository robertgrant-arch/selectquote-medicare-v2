import { useState, useMemo } from 'react';
import { Sparkles, FlaskConical, BarChart3, Info, ChevronDown, ChevronUp, Star, CheckCircle2 } from 'lucide-react';
import { scoreAllPlans, MODEL_A_CONFIG, MODEL_B_CONFIG } from '@/lib/aiRecommendationEngine';
import type { ScoringModel, ScoringModelType } from '@/lib/aiRecommendationEngine';
import type { MedicarePlan, RxDrug, Doctor } from '@/lib/types';

interface Props {
  plans: MedicarePlan[];
  rxDrugs?: RxDrug[];
  doctors?: Doctor[];
}

const FACTOR_LABELS: Record<string, string> = {
  drugCost: 'Drug Cost',
  premium: 'Monthly Premium',
  moop: 'Max Out-of-Pocket',
  starRating: 'Star Rating',
  doctorMatch: 'Doctor Network',
  extraBenefits: 'Extra Benefits',
  copayBurden: 'Copays', drugDeductible: 'Drug Deductible',
};

const RESEARCH_SOURCES = [
  { label: 'KFF Medicare Survey 2024', finding: 'Drug cost is #1 plan switching driver (38% of respondents)', weight: 'drugCost: 20%' },
  { label: 'J.D. Power MA Study 2024', finding: 'MOOP and premium are top financial concerns', weight: 'moop: 20%, premium: 15%' },
  { label: 'Commonwealth Fund 2023', finding: 'Star ratings correlate with member satisfaction and care quality', weight: 'starRating: 15%' },
  { label: 'NIH Provider Continuity Study', finding: 'Doctor network access is critical for chronically ill beneficiaries', weight: 'doctorNetwork: 15%' },
  { label: 'CMS Extra Benefits Analysis 2023', finding: 'Dental/vision/OTC benefits increasingly influence plan choice', weight: 'extraBenefits: 10%' },
  { label: 'AHIP Copay Impact Report', finding: 'Specialist and drug copays affect total care cost significantly', weight: 'copays: 5%' },
];

export default function AdminAIModels({ plans, rxDrugs = [], doctors = [] }: Props) {
  const [activeModel, setActiveModel] = useState<ScoringModelType>('B');
  const [expandedSource, setExpandedSource] = useState<number | null>(null);
  const [showWeightDetails, setShowWeightDetails] = useState(false);

  const scoresA = useMemo(() => scoreAllPlans(plans, { rxDrugs, doctors }, 'A').slice(0, 5), [plans, rxDrugs, doctors]);
  const scoresB = useMemo(() => scoreAllPlans(plans, { rxDrugs, doctors }, 'B').slice(0, 5), [plans, rxDrugs, doctors]);

  const activeScores = activeModel === 'A' ? scoresA : scoresB;
  const activeConfig = activeModel === 'A' ? MODEL_A_CONFIG : MODEL_B_CONFIG;

  const modelALabel = 'Model A — Manual Weights';
  const modelBLabel = 'Model B — Research-Backed';

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1C3A48, #237A92)' }}>
          <Sparkles size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#1C3A48' }}>AI Recommendation Engine</h2>
          <p className="text-xs text-gray-500">Compare Model A (manual) vs Model B (research-backed) scoring</p>
        </div>
      </div>

      {/* Model Toggle */}
      <div className="flex gap-3 mb-6">
        {(['A', 'B'] as ScoringModelType[]).map((model) => (
          <button
            key={model}
            onClick={() => setActiveModel(model)}
            className="flex-1 rounded-xl p-4 border-2 text-left transition-all"
            style={{
              borderColor: activeModel === model ? '#1C3A48' : '#E2EAED',
              backgroundColor: activeModel === model ? '#EEF2FF' : 'white',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              {model === 'A' ? <BarChart3 size={16} style={{ color: '#1C3A48' }} /> : <FlaskConical size={16} style={{ color: '#2563EB' }} />}
              <span className="text-sm font-bold" style={{ color: '#1C3A48' }}>
                {model === 'A' ? modelALabel : modelBLabel}
              </span>
              {activeModel === model && <CheckCircle2 size={14} style={{ color: '#1C3A48' }} className="ml-auto" />}
            </div>
            <p className="text-xs text-gray-500">
              {model === 'A'
                ? 'Simple configurable weights. Good baseline.'
                : 'Weights derived from KFF, J.D. Power, Commonwealth Fund & NIH studies.'}
            </p>
          </button>
        ))}
      </div>

      {/* Weight Breakdown */}
      <div className="rounded-xl border mb-6" style={{ borderColor: '#E8F2F5' }}>
        <button
          className="w-full flex items-center justify-between p-4"
          onClick={() => setShowWeightDetails(!showWeightDetails)}
        >
          <span className="text-sm font-semibold" style={{ color: '#1C3A48' }}>Factor Weights — {activeModel === 'A' ? 'Manual' : 'Research-Backed'}</span>
          {showWeightDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showWeightDetails && (
          <div className="px-4 pb-4 space-y-3">
            {Object.entries(activeConfig.weights).map(([factor, weight]) => {
              const pct = Math.round((weight as number) * 100);
              return (
                <div key={factor}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{FACTOR_LABELS[factor] || factor}</span>
                    <span className="font-bold" style={{ color: '#1C3A48' }}>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: '#E8F2F5' }}>
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${pct}%`, background: pct >= 20 ? '#1C3A48' : pct >= 15 ? '#2563EB' : '#60A5FA' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Research Sources (Model B only) */}
      {activeModel === 'B' && (
        <div className="rounded-xl border mb-6 overflow-hidden" style={{ borderColor: '#E8F2F5' }}>
          <div className="p-4 flex items-center gap-2" style={{ backgroundColor: '#F0F4FF' }}>
            <FlaskConical size={14} style={{ color: '#2563EB' }} />
            <span className="text-sm font-semibold" style={{ color: '#1C3A48' }}>Research Foundation</span>
          </div>
          {RESEARCH_SOURCES.map((src, i) => (
            <div key={i} className="border-t" style={{ borderColor: '#E8F2F5' }}>
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                onClick={() => setExpandedSource(expandedSource === i ? null : i)}
              >
                <span className="text-xs font-semibold text-gray-700">{src.label}</span>
                {expandedSource === i ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {expandedSource === i && (
                <div className="px-4 pb-3 space-y-1">
                  <p className="text-xs text-gray-600">{src.finding}</p>
                  <p className="text-xs font-semibold" style={{ color: '#2563EB' }}>Informs: {src.weight}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Top Plan Rankings */}
      <div className="rounded-xl border" style={{ borderColor: '#E8F2F5' }}>
        <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: '#E8F2F5', backgroundColor: '#F7F8FA' }}>
          <Star size={14} style={{ color: '#1C3A48' }} />
          <span className="text-sm font-semibold" style={{ color: '#1C3A48' }}>Top 5 Ranked Plans</span>
          <span className="ml-auto text-xs text-gray-400">Using {activeModel === 'A' ? 'Manual' : 'Research'} weights</span>
        </div>
        {activeScores.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">No plans loaded. Enter a ZIP code on the plans page first.</div>
        )}
        {activeScores.map((ps, idx) => (
          <div key={ps.plan.id} className="flex items-center gap-3 px-4 py-3 border-t" style={{ borderColor: '#E8F2F5' }}>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: idx === 0 ? 'linear-gradient(135deg, #1C3A48, #237A92)' : '#E8F2F5', color: idx === 0 ? 'white' : '#1C3A48' }}
            >
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: '#1C3A48' }}>{ps.plan.planName}</p>
              <p className="text-xs text-gray-500">{ps.plan.carrier} · ${ps.plan.premium}/mo · ⭐ {ps.plan.starRating.overall}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold" style={{ color: '#1C3A48' }}>{Math.round(ps.totalScore)}%</p>
              <p className="text-xs text-gray-400">score</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: '#FFFBEB' }}>
        <Info size={13} style={{ color: '#D97706', marginTop: 1 }} />
        <p className="text-xs text-amber-700">AI recommendations are not a substitute for advice from a licensed Medicare insurance agent. Model weights are configurable by admin.</p>
      </div>
    </div>
  );
}
