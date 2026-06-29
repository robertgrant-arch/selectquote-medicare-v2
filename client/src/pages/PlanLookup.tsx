/**
 * Plan Lookup Tool — pVerify-powered eligibility lookup + AI plan comparison
 * Color scheme: #1C3A48 primary, #1C3A48 CTA
 *
 * PRIVACY: Only a Medicare ID is collected. It is cleared from state immediately
 * after the lookup completes and is never persisted to any database or log.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import {
  Shield,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Loader2,
  Search,
  TrendingDown,
  TrendingUp,
  Minus,
  AlertCircle,
  Phone,
  BookmarkPlus,
  Sparkles,
  Lock,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CurrentPlanData {
  planName: string;
  planId: string;
  payerId: string;
  memberName?: string;
  status: string;
  effectiveDate: string;
  terminationDate: string;
  premium: number;
  deductible: number;
  oopMax: number;
  pcpCopay: number;
  specialistCopay: number;
  urgentCareCopay: number;
  erCopay: number;
  inpatientCost: string;
  drugTier1Copay: number;
  drugTier2Copay: number;
  drugTier3Copay: number;
  dentalCoverage: string;
  visionCoverage: string;
  hearingCoverage: string;
}

interface PotentialPlan {
  id: string;
  planName: string;
  carrier: string;
  premium: number;
  deductible: number;
  oopMax: number;
  pcpCopay: number;
  specialistCopay: number;
  urgentCareCopay: number;
  erCopay: number;
  drugTier1Copay: number;
  drugTier2Copay: number;
  drugTier3Copay: number;
  dentalCoverage: string;
  visionCoverage: string;
  hearingCoverage: string;
}

interface ComparisonResult {
  summary: string;
  currentPlanPros: string[];
  currentPlanCons: string[];
  potentialPlanPros: string[];
  potentialPlanCons: string[];
  recommendation: string;
  estimatedAnnualCostCurrent: number;
  estimatedAnnualCostPotential: number;
}

// ─── Mock potential plans ────────────────────────────────────────────────────

const POTENTIAL_PLANS: PotentialPlan[] = [
  {
    id: "humana-h1036",
    planName: "Humana Gold Plus H1036-286 (HMO)",
    carrier: "Humana",
    premium: 0,
    deductible: 0,
    oopMax: 3400,
    pcpCopay: 5,
    specialistCopay: 35,
    urgentCareCopay: 30,
    erCopay: 90,
    drugTier1Copay: 0,
    drugTier2Copay: 4,
    drugTier3Copay: 38,
    dentalCoverage: "$1,000 comprehensive/year",
    visionCoverage: "$100 eyewear allowance/year",
    hearingCoverage: "$500 hearing aid allowance",
  },
  {
    id: "aetna-hmo",
    planName: "Aetna Medicare Advantage HMO",
    carrier: "Aetna",
    premium: 35,
    deductible: 0,
    oopMax: 3000,
    pcpCopay: 0,
    specialistCopay: 30,
    urgentCareCopay: 30,
    erCopay: 100,
    drugTier1Copay: 0,
    drugTier2Copay: 10,
    drugTier3Copay: 40,
    dentalCoverage: "$2,000 comprehensive/year",
    visionCoverage: "$200 eyewear allowance/year",
    hearingCoverage: "Not covered",
  },
  {
    id: "wellcare-value",
    planName: "WellCare Value (HMO)",
    carrier: "WellCare",
    premium: 0,
    deductible: 195,
    oopMax: 5500,
    pcpCopay: 15,
    specialistCopay: 50,
    urgentCareCopay: 40,
    erCopay: 120,
    drugTier1Copay: 1,
    drugTier2Copay: 8,
    drugTier3Copay: 45,
    dentalCoverage: "Preventive only",
    visionCoverage: "$100 eyewear allowance/year",
    hearingCoverage: "Not covered",
  },
];

// ─── Helper components ───────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold text-gray-800">{value}</span>
    </div>
  );
}

function CopayBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
      <div className="text-lg font-bold" style={{ color: "#1C3A48" }}>
        {typeof value === "number" ? `$${value}` : value}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function CompareCell({
  current,
  potential,
  lowerIsBetter = true,
}: {
  current: number | string;
  potential: number | string;
  lowerIsBetter?: boolean;
}) {
  const numCurrent = typeof current === "number" ? current : parseFloat(String(current).replace(/[^0-9.]/g, "")) || 0;
  const numPotential = typeof potential === "number" ? potential : parseFloat(String(potential).replace(/[^0-9.]/g, "")) || 0;

  const currentBetter = lowerIsBetter ? numCurrent < numPotential : numCurrent > numPotential;
  const potentialBetter = lowerIsBetter ? numPotential < numCurrent : numPotential > numCurrent;
  const tied = numCurrent === numPotential;

  const currentStyle = tied ? "text-gray-700" : currentBetter ? "text-[#1C3A48] font-bold" : "text-red-600";
  const potentialStyle = tied ? "text-gray-700" : potentialBetter ? "text-[#1C3A48] font-bold" : "text-red-600";

  const currentIcon = tied ? (
    <Minus size={12} className="text-gray-400 inline ml-1" />
  ) : currentBetter ? (
    <TrendingDown size={12} className="text-green-600 inline ml-1" />
  ) : (
    <TrendingUp size={12} className="text-red-500 inline ml-1" />
  );

  const potentialIcon = tied ? (
    <Minus size={12} className="text-gray-400 inline ml-1" />
  ) : potentialBetter ? (
    <TrendingDown size={12} className="text-green-600 inline ml-1" />
  ) : (
    <TrendingUp size={12} className="text-red-500 inline ml-1" />
  );

  const fmt = (v: number | string) =>
    typeof v === "number" ? `$${v.toLocaleString()}` : v;

  return (
    <>
      <td className={`px-4 py-3 text-sm text-center ${currentStyle}`}>
        {fmt(current)}
        {currentIcon}
      </td>
      <td className={`px-4 py-3 text-sm text-center ${potentialStyle}`}>
        {fmt(potential)}
        {potentialIcon}
      </td>
    </>
  );
}

function TextCompareCell({ current, potential }: { current: string; potential: string }) {
  const currentHas = current !== "Not covered";
  const potentialHas = potential !== "Not covered";

  return (
    <>
      <td className={`px-4 py-3 text-sm text-center ${currentHas ? "text-[#1C3A48] font-medium" : "text-gray-400"}`}>
        {currentHas ? <CheckCircle2 size={14} className="inline mr-1 text-green-600" /> : <XCircle size={14} className="inline mr-1 text-red-400" />}
        {current}
      </td>
      <td className={`px-4 py-3 text-sm text-center ${potentialHas ? "text-[#1C3A48] font-medium" : "text-gray-400"}`}>
        {potentialHas ? <CheckCircle2 size={14} className="inline mr-1 text-green-600" /> : <XCircle size={14} className="inline mr-1 text-red-400" />}
        {potential}
      </td>
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PlanLookup() {
  // Form state — only Medicare ID is collected, no other PII
  const [medicareId, setMedicareId] = useState("");
  const [consent, setConsent] = useState(false);
  const [formError, setFormError] = useState("");

  // Results state
  const [currentPlan, setCurrentPlan] = useState<CurrentPlanData | null>(null);
  const [selectedPotentialId, setSelectedPotentialId] = useState<string>("");
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [savedComparison, setSavedComparison] = useState(false);

  // tRPC mutations
  const lookupMutation = trpc.pverify.lookup.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setCurrentPlan(data.data as CurrentPlanData);
        setComparisonResult(null);
        setSelectedPotentialId("");
        // PRIVACY: Clear the Medicare ID from state immediately after lookup completes.
        // It is never stored in any database, log, or persistent store.
        setMedicareId("");
      }
    },
    onError: (err) => {
      setFormError(err.message || "Lookup failed. Please try again.");
      // PRIVACY: Clear the Medicare ID on error as well — never retain it.
      setMedicareId("");
    },
  });

  const compareMutation = trpc.pverify.compare.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setComparisonResult(data.data as ComparisonResult);
      }
    },
  });

  const handleLookup = () => {
    if (!medicareId.trim()) {
      setFormError("Please enter your Medicare ID.");
      return;
    }
    if (!consent) {
      setFormError("Please check the consent checkbox to continue.");
      return;
    }
    setFormError("");
    lookupMutation.mutate({ medicareId });
  };

  const handleCompare = () => {
    if (!currentPlan || !selectedPotentialId) return;
    const potential = POTENTIAL_PLANS.find((p) => p.id === selectedPotentialId);
    if (!potential) return;
    compareMutation.mutate({ currentPlan, potentialPlan: potential });
  };

  const selectedPotential = POTENTIAL_PLANS.find((p) => p.id === selectedPotentialId) ?? null;
  const savings =
    comparisonResult
      ? comparisonResult.estimatedAnnualCostCurrent - comparisonResult.estimatedAnnualCostPotential
      : 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAF9F5" }}>
      <Header />

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div
        className="py-10"
        style={{ backgroundColor: "#1C3A48" }}
      >
        <div className="container max-w-4xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Search size={20} className="text-white" />
            </div>
            <h1
              className="text-3xl font-bold text-white"
              style={{ fontFamily: "'DM Sans', serif" }}
            >
              Plan Lookup Tool
            </h1>
          </div>
          <p className="text-white/80 text-base max-w-xl">
            Enter your Medicare ID to look up your current plan. Your ID is never stored.
          </p>
          {/* pVerify badge */}
          <div className="inline-flex items-center gap-2 mt-4 bg-white/10 border border-white/20 rounded-full px-3 py-1.5">
            <Shield size={13} className="text-blue-200" />
            <span className="text-xs font-semibold text-white/90">pVerify Powered Eligibility</span>
          </div>
        </div>
      </div>

      <div className="container max-w-4xl py-10 space-y-8">

        {/* ── Section A: Eligibility Lookup Form ──────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: "#1C3A48" }}
            >
              1
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Look Up My Current Plan</h2>
              <p className="text-sm text-gray-500">
                Enter your Medicare ID to look up your current plan. Your ID is never stored.
              </p>
            </div>
          </div>

          <div className="p-6">
            {/* Single Medicare ID input */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Medicare ID
              </label>
              <input
                type="text"
                value={medicareId}
                onChange={(e) => {
                  setMedicareId(e.target.value);
                  setFormError("");
                }}
                onKeyDown={(e) => { if (e.key === "Enter") handleLookup(); }}
                placeholder="e.g. 1EG4-TE5-MK72"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base outline-none focus:border-green-500 transition-colors font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              {/* Privacy note directly below input */}
              <div className="flex items-center gap-1.5 mt-2">
                <Lock size={11} className="text-gray-400 shrink-0" />
                <span className="text-xs text-gray-400">
                  Never stored · Purged after lookup
                </span>
              </div>
            </div>

            {/* Consent */}
            <label className="flex items-start gap-3 cursor-pointer mb-5 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-[#1C3A48]"
              />
              <span className="text-sm text-gray-700">
                I consent to look up my eligibility information. I understand this is a simulated
                lookup for demonstration purposes only.
              </span>
            </label>

            {formError && (
              <div className="flex items-center gap-2 text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-xl border border-red-100">
                <AlertCircle size={15} />
                {formError}
              </div>
            )}

            <button
              onClick={handleLookup}
              disabled={!consent || lookupMutation.isPending}
              className="w-full sm:w-auto px-8 py-3 rounded-xl text-white font-bold text-sm flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: consent ? "#1C3A48" : "#9CA3AF" }}
            >
              {lookupMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Looking up your plan...
                </>
              ) : (
                <>
                  <Search size={16} />
                  Look Up My Plan
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Current Plan Card ────────────────────────────────────────── */}
        {currentPlan && (
          <div className="bg-white rounded-xl border-2 border-[#C8D8F5] shadow-sm overflow-hidden">
            {/* Green header */}
            <div
              className="px-6 py-4 flex items-center gap-3"
              style={{ backgroundColor: "#1C3A48" }}
            >
              <CheckCircle2 size={22} className="text-white" />
              <div>
                <div className="text-white font-bold text-base">We found your current plan</div>
                <div className="text-green-200 text-xs">
                  Eligibility verified · Status:{" "}
                  <span className="text-white font-semibold">{currentPlan.status}</span>
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-xs text-green-200">Coverage Period</div>
                <div className="text-white text-xs font-semibold">
                  {currentPlan.effectiveDate} – {currentPlan.terminationDate}
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Plan name + ID */}
              <div className="mb-5">
                <h3
                  className="text-xl font-bold text-gray-900 mb-1"
                  style={{ fontFamily: "'DM Sans', serif" }}
                >
                  {currentPlan.planName}
                </h3>
                <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                  <span>Plan ID: <strong className="text-gray-700">{currentPlan.planId}</strong></span>
                </div>
              </div>

              {/* Cost summary */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <CopayBadge label="Monthly Premium" value={currentPlan.premium === 0 ? "$0" : `$${currentPlan.premium}`} />
                <CopayBadge label="Annual Deductible" value={currentPlan.deductible === 0 ? "$0" : `$${currentPlan.deductible}`} />
                <CopayBadge label="Max Out-of-Pocket" value={`$${currentPlan.oopMax.toLocaleString()}`} />
              </div>

              {/* Two-column field grid */}
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 mb-6">
                <FieldRow label="PCP Copay" value={`$${currentPlan.pcpCopay} per visit`} />
                <FieldRow label="Specialist Copay" value={`$${currentPlan.specialistCopay} per visit`} />
                <FieldRow label="Urgent Care Copay" value={`$${currentPlan.urgentCareCopay} per visit`} />
                <FieldRow label="Emergency Room" value={`$${currentPlan.erCopay} per visit`} />
                <FieldRow label="Inpatient Hospital" value={currentPlan.inpatientCost} />
                <FieldRow label="Tier 1 (Generic) Rx" value={`$${currentPlan.drugTier1Copay} copay`} />
                <FieldRow label="Tier 2 (Brand) Rx" value={`$${currentPlan.drugTier2Copay} copay`} />
                <FieldRow label="Tier 3 (Non-Preferred) Rx" value={`$${currentPlan.drugTier3Copay} copay`} />
                <FieldRow label="Dental Coverage" value={currentPlan.dentalCoverage} />
                <FieldRow label="Vision Coverage" value={currentPlan.visionCoverage} />
                <FieldRow label="Hearing Coverage" value={currentPlan.hearingCoverage} />
              </div>
            </div>
          </div>
        )}

        {/* ── Section B: Compare to a Potential Plan ───────────────────── */}
        {currentPlan && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: "#1C3A48" }}
              >
                2
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Compare to a Potential Plan</h2>
                <p className="text-sm text-gray-500">Select a plan you're considering to see a detailed comparison.</p>
              </div>
            </div>

            <div className="p-6">
              {/* Potential plan dropdown */}
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select a Potential Plan
                </label>
                <div className="relative">
                  <select
                    value={selectedPotentialId}
                    onChange={(e) => {
                      setSelectedPotentialId(e.target.value);
                      setComparisonResult(null);
                      setSavedComparison(false);
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm outline-none focus:border-orange-400 transition-colors appearance-none bg-white font-medium"
                  >
                    <option value="">Choose a plan to compare...</option>
                    {POTENTIAL_PLANS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.planName} — ${p.premium}/mo · ${p.oopMax.toLocaleString()} MOOP · PCP ${p.pcpCopay}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>

              {/* Selected plan preview */}
              {selectedPotential && (
                <div
                  className="rounded-xl p-4 mb-5 border"
                  style={{ backgroundColor: "#FFF8F3", borderColor: "#FDDCBC" }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{selectedPotential.planName}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{selectedPotential.carrier}</div>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span>
                        <span className="text-gray-500">Premium: </span>
                        <strong style={{ color: "#1C3A48" }}>
                          {selectedPotential.premium === 0 ? "$0/mo" : `$${selectedPotential.premium}/mo`}
                        </strong>
                      </span>
                      <span>
                        <span className="text-gray-500">MOOP: </span>
                        <strong className="text-gray-800">${selectedPotential.oopMax.toLocaleString()}</strong>
                      </span>
                      <span>
                        <span className="text-gray-500">PCP: </span>
                        <strong className="text-gray-800">${selectedPotential.pcpCopay}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleCompare}
                disabled={!selectedPotentialId || compareMutation.isPending}
                className="px-8 py-3 rounded-xl text-white font-bold text-sm flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                style={{ backgroundColor: selectedPotentialId ? "#1C3A48" : "#9CA3AF" }}
              >
                {compareMutation.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Analyzing your plans...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Compare with AI
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Loading state ────────────────────────────────────────────── */}
        {compareMutation.isPending && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse"
              style={{ backgroundColor: "#E8F2F5" }}
            >
              <Sparkles size={28} style={{ color: "#1C3A48" }} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Analyzing your plans...</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Comparing premiums, copays, drug coverage, and extra benefits to generate your
              personalized recommendation.
            </p>
            <div className="flex justify-center gap-6 mt-5 text-xs text-gray-400">
              {["Comparing costs", "Evaluating benefits", "Generating recommendation"].map((step) => (
                <span key={step} className="flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ backgroundColor: "#1C3A48" }}
                  />
                  {step}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Comparison Results ───────────────────────────────────────── */}
        {comparisonResult && currentPlan && selectedPotential && !compareMutation.isPending && (
          <div className="space-y-6">
            {/* Results header */}
            <div className="flex items-center justify-between">
              <h2
                className="text-2xl font-bold text-gray-900"
                style={{ fontFamily: "'DM Sans', serif" }}
              >
                Comparison Results
              </h2>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <TrendingDown size={12} className="text-green-600" /> Better
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp size={12} className="text-red-500" /> Worse
                </span>
                <span className="flex items-center gap-1">
                  <Minus size={12} className="text-gray-400" /> Same
                </span>
              </div>
            </div>

            {/* a) Side-by-side comparison table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Side-by-Side Comparison</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-40">
                        Feature
                      </th>
                      <th
                        className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide"
                        style={{ color: "#1C3A48" }}
                      >
                        Current Plan
                        <div className="text-gray-500 font-normal normal-case mt-0.5 text-xs">
                          {currentPlan.planName.length > 30
                            ? currentPlan.planName.slice(0, 30) + "…"
                            : currentPlan.planName}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide"
                        style={{ color: "#1C3A48" }}
                      >
                        New Plan
                        <div className="text-gray-500 font-normal normal-case mt-0.5 text-xs">
                          {selectedPotential.planName.length > 30
                            ? selectedPotential.planName.slice(0, 30) + "…"
                            : selectedPotential.planName}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[
                      { label: "Monthly Premium", current: currentPlan.premium, potential: selectedPotential.premium },
                      { label: "Annual Deductible", current: currentPlan.deductible, potential: selectedPotential.deductible },
                      { label: "Max Out-of-Pocket", current: currentPlan.oopMax, potential: selectedPotential.oopMax },
                      { label: "PCP Copay", current: currentPlan.pcpCopay, potential: selectedPotential.pcpCopay },
                      { label: "Specialist Copay", current: currentPlan.specialistCopay, potential: selectedPotential.specialistCopay },
                      { label: "Urgent Care", current: currentPlan.urgentCareCopay, potential: selectedPotential.urgentCareCopay },
                      { label: "Emergency Room", current: currentPlan.erCopay, potential: selectedPotential.erCopay },
                      { label: "Tier 1 (Generic) Rx", current: currentPlan.drugTier1Copay, potential: selectedPotential.drugTier1Copay },
                      { label: "Tier 2 (Brand) Rx", current: currentPlan.drugTier2Copay, potential: selectedPotential.drugTier2Copay },
                      { label: "Tier 3 (Non-Pref) Rx", current: currentPlan.drugTier3Copay, potential: selectedPotential.drugTier3Copay },
                    ].map((row) => (
                      <tr key={row.label} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">{row.label}</td>
                        <CompareCell current={row.current} potential={row.potential} />
                      </tr>
                    ))}
                    {[
                      { label: "Dental", current: currentPlan.dentalCoverage, potential: selectedPotential.dentalCoverage },
                      { label: "Vision", current: currentPlan.visionCoverage, potential: selectedPotential.visionCoverage },
                      { label: "Hearing", current: currentPlan.hearingCoverage, potential: selectedPotential.hearingCoverage },
                    ].map((row) => (
                      <tr key={row.label} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">{row.label}</td>
                        <TextCompareCell current={row.current} potential={row.potential} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* b) AI Analysis summary */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={18} style={{ color: "#1C3A48" }} />
                <h3 className="font-bold text-gray-900">AI Analysis</h3>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">{comparisonResult.summary}</p>
            </div>

            {/* c) Pros/Cons two-column */}
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Current plan pros/cons */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: "#1C3A48" }}
                  >
                    C
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm">Current Plan</h4>
                </div>
                <div className="space-y-2 mb-4">
                  {comparisonResult.currentPlanPros.map((pro) => (
                    <div key={pro} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 size={14} className="text-green-600 mt-0.5 shrink-0" />
                      {pro}
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {comparisonResult.currentPlanCons.map((con) => (
                    <div key={con} className="flex items-start gap-2 text-sm text-gray-500">
                      <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                      {con}
                    </div>
                  ))}
                </div>
              </div>

              {/* Potential plan pros/cons */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: "#1C3A48" }}
                  >
                    N
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm">New Plan</h4>
                </div>
                <div className="space-y-2 mb-4">
                  {comparisonResult.potentialPlanPros.map((pro) => (
                    <div key={pro} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 size={14} className="text-green-600 mt-0.5 shrink-0" />
                      {pro}
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {comparisonResult.potentialPlanCons.map((con) => (
                    <div key={con} className="flex items-start gap-2 text-sm text-gray-500">
                      <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                      {con}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* d) Estimated Annual Cost */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4">Estimated Annual Cost</h3>
              <div className="grid sm:grid-cols-2 gap-6 mb-5">
                <div className="text-center p-5 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Current Plan
                  </div>
                  <div
                    className="text-4xl font-bold mb-1"
                    style={{ color: "#1C3A48", fontFamily: "'DM Sans', serif" }}
                  >
                    ${comparisonResult.estimatedAnnualCostCurrent.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">estimated per year</div>
                </div>
                <div className="text-center p-5 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    New Plan
                  </div>
                  <div
                    className="text-4xl font-bold mb-1"
                    style={{
                      color: savings > 0 ? "#1C3A48" : "#EF4444",
                      fontFamily: "'DM Sans', serif",
                    }}
                  >
                    ${comparisonResult.estimatedAnnualCostPotential.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">estimated per year</div>
                </div>
              </div>

              {/* Savings callout */}
              {savings > 0 && (
                <div
                  className="rounded-xl p-4 text-center"
                  style={{ backgroundColor: "#FFF8F3", border: "1px solid #FDDCBC" }}
                >
                  <div className="text-sm font-semibold" style={{ color: "#1C3A48" }}>
                    You could save approximately{" "}
                    <span className="text-xl font-bold">${savings.toLocaleString()}</span> per year
                    by switching to the new plan.
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Based on 6 PCP visits, 4 specialist visits, and 2 urgent care visits annually.
                  </div>
                </div>
              )}
              {savings <= 0 && (
                <div className="rounded-xl p-4 text-center bg-blue-50 border border-blue-100">
                  <div className="text-sm font-semibold text-blue-700">
                    Your current plan is estimated to cost less for typical usage patterns.
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Based on 6 PCP visits, 4 specialist visits, and 2 urgent care visits annually.
                  </div>
                </div>
              )}
            </div>

            {/* e) Recommendation box */}
            <div
              className="rounded-xl p-6"
              style={{ backgroundColor: "#FFF8F3", border: "2px solid #1C3A48" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={18} style={{ color: "#1C3A48" }} />
                <h3 className="font-bold text-gray-900">AI Recommendation</h3>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">{comparisonResult.recommendation}</p>
            </div>

            {/* f) Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setSavedComparison(true)}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm border-2 transition-all"
                style={{
                  borderColor: "#1C3A48",
                  color: savedComparison ? "white" : "#1C3A48",
                  backgroundColor: savedComparison ? "#1C3A48" : "transparent",
                }}
              >
                {savedComparison ? (
                  <>
                    <CheckCircle2 size={16} />
                    Comparison Saved!
                  </>
                ) : (
                  <>
                    <BookmarkPlus size={16} />
                    Save This Comparison
                  </>
                )}
              </button>
              <a
                href="tel:1-800-777-8002"
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all"
                style={{ backgroundColor: "#1C3A48" }}
              >
                <Phone size={16} />
                Talk to an Agent
              </a>
            </div>
          </div>
        )}

        {/* ── Disclaimer ───────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>
            Your Medicare ID is used only to perform a one-time eligibility lookup and is immediately
            purged from memory after use. It is never stored in a database, log, or any persistent
            system. Plan data shown is for illustrative purposes only.
          </span>
        </div>
      </div>
    </div>
  );
}
