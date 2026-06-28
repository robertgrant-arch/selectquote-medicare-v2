/**
import TermTip from '@/features/education/components/TermTip';
import { useZipValidation } from '@/features/zip-validation/lib/useZipValidation';
import CountySelector from '@/features/zip-validation/components/CountySelector';
 * FindBestPlan — Health Profile Wizard with AI-Powered Plan Recommendations
 *
 * Design: Bold Civic | Navy #1C3A48 | Teal #1C3A48 | Green #16A34A
 * Flow: ZIP entry → 5-step questionnaire → AI scoring → ranked results + narrative
 */

import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Heart,
  Pill,
  Star,
  DollarSign,
  Users,
  Sparkles,
  CheckCircle2,
  MapPin,
  Search,
  TrendingDown,
  Shield,
  Stethoscope,
  Ear,
  Eye,
  Car,
  ShoppingBag,
  Dumbbell,
  ChevronRight,
  RotateCcw,
  Loader2,
  AlertCircle,
  Award,
} from "lucide-react";
import { Streamdown } from "streamdown";
import Header from "@/components/Header";
import CarrierLogo from "@/components/CarrierLogo";
import StarRating from "@/components/StarRating";
import { trpc } from "@/lib/trpc";
import type { MedicarePlan } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type HealthStatus = "excellent" | "good" | "fair" | "poor";
type ChronicConditions = "none" | "1-2" | "3+";
type PlannedSurgery = "yes" | "no";
type PcpVisits = "0-2" | "3-6" | "7-12" | "12+";
type SpecialistVisits = "0" | "1-3" | "4-8" | "9+";
type ErVisits = "0" | "1-2" | "3+";
type UrgentCareVisits = "0" | "1-3" | "4+";
type MonthlyRxCount = "0" | "1-3" | "4-7" | "8+";
type YesNo = "yes" | "no";
type MonthlyDrugSpend = "$0" | "under-100" | "100-500" | "500+";
type Importance = "not" | "somewhat" | "very";
type PlanTypePreference = "hmo" | "ppo" | "no-preference";
type TopPriority = "lowest-premium" | "lowest-oop" | "best-benefits" | "largest-network";
type ExtraHelp = "full" | "partial" | "no" | "not-sure";

interface HealthProfile {
  healthStatus: HealthStatus | "";
  chronicConditions: ChronicConditions | "";
  plannedSurgery: PlannedSurgery | "";
  pcpVisits: PcpVisits | "";
  specialistVisits: SpecialistVisits | "";
  erVisits: ErVisits | "";
  urgentCareVisits: UrgentCareVisits | "";
  monthlyRxCount: MonthlyRxCount | "";
  brandNameDrugs: YesNo | "";
  specialtyDrugs: YesNo | "";
  monthlyDrugSpend: MonthlyDrugSpend | "";
  dentalImportance: Importance | "";
  visionImportance: Importance | "";
  hearingImportance: Importance | "";
  needsTransportation: YesNo | "";
  wantsOTC: YesNo | "";
  wantsFitness: YesNo | "";
  hasSpecificDoctors: YesNo | "";
  planTypePreference: PlanTypePreference | "";
  topPriority: TopPriority | "";
  extraHelp: ExtraHelp | "";
}

const EMPTY_PROFILE: HealthProfile = {
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
  extraHelp: "",
};

interface RankedPlan {
  id: string;
  planName: string;
  carrier: string;
  planType: string;
  premium: number;
  maxOutOfPocket: number;
  starRating: number;
  estimatedAnnualCost: number;
  matchScore: number;
  matchReasons: string[];
  watchOuts: string[];
}

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Health Status", icon: Heart, color: "#1C3A48" },
  { id: 2, label: "Utilization", icon: Stethoscope, color: "#1C3A48" },
  { id: 3, label: "Medications", icon: Pill, color: "#1C3A48" },
  { id: 4, label: "Benefits", icon: Award, color: "#1C3A48" },
  { id: 5, label: "Preferences", icon: Users, color: "#1C3A48" },
];

// ── Option button ─────────────────────────────────────────────────────────────

