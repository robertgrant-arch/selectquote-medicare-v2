/**
 * Plan Recommender — Questionnaire-based plan recommendation tool
 * Design: Bold Civic Design | Primary: #00353E | CTA: #00353E
 *
 * 5-section questionnaire → cost calculation → top-3 ranked plans → Claude Haiku narrative
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  RefreshCw,
  ChevronRight,
  Heart,
  Pill,
  Star as StarIcon,
  DollarSign,
  Users,
  Zap,
  TrendingDown,
  Award,
  Info,
} from "lucide-react";
import { Streamdown } from "streamdown";
import Header from "@/components/Header";
import CarrierLogo from "@/components/CarrierLogo";
import StarRating from "@/components/StarRating";
import type { MedicarePlan } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuestionnaireAnswers {
  // Section 1 — Health Profile
  healthStatus: "excellent" | "good" | "fair" | "poor" | "";
  chronicConditions: "none" | "1-2" | "3+" | "";
  plannedSurgery: "yes" | "no" | "";

  // Section 2 — Expected Utilization
  pcpVisits: "0-2" | "3-6" | "7-12" | "12+" | "";
  specialistVisits: "0" | "1-3" | "4-8" | "9+" | "";
  erVisits: "0" | "1-2" | "3+" | "";
  urgentCareVisits: "0" | "1-3" | "4+" | "";

  // Section 3 — Prescription Drugs
  monthlyRxCount: "0" | "1-3" | "4-7" | "8+" | "";
  brandNameDrugs: "yes" | "no" | "";
  specialtyDrugs: "yes" | "no" | "";
  monthlyDrugSpend: "$0" | "under-100" | "100-500" | "500+" | "";

  // Section 4 — Benefits Priorities
  dentalImportance: "not" | "somewhat" | "very" | "";
  visionImportance: "not" | "somewhat" | "very" | "";
  hearingImportance: "not" | "somewhat" | "very" | "";
  needsTransportation: "yes" | "no" | "";
  wantsOTC: "yes" | "no" | "";
  wantsFitness: "yes" | "no" | "";

  // Section 5 — Provider & Plan Preferences
  hasSpecificDoctors: "yes" | "no" | "";
  planTypePreference: "hmo" | "ppo" | "no-preference" | "";
  topPriority: "lowest-premium" | "lowest-oop" | "best-benefits" | "largest-network" | "";
}

const INITIAL_ANSWERS: QuestionnaireAnswers = {
  healthStatus: "",
  chronicConditions: "",
  plannedSurgery: "",
  pcpVisits: "",
  specialistVisits: "",
  erVisits: "",
  urgentCareVisits: "",
  monthlyRxCount: "",
  brandNameDrugs: "",
  specialtyDrugs: "",
  monthlyDrugSpend: "",
  dentalImportance: "",
  visionImportance: "",
  hearingImportance: "",
  needsTransportation: "",
  wantsOTC: "",
  wantsFitness: "",
  hasSpecificDoctors: "",
  planTypePreference: "",
  topPriority: "",
};

// ── Cost Estimation Engine ────────────────────────────────────────────────────

function parseCopayToNumber(copay: string): number {
  if (!copay) return 0;
  const m = copay.match(/\$(\d+)/);
  if (m) return parseInt(m[1], 10);
  if (copay.toLowerCase().includes("free") || copay === "$0") return 0;
  if (copay.toLowerCase().includes("covered") || copay.toLowerCase().includes("no charge")) return 0;
  return 30; // fallback estimate
}

function estimateAnnualCost(plan: MedicarePlan, answers: QuestionnaireAnswers): number {
  let total = 0;

  // Annual premium
  total += plan.premium * 12;

  // PCP visits
  const pcpCopay = parseCopayToNumber(plan.copays.primaryCare);
  const pcpVisitMap: Record<string, number> = { "0-2": 1, "3-6": 4, "7-12": 9, "12+": 14 };
  const pcpVisits = pcpVisitMap[answers.pcpVisits] ?? 2;
  total += pcpCopay * pcpVisits;

  // Specialist visits
  const specCopay = parseCopayToNumber(plan.copays.specialist);
  const specVisitMap: Record<string, number> = { "0": 0, "1-3": 2, "4-8": 6, "9+": 10 };
  const specVisits = specVisitMap[answers.specialistVisits] ?? 1;
  total += specCopay * specVisits;

  // ER visits
  const erCopay = parseCopayToNumber(plan.copays.emergency);
  const erVisitMap: Record<string, number> = { "0": 0, "1-2": 1, "3+": 3 };
  const erVisits = erVisitMap[answers.erVisits] ?? 0;
  total += erCopay * erVisits;

  // Urgent care visits
  const ucCopay = parseCopayToNumber(plan.copays.urgentCare);
  const ucVisitMap: Record<string, number> = { "0": 0, "1-3": 2, "4+": 5 };
  const ucVisits = ucVisitMap[answers.urgentCareVisits] ?? 0;
  total += ucCopay * ucVisits;

  // Drug costs — simplified estimate based on tier copays
  const rxCountMap: Record<string, number> = { "0": 0, "1-3": 2, "4-7": 5, "8+": 9 };
  const rxCount = rxCountMap[answers.monthlyRxCount] ?? 0;
  if (rxCount > 0) {
    const tier1Copay = parseCopayToNumber(plan.rxDrugs.tier1);
    const tier2Copay = parseCopayToNumber(plan.rxDrugs.tier2);
    const tier3Copay = parseCopayToNumber(plan.rxDrugs.tier3);

    if (answers.specialtyDrugs === "yes") {
      // Specialty drugs — use tier 3/4 estimate
      const tier4Copay = parseCopayToNumber(plan.rxDrugs.tier4);
      total += tier4Copay * 12; // 1 specialty drug/month
      total += tier2Copay * Math.max(0, rxCount - 1) * 12;
    } else if (answers.brandNameDrugs === "yes") {
      total += tier2Copay * Math.ceil(rxCount * 0.4) * 12;
      total += tier1Copay * Math.floor(rxCount * 0.6) * 12;
    } else {
      total += tier1Copay * rxCount * 12;
    }

    // Drug deductible
    const rxDed = parseCopayToNumber(plan.rxDrugs.deductible);
    total += rxDed;
  }

  // Planned surgery — add inpatient cost
  if (answers.plannedSurgery === "yes") {
    const inpatientCopay = parseCopayToNumber(plan.copays.inpatientHospital);
    total += inpatientCopay;
  }

  // Part B reduction benefit (subtract)
  total -= plan.partBPremiumReduction * 12;

  // Cap at MOOP
  const nonPremiumCosts = total - plan.premium * 12 + plan.partBPremiumReduction * 12;
  if (nonPremiumCosts > plan.maxOutOfPocket) {
    total = plan.premium * 12 - plan.partBPremiumReduction * 12 + plan.maxOutOfPocket;
  }

  return Math.max(0, Math.round(total));
}

function scorePlan(plan: MedicarePlan, answers: QuestionnaireAnswers): number {
  let score = 0;

  // Plan type preference
  if (answers.planTypePreference === "hmo" && plan.planType === "HMO") score += 20;
  if (answers.planTypePreference === "ppo" && plan.planType === "PPO") score += 20;

  // Top priority
  if (answers.topPriority === "lowest-premium") {
    score += Math.max(0, 30 - plan.premium);
  }
  if (answers.topPriority === "lowest-oop") {
    score += Math.max(0, 30 - plan.maxOutOfPocket / 300);
  }
  if (answers.topPriority === "best-benefits") {
    const benefitCount = Object.values(plan.extraBenefits).filter((b) => b.covered).length;
    score += benefitCount * 5;
  }
  if (answers.topPriority === "largest-network") {
    score += plan.networkSize / 500;
  }

  // Dental importance
  if (answers.dentalImportance === "very" && plan.extraBenefits.dental.covered) score += 15;
  if (answers.dentalImportance === "somewhat" && plan.extraBenefits.dental.covered) score += 8;

  // Vision importance
  if (answers.visionImportance === "very" && plan.extraBenefits.vision.covered) score += 15;
  if (answers.visionImportance === "somewhat" && plan.extraBenefits.vision.covered) score += 8;

  // Hearing importance
  if (answers.hearingImportance === "very" && plan.extraBenefits.hearing.covered) score += 15;
  if (answers.hearingImportance === "somewhat" && plan.extraBenefits.hearing.covered) score += 8;

  // Transportation
  if (answers.needsTransportation === "yes" && plan.extraBenefits.transportation.covered) score += 15;

  // OTC
  if (answers.wantsOTC === "yes" && plan.extraBenefits.otc.covered) score += 10;

  // Fitness
  if (answers.wantsFitness === "yes" && plan.extraBenefits.fitness.covered) score += 10;

  // Star rating bonus
  score += plan.starRating.overall * 3;

  // High utilization — prefer lower copays
  if (answers.pcpVisits === "7-12" || answers.pcpVisits === "12+") {
    const pcpCopay = parseCopayToNumber(plan.copays.primaryCare);
    score += Math.max(0, 20 - pcpCopay / 2);
  }

  // Specialty drugs — prefer gap coverage
  if (answers.specialtyDrugs === "yes" && plan.rxDrugs.gap) score += 20;

  return score;
}

interface RankedPlan {
  plan: MedicarePlan;
  estimatedCost: number;
  score: number;
  rank: number;
  costBreakdown: {
    annualPremium: number;
    estimatedCopays: number;
    estimatedDrugCosts: number;
    partBSavings: number;
  };
  whyRecommended: string[];
}

function rankPlans(answers: QuestionnaireAnswers, plans: MedicarePlan[]): RankedPlan[] {
  const scored = plans.map((plan) => {
    const estimatedCost = estimateAnnualCost(plan, answers);
    const score = scorePlan(plan, answers);

    // Build cost breakdown
    const annualPremium = plan.premium * 12;
    const partBSavings = plan.partBPremiumReduction * 12;
    const estimatedCopays = Math.min(
      plan.maxOutOfPocket,
      Math.round(estimatedCost - annualPremium + partBSavings)
    );
    const estimatedDrugCosts = Math.max(0, estimatedCopays - Math.round(estimatedCopays * 0.6));

    // Build why recommended list
    const reasons: string[] = [];
    if (plan.premium === 0) reasons.push("$0 monthly premium");
    if (plan.partBPremiumReduction > 0) reasons.push(`Saves $${plan.partBPremiumReduction}/mo on Part B`);
    if (answers.dentalImportance !== "not" && plan.extraBenefits.dental.covered) reasons.push("Includes dental coverage");
    if (answers.visionImportance !== "not" && plan.extraBenefits.vision.covered) reasons.push("Includes vision coverage");
    if (answers.needsTransportation === "yes" && plan.extraBenefits.transportation.covered) reasons.push("Includes transportation benefit");
    if (answers.wantsOTC === "yes" && plan.extraBenefits.otc.covered) reasons.push(`OTC allowance: ${plan.extraBenefits.otc.annualLimit || "included"}`);
    if (answers.wantsFitness === "yes" && plan.extraBenefits.fitness.covered) reasons.push("Includes fitness/gym benefit");
    if (answers.specialtyDrugs === "yes" && plan.rxDrugs.gap) reasons.push("Gap coverage for specialty drugs");
    if (plan.starRating.overall >= 4.5) reasons.push(`Top-rated: ${plan.starRating.overall}★ CMS rating`);
    if (answers.planTypePreference === "ppo" && plan.planType === "PPO") reasons.push("PPO — no referrals needed");
    if (answers.planTypePreference === "hmo" && plan.planType === "HMO") reasons.push("HMO — lower cost structure");
    if (reasons.length === 0) reasons.push("Competitive overall value");

    return {
      plan,
      estimatedCost,
      score,
      rank: 0,
      costBreakdown: { annualPremium, estimatedCopays, estimatedDrugCosts, partBSavings },
      whyRecommended: reasons.slice(0, 4),
    };
  });

  // Sort by score descending, then by estimated cost ascending as tiebreaker
  scored.sort((a, b) => b.score - a.score || a.estimatedCost - b.estimatedCost);

  // Assign ranks
  return scored.slice(0, 3).map((item, i) => ({ ...item, rank: i + 1 }));
}

// ── Section progress indicator ────────────────────────────────────────────────

const SECTIONS = [
  { id: 1, label: "Health Profile", icon: Heart },
  { id: 2, label: "Utilization", icon: Users },
  { id: 3, label: "Prescriptions", icon: Pill },
  { id: 4, label: "Benefits", icon: StarIcon },
  { id: 5, label: "Preferences", icon: DollarSign },
];

// ── Radio Button Group ────────────────────────────────────────────────────────

interface RadioGroupProps<T extends string> {
  value: T | "";
  onChange: (v: T) => void;
  options: { value: T; label: string; desc?: string }[];
  cols?: 2 | 3 | 4;
}

function RadioGroup<T extends string>({ value, onChange, options, cols = 2 }: RadioGroupProps<T>) {
  const gridClass = cols === 4 ? "grid-cols-2 sm:grid-cols-4" : cols === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2";
  return (
    <div className={`grid ${gridClass} gap-2`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className="text-left p-3 rounded-xl border-2 transition-all"
          style={{
            borderColor: value === opt.value ? "#00353E" : "#E8E8E8",
            backgroundColor: value === opt.value ? "#E6F7F9" : "white",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
              style={{
                borderColor: value === opt.value ? "#00353E" : "#D1D5DB",
                backgroundColor: value === opt.value ? "#00353E" : "white",
              }}
            >
              {value === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">{opt.label}</div>
              {opt.desc && <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Question component ────────────────────────────────────────────────────────

function Question({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="text-sm font-semibold text-gray-800 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </div>
      {children}
    </div>
  );
}

// ── Ranked Plan Card ──────────────────────────────────────────────────────────

function RankedPlanCard({ ranked }: { ranked: RankedPlan }) {
  const { plan, estimatedCost, rank, costBreakdown, whyRecommended } = ranked;
  const rankColors = ["#00353E", "#00859A", "#303030"];
  const rankLabels = ["Best Match", "Runner Up", "Also Consider"];
  const color = rankColors[rank - 1];

  return (
    <div
      className="bg-white rounded-xl border-2 shadow-sm overflow-hidden"
      style={{ borderColor: rank === 1 ? color : "#E8E8E8" }}
    >
      {rank === 1 && (
        <div className="px-4 py-2 text-xs font-bold text-white flex items-center gap-1.5" style={{ backgroundColor: color }}>
          <Award size={12} />
          Top Recommendation
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ backgroundColor: color }}
          >
            {rank}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CarrierLogo carrier={plan.carrier} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900 truncate">{plan.planName}</div>
                <div className="text-xs text-gray-500">{plan.carrier}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
              <span className="text-xs text-gray-400 font-semibold">{rankLabels[rank - 1]}</span>
            </div>
          </div>
        </div>

        {/* Estimated annual cost */}
        <div
          className="rounded-xl p-4 mb-4"
          style={{ backgroundColor: rank === 1 ? "#E6F7F9" : "#F9FAFB" }}
        >
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Estimated Annual Cost
          </div>
          <div className="text-2xl font-bold" style={{ color: rank === 1 ? "#00353E" : "#1F2937" }}>
            ${estimatedCost.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Based on your expected utilization</div>

          {/* Cost breakdown */}
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Annual premium</span>
              <span className="font-semibold text-gray-700">
                {plan.premium === 0 ? "$0" : `$${costBreakdown.annualPremium.toLocaleString()}`}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Est. copays & coinsurance</span>
              <span className="font-semibold text-gray-700">${costBreakdown.estimatedCopays.toLocaleString()}</span>
            </div>
            {costBreakdown.partBSavings > 0 && (
              <div className="flex justify-between text-xs">
                <span style={{ color: "#00859A" }}>Part B reduction savings</span>
                <span className="font-semibold" style={{ color: "#00859A" }}>−${costBreakdown.partBSavings.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-xs pt-1.5 border-t border-gray-200">
              <span className="font-semibold text-gray-700">Total estimate</span>
              <span className="font-bold" style={{ color: rank === 1 ? "#00353E" : "#1F2937" }}>
                ${estimatedCost.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Key plan stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Premium", value: plan.premium === 0 ? "$0/mo" : `$${plan.premium}/mo` },
            { label: "Max OOP", value: `$${plan.maxOutOfPocket.toLocaleString()}` },
            { label: "Deductible", value: `$${plan.deductible}` },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-2 bg-gray-50 rounded-lg">
              <div className="text-sm font-bold text-gray-800">{stat.value}</div>
              <div className="text-[10px] text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Why recommended */}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Why this plan matches you
          </div>
          <div className="space-y-1.5">
            {whyRecommended.map((reason, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-700">
                <CheckCircle2 size={12} style={{ color: color }} className="shrink-0" />
                {reason}
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-4 space-y-2">
          <Link
            href={`/plans?zip=64106`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-white no-underline transition-opacity hover:opacity-90"
            style={{ backgroundColor: rank === 1 ? color : "#8C8C8C" }}
          >
            View Full Plan Details
            <ChevronRight size={14} />
          </Link>
          <a
            href={`/ai-compare?plan2=${encodeURIComponent(plan.id)}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors no-underline"
            style={{
              borderColor: color,
              color: color,
              backgroundColor: "transparent",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = rank === 1 ? "#E6F7F9" : "#F3F4F6"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "transparent"; }}
          >
            <Sparkles size={14} />
            Save &amp; Compare to My Current Plan
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type PagePhase = "questionnaire" | "calculating" | "results";

export default function PlanRecommender() {
  const [currentSection, setCurrentSection] = useState(1);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(INITIAL_ANSWERS);
  const [phase, setPhase] = useState<PagePhase>("questionnaire");
  const [rankedPlans, setRankedPlans] = useState<RankedPlan[]>([]);
  const [streamedText, setStreamedText] = useState("");
  const [streamPhase, setStreamPhase] = useState<"idle" | "streaming" | "done" | "error">("idle");
  const [streamError, setStreamError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const [allPlans, setAllPlans] = useState<MedicarePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

  // Fetch plans from API on mount (use ZIP from URL or default 64106)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const zip = params.get("zip") || "64106";
    setPlansLoading(true);
    fetch(`/api/plans?zip=${zip}`)
      .then((r) => r.json())
      .then((data: { plans?: MedicarePlan[] }) => {
        setAllPlans(data.plans ?? []);
      })
      .catch(() => setAllPlans([]))
      .finally(() => setPlansLoading(false));
  }, []);

  const setAnswer = <K extends keyof QuestionnaireAnswers>(key: K, value: QuestionnaireAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  // Section completion checks
  const section1Complete =
    answers.healthStatus !== "" && answers.chronicConditions !== "" && answers.plannedSurgery !== "";
  const section2Complete =
    answers.pcpVisits !== "" && answers.specialistVisits !== "" && answers.erVisits !== "" && answers.urgentCareVisits !== "";
  const section3Complete =
    answers.monthlyRxCount !== "" && answers.brandNameDrugs !== "" && answers.specialtyDrugs !== "" && answers.monthlyDrugSpend !== "";
  const section4Complete =
    answers.dentalImportance !== "" && answers.visionImportance !== "" && answers.hearingImportance !== "" &&
    answers.needsTransportation !== "" && answers.wantsOTC !== "" && answers.wantsFitness !== "";
  const section5Complete =
    answers.hasSpecificDoctors !== "" && answers.planTypePreference !== "" && answers.topPriority !== "";

  const sectionComplete = [false, section1Complete, section2Complete, section3Complete, section4Complete, section5Complete];
  const allComplete = section1Complete && section2Complete && section3Complete && section4Complete && section5Complete;

  const handleSubmit = useCallback(async () => {
    if (!allComplete) return;

    setPhase("calculating");

    // Small delay for UX
    await new Promise((r) => setTimeout(r, 600));

    const ranked = rankPlans(answers, allPlans);
    setRankedPlans(ranked);
    setPhase("results");

    // Start streaming AI narrative
    setStreamPhase("streaming");
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/recommend-stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers, topPlans: ranked.map((r) => ({ planName: r.plan.planName, carrier: r.plan.carrier, planType: r.plan.planType, premium: r.plan.premium, maxOutOfPocket: r.plan.maxOutOfPocket, starRating: r.plan.starRating.overall, estimatedCost: r.estimatedCost, rank: r.rank, whyRecommended: r.whyRecommended })) }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`API error ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: done")) {
            setStreamPhase("done");
            return;
          }
          if (line.startsWith("data: ")) {
            try {
              const chunk = JSON.parse(line.slice(6)) as string;
              fullText += chunk;
              setStreamedText(fullText);
            } catch {
              // skip
            }
          }
        }
      }

      setStreamPhase("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setStreamError((err as Error).message);
      setStreamPhase("error");
    }
  }, [answers, allComplete]);

  const handleReset = () => {
    abortRef.current?.abort();
    setAnswers(INITIAL_ANSWERS);
    setCurrentSection(1);
    setPhase("questionnaire");
    setRankedPlans([]);
    setStreamedText("");
    setStreamPhase("idle");
    setStreamError("");
  };

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F9F9F9" }}>
      <Header />

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ backgroundColor: "#00353E" }}
      >
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
                Plan Recommender
              </h1>
              <p className="text-white/80 text-base max-w-2xl">
                Answer 20 questions about your health needs and priorities. We'll calculate your
                estimated annual cost for every plan and recommend the top 3 matches — with a
                personalized AI explanation.
              </p>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-white/60 text-xs">
                  <Zap size={11} />
                  <span>Takes about 3 minutes</span>
                </div>
                <span className="text-white/30">·</span>
                <div className="flex items-center gap-1.5 text-white/60 text-xs">
                  <Sparkles size={11} />
                  <span>AI-powered recommendation</span>
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
        {/* ── Calculating state ─────────────────────────────────────────────── */}
        {phase === "calculating" && (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div
              className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "#E6F7F9", borderTopColor: "#00353E" }}
            />
            <div className="text-center">
              <div className="text-lg font-bold text-gray-800 mb-1">Calculating your best plans...</div>
              <div className="text-sm text-gray-500">Estimating annual costs across all available plans</div>
            </div>
          </div>
        )}

        {/* ── Questionnaire ─────────────────────────────────────────────────── */}
        {phase === "questionnaire" && (
          <div className="max-w-2xl mx-auto">
            {/* Section progress */}
            <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
              {SECTIONS.map((sec, i) => {
                const Icon = sec.icon;
                const isActive = currentSection === sec.id;
                const isDone = sectionComplete[sec.id];
                return (
                  <button
                    key={sec.id}
                    onClick={() => setCurrentSection(sec.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0"
                    style={{
                      backgroundColor: isActive ? "#00353E" : isDone ? "#E6F7F9" : "#F3F4F6",
                      color: isActive ? "white" : isDone ? "#00353E" : "#8C8C8C",
                    }}
                  >
                    {isDone ? <CheckCircle2 size={13} /> : <Icon size={13} />}
                    {sec.label}
                    {i < SECTIONS.length - 1 && (
                      <ChevronRight size={11} className="ml-1 opacity-40" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Section card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              {/* Section 1 */}
              {currentSection === 1 && (
                <div>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#E6F7F9" }}>
                      <Heart size={16} style={{ color: "#00353E" }} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">General Health Profile</h2>
                  </div>

                  <Question label="How would you rate your overall health?" required>
                    <RadioGroup
                      value={answers.healthStatus}
                      onChange={(v) => setAnswer("healthStatus", v)}
                      options={[
                        { value: "excellent", label: "Excellent", desc: "Rarely see a doctor" },
                        { value: "good", label: "Good", desc: "Occasional visits" },
                        { value: "fair", label: "Fair", desc: "Regular management needed" },
                        { value: "poor", label: "Poor", desc: "Frequent medical care" },
                      ]}
                      cols={2}
                    />
                  </Question>

                  <Question label="How many chronic conditions do you manage?" required>
                    <RadioGroup
                      value={answers.chronicConditions}
                      onChange={(v) => setAnswer("chronicConditions", v)}
                      options={[
                        { value: "none", label: "None", desc: "No ongoing conditions" },
                        { value: "1-2", label: "1–2 conditions", desc: "e.g., diabetes, hypertension" },
                        { value: "3+", label: "3 or more", desc: "Multiple chronic conditions" },
                      ]}
                      cols={3}
                    />
                  </Question>

                  <Question label="Do you expect any planned surgeries or hospitalizations in the next year?" required>
                    <RadioGroup
                      value={answers.plannedSurgery}
                      onChange={(v) => setAnswer("plannedSurgery", v)}
                      options={[
                        { value: "yes", label: "Yes", desc: "Surgery or inpatient stay planned" },
                        { value: "no", label: "No", desc: "No planned procedures" },
                      ]}
                      cols={2}
                    />
                  </Question>
                </div>
              )}

              {/* Section 2 */}
              {currentSection === 2 && (
                <div>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#E6F7F9" }}>
                      <Users size={16} style={{ color: "#00353E" }} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Expected Utilization</h2>
                  </div>

                  <Question label="Primary care visits per year" required>
                    <RadioGroup
                      value={answers.pcpVisits}
                      onChange={(v) => setAnswer("pcpVisits", v)}
                      options={[
                        { value: "0-2", label: "0–2 visits" },
                        { value: "3-6", label: "3–6 visits" },
                        { value: "7-12", label: "7–12 visits" },
                        { value: "12+", label: "12+ visits" },
                      ]}
                      cols={4}
                    />
                  </Question>

                  <Question label="Specialist visits per year" required>
                    <RadioGroup
                      value={answers.specialistVisits}
                      onChange={(v) => setAnswer("specialistVisits", v)}
                      options={[
                        { value: "0", label: "0 visits" },
                        { value: "1-3", label: "1–3 visits" },
                        { value: "4-8", label: "4–8 visits" },
                        { value: "9+", label: "9+ visits" },
                      ]}
                      cols={4}
                    />
                  </Question>

                  <Question label="Expected ER visits per year" required>
                    <RadioGroup
                      value={answers.erVisits}
                      onChange={(v) => setAnswer("erVisits", v)}
                      options={[
                        { value: "0", label: "0 visits" },
                        { value: "1-2", label: "1–2 visits" },
                        { value: "3+", label: "3+ visits" },
                      ]}
                      cols={3}
                    />
                  </Question>

                  <Question label="Urgent care visits per year" required>
                    <RadioGroup
                      value={answers.urgentCareVisits}
                      onChange={(v) => setAnswer("urgentCareVisits", v)}
                      options={[
                        { value: "0", label: "0 visits" },
                        { value: "1-3", label: "1–3 visits" },
                        { value: "4+", label: "4+ visits" },
                      ]}
                      cols={3}
                    />
                  </Question>
                </div>
              )}

              {/* Section 3 */}
              {currentSection === 3 && (
                <div>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#E6F7F9" }}>
                      <Pill size={16} style={{ color: "#00353E" }} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Prescription Drug Needs</h2>
                  </div>

                  <Question label="Number of monthly prescriptions" required>
                    <RadioGroup
                      value={answers.monthlyRxCount}
                      onChange={(v) => setAnswer("monthlyRxCount", v)}
                      options={[
                        { value: "0", label: "None" },
                        { value: "1-3", label: "1–3 drugs" },
                        { value: "4-7", label: "4–7 drugs" },
                        { value: "8+", label: "8+ drugs" },
                      ]}
                      cols={4}
                    />
                  </Question>

                  <Question label="Do you take any brand-name drugs?" required>
                    <RadioGroup
                      value={answers.brandNameDrugs}
                      onChange={(v) => setAnswer("brandNameDrugs", v)}
                      options={[
                        { value: "yes", label: "Yes", desc: "Tier 2–3 brand drugs" },
                        { value: "no", label: "No", desc: "Generics only" },
                      ]}
                      cols={2}
                    />
                  </Question>

                  <Question label="Do you take any specialty or tier 4–5 drugs?" required>
                    <RadioGroup
                      value={answers.specialtyDrugs}
                      onChange={(v) => setAnswer("specialtyDrugs", v)}
                      options={[
                        { value: "yes", label: "Yes", desc: "Biologics, injectables, etc." },
                        { value: "no", label: "No", desc: "Standard formulary drugs" },
                      ]}
                      cols={2}
                    />
                  </Question>

                  <Question label="Estimated monthly drug spend without insurance" required>
                    <RadioGroup
                      value={answers.monthlyDrugSpend}
                      onChange={(v) => setAnswer("monthlyDrugSpend", v)}
                      options={[
                        { value: "$0", label: "$0" },
                        { value: "under-100", label: "Under $100" },
                        { value: "100-500", label: "$100–$500" },
                        { value: "500+", label: "$500+" },
                      ]}
                      cols={4}
                    />
                  </Question>
                </div>
              )}

              {/* Section 4 */}
              {currentSection === 4 && (
                <div>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#E6F7F9" }}>
                      <StarIcon size={16} style={{ color: "#00353E" }} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Benefits Priorities</h2>
                  </div>

                  <Question label="How important is dental coverage?" required>
                    <RadioGroup
                      value={answers.dentalImportance}
                      onChange={(v) => setAnswer("dentalImportance", v)}
                      options={[
                        { value: "not", label: "Not important" },
                        { value: "somewhat", label: "Somewhat important" },
                        { value: "very", label: "Very important" },
                      ]}
                      cols={3}
                    />
                  </Question>

                  <Question label="How important is vision coverage?" required>
                    <RadioGroup
                      value={answers.visionImportance}
                      onChange={(v) => setAnswer("visionImportance", v)}
                      options={[
                        { value: "not", label: "Not important" },
                        { value: "somewhat", label: "Somewhat important" },
                        { value: "very", label: "Very important" },
                      ]}
                      cols={3}
                    />
                  </Question>

                  <Question label="How important is hearing coverage?" required>
                    <RadioGroup
                      value={answers.hearingImportance}
                      onChange={(v) => setAnswer("hearingImportance", v)}
                      options={[
                        { value: "not", label: "Not important" },
                        { value: "somewhat", label: "Somewhat important" },
                        { value: "very", label: "Very important" },
                      ]}
                      cols={3}
                    />
                  </Question>

                  <Question label="Do you need transportation to medical appointments?" required>
                    <RadioGroup
                      value={answers.needsTransportation}
                      onChange={(v) => setAnswer("needsTransportation", v)}
                      options={[
                        { value: "yes", label: "Yes", desc: "I need rides to appointments" },
                        { value: "no", label: "No", desc: "I have my own transportation" },
                      ]}
                      cols={2}
                    />
                  </Question>

                  <Question label="Do you want an OTC (over-the-counter) allowance benefit?" required>
                    <RadioGroup
                      value={answers.wantsOTC}
                      onChange={(v) => setAnswer("wantsOTC", v)}
                      options={[
                        { value: "yes", label: "Yes", desc: "Quarterly allowance for health items" },
                        { value: "no", label: "No preference" },
                      ]}
                      cols={2}
                    />
                  </Question>

                  <Question label="Do you want a fitness or gym benefit?" required>
                    <RadioGroup
                      value={answers.wantsFitness}
                      onChange={(v) => setAnswer("wantsFitness", v)}
                      options={[
                        { value: "yes", label: "Yes", desc: "SilverSneakers or gym membership" },
                        { value: "no", label: "No preference" },
                      ]}
                      cols={2}
                    />
                  </Question>
                </div>
              )}

              {/* Section 5 */}
              {currentSection === 5 && (
                <div>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#E6F7F9" }}>
                      <DollarSign size={16} style={{ color: "#00353E" }} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Provider & Plan Preferences</h2>
                  </div>

                  <Question label="Do you have specific doctors you need to keep?" required>
                    <RadioGroup
                      value={answers.hasSpecificDoctors}
                      onChange={(v) => setAnswer("hasSpecificDoctors", v)}
                      options={[
                        { value: "yes", label: "Yes", desc: "I need my current doctors in-network" },
                        { value: "no", label: "No", desc: "I'm open to any in-network provider" },
                      ]}
                      cols={2}
                    />
                  </Question>

                  <Question label="Do you prefer HMO or PPO?" required>
                    <RadioGroup
                      value={answers.planTypePreference}
                      onChange={(v) => setAnswer("planTypePreference", v)}
                      options={[
                        { value: "hmo", label: "HMO", desc: "Lower cost, need referrals" },
                        { value: "ppo", label: "PPO", desc: "More flexibility, higher cost" },
                        { value: "no-preference", label: "No preference", desc: "Show me the best value" },
                      ]}
                      cols={3}
                    />
                  </Question>

                  <Question label="What matters most to you in a plan?" required>
                    <RadioGroup
                      value={answers.topPriority}
                      onChange={(v) => setAnswer("topPriority", v)}
                      options={[
                        { value: "lowest-premium", label: "Lowest premium", desc: "Minimize monthly cost" },
                        { value: "lowest-oop", label: "Lowest out-of-pocket max", desc: "Protect against big bills" },
                        { value: "best-benefits", label: "Best extra benefits", desc: "Dental, vision, OTC, etc." },
                        { value: "largest-network", label: "Largest network", desc: "Most doctor choices" },
                      ]}
                      cols={2}
                    />
                  </Question>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-100">
                <button
                  onClick={() => setCurrentSection(Math.max(1, currentSection - 1))}
                  disabled={currentSection === 1}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeft size={15} />
                  Previous
                </button>

                <div className="text-xs text-gray-400 font-medium">
                  Section {currentSection} of 5
                </div>

                {currentSection < 5 ? (
                  <button
                    onClick={() => setCurrentSection(currentSection + 1)}
                    disabled={!sectionComplete[currentSection]}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ backgroundColor: sectionComplete[currentSection] ? "#00353E" : "#9CA3AF" }}
                  >
                    Next
                    <ArrowRight size={15} />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!allComplete}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                    style={{ backgroundColor: allComplete ? "#00353E" : "#9CA3AF" }}
                  >
                    <Sparkles size={15} />
                    Get My Recommendations
                  </button>
                )}
              </div>
            </div>

            {/* Overall progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{SECTIONS.filter((_, i) => sectionComplete[i + 1]).length} of 5 sections complete</span>
                <span>{Math.round((SECTIONS.filter((_, i) => sectionComplete[i + 1]).length / 5) * 100)}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(SECTIONS.filter((_, i) => sectionComplete[i + 1]).length / 5) * 100}%`,
                    backgroundColor: "#00353E",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Results ───────────────────────────────────────────────────────── */}
        {phase === "results" && rankedPlans.length > 0 && (
          <div className="space-y-6">
            {/* Results header */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Your Top 3 Recommended Plans</h2>
                <p className="text-sm text-gray-500">
                  Based on your health profile, utilization, and priorities — ranked by best overall fit.
                </p>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors shrink-0"
              >
                <RotateCcw size={14} />
                Retake
              </button>
            </div>

            {/* Top 3 plan cards */}
            <div className="grid md:grid-cols-3 gap-4">
              {rankedPlans.map((ranked) => (
                <RankedPlanCard key={ranked.plan.id} ranked={ranked} />
              ))}
            </div>

            {/* Cost comparison bar chart */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#E6F7F9" }}>
                  <TrendingDown size={14} style={{ color: "#00353E" }} />
                </div>
                <h3 className="text-base font-bold text-gray-900">Estimated Annual Cost Comparison</h3>
              </div>
              <div className="space-y-3">
                {rankedPlans.map((ranked, i) => {
                  const maxCost = Math.max(...rankedPlans.map((r) => r.estimatedCost));
                  const pct = (ranked.estimatedCost / maxCost) * 100;
                  const colors = ["#00353E", "#00859A", "#303030"];
                  return (
                    <div key={ranked.plan.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-gray-700 truncate max-w-[200px]">{ranked.plan.planName}</span>
                        <span className="font-bold" style={{ color: colors[i] }}>${ranked.estimatedCost.toLocaleString()}/yr</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: colors[i] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-3 flex items-start gap-1.5">
                <Info size={11} className="shrink-0 mt-0.5" />
                Estimates are based on your expected utilization and plan copay rates. Actual costs may vary. This is for educational purposes only — consult a licensed agent before enrolling.
              </p>
            </div>

            {/* AI Narrative */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#E6F7F9" }}>
                    <Sparkles size={14} style={{ color: "#00353E" }} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Personalized AI Recommendation</h3>
                    {streamPhase === "streaming" && (
                      <div className="text-[10px] flex items-center gap-1 animate-pulse" style={{ color: "#00859A" }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#00859A" }} />
                        Claude is writing your recommendation...
                      </div>
                    )}
                    {streamPhase === "done" && (
                      <div className="text-[10px] text-gray-400">Powered by Claude Haiku</div>
                    )}
                  </div>
                </div>
                {streamPhase === "error" && (
                  <button
                    onClick={handleSubmit}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <RefreshCw size={12} />
                    Retry
                  </button>
                )}
              </div>
              <div className="p-6">
                {streamPhase === "streaming" && streamedText.length === 0 && (
                  <div className="flex items-center gap-3 text-gray-500 text-sm py-4">
                    <div
                      className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin shrink-0"
                      style={{ borderColor: "#E6F7F9", borderTopColor: "#00353E" }}
                    />
                    Generating your personalized recommendation...
                  </div>
                )}
                {streamedText.length > 0 && (
                  <div className="ai-analysis">
                    <style>{`
                      .ai-analysis h2 {
                        font-family: 'Montserrat', serif;
                        font-size: 1.05rem;
                        font-weight: 700;
                        color: #1F2937;
                        margin-top: 1.25rem;
                        margin-bottom: 0.4rem;
                        padding-bottom: 0.3rem;
                        border-bottom: 2px solid #E6F7F9;
                      }
                      .ai-analysis h2:first-child { margin-top: 0; }
                      .ai-analysis p { color: #303030; line-height: 1.65; margin-bottom: 0.75rem; font-size: 0.875rem; }
                      .ai-analysis ul { padding-left: 1.25rem; margin-bottom: 0.75rem; }
                      .ai-analysis li { color: #303030; font-size: 0.875rem; margin-bottom: 0.3rem; line-height: 1.55; }
                      .ai-analysis strong { color: #111827; font-weight: 600; }
                    `}</style>
                    <Streamdown>{streamedText}</Streamdown>
                    {streamPhase === "streaming" && (
                      <span className="inline-block w-0.5 h-4 animate-pulse ml-0.5 align-middle" style={{ backgroundColor: "#00859A" }} />
                    )}
                  </div>
                )}
                {streamPhase === "error" && (
                  <div className="flex items-start gap-3 text-red-600 bg-red-50 rounded-xl p-4 border border-red-200">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-sm mb-1">AI Recommendation Unavailable</div>
                      <div className="text-xs">{streamError || "An error occurred generating your recommendation."}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Compare with AI button */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-1">Want a deeper side-by-side analysis?</h3>
                <p className="text-sm text-gray-500">Open the AI Compare page with your top 3 plans pre-loaded for a detailed breakdown.</p>
              </div>
              <a
                href={`/ai-compare?plan1=${encodeURIComponent(rankedPlans[0]?.plan.id ?? '')}&plan2=${encodeURIComponent(rankedPlans[1]?.plan.id ?? '')}&plan3=${encodeURIComponent(rankedPlans[2]?.plan.id ?? '')}`}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white shadow-md shrink-0 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#00353E" }}
              >
                <Sparkles size={16} />
                Compare These 3 Plans with AI
                <ChevronRight size={16} />
              </a>
            </div>

            {/* Disclaimer */}
            <div className="rounded-xl p-4 text-xs flex items-start gap-2 border" style={{ backgroundColor: "#E6F7F9", borderColor: "#E8E8E8", color: "#303030" }}>
              <Info size={14} className="shrink-0 mt-0.5" />
              <div>
                <strong>Important Disclaimer:</strong> These recommendations are for educational purposes only and are based on mock plan data. They do not constitute professional insurance advice. Plan availability, costs, and benefits vary by location and change annually. Always consult a licensed Medicare insurance agent before making enrollment decisions. This tool is a demonstration application.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
