/**
 * Verify Coverage — pVerify Eligibility Check Page
 *
 * Allows users to check their Medicare eligibility and see their current
 * Medicare Advantage plan details by entering their name, DOB, and optional MBI.
 *
 * PRIVACY: No PII is stored in the browser beyond the current session.
 * The server purges all PII immediately after the API call.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Lock,
  Search,
  Activity,
  Heart,
  Pill,
  Eye,
  Ear,
  Smile,
  DollarSign,
  Calendar,
  Info,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EligibilityResult {
  isActive: boolean;
  partA: { active: boolean; effectiveDate: string | null };
  partB: { active: boolean; effectiveDate: string | null };
  currentPlan: {
    planName: string;
    planId: string;
    carrier: string;
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
  } | null;
  isMockData: boolean;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CoverageStatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
      style={{
        backgroundColor: active ? "#EEF5F7" : "#FEF2F2",
        color: active ? "#237A92" : "#991B1B",
      }}
    >
      {active ? (
        <CheckCircle2 size={15} className="shrink-0" />
      ) : (
        <AlertCircle size={15} className="shrink-0" />
      )}
      <span>
        {label}: <strong>{active ? "Active" : "Inactive"}</strong>
      </span>
    </div>
  );
}

function BenefitRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  const display = typeof value === "number" ? (value === 0 ? "$0" : `$${value}`) : value;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2.5 text-sm text-gray-600">
        <Icon size={15} style={{ color: "#1C3A48" }} className="shrink-0" />
        {label}
      </div>
      <span className="text-sm font-semibold text-gray-900">{display}</span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function VerifyCoverage() {
  const [, navigate] = useLocation();

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [mbi, setMbi] = useState("");
  const [formError, setFormError] = useState("");

  // Result state
  const [result, setResult] = useState<EligibilityResult | null>(null);

  const eligibilityMutation = trpc.pverify.eligibilityCheck.useMutation({
    onSuccess: (data) => {
      setResult(data.data as EligibilityResult);
    },
    onError: (err) => {
      setFormError(err.message || "Failed to check eligibility. Please try again.");
    },
  });

  // Auto-format DOB as MM/DD/YYYY while typing
  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length >= 3) val = val.slice(0, 2) + "/" + val.slice(2);
    if (val.length >= 6) val = val.slice(0, 5) + "/" + val.slice(5);
    val = val.slice(0, 10);
    setDob(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!firstName.trim()) return setFormError("First name is required.");
    if (!lastName.trim()) return setFormError("Last name is required.");
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) return setFormError("Date of birth must be in MM/DD/YYYY format.");

    eligibilityMutation.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dob,
      mbi: mbi.trim() || undefined,
    });
  };

  const handleReset = () => {
    setResult(null);
    setFirstName("");
    setLastName("");
    setDob("");
    setMbi("");
    setFormError("");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAF9F5" }}>
      <Header />

      {/* ── Page Hero ─────────────────────────────────────────────────────── */}
      <section
        className="py-14"
        style={{
          backgroundColor: "#1C3A48",
        }}
      >
        <div className="container text-center">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-4"
            style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "white" }}
          >
            <Shield size={12} />
            Real-Time Medicare Eligibility Verification
          </div>
          <h1
            className="text-3xl lg:text-4xl font-bold text-white mb-3"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            Verify Your Medicare Coverage
          </h1>
          <p className="text-white/80 text-lg max-w-xl mx-auto">
            Check your Medicare Part A & B status and see your current Medicare Advantage plan
            details in seconds.
          </p>
        </div>
      </section>

      <div className="container py-12">
        <div className="max-w-2xl mx-auto">
          {!result ? (
            /* ── Lookup Form ──────────────────────────────────────────────── */
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              {/* Privacy notice */}
              <div
                className="flex items-start gap-3 p-4 rounded-xl mb-6 text-sm"
                style={{ backgroundColor: "#EEF5F7", color: "#1C3A48" }}
              >
                <Lock size={16} className="mt-0.5 shrink-0" />
                <div>
                  <strong>Your privacy is protected.</strong> We use your information only to
                  check your Medicare eligibility. No data is stored or shared.
                </div>
              </div>

              <h2 className="text-xl font-bold mb-6" style={{ color: "#1C3A48" }}>
                Enter Your Information
              </h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName" className="text-sm font-medium text-gray-700 mb-1.5 block">
                      First Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      maxLength={50}
                      className="h-11"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-sm font-medium text-gray-700 mb-1.5 block">
                      Last Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Smith"
                      maxLength={50}
                      className="h-11"
                    />
                  </div>
                </div>

                {/* DOB */}
                <div>
                  <Label htmlFor="dob" className="text-sm font-medium text-gray-700 mb-1.5 block">
                    Date of Birth <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dob"
                    value={dob}
                    onChange={handleDobChange}
                    placeholder="MM/DD/YYYY"
                    inputMode="numeric"
                    maxLength={10}
                    className="h-11"
                  />
                </div>

                {/* MBI (optional) */}
                <div>
                  <Label htmlFor="mbi" className="text-sm font-medium text-gray-700 mb-1.5 block">
                    Medicare Beneficiary ID (MBI){" "}
                    <span className="text-gray-400 font-normal">— optional</span>
                  </Label>
                  <Input
                    id="mbi"
                    value={mbi}
                    onChange={(e) => setMbi(e.target.value.toUpperCase())}
                    placeholder="e.g. 1EG4-TE5-MK72"
                    maxLength={20}
                    className="h-11 font-mono"
                  />
                  <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                    <Info size={11} />
                    Found on your red, white, and blue Medicare card. Providing it improves accuracy.
                  </p>
                </div>

                {/* Error */}
                {formError && (
                  <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-3 rounded-lg">
                    <AlertCircle size={15} className="shrink-0" />
                    {formError}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={eligibilityMutation.isPending}
                  className="w-full h-12 text-base font-semibold rounded-xl"
                  style={{ backgroundColor: "#1C3A48", color: "white" }}
                >
                  {eligibilityMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Activity size={16} className="animate-pulse" />
                      Checking Coverage…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Search size={16} />
                      Check My Coverage
                    </span>
                  )}
                </Button>
              </form>

              {/* Trust badges */}
              <div className="flex flex-wrap justify-center gap-4 mt-6 pt-6 border-t border-gray-100">
                {[
                  { icon: Lock, text: "256-bit SSL encryption" },
                  { icon: Shield, text: "HIPAA-compliant" },
                  { icon: CheckCircle2, text: "No data stored" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Icon size={12} style={{ color: "#1C3A48" }} />
                    {text}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ── Results Card ─────────────────────────────────────────────── */
            <div className="space-y-6">
              {/* Mock data notice */}
              {result.isMockData && (
                <div
                  className="flex items-start gap-3 p-4 rounded-xl text-sm"
                  style={{ backgroundColor: "#FEF9C3", color: "#854D0E" }}
                >
                  <Info size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <strong>Demo mode:</strong> Showing sample data because pVerify credentials
                    are not yet configured. Real eligibility data will appear once credentials are
                    set up.
                  </div>
                </div>
              )}

              {/* Coverage status */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold" style={{ color: "#1C3A48" }}>
                    Medicare Coverage Status
                  </h2>
                  <div
                    className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: result.isActive ? "#EEF5F7" : "#FEE2E2",
                      color: result.isActive ? "#237A92" : "#991B1B",
                    }}
                  >
                    {result.isActive ? "✓ Active Coverage" : "⚠ Inactive"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <CoverageStatusBadge active={result.partA.active} label="Medicare Part A" />
                  <CoverageStatusBadge active={result.partB.active} label="Medicare Part B" />
                </div>

                {(result.partA.effectiveDate || result.partB.effectiveDate) && (
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
                    {result.partA.effectiveDate && (
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        Part A effective: {result.partA.effectiveDate}
                      </span>
                    )}
                    {result.partB.effectiveDate && (
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        Part B effective: {result.partB.effectiveDate}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Current MA plan */}
              {result.currentPlan ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                        Current Medicare Advantage Plan
                      </p>
                      <h3 className="text-lg font-bold" style={{ color: "#1C3A48" }}>
                        {result.currentPlan.planName}
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {result.currentPlan.carrier} · Plan ID: {result.currentPlan.planId}
                      </p>
                    </div>
                    <div
                      className="px-3 py-1 rounded-full text-xs font-bold shrink-0"
                      style={{ backgroundColor: "#EEF5F7", color: "#237A92" }}
                    >
                      Active
                    </div>
                  </div>

                  {/* Key financials */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { label: "Monthly Premium", value: result.currentPlan.premium === 0 ? "$0" : `$${result.currentPlan.premium}` },
                      { label: "Annual Deductible", value: result.currentPlan.deductible === 0 ? "$0" : `$${result.currentPlan.deductible}` },
                      { label: "Out-of-Pocket Max", value: `$${result.currentPlan.oopMax.toLocaleString()}` },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="text-center p-3 rounded-xl"
                        style={{ backgroundColor: "#EEF5F7" }}
                      >
                        <div className="text-xl font-bold" style={{ color: "#1C3A48" }}>
                          {value}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Copays & benefits */}
                  <div className="border border-gray-100 rounded-xl px-4 py-1">
                    <BenefitRow icon={Heart} label="Primary Care Visit" value={result.currentPlan.pcpCopay} />
                    <BenefitRow icon={Activity} label="Specialist Visit" value={result.currentPlan.specialistCopay} />
                    <BenefitRow icon={AlertCircle} label="Urgent Care" value={result.currentPlan.urgentCareCopay} />
                    <BenefitRow icon={AlertCircle} label="Emergency Room" value={result.currentPlan.erCopay} />
                    <BenefitRow icon={Activity} label="Inpatient Hospital" value={result.currentPlan.inpatientCost} />
                    <BenefitRow icon={Pill} label="Tier 1 Drugs (Generic)" value={result.currentPlan.drugTier1Copay} />
                    <BenefitRow icon={Pill} label="Tier 2 Drugs (Preferred Brand)" value={result.currentPlan.drugTier2Copay} />
                    <BenefitRow icon={Pill} label="Tier 3 Drugs (Non-Preferred)" value={result.currentPlan.drugTier3Copay} />
                    <BenefitRow icon={Smile} label="Dental Coverage" value={result.currentPlan.dentalCoverage} />
                    <BenefitRow icon={Eye} label="Vision Coverage" value={result.currentPlan.visionCoverage} />
                    <BenefitRow icon={Ear} label="Hearing Coverage" value={result.currentPlan.hearingCoverage} />
                  </div>

                  {/* Plan dates */}
                  <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      Effective: {result.currentPlan.effectiveDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      Through: {result.currentPlan.terminationDate}
                    </span>
                  </div>

                  {/* CTA */}
                  <div
                    className="mt-5 p-4 rounded-xl"
                    style={{ backgroundColor: "#EEF5F7", border: "1px solid #C6DAE0" }}
                  >
                    <p className="text-sm font-medium text-gray-800 mb-3">
                      Want to see if there's a better plan available in your area?
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => navigate("/plans?zip=")}
                        className="flex items-center gap-2 text-sm font-semibold h-10 px-5 rounded-lg"
                        style={{ backgroundColor: "#1C3A48", color: "white" }}
                      >
                        Compare Plans in Your Area
                        <ChevronRight size={15} />
                      </Button>
                      <Button
                        onClick={() => navigate("/find-best-plan")}
                        variant="outline"
                        className="flex items-center gap-2 text-sm font-semibold h-10 px-5 rounded-lg border-gray-300"
                        style={{ color: "#1C3A48" }}
                      >
                        Get Personalized Recommendation
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* No MA plan found */
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: "#EEF5F7" }}
                  >
                    <DollarSign size={24} style={{ color: "#1C3A48" }} />
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={{ color: "#1C3A48" }}>
                    No Medicare Advantage Plan Found
                  </h3>
                  <p className="text-gray-500 text-sm mb-5 max-w-sm mx-auto">
                    You appear to be on Original Medicare (Parts A & B). You may be eligible for a
                    Medicare Advantage plan that could save you money and add extra benefits.
                  </p>
                  <Button
                    onClick={() => navigate("/plans?zip=")}
                    className="flex items-center gap-2 text-sm font-semibold h-10 px-6 rounded-lg mx-auto"
                    style={{ backgroundColor: "#1C3A48", color: "white" }}
                  >
                    Explore Medicare Advantage Plans
                    <ChevronRight size={15} />
                  </Button>
                </div>
              )}

              {/* Check again */}
              <div className="text-center">
                <button
                  onClick={handleReset}
                  className="text-sm font-medium hover:underline"
                  style={{ color: "#1C3A48" }}
                >
                  ← Check a different person
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
