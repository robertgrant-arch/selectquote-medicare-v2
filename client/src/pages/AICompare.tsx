/**
 * AI Plan Compare Page — 3-Plan Side-by-Side
 * Design: Bold Civic Design | Primary: #00353E | CTA: #00353E
 *
 * Performance optimizations:
 * 1. Side-by-side comparison table renders INSTANTLY from client-side plan data
 * 2. Claude claude-3-5-haiku-20241022 (2-3x faster than Sonnet)
 * 3. Streaming SSE — AI text appears token-by-token as Claude generates it
 * 4. localStorage cache keyed by sorted plan IDs — instant replay for same trio
 * 5. Progressive UX — table shows immediately, AI streams below
 */

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Sparkles,
  ChevronDown,
  AlertCircle,
  RotateCcw,
  Star,
  RefreshCw,
  Zap,
  Clock,
  Info,
  MessageSquare,
} from "lucide-react";
import { Streamdown } from "streamdown";
import Header from "@/components/Header";
import CarrierLogo from "@/components/CarrierLogo";
import StarRating from "@/components/StarRating";
import type { MedicarePlan } from "@/lib/types";
import { useQuoteSession } from "@/features/quote-session/hooks/useQuoteSession";

// ── sessionStorage cache helpers ─────────────────────────────────────────────
// sessionStorage (tab-scoped) instead of localStorage — cleared on tab close.

const CACHE_VERSION = "v3";

function getCacheKey(ids: string[], personalized = false): string {
  return `medicare-compare-${CACHE_VERSION}-${[...ids].sort().join("__")}${personalized ? '-phi' : ''}`;
}

interface CachedResult {
  analysis: string;
  generatedAt: string;
  planIds: string[];
}

function loadCache(ids: string[], personalized = false): CachedResult | null {
  try {
    const raw = sessionStorage.getItem(getCacheKey(ids, personalized));
    if (!raw) return null;
    return JSON.parse(raw) as CachedResult;
  } catch {
    return null;
  }
}

function saveCache(ids: string[], result: CachedResult, personalized = false): void {
  try {
    sessionStorage.setItem(getCacheKey(ids, personalized), JSON.stringify(result));
  } catch {
    // ignore storage errors
  }
}

function clearCache(ids: string[], personalized = false): void {
  try {
    sessionStorage.removeItem(getCacheKey(ids, personalized));
  } catch {
    // ignore
  }
}

// ── Plan normalizer (strips extra fields for API) ─────────────────────────────

function normalizePlan(p: MedicarePlan) {
  return {
    id: p.id,
    carrier: p.carrier,
    planName: p.planName,
    planType: p.planType,
    snpType: p.snpType,
    premium: p.premium,
    deductible: p.deductible,
    maxOutOfPocket: p.maxOutOfPocket,
    partBPremiumReduction: p.partBPremiumReduction,
    starRating: { overall: p.starRating.overall },
    copays: {
      primaryCare: p.copays.primaryCare,
      specialist: p.copays.specialist,
      urgentCare: p.copays.urgentCare,
      emergency: p.copays.emergency,
      inpatientHospital: p.copays.inpatientHospital,
      outpatientSurgery: p.copays.outpatientSurgery,
    },
    rxDrugs: {
      tier1: p.rxDrugs.tier1,
      tier2: p.rxDrugs.tier2,
      tier3: p.rxDrugs.tier3,
      tier4: p.rxDrugs.tier4,
      deductible: p.rxDrugs.deductible,
      gap: p.rxDrugs.gap,
    },
    extraBenefits: {
      dental: { covered: p.extraBenefits.dental.covered, details: p.extraBenefits.dental.details, annualLimit: p.extraBenefits.dental.annualLimit },
      vision: { covered: p.extraBenefits.vision.covered, details: p.extraBenefits.vision.details, annualLimit: p.extraBenefits.vision.annualLimit },
      hearing: { covered: p.extraBenefits.hearing.covered, details: p.extraBenefits.hearing.details, annualLimit: p.extraBenefits.hearing.annualLimit },
      otc: { covered: p.extraBenefits.otc.covered, details: p.extraBenefits.otc.details, annualLimit: p.extraBenefits.otc.annualLimit },
      fitness: { covered: p.extraBenefits.fitness.covered, details: p.extraBenefits.fitness.details },
      transportation: { covered: p.extraBenefits.transportation.covered, details: p.extraBenefits.transportation.details },
      telehealth: { covered: p.extraBenefits.telehealth.covered, details: p.extraBenefits.telehealth.details },
      meals: { covered: p.extraBenefits.meals.covered, details: p.extraBenefits.meals.details },
    },
    networkSize: p.networkSize,
    enrollmentPeriod: p.enrollmentPeriod,
    effectiveDate: p.effectiveDate,
    isBestMatch: p.isBestMatch,
    isMostPopular: p.isMostPopular,
    isNewPlan: p.isNewPlan,
    contractId: p.contractId,
    planId: p.planId,
  };
}