function OptionBtn<T extends string>({
  value,
  selected,
  label,
  sublabel,
  onSelect,
  accent = "#1C3A48",
}: {
  value: T;
  selected: boolean;
  label: string;
  sublabel?: string;
  onSelect: (v: T) => void;
  accent?: string;
}) {
  return (
    <button
      onClick={() => onSelect(value)}
      className="relative flex items-start gap-3 w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all"
      style={{
        borderColor: selected ? accent : "#E2EAED",
        backgroundColor: selected ? `${accent}10` : "white",
        boxShadow: selected ? `0 0 0 1px ${accent}30` : "none",
      }}
    >
      <div
        className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5"
        style={{
          borderColor: selected ? accent : "#D1D5DB",
          backgroundColor: selected ? accent : "white",
        }}
      >
        {selected && <div className="w-2 h-2 rounded-full bg-white" />}
      </div>
      <div>
        <div className="text-sm font-semibold" style={{ color: selected ? accent : "#3E5560" }}>
          {label}
        </div>
        {sublabel && <div className="text-xs text-gray-400 mt-0.5">{sublabel}</div>}
      </div>
    </button>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionQ({ question, hint }: { question: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-bold" style={{ color: "#1C3A48" }}>
        {question}
      </h3>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FindBestPlan() {
  const [, navigate] = useLocation();

  // Parse copay string like "$0", "$35", "$0 copay", "No charge" to number
  function parseCopay(s: string): number {
    if (!s) return 0;
    const lower = s.toLowerCase();
    if (lower.includes("no charge") || lower.includes("free") || lower === "$0") return 0;
    const m = s.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 30;
  }
  const [step, setStep] = useState<"zip" | 1 | 2 | 3 | 4 | 5 | "results">("zip");
  const [zip, setZip] = useState("");
  const [zipError, setZipError] = useState("");
  const zipValidation = useZipValidation();
  const [profile, setProfile] = useState<HealthProfile>(EMPTY_PROFILE);
  const [plans, setPlans] = useState<MedicarePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    rankedPlans: RankedPlan[];
    aiNarrative: string;
    totalPlansScored: number;
  } | null>(null);

  const set = <K extends keyof HealthProfile>(key: K, value: HealthProfile[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  // Fetch plans when ZIP is confirmed
  const handleZipSubmit = async () => {
    const trimmed = zip.trim();
    const result = await zipValidation.validate(trimmed);

    if (result.status === 'invalid_format' || result.status === 'invalid_zip' || result.status === 'error') {
      setZipError(result.errorMessage);
      return;
    }
    if (result.status === 'needs_county_selection') {
      setZipError('');
      // County selector will appear — wait for selection
      return;
    }
    if (result.status === 'valid') {
      setZipError('');
      setPlansLoading(true);
      setPlansError(null);
      fetch(`/api/plans?zip=${trimmed}`)
        .then((r) => r.json())
        .then((data: { plans?: MedicarePlan[]; error?: string }) => {
          if (data.error) {
            setPlansError(data.error);
          } else {
            setPlans(data.plans ?? []);
            setStep(1);
          }
        })
        .catch(() => setPlansError('Unable to load plans. Please try again.'))
        .finally(() => setPlansLoading(false));
    }
  };

  // Validate current step before advancing
  const stepFields: Record<number, (keyof HealthProfile)[]> = {
    1: ["healthStatus", "chronicConditions", "plannedSurgery", "extraHelp"],
    2: ["pcpVisits", "specialistVisits", "erVisits", "urgentCareVisits"],
    3: ["monthlyRxCount", "brandNameDrugs", "specialtyDrugs", "monthlyDrugSpend"],
    4: ["dentalImportance", "visionImportance", "hearingImportance", "needsTransportation", "wantsOTC", "wantsFitness"],
    5: ["hasSpecificDoctors", "planTypePreference", "topPriority"],
  };

  const currentStepNum = typeof step === "number" ? step : 0;
  const requiredFields = stepFields[currentStepNum] ?? [];
  const stepComplete = requiredFields.every((f) => profile[f] !== "");

  const recommendMutation = trpc.healthProfile.recommend.useMutation({
    onSuccess: (data) => {
      setResults(data);
      setStep("results");
    },
  });

  const handleNext = () => {
    if (step === 5) {
      // Submit — build plan input for scoring
      const planInputs = plans.map((p) => ({
        id: p.id,
        planName: p.planName,
        carrier: p.carrier,
        planType: p.planType,
        premium: p.premium,
        deductible: p.deductible,
        maxOutOfPocket: p.maxOutOfPocket,
        starRating: p.starRating.overall,
        pcpCopay: parseCopay(p.copays.primaryCare),
        specialistCopay: parseCopay(p.copays.specialist),
        urgentCareCopay: parseCopay(p.copays.urgentCare),
        erCopay: parseCopay(p.copays.emergency),
        drugTier1Copay: parseCopay(p.rxDrugs.tier1),
        drugTier2Copay: parseCopay(p.rxDrugs.tier2),
        drugTier3Copay: parseCopay(p.rxDrugs.tier3),
        hasDental: p.extraBenefits?.dental?.covered ?? false,
        hasVision: p.extraBenefits?.vision?.covered ?? false,
        hasHearing: p.extraBenefits?.hearing?.covered ?? false,
        hasTransportation: p.extraBenefits?.transportation?.covered ?? false,
        hasOTC: p.extraBenefits?.otc?.covered ?? false,
        hasFitness: p.extraBenefits?.fitness?.covered ?? false,
        isBestMatch: p.isBestMatch ?? false,
        isMostPopular: p.isMostPopular ?? false,
      }));

      recommendMutation.mutate({
        profile: profile as Required<HealthProfile> & { zip: string },
        plans: planInputs,
      } as Parameters<typeof recommendMutation.mutate>[0]);
    } else if (typeof step === "number" && step < 5) {
      setStep((step + 1) as 1 | 2 | 3 | 4 | 5);
    }
  };

  // Skip to all plans — bypasses all questions
  const handleSkipToAllPlans = () => {
    const z = zip.trim();
    if (!/^\d{5}$/.test(z)) {
      // If we're already on step 1, zip is confirmed; use it
      if (typeof step === "number" && plans.length > 0) {
        navigate(`/plans?zip=${z}&extraHelp=skip`);
        return;
      }
      setZipError("Please enter a valid 5-digit ZIP code first.");
      return;
    }
    navigate(`/plans?zip=${z}&extraHelp=skip`);
  };

  const handleBack = () => {
    if (step === 1) setStep("zip");
    else if (typeof step === "number" && step > 1) setStep((step - 1) as 1 | 2 | 3 | 4 | 5);
    else if (step === "results") setStep(5);
  };

  const progress = typeof step === "number" ? (step / 5) * 100 : step === "results" ? 100 : 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAF9F5" }}>
      <Header />

      <div className="container py-8 max-w-2xl mx-auto">
        {/* ── Page header ─────────────────────────────────────────────────── */}
        {step !== "results" && (
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full mb-4"
              style={{ backgroundColor: "#E8F2F5", color: "#1C3A48" }}
            >
              <Sparkles size={12} />
              AI-Powered Plan Matching
            </div>
            <h1
              className="text-3xl font-bold mb-2"
              style={{ color: "#1C3A48", fontFamily: "'DM Sans', sans-serif" }}
            >
              Find Your Best Plan
            </h1>
            <p className="text-gray-500 text-base">
              Answer 20 quick questions and our AI will match you with the best Medicare Advantage plans for your health needs.
            </p>
          </div>
        )}

        {/* ── ZIP step ────────────────────────────────────────────────────── */}
        {step === "zip" && (
          <div className="bg-white rounded-xl p-8 shadow-sm" style={{ border: "1px solid #E8F2F5" }}>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "#E8F2F5" }}
              >
                <MapPin size={20} style={{ color: "#1C3A48" }} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: "#1C3A48" }}>
                  Where do you live?
                </h2>
                <p className="text-xs text-gray-400">We'll find plans available in your area</p>
              </div>
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="Enter ZIP code"
                value={zip}
                onChange={(e) => { setZip(e.target.value.replace(/\D/g, "")); setZipError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleZipSubmit()}
                className="flex-1 px-4 py-3.5 text-lg font-semibold border-2 rounded-xl outline-none transition-all"
                style={{ borderColor: zipError ? "#1C3A48" : "#E2EAED", color: "#1C3A48" }}
                onFocus={(e) => { if (!zipError) e.currentTarget.style.borderColor = "#1C3A48"; }}
                onBlur={(e) => { if (!zipError) e.currentTarget.style.borderColor = "#E2EAED"; }}
              />
              <button
                onClick={handleZipSubmit}
                disabled={plansLoading}
                className="px-6 py-3.5 rounded-xl font-bold text-white flex items-center gap-2 transition-all"
                style={{ backgroundColor: plansLoading ? "#9CA3AF" : "#1C3A48" }}
              >
                {plansLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                {plansLoading ? "Loading…" : "Start"}
              </button>
            </div>
            {zipError && (
              <p className="text-sm mt-2 flex items-center gap-1" style={{ color: "#1C3A48" }}>
                <AlertCircle size={13} /> {zipError}
              </p>
            )}
            {plansError && (
              <p className="text-sm mt-2 flex items-center gap-1 text-red-500">
                <AlertCircle size={13} /> {plansError}
              </p>
            )}

            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { icon: Shield, text: "Real CMS 2026 data" },
                { icon: Sparkles, text: "AI-powered matching" },
                { icon: CheckCircle2, text: "Free, no obligation" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-xs text-gray-500">
                  <Icon size={13} style={{ color: "#1C3A48" }} />
                  {text}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Progress bar (steps 1–5) ─────────────────────────────────────── */}
        {typeof step === "number" && (
          <>
            {/* Step indicators */}
            <div className="flex items-center justify-between mb-6">
              {STEPS.map((s, i) => {
                const isActive = step === s.id;
                const isDone = step > s.id;
                const Icon = s.icon;
                return (
                  <div key={s.id} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                        style={{
                          backgroundColor: isDone ? "#237A92" : isActive ? s.color : "#E2EAED",
                          boxShadow: isActive ? `0 0 0 3px ${s.color}30` : "none",
                        }}
                      >
                        {isDone ? (
                          <CheckCircle2 size={16} className="text-white" />
                        ) : (
                          <Icon size={15} className={isActive || isDone ? "text-white" : "text-gray-400"} />
                        )}
                      </div>
                      <span
                        className="text-[10px] font-semibold mt-1 hidden sm:block"
                        style={{ color: isActive ? s.color : isDone ? "#237A92" : "#9CA3AF" }}
                      >
                        {s.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className="h-0.5 w-8 sm:w-12 mx-1 mt-[-18px] sm:mt-[-18px] transition-all"
                        style={{ backgroundColor: step > s.id ? "#237A92" : "#E2EAED" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Step card */}
            <div className="bg-white rounded-xl p-6 shadow-sm mb-4" style={{ border: "1px solid #E8F2F5" }}>
              {/* Step 1: Health Status */}
              {step === 1 && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#E8F2F5" }}>
                        <Heart size={14} style={{ color: "#1C3A48" }} />
                      </div>
                      <h2 className="text-lg font-bold" style={{ color: "#1C3A48" }}>Health Status</h2>
                    </div>
                    <button
                      onClick={() => navigate(`/plans?zip=${zip.trim()}&extraHelp=skip`)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-all hover:bg-gray-50 flex items-center gap-1"
                      style={{ borderColor: "#D1D5DB", color: "#7A9BA6" }}
                    >
                      Skip to View All Plans
                      <ChevronRight size={12} />
                    </button>
                  </div>

                  <SectionQ question="How would you describe your overall health?" />
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {([
                      { value: "excellent" as const, label: "Excellent", sublabel: "No major health issues" },
                      { value: "good" as const, label: "Good", sublabel: "Minor or well-managed conditions" },
                      { value: "fair" as const, label: "Fair", sublabel: "Some ongoing health challenges" },
                      { value: "poor" as const, label: "Poor", sublabel: "Significant health challenges" },
                    ] as const).map((o) => (
                      <OptionBtn
                        key={o.value}
                        value={o.value}
                        selected={profile.healthStatus === o.value}
                        label={o.label}
                        sublabel={o.sublabel}
                        onSelect={(v) => set("healthStatus", v)}
                        accent="#1C3A48"
                      />
                    ))}
                  </div>

                  <SectionQ question="How many chronic conditions do you manage?" hint="e.g., diabetes, heart disease, COPD, arthritis" />
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    {([
                      { value: "none" as const, label: "None" },
                      { value: "1-2" as const, label: "1–2" },
                      { value: "3+" as const, label: "3 or more" },
                    ] as const).map((o) => (
                      <OptionBtn key={o.value} value={o.value} selected={profile.chronicConditions === o.value} label={o.label} onSelect={(v) => set("chronicConditions", v)} accent="#1C3A48" />
                    ))}
                  </div>

                  <SectionQ question="Do you have a planned surgery or hospitalization in the next 12 months?" />
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    <OptionBtn value="yes" selected={profile.plannedSurgery === "yes"} label="Yes" sublabel="I have a procedure planned" onSelect={(v) => set("plannedSurgery", v)} accent="#1C3A48" />
                    <OptionBtn value="no" selected={profile.plannedSurgery === "no"} label="No" sublabel="No planned procedures" onSelect={(v) => set("plannedSurgery", v)} accent="#1C3A48" />
                  </div>

                  {/* Extra Help / LIS question */}
                  <SectionQ question="Do you receive Extra Help (Low-Income Subsidy) from Medicare?" />
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {([
                      { value: "full" as const, label: "Yes — Full Extra Help", sublabel: "Full LIS subsidy" },
                      { value: "partial" as const, label: "Yes — Partial Extra Help", sublabel: "Partial LIS subsidy" },
                      { value: "no" as const, label: "No", sublabel: "I don't receive Extra Help" },
                      { value: "not-sure" as const, label: "Not Sure", sublabel: "I'm not certain" },
                    ] as const).map((o) => (
                      <OptionBtn
                        key={o.value}
                        value={o.value}
                        selected={profile.extraHelp === o.value}
                        label={o.label}
                        sublabel={o.sublabel}
                        onSelect={(v) => set("extraHelp", v)}
                        accent="#1C3A48"
                      />
                    ))}
                  </div>
                  <div
                    className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs text-gray-500 mb-1"
                    style={{ backgroundColor: "#EEF5F7", border: "1px solid #C6DAE0" }}
                  >
                    <Shield size={12} className="shrink-0 mt-0.5" style={{ color: "#237A92" }} />
                    <span>
                      Extra Help is a Medicare program that helps pay Part D prescription drug costs. If you're unsure, select "Not Sure" and all plans will be shown.
                    </span>
                  </div>
                </div>
              )}

              {/* Step 2: Utilization */}
              {step === 2 && (
                <div>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#E8F2F5" }}>
                      <Stethoscope size={14} style={{ color: "#1C3A48" }} />
                    </div>
                    <h2 className="text-lg font-bold" style={{ color: "#1C3A48" }}>Healthcare Utilization</h2>
                  </div>

                  <SectionQ question="How many times do you visit your primary care doctor per year?" />
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {([
                      { value: "0-2" as const, label: "0–2 times" },
                      { value: "3-6" as const, label: "3–6 times" },
                      { value: "7-12" as const, label: "7–12 times" },
                      { value: "12+" as const, label: "12+ times" },
                    ] as const).map((o) => (
                      <OptionBtn key={o.value} value={o.value} selected={profile.pcpVisits === o.value} label={o.label} onSelect={(v) => set("pcpVisits", v)} />
                    ))}
                  </div>

                  <SectionQ question="How many specialist visits do you have per year?" />
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {([
                      { value: "0" as const, label: "None" },
                      { value: "1-3" as const, label: "1–3 times" },
                      { value: "4-8" as const, label: "4–8 times" },
                      { value: "9+" as const, label: "9+ times" },
                    ] as const).map((o) => (
                      <OptionBtn key={o.value} value={o.value} selected={profile.specialistVisits === o.value} label={o.label} onSelect={(v) => set("specialistVisits", v)} />
                    ))}
                  </div>

                  <SectionQ question="How often do you use urgent care or the ER per year?" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5">Urgent Care</p>
                      <div className="space-y-1.5">
                        {([
                          { value: "0" as const, label: "Never" },
                          { value: "1-3" as const, label: "1–3 times" },
                          { value: "4+" as const, label: "4+ times" },
                        ] as const).map((o) => (
                          <OptionBtn key={o.value} value={o.value} selected={profile.urgentCareVisits === o.value} label={o.label} onSelect={(v) => set("urgentCareVisits", v)} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5">Emergency Room</p>
                      <div className="space-y-1.5">
                        {([
                          { value: "0" as const, label: "Never" },
                          { value: "1-2" as const, label: "1–2 times" },
                          { value: "3+" as const, label: "3+ times" },
                        ] as const).map((o) => (
                          <OptionBtn key={o.value} value={o.value} selected={profile.erVisits === o.value} label={o.label} onSelect={(v) => set("erVisits", v)} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Medications */}
              {step === 3 && (
                <div>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EEF5F7" }}>
                      <Pill size={14} style={{ color: "#237A92" }} />
                    </div>
                    <h2 className="text-lg font-bold" style={{ color: "#1C3A48" }}>Prescription Medications</h2>
                  </div>

                  <SectionQ question="How many prescription medications do you take monthly?" />
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {([
                      { value: "0" as const, label: "None" },
                      { value: "1-3" as const, label: "1–3 medications" },
                      { value: "4-7" as const, label: "4–7 medications" },
                      { value: "8+" as const, label: "8+ medications" },
                    ] as const).map((o) => (
                      <OptionBtn key={o.value} value={o.value} selected={profile.monthlyRxCount === o.value} label={o.label} onSelect={(v) => set("monthlyRxCount", v)} accent="#1C3A48" />
                    ))}
                  </div>

                  <SectionQ question="Do you take any brand-name drugs (not generic)?" />
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    <OptionBtn value="yes" selected={profile.brandNameDrugs === "yes"} label="Yes" onSelect={(v) => set("brandNameDrugs", v)} accent="#1C3A48" />
                    <OptionBtn value="no" selected={profile.brandNameDrugs === "no"} label="No" onSelect={(v) => set("brandNameDrugs", v)} accent="#1C3A48" />
                  </div>

                  <SectionQ question="Do you take specialty or high-tier drugs?" hint="e.g., biologics, cancer drugs, MS medications" />
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    <OptionBtn value="yes" selected={profile.specialtyDrugs === "yes"} label="Yes" onSelect={(v) => set("specialtyDrugs", v)} accent="#1C3A48" />
                    <OptionBtn value="no" selected={profile.specialtyDrugs === "no"} label="No" onSelect={(v) => set("specialtyDrugs", v)} accent="#1C3A48" />
                  </div>

                  <SectionQ question="What do you currently spend on drugs per month (without insurance)?" />
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: "$0" as const, label: "$0", sublabel: "No prescriptions" as string | undefined },
                      { value: "under-100" as const, label: "Under $100", sublabel: undefined as string | undefined },
                      { value: "100-500" as const, label: "$100–$500", sublabel: undefined as string | undefined },
                      { value: "500+" as const, label: "$500+", sublabel: undefined as string | undefined },
                    ] as const).map((o) => (
                      <OptionBtn key={o.value} value={o.value} selected={profile.monthlyDrugSpend === o.value} label={o.label} sublabel={o.sublabel} onSelect={(v) => set("monthlyDrugSpend", v)} accent="#1C3A48" />
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Benefits */}
              {step === 4 && (
                <div>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EEF5F7" }}>
                      <Award size={14} style={{ color: "#237A92" }} />
                    </div>
                    <h2 className="text-lg font-bold" style={{ color: "#1C3A48" }}>Extra Benefits</h2>
                  </div>

                  <SectionQ question="How important is dental coverage to you?" />
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    {([
                      { value: "not" as const, label: "Not important" },
                      { value: "somewhat" as const, label: "Somewhat" },
                      { value: "very" as const, label: "Very important" },
                    ] as const).map((o) => (
                      <OptionBtn key={o.value} value={o.value} selected={profile.dentalImportance === o.value} label={o.label} onSelect={(v) => set("dentalImportance", v)} accent="#1C3A48" />
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <SectionQ question="Vision coverage?" />
                      <div className="space-y-1.5">
                        {([
                          { value: "not" as const, label: "Not important" },
                          { value: "somewhat" as const, label: "Somewhat" },
                          { value: "very" as const, label: "Very important" },
                        ] as const).map((o) => (
                          <OptionBtn key={o.value} value={o.value} selected={profile.visionImportance === o.value} label={o.label} onSelect={(v) => set("visionImportance", v)} accent="#1C3A48" />
                        ))}
                      </div>
                    </div>
                    <div>
                      <SectionQ question="Hearing coverage?" />
                      <div className="space-y-1.5">
                        {([
                          { value: "not" as const, label: "Not important" },
                          { value: "somewhat" as const, label: "Somewhat" },
                          { value: "very" as const, label: "Very important" },
                        ] as const).map((o) => (
                          <OptionBtn key={o.value} value={o.value} selected={profile.hearingImportance === o.value} label={o.label} onSelect={(v) => set("hearingImportance", v)} accent="#1C3A48" />
                        ))}
                      </div>
                    </div>
                  </div>

                  <SectionQ question="Do you need any of these additional benefits?" />
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "needsTransportation" as const, icon: Car, label: "Transportation" },
                      { key: "wantsOTC" as const, icon: ShoppingBag, label: "OTC Allowance" },
                      { key: "wantsFitness" as const, icon: Dumbbell, label: "Fitness Benefit" },
                    ].map(({ key, icon: Icon, label }) => (
                      <div key={key} className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1">
                          <Icon size={12} />
                          {label}
                        </div>
                        <OptionBtn value="yes" selected={profile[key] === "yes"} label="Yes" onSelect={(v) => set(key, v)} accent="#1C3A48" />
                        <OptionBtn value="no" selected={profile[key] === "no"} label="No" onSelect={(v) => set(key, v)} accent="#1C3A48" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 5: Preferences */}
              {step === 5 && (
                <div>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EEF5F7" }}>
                      <Users size={14} style={{ color: "#237A92" }} />
                    </div>
                    <h2 className="text-lg font-bold" style={{ color: "#1C3A48" }}>Provider & Plan Preferences</h2>
                  </div>

                  <SectionQ question="Do you have specific doctors you want to keep seeing?" />
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    <OptionBtn value="yes" selected={profile.hasSpecificDoctors === "yes"} label="Yes" sublabel="I want to keep my current doctors" onSelect={(v) => set("hasSpecificDoctors", v)} accent="#1C3A48" />
                    <OptionBtn value="no" selected={profile.hasSpecificDoctors === "no"} label="No" sublabel="I'm open to any in-network doctors" onSelect={(v) => set("hasSpecificDoctors", v)} accent="#1C3A48" />
                  </div>

                  <SectionQ question="Do you prefer a specific plan type?" />
                  <div className="space-y-2 mb-5">
                    {([
                      { value: "hmo" as const, label: "HMO", sublabel: "Lower costs, requires referrals, in-network only" },
                      { value: "ppo" as const, label: "PPO", sublabel: "More flexibility, can see out-of-network doctors" },
                      { value: "no-preference" as const, label: "No preference", sublabel: "Show me the best options regardless of type" },
                    ] as const).map((o) => (
                      <OptionBtn key={o.value} value={o.value} selected={profile.planTypePreference === o.value} label={o.label} sublabel={o.sublabel} onSelect={(v) => set("planTypePreference", v)} accent="#1C3A48" />
                    ))}
                  </div>

                  <SectionQ question="What is your top priority when choosing a plan?" />
                  <div className="space-y-2">
                    {([
                      { value: "lowest-premium" as const, label: "Lowest monthly premium", sublabel: "Minimize my monthly cost", icon: DollarSign },
                      { value: "lowest-oop" as const, label: "Lowest out-of-pocket max", sublabel: "Protect against large medical bills", icon: Shield },
                      { value: "best-benefits" as const, label: "Best extra benefits", sublabel: "Dental, vision, OTC, fitness, etc.", icon: Award },
                      { value: "largest-network" as const, label: "Largest doctor network", sublabel: "Maximum flexibility in providers", icon: Users },
                    ] as const).map((o) => (
                      <OptionBtn key={o.value} value={o.value} selected={profile.topPriority === o.value} label={o.label} sublabel={o.sublabel} onSelect={(v) => set("topPriority", v)} accent="#1C3A48" />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
                style={{ borderColor: "#E2EAED", color: "#3E5560" }}
              >
                <ArrowLeft size={15} />
                Back
              </button>

              <div className="text-xs text-gray-400">
                Step {step} of 5
              </div>

              <button
                onClick={handleNext}
                disabled={!stepComplete || recommendMutation.isPending}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                style={{
                  backgroundColor: !stepComplete || recommendMutation.isPending ? "#9CA3AF" : step === 5 ? "#1C3A48" : "#1C3A48",
                }}
              >
                {recommendMutation.isPending ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Analyzing…
                  </>
                ) : step === 5 ? (
                  <>
                    <Sparkles size={15} />
                    Get My Recommendations
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>

            {recommendMutation.isError && (
              <div className="mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ color: "#1C3A48", backgroundColor: "#EEF5F7" }}>
                <AlertCircle size={13} />
                {recommendMutation.error.message || "Failed to get recommendations. Please try again."}
              </div>
            )}
          </>
        )}

        {/* ── Results ──────────────────────────────────────────────────────── */}
        {step === "results" && results && (
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold" style={{ color: "#1C3A48" }}>
                  Your Personalized Results
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {results.totalPlansScored} plans analyzed for ZIP {zip} · Top {results.rankedPlans.length} matches shown
                </p>
              </div>
              <button
                onClick={() => { setStep("zip"); setProfile(EMPTY_PROFILE); setResults(null); }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-all"
                style={{ borderColor: "#E2EAED", color: "#3E5560" }}
              >
                <RotateCcw size={12} />
                Start Over
              </button>
            </div>

            {/* AI Narrative */}
            {results.aiNarrative && (
              <div
                className="rounded-xl p-5 mb-6 border"
                style={{ backgroundColor: "#EEF5F7", borderColor: "#C6DAE0" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: "#1C3A48" }}
                  >
                    <Sparkles size={14} className="text-white" />
                  </div>
                  <span className="text-sm font-bold" style={{ color: "#1C3A48" }}>
                    AI Advisor Analysis
                  </span>
                </div>
                <div className="prose prose-sm max-w-none text-gray-700">
                  <Streamdown>{results.aiNarrative}</Streamdown>
                </div>
              </div>
            )}

            {/* Ranked plan cards */}
            <div className="space-y-4">
              {results.rankedPlans.map((plan, i) => (
                <div
                  key={plan.id}
                  className="bg-white rounded-xl p-5 border-2 transition-all"
                  style={{
                    borderColor: i === 0 ? "#1C3A48" : "#E8F2F5",
                    boxShadow: i === 0 ? "0 4px 20px rgba(28,58,72,0.1)" : "0 1px 4px rgba(28,58,72,0.06)",
                  }}
                >
                  {/* Rank badge */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0"
                        style={{
                          backgroundColor: i === 0 ? "#1C3A48" : i === 1 ? "#1C3A48" : "#E8F2F5",
                          color: i < 2 ? "white" : "#1C3A48",
                        }}
                      >
                        #{i + 1}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{plan.carrier}</div>
                        <h3 className="text-base font-bold leading-snug" style={{ color: "#1C3A48" }}>
                          {plan.planName}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: "#E8F2F5", color: "#1C3A48" }}>
                            {plan.planType}
                          </span>
                          <StarRating rating={plan.starRating} size={11} />
                        </div>
                      </div>
                    </div>

                    {/* Match score */}
                    <div className="text-center shrink-0">
                      <div
                        className="text-2xl font-bold"
                        style={{ color: plan.matchScore >= 75 ? "#237A92" : plan.matchScore >= 55 ? "#3E5560" : "#1C3A48" }}
                      >
                        {plan.matchScore}%
                      </div>
                      <div className="text-[10px] text-gray-400 font-medium">match</div>
                    </div>
                  </div>

                  {/* Cost row */}
                  <div className="grid grid-cols-3 gap-3 p-3 rounded-xl mb-4" style={{ backgroundColor: "#FAF9F5" }}>
                    <div className="text-center">
                      <div className="text-xl font-bold" style={{ color: plan.premium === 0 ? "#1C3A48" : "#1C3A48" }}>
                        {plan.premium === 0 ? "$0" : `$${plan.premium}`}
                      </div>
                      <div className="text-[10px] text-gray-500">/mo premium</div>
                    </div>
                    <div className="text-center border-x border-gray-200">
                      <div className="text-lg font-bold" style={{ color: "#1C3A48" }}>
                        ${plan.maxOutOfPocket.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-gray-500">max OOP</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold" style={{ color: "#1C3A48" }}>
                        ${plan.estimatedAnnualCost.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-gray-500">est. annual</div>
                    </div>
                  </div>

                  {/* Match reasons */}
                  {plan.matchReasons.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1.5">Why it matches you:</p>
                      <div className="space-y-1">
                        {plan.matchReasons.map((r) => (
                          <div key={r} className="flex items-start gap-1.5 text-xs text-gray-600">
                            <CheckCircle2 size={11} className="mt-0.5 shrink-0" style={{ color: "#237A92" }} />
                            {r}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Watch-outs */}
                  {plan.watchOuts.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-500 mb-1.5">Things to consider:</p>
                      <div className="space-y-1">
                        {plan.watchOuts.map((w) => (
                          <div key={w} className="flex items-start gap-1.5 text-xs" style={{ color: "#3E5560" }}>
                            <AlertCircle size={11} className="mt-0.5 shrink-0" />
                            {w}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/plans?zip=${zip}&extraHelp=${profile.extraHelp || 'not-sure'}`)}
                      className="flex-1 py-2.5 text-sm font-bold rounded-xl border-2 transition-all"
                      style={{ borderColor: "#1C3A48", color: "#1C3A48" }}
                    >
                      View All Plans
                    </button>
                    <button
                      className="flex-1 py-2.5 text-sm font-bold rounded-xl text-white flex items-center justify-center gap-1.5 transition-all"
                      style={{ backgroundColor: i === 0 ? "#1C3A48" : "#1C3A48" }}
                    >
                      Enroll Now
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Disclaimer */}
            <div className="mt-6 p-4 rounded-xl bg-white text-xs text-gray-400" style={{ border: "1px solid #E8F2F5" }}>
              <strong className="text-gray-500">Disclaimer:</strong> Match scores are calculated using your health profile and CMS 2026 plan data. Estimated annual costs are projections based on typical utilization. Always verify plan details with the carrier before enrolling.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