// ── Plan Selector Dropdown ────────────────────────────────────────────────────

interface PlanSelectorProps {
  label: string;
  sublabel: string;
  value: string;
  onChange: (id: string) => void;
  excludeIds?: string[];
  accentColor: string;
  allPlans: MedicarePlan[];
}

function PlanSelector({ label, sublabel, value, onChange, excludeIds = [], accentColor, allPlans }: PlanSelectorProps) {
  const [open, setOpen] = useState(false);
  const selectedPlan = allPlans.find((p) => p.id === value);

  const grouped = useMemo(() => {
    const carriers = Array.from(new Set(allPlans.map((p) => p.carrier)));
    return carriers.map((carrier) => ({
      carrier,
      plans: allPlans.filter((p) => p.carrier === carrier && !excludeIds.includes(p.id)),
    }));
  }, [excludeIds, allPlans]);

  // Close on outside click
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: accentColor }}>
        {label}
      </div>
      <div className="text-xs text-gray-500 mb-2">{sublabel}</div>

      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left border-2 rounded-xl p-4 transition-all bg-white"
        style={{
          borderColor: open ? accentColor : "#E8E8E8",
          boxShadow: open ? `0 0 0 3px ${accentColor}20` : "none",
        }}
      >
        {selectedPlan ? (
          <div className="flex items-center gap-3">
            <CarrierLogo carrier={selectedPlan.carrier} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-gray-900 truncate">{selectedPlan.planName}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: "#E6F7F9",
                    color: "#00353E",
                  }}
                >
                  {selectedPlan.planType}
                </span>
                <span className="text-xs text-gray-500">
                  {selectedPlan.premium === 0 ? "$0/mo" : `$${selectedPlan.premium}/mo`}
                </span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-500">{selectedPlan.starRating.overall}★</span>
              </div>
            </div>
            <ChevronDown
              size={16}
              className="text-gray-400 shrink-0 transition-transform"
              style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Select a plan...</span>
            <ChevronDown size={16} className="text-gray-400" />
          </div>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
          {grouped.map(({ carrier, plans }) =>
            plans.length === 0 ? null : (
              <div key={carrier}>
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-100">
                  {carrier}
                </div>
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => {
                      onChange(plan.id);
                      setOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                    style={{ backgroundColor: plan.id === value ? "#E6F7F9" : undefined }}
                  >
                    <div className="text-sm font-semibold text-gray-800 leading-snug">{plan.planName}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: "#E6F7F9",
                          color: "#00353E",
                        }}
                      >
                        {plan.planType}
                      </span>
                      <span className="text-xs text-gray-500">
                        {plan.premium === 0 ? "$0/mo" : `$${plan.premium}/mo`}
                      </span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{plan.starRating.overall}★</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">MOOP: ${plan.maxOutOfPocket.toLocaleString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Plan Mini Card ────────────────────────────────────────────────────────────

function PlanMiniCard({ plan, label, color }: { plan: MedicarePlan; label: string; color: string }) {
  return (
    <div className="flex-1 bg-white rounded-xl border-2 p-4 shadow-sm min-w-0" style={{ borderColor: color }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color }}>
        {label}
      </div>
      <div className="flex items-center gap-2 mb-3">
        <CarrierLogo carrier={plan.carrier} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-900 leading-snug truncate">{plan.planName}</div>
          <div className="text-xs text-gray-500 truncate">{plan.carrier}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: "#E6F7F9",
            color: "#00353E",
          }}
        >
          {plan.planType}
        </span>
        <StarRating rating={plan.starRating.overall} size={11} />
      </div>
      <div className="flex items-center gap-3 mt-2">
        <div>
          <div className="text-lg font-bold" style={{ color: plan.premium === 0 ? "#00353E" : "#1F2937" }}>
            {plan.premium === 0 ? "$0" : `$${plan.premium}`}
          </div>
          <div className="text-[10px] text-gray-500">/month</div>
        </div>
        <div className="w-px h-8 bg-gray-200" />
        <div>
          <div className="text-sm font-bold text-gray-700">${plan.maxOutOfPocket.toLocaleString()}</div>
          <div className="text-[10px] text-gray-500">max OOP</div>
        </div>
      </div>
    </div>
  );
}

// ── 3-Plan Comparison Table ───────────────────────────────────────────────────

interface PersonalizedTableData {
  drugCosts?: [number | undefined, number | undefined, number | undefined];
  doctorNetwork?: [number | undefined, number | undefined, number | undefined];
  totalDoctors: number;
}

function CompareTable3({ plans, labels, colors, personalized }: {
  plans: [MedicarePlan, MedicarePlan, MedicarePlan];
  labels: [string, string, string];
  colors: [string, string, string];
  personalized?: PersonalizedTableData;
}) {
  const [p1, p2, p3] = plans;

  type RowDef = {
    label: string;
    vals: [string, string, string];
    nums?: [number, number, number];
    lowerIsBetter?: boolean;
    isPersonalized?: boolean;
  };

  const personalizedRows: RowDef[] = [];
  if (personalized) {
    if (personalized.drugCosts?.some(v => v !== undefined)) {
      personalizedRows.push({
        label: '★ Your Drug Cost/yr',
        vals: personalized.drugCosts.map(v => v !== undefined ? `$${v.toLocaleString()}` : '—') as [string, string, string],
        nums: personalized.drugCosts.map(v => v ?? 0) as [number, number, number],
        lowerIsBetter: true,
        isPersonalized: true,
      });
    }
    if (personalized.doctorNetwork?.some(v => v !== undefined) && personalized.totalDoctors > 0) {
      personalizedRows.push({
        label: `★ Doctors In-Network (${personalized.totalDoctors})`,
        vals: personalized.doctorNetwork.map(v =>
          v !== undefined ? `${v}/${personalized.totalDoctors}` : '—'
        ) as [string, string, string],
        nums: personalized.doctorNetwork.map(v => v ?? 0) as [number, number, number],
        lowerIsBetter: false,
        isPersonalized: true,
      });
    }
  }

  const standardRows: RowDef[] = [
    {
      label: "Monthly Premium",
      vals: [
        p1.premium === 0 ? "$0" : `$${p1.premium}`,
        p2.premium === 0 ? "$0" : `$${p2.premium}`,
        p3.premium === 0 ? "$0" : `$${p3.premium}`,
      ],
      nums: [p1.premium, p2.premium, p3.premium],
      lowerIsBetter: true,
    },
    {
      label: "Part B Reduction",
      vals: [
        p1.partBPremiumReduction > 0 ? `+$${p1.partBPremiumReduction}/mo` : "None",
        p2.partBPremiumReduction > 0 ? `+$${p2.partBPremiumReduction}/mo` : "None",
        p3.partBPremiumReduction > 0 ? `+$${p3.partBPremiumReduction}/mo` : "None",
      ],
      nums: [p1.partBPremiumReduction, p2.partBPremiumReduction, p3.partBPremiumReduction],
      lowerIsBetter: false,
    },
    {
      label: "Max Out-of-Pocket",
      vals: [
        `$${p1.maxOutOfPocket.toLocaleString()}`,
        `$${p2.maxOutOfPocket.toLocaleString()}`,
        `$${p3.maxOutOfPocket.toLocaleString()}`,
      ],
      nums: [p1.maxOutOfPocket, p2.maxOutOfPocket, p3.maxOutOfPocket],
      lowerIsBetter: true,
    },
    {
      label: "Annual Deductible",
      vals: [`$${p1.deductible}`, `$${p2.deductible}`, `$${p3.deductible}`],
      nums: [p1.deductible, p2.deductible, p3.deductible],
      lowerIsBetter: true,
    },
    {
      label: "Plan Type",
      vals: [p1.planType, p2.planType, p3.planType],
    },
    {
      label: "CMS Star Rating",
      vals: [`${p1.starRating.overall}/5`, `${p2.starRating.overall}/5`, `${p3.starRating.overall}/5`],
      nums: [p1.starRating.overall, p2.starRating.overall, p3.starRating.overall],
      lowerIsBetter: false,
    },
    {
      label: "Primary Care Copay",
      vals: [p1.copays.primaryCare, p2.copays.primaryCare, p3.copays.primaryCare],
    },
    {
      label: "Specialist Copay",
      vals: [p1.copays.specialist, p2.copays.specialist, p3.copays.specialist],
    },
    {
      label: "Emergency Copay",
      vals: [p1.copays.emergency, p2.copays.emergency, p3.copays.emergency],
    },
    {
      label: "Tier 1 (Generic) Rx",
      vals: [p1.rxDrugs.tier1, p2.rxDrugs.tier1, p3.rxDrugs.tier1],
    },
    {
      label: "Tier 2 (Brand) Rx",
      vals: [p1.rxDrugs.tier2, p2.rxDrugs.tier2, p3.rxDrugs.tier2],
    },
    {
      label: "Gap Coverage",
      vals: [
        p1.rxDrugs.gap ? "✅ Yes" : "❌ No",
        p2.rxDrugs.gap ? "✅ Yes" : "❌ No",
        p3.rxDrugs.gap ? "✅ Yes" : "❌ No",
      ],
    },
    {
      label: "Dental",
      vals: [
        p1.extraBenefits.dental.covered ? "✅ Included" : "❌ None",
        p2.extraBenefits.dental.covered ? "✅ Included" : "❌ None",
        p3.extraBenefits.dental.covered ? "✅ Included" : "❌ None",
      ],
    },
    {
      label: "Vision",
      vals: [
        p1.extraBenefits.vision.covered ? "✅ Included" : "❌ None",
        p2.extraBenefits.vision.covered ? "✅ Included" : "❌ None",
        p3.extraBenefits.vision.covered ? "✅ Included" : "❌ None",
      ],
    },
    {
      label: "OTC Allowance",
      vals: [
        p1.extraBenefits.otc.covered ? `✅ ${p1.extraBenefits.otc.annualLimit || "Yes"}` : "❌ None",
        p2.extraBenefits.otc.covered ? `✅ ${p2.extraBenefits.otc.annualLimit || "Yes"}` : "❌ None",
        p3.extraBenefits.otc.covered ? `✅ ${p3.extraBenefits.otc.annualLimit || "Yes"}` : "❌ None",
      ],
    },
    {
      label: "Fitness Benefit",
      vals: [
        p1.extraBenefits.fitness.covered ? "✅ Included" : "❌ None",
        p2.extraBenefits.fitness.covered ? "✅ Included" : "❌ None",
        p3.extraBenefits.fitness.covered ? "✅ Included" : "❌ None",
      ],
    },
    {
      label: "Transportation",
      vals: [
        p1.extraBenefits.transportation.covered ? "✅ Included" : "❌ None",
        p2.extraBenefits.transportation.covered ? "✅ Included" : "❌ None",
        p3.extraBenefits.transportation.covered ? "✅ Included" : "❌ None",
      ],
    },
    {
      label: "Network Size",
      vals: [
        `${p1.networkSize.toLocaleString()}+`,
        `${p2.networkSize.toLocaleString()}+`,
        `${p3.networkSize.toLocaleString()}+`,
      ],
      nums: [p1.networkSize, p2.networkSize, p3.networkSize],
      lowerIsBetter: false,
    },
  ];

  const rows: RowDef[] = [...personalizedRows, ...standardRows];

  // Determine best value highlight for numeric rows
  function getBestIdx(nums: [number, number, number], lowerIsBetter: boolean): number {
    const best = lowerIsBetter ? Math.min(...nums) : Math.max(...nums);
    return nums.indexOf(best);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-100">
            <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wider w-36">
              Feature
            </th>
            {labels.map((label, i) => (
              <th
                key={label}
                className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider"
                style={{ color: colors[i] }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const bestIdx = row.nums ? getBestIdx(row.nums, row.lowerIsBetter ?? true) : -1;
            return (
              <tr key={row.label} className={row.isPersonalized ? "bg-blue-50/40" : i % 2 === 0 ? "bg-gray-50/50" : "bg-white"}>
                <td className={`py-2.5 pr-4 text-xs font-medium whitespace-nowrap ${row.isPersonalized ? 'text-[#00859A]' : 'text-gray-500'}`}>{row.label}</td>
                {row.vals.map((val, j) => (
                  <td
                    key={j}
                    className="py-2.5 px-3 text-xs font-semibold"
                    style={{
                      color: bestIdx === j && row.nums && row.vals.filter((v, k) => row.vals[k] === val).length < 3
                        ? "#00859A"
                        : "#00353E",
                      backgroundColor: bestIdx === j && row.nums && new Set(row.vals).size > 1
                        ? "#E6F7F9"
                        : undefined,
                    }}
                  >
                    {val}
                    {bestIdx === j && row.nums && new Set(row.vals).size > 1 && (
                      <span className="ml-1 text-[9px] font-bold text-[#00353E] bg-[#E6F7F9] px-1 py-0.5 rounded">BEST</span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type ComparePhase = "idle" | "table-ready" | "streaming" | "done" | "error" | "cached";

const PLAN_COLORS: [string, string, string] = ["#00353E", "#00859A", "#303030"];
const PLAN_LABELS: [string, string, string] = ["Current Plan", "New Plan 1", "New Plan 2"];

export default function AICompare() {
  const [planIds, setPlanIds] = useState<[string, string, string]>(["", "", ""]);
  const [allPlans, setAllPlans] = useState<MedicarePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [doctorNetworkMap, setDoctorNetworkMap] = useState<Record<string, number>>({});

  // Stable zip from URL — no need to re-read on every render
  const [zip] = useState(() => new URLSearchParams(window.location.search).get("zip") || "64106");

  // PHI from quote session (same unified store as Plans page and chat)
  const { session } = useQuoteSession();

  const phiDoctors = useMemo(
    () => (session?.providers ?? []).map(p => ({
      id: p.npi ?? String(p.id),
      name: p.name,
      npi: p.npi ?? '',
      specialty: p.specialty ?? '',
    })),
    [session],
  );

  const phiDrugs = useMemo(
    () => (session?.medications ?? []).map(m => ({ name: m.name, dosage: m.dosage })),
    [session],
  );

  const hasPhiContext = phiDoctors.length > 0 || phiDrugs.length > 0;

  // Fetch plans — re-fetches when phiDrugs loads so estimatedAnnualDrugCost is populated
  useEffect(() => {
    setPlansLoading(true);
    const drugsParam = phiDrugs.length > 0
      ? `&drugs=${encodeURIComponent(JSON.stringify(phiDrugs))}`
      : '';
    fetch(`/api/plans?zip=${zip}${drugsParam}`)
      .then((r) => r.json())
      .then((data: { plans?: MedicarePlan[] }) => {
        setAllPlans(data.plans ?? []);
      })
      .catch(() => setAllPlans([]))
      .finally(() => setPlansLoading(false));
  }, [zip, phiDrugs]);

  // Fetch doctor network coverage for selected plans when PHI doctors are available
  useEffect(() => {
    if (!phiDoctors.length) return;
    const selected = planIds
      .filter(Boolean)
      .map(id => allPlans.find(p => p.id === id))
      .filter((p): p is MedicarePlan => Boolean(p));
    if (!selected.length) return;

    fetch('/api/provider-network', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctors: phiDoctors.map(d => ({ npi: d.npi, name: d.name, specialty: d.specialty })),
        plans: selected.map(p => ({
          planId: p.planId,
          contractId: p.contractId,
          carrier: p.carrier,
          networkSize: p.networkSize,
        })),
        zip,
      }),
    })
      .then(r => r.json())
      .then((data: Record<string, { inNetworkCount: number }>) => {
        setDoctorNetworkMap(
          Object.fromEntries(Object.entries(data).map(([planId, v]) => [planId, v.inNetworkCount]))
        );
      })
      .catch(() => {});
  }, [phiDoctors, planIds, allPlans, zip]);

  // Progressive state
  const [phase, setPhase] = useState<ComparePhase>("idle");
  const [streamedText, setStreamedText] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [fromCache, setFromCache] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // Read chat context flags from URL (set by the chatbot handoff)
  const chatContext = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      fromChat: p.get("from") === "chat",
      hasDoctors: p.get("hasDoctors") === "1",
      hasMeds: p.get("hasMeds") === "1",
    };
  }, []);

  // Pre-fill plan IDs from URL params (e.g. from Plan Recommender or chatbot handoff)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p1 = params.get("plan1") ?? "";
    const p2 = params.get("plan2") ?? "";
    const p3 = params.get("plan3") ?? "";
    if (p1 || p2 || p3) {
      setPlanIds([p1, p2, p3]);
    }
  }, []);

  const plans = planIds.map((id) => allPlans.find((p) => p.id === id) ?? null) as [
    MedicarePlan | null,
    MedicarePlan | null,
    MedicarePlan | null,
  ];

  const allSelected = planIds.every((id) => !!id);
  const allUnique = new Set(planIds.filter(Boolean)).size === planIds.filter(Boolean).length;
  const canCompare = allSelected && allUnique;

  // Personalized data for the comparison table rows (drug cost + doctor network)
  const personalizedTableData = useMemo((): PersonalizedTableData | undefined => {
    if (!hasPhiContext) return undefined;
    return {
      drugCosts: [plans[0], plans[1], plans[2]].map(p =>
        p ? (p as any).estimatedAnnualDrugCost as number | undefined : undefined
      ) as [number | undefined, number | undefined, number | undefined],
      doctorNetwork: [plans[0], plans[1], plans[2]].map(p =>
        p ? doctorNetworkMap[p.planId] : undefined
      ) as [number | undefined, number | undefined, number | undefined],
      totalDoctors: phiDoctors.length,
    };
  }, [hasPhiContext, plans, doctorNetworkMap, phiDoctors.length]);

  const activePlanIds = planIds.filter(Boolean);

  const handleCompare = useCallback(async (forceRefresh = false) => {
    // Strong null guards — all three plans must be fully resolved objects before proceeding.
    // This prevents sending undefined to the server when plans haven't loaded yet
    // (e.g. when URL params pre-fill IDs before the /api/plans fetch completes).
    const p0 = plans[0];
    const p1 = plans[1];
    const p2 = plans[2];
    if (!canCompare || !p0 || !p1 || !p2) return;
    if (typeof p0 !== "object" || typeof p1 !== "object" || typeof p2 !== "object") return;
    if (!p0.id || !p1.id || !p2.id) return;

    // Check cache first (unless forced refresh) — called directly to avoid stale closure
    if (!forceRefresh) {
      const currentCachedResult = loadCache(planIds, hasPhiContext);
      if (currentCachedResult) {
        setStreamedText(currentCachedResult.analysis);
        setGeneratedAt(currentCachedResult.generatedAt);
        setFromCache(true);
        setPhase("cached");
        return;
      }
    }

    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    // STEP 1: Show table instantly (no API wait)
    setPhase("table-ready");
    setStreamedText("");
    setErrorMsg("");
    setFromCache(false);

    // Small delay so the table renders before we start the stream
    await new Promise((r) => setTimeout(r, 50));

    // STEP 2: Start streaming
    setPhase("streaming");

    try {
      // Build userContext from PHI so Claude's analysis references actual medications and doctors
      const userContext = hasPhiContext ? {
        medications: phiDrugs,
        doctors: phiDoctors.map(d => ({ name: d.name, specialty: d.specialty || undefined })),
        drugCosts: Object.fromEntries(
          ([p0, p1, p2] as MedicarePlan[]).flatMap(p => {
            const cost = (p as any).estimatedAnnualDrugCost as number | undefined;
            return cost !== undefined ? [[p.id, cost]] : [];
          })
        ),
        doctorNetwork: Object.fromEntries(
          ([p0, p1, p2] as MedicarePlan[]).flatMap(p => {
            const count = p.planId ? doctorNetworkMap[p.planId] : undefined;
            return count !== undefined ? [[p.planId, count]] : [];
          })
        ),
      } : undefined;

      // Normalize plans — use the guarded local variables (never plans[n] directly)
      const body = JSON.stringify({
        currentPlan: normalizePlan(p0),
        newPlan: normalizePlan(p1),
        thirdPlan: normalizePlan(p2),
        ...(userContext ? { userContext } : {}),
      });

      const response = await fetch("/api/compare-stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API error ${response.status}: ${errText.slice(0, 200)}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      // Track current event type so data lines are only processed for the right event
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            // Record the event type; data lines will be dispatched based on this
            currentEvent = line.slice(7).trim();
            if (currentEvent === "done") {
              // done event — save and exit immediately
              const ts = new Date().toISOString();
              setGeneratedAt(ts);
              setPhase("done");
              saveCache(planIds, { analysis: fullText, generatedAt: ts, planIds }, hasPhiContext);
              return;
            }
            continue;
          }

          if (line.startsWith("data: ")) {
            if (currentEvent === "error") {
              // Error event from server — surface as error, do NOT append to text
              try {
                const errPayload = JSON.parse(line.slice(6));
                const errMsg = typeof errPayload === "string" ? errPayload : JSON.stringify(errPayload);
                throw new Error(errMsg);
              } catch (parseErr) {
                throw parseErr instanceof SyntaxError
                  ? new Error("Comparison failed. Please try again.")
                  : parseErr as Error;
              }
            }

            if (currentEvent === "delta" || currentEvent === "") {
              // Delta chunk — append to streamed text
              try {
                const chunk = JSON.parse(line.slice(6)) as string;
                if (typeof chunk === "string") {
                  fullText += chunk;
                  setStreamedText(fullText);
                }
              } catch {
                // skip malformed JSON
              }
            }
          }
        }
      }

      // Fallback if stream ended without a done event
      const ts = new Date().toISOString();
      setGeneratedAt(ts);
      setPhase("done");
      if (fullText) {
        saveCache(planIds, { analysis: fullText, generatedAt: ts, planIds }, hasPhiContext);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setErrorMsg((err as Error).message || "An unexpected error occurred.");
      setPhase("error");
    }
  }, [plans, planIds, canCompare, hasPhiContext, phiDoctors, phiDrugs, doctorNetworkMap]);

  const handleReset = () => {
    abortRef.current?.abort();
    setPhase("idle");
    setStreamedText("");
    setErrorMsg("");
    setFromCache(false);
    setGeneratedAt("");
  };

  const handleRefresh = () => {
    if (canCompare) clearCache(planIds, hasPhiContext);
    handleCompare(true);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const showResults = phase !== "idle";
  const isStreaming = phase === "streaming";
  const isTableReady = ["table-ready", "streaming", "done", "cached", "error"].includes(phase);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F9F9F9" }}>
      <Header />

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ backgroundColor: "#00353E" }}
      >
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
        <div className="relative container py-10">
          <Link
            href="/plans?zip=64106"
            className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium mb-5 transition-colors no-underline"
          >
            <ArrowLeft size={15} />
            Back to Plans
          </Link>
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            >
              <Sparkles size={24} className="text-white" />
            </div>
            <div>
              <h1
                className="text-3xl lg:text-4xl font-bold text-white mb-2"
                style={{ fontFamily: "'Montserrat', serif" }}
              >
                AI Plan Compare
              </h1>
              <p className="text-white/80 text-base max-w-2xl">
                Select up to three plans to compare side-by-side. The comparison table appears
                instantly — then Claude AI streams a personalized analysis with a clear recommendation.
              </p>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-white/60 text-xs">
                  <Zap size={11} />
                  <span>Instant comparison table</span>
                </div>
                <span className="text-white/30">·</span>
                <div className="flex items-center gap-1.5 text-white/60 text-xs">
                  <Sparkles size={11} />
                  <span>Powered by Claude Haiku</span>
                </div>
                <span className="text-white/30">·</span>
                <div className="flex items-center gap-1.5 text-white/60 text-xs">
                  <Info size={11} />
                  <span>For educational purposes only</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* ── Chat handoff banner ───────────────────────────────────────────── */}
        {chatContext.fromChat && activePlanIds.length > 0 && (
          <div
            className="flex items-start gap-3 rounded-xl border px-4 py-3 mb-6"
            style={{ backgroundColor: "#E6F7F9", borderColor: "#E8E8E8" }}
          >
            <MessageSquare size={16} style={{ color: "#00859A" }} className="mt-0.5 shrink-0" />
            <p className="text-sm" style={{ color: "#00353E" }}>
              <span className="font-semibold">Plans pre-selected from your Medicare AI Advisor conversation.</span>
              {(chatContext.hasDoctors || chatContext.hasMeds) && (
                <span className="text-gray-600">
                  {" "}We've matched plans
                  {chatContext.hasDoctors && chatContext.hasMeds
                    ? " based on your doctors and prescriptions"
                    : chatContext.hasDoctors
                    ? " based on your preferred doctors"
                    : " based on your prescriptions"}
                  .
                </span>
              )}
              {" "}Review the selections below, then click <em>Compare Plans with AI</em>.
            </p>
          </div>
        )}

        {/* ── Plan Selection Card ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#E6F7F9" }}>
              <span className="text-xs font-bold" style={{ color: "#00353E" }}>1</span>
            </div>
            <h2 className="text-base font-bold text-gray-900">Select Three Plans to Compare</h2>
            {canCompare && loadCache(planIds, hasPhiContext) && phase === "idle" && (
              <div className="ml-auto flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full border" style={{ color: "#00859A", backgroundColor: "#E6F7F9", borderColor: "#E8E8E8" }}>
                <Clock size={10} />
                Cached result available
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-5 mb-5">
            <PlanSelector
              label="Your Current Plan"
              sublabel="The plan you're enrolled in now"
              value={planIds[0]}
              onChange={(id) => { setPlanIds([id, planIds[1], planIds[2]]); handleReset(); }}
              excludeIds={[planIds[1], planIds[2]].filter(Boolean)}
              accentColor={PLAN_COLORS[0]}
              allPlans={allPlans}
            />
            <PlanSelector
              label="Plan You're Considering"
              sublabel="A new plan you want to compare"
              value={planIds[1]}
              onChange={(id) => { setPlanIds([planIds[0], id, planIds[2]]); handleReset(); }}
              excludeIds={[planIds[0], planIds[2]].filter(Boolean)}
              accentColor={PLAN_COLORS[1]}
              allPlans={allPlans}
            />
            <PlanSelector
              label="Another Plan You're Considering"
              sublabel="A second alternative to compare"
              value={planIds[2]}
              onChange={(id) => { setPlanIds([planIds[0], planIds[1], id]); handleReset(); }}
              excludeIds={[planIds[0], planIds[1]].filter(Boolean)}
              accentColor={PLAN_COLORS[2]}
              allPlans={allPlans}
            />
          </div>

          {activePlanIds.length > 1 && !allUnique && (
            <div className="flex items-center gap-2 text-sm mb-4 p-3 rounded-lg border" style={{ color: "#303030", backgroundColor: "#E6F7F9", borderColor: "#E8E8E8" }}>
              <AlertCircle size={15} />
              Please select three different plans to compare.
            </div>
          )}

          <button
            onClick={() => handleCompare(false)}
            disabled={!canCompare || isStreaming || phase === "table-ready"}
            className="w-full py-3.5 rounded-xl text-base font-bold text-white transition-all flex items-center justify-center gap-2 shadow-md"
            style={{
              backgroundColor: canCompare && phase === "idle" ? "#00353E" : "#D1D5DB",
              cursor: canCompare && phase === "idle" ? "pointer" : "not-allowed",
            }}
          >
            {phase === "table-ready" || isStreaming ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {phase === "table-ready" ? "Building comparison..." : "Claude is analyzing..."}
              </>
            ) : (
              <>
                <Sparkles size={18} />
                {canCompare && loadCache(planIds, hasPhiContext) && phase === "idle" ? "Show Cached Comparison" : "Compare Plans with AI"}
              </>
            )}
          </button>

          {!canCompare && activePlanIds.length === 0 && (
            <p className="text-center text-xs text-gray-400 mt-3">
              Select all three plans above to enable the AI comparison
            </p>
          )}
        </div>

        {/* ── Results: Instant Table + Streaming AI ────────────────────────── */}
        {showResults && plans[0] && plans[1] && plans[2] && (
          <div className="space-y-6 animate-fade-in-up">
            {/* 3 mini cards — shown instantly */}
            <div className="flex gap-3">
              {plans.map((plan, i) =>
                plan ? (
                  <PlanMiniCard
                    key={plan.id}
                    plan={plan}
                    label={PLAN_LABELS[i]}
                    color={PLAN_COLORS[i]}
                  />
                ) : null
              )}
            </div>

            {/* Side-by-side table — rendered INSTANTLY from client data */}
            {isTableReady && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#E6F7F9" }}>
                    <Star size={14} style={{ color: "#00353E" }} />
                  </div>
                  <h2 className="text-base font-bold text-gray-900">Side-by-Side Comparison</h2>
                  <div className="ml-auto flex items-center gap-1.5 text-[10px] text-gray-400">
                    <span className="inline-block w-2 h-2 rounded-full border" style={{ backgroundColor: "#E6F7F9", borderColor: "#00859A" }} />
                    Best value highlighted
                  </div>
                </div>
                <div className="p-4">
                  <CompareTable3
                    plans={[plans[0], plans[1], plans[2]]}
                    labels={PLAN_LABELS}
                    colors={PLAN_COLORS}
                    personalized={personalizedTableData}
                  />
                </div>
              </div>
            )}

            {/* AI Analysis section — streams in progressively */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#E6F7F9" }}>
                    <Sparkles size={14} style={{ color: "#00353E" }} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">AI Analysis by Claude</h2>
                    {generatedAt && (
                      <div className="text-[10px] text-gray-400 flex items-center gap-1">
                        {fromCache && <><Clock size={9} /> Cached · </>}
                        {new Date(generatedAt).toLocaleTimeString()} · claude-haiku-4-5
                      </div>
                    )}
                    {isStreaming && (
                      <div className="text-[10px] flex items-center gap-1 animate-pulse" style={{ color: "#00859A" }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#00859A" }} />
                        Streaming...
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(phase === "done" || phase === "cached") && (
                    <button
                      onClick={handleRefresh}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <RefreshCw size={12} />
                      Refresh Analysis
                    </button>
                  )}
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <RotateCcw size={12} />
                    New Comparison
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Streaming loading indicator (only shows before text starts) */}
                {isStreaming && streamedText.length === 0 && (
                  <div className="flex items-center gap-3 text-gray-500 text-sm py-4">
                    <div
                      className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin shrink-0"
                      style={{ borderColor: "#E6F7F9", borderTopColor: "#00353E" }}
                    />
                    Claude is analyzing all three plans...
                  </div>
                )}

                {/* Streaming / completed text */}
                {streamedText.length > 0 && (
                  <div className="ai-analysis">
                    <Streamdown>{streamedText}</Streamdown>
                    {isStreaming && (
                      <span className="inline-block w-0.5 h-4 animate-pulse ml-0.5 align-middle" style={{ backgroundColor: "#00859A" }} />
                    )}
                  </div>
                )}

                {/* Error state */}
                {phase === "error" && (
                  <div className="flex items-start gap-3 text-red-600 bg-red-50 rounded-xl p-4 border border-red-200">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-sm mb-1">AI Analysis Failed</div>
                      <div className="text-xs">{errorMsg}</div>
                      <button
                        onClick={() => handleCompare(true)}
                        className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800"
                      >
                        <RotateCcw size={11} /> Try Again
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Cached result banner */}
            {fromCache && phase === "cached" && (
              <div className="flex items-center gap-3 rounded-xl p-4 text-sm border" style={{ backgroundColor: "#E6F7F9", borderColor: "#E8E8E8", color: "#303030" }}>
                <Clock size={16} className="shrink-0" />
                <div className="flex-1">
                  This is a cached result from a previous comparison. The data table above is always live.
                </div>
                <button
                  onClick={handleRefresh}
                  className="flex items-center gap-1.5 text-xs font-semibold shrink-0" style={{ color: "#00859A" }}
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── How It Works ─────────────────────────────────────────────────── */}
        {phase === "idle" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">How It Works</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                {
                  step: "1",
                  title: "Select Three Plans",
                  desc: "Choose your current plan and two alternatives you're considering.",
                  color: "#00353E",
                },
                {
                  step: "2",
                  title: "Instant Table",
                  desc: "A full 3-column comparison table appears immediately — no waiting.",
                  color: "#00353E",
                  badge: "Instant",
                },
                {
                  step: "3",
                  title: "AI Streams In",
                  desc: "Claude Haiku analyzes all three plans and streams a recommendation in 3-5 seconds.",
                  color: "#00353E",
                  badge: "~3-5s",
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: item.color }}
                  >
                    {item.step}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-gray-800">{item.title}</div>
                      {item.badge && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: item.color }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
