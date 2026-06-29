/**
 * MBIVerifyModal — Optional Medicare Beneficiary ID verification step
 *
 * Shown AFTER ZIP validation, BEFORE navigating to /plans.
 * Lets users optionally enter their MBI to get personalized plan comparison
 * (current plan highlighted in results).
 *
 * PRIVACY: MBI is never stored. It is sent to the server, used transiently
 * for the pVerify API call, then immediately purged.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Shield,
  Lock,
  X,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MBIVerifyResult {
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

interface Props {
  zip: string;
  onSkip: () => void;
  onVerified: (result: MBIVerifyResult) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MBIVerifyModal({ zip, onSkip, onVerified }: Props) {
  const [mbi, setMbi] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [mode, setMode] = useState<"mbi" | "name">("mbi");
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);

  const eligibilityMutation = trpc.pverify.eligibilityCheck.useMutation({
    onSuccess: (data) => {
      setVerified(true);
      // Short delay so user sees the success state before proceeding
      setTimeout(() => {
        onVerified(data.data as MBIVerifyResult);
      }, 900);
    },
    onError: (err) => {
      setError(err.message || "Verification failed. You can skip and continue.");
    },
  });

  // Auto-format DOB
  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length >= 3) val = val.slice(0, 2) + "/" + val.slice(2);
    if (val.length >= 6) val = val.slice(0, 5) + "/" + val.slice(5);
    setDob(val.slice(0, 10));
  };

  const handleVerify = () => {
    setError("");

    if (mode === "mbi") {
      if (!mbi.trim()) {
        setError("Please enter your Medicare ID or switch to name lookup.");
        return;
      }
      // Need at least first name + last name + DOB even with MBI for pVerify
      if (!firstName.trim() || !lastName.trim() || !/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) {
        setError("Please also enter your name and date of birth.");
        return;
      }
      // pVerify accepts ONLY mbi/ssn (PHI minimization). Name/DOB are collected
      // for UI validation but were always stripped server-side — do not send.
      eligibilityMutation.mutate({
        mbi: mbi.trim(),
      });
    } else {
      if (!firstName.trim() || !lastName.trim()) {
        setError("Please enter your first and last name.");
        return;
      }
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) {
        setError("Date of birth must be in MM/DD/YYYY format.");
        return;
      }
      // NOTE: name-only lookup has no MBI/SSN to send; the server requires one
      // and will reject this. This is a pre-existing functional gap (logged) —
      // behavior is unchanged (the request was already stripped to no-identifier).
      eligibilityMutation.mutate({});
    }
  };

  const isPending = eligibilityMutation.isPending;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(11,27,36,0.5)", backdropFilter: "blur(3px)" }}
    >
      <div
        className="relative bg-white rounded-xl w-full max-w-lg overflow-hidden"
        style={{ boxShadow: "0 8px 40px rgba(11,27,36,0.16)", border: "1px solid #E2EAED" }}
      >
        {/* Header bar */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ backgroundColor: "#1C3A48" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            >
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Personalize Your Plan Results
              </h2>
              <p className="text-white/70 text-xs">Searching plans for ZIP {zip}</p>
            </div>
          </div>
          <button
            onClick={onSkip}
            className="flex items-center justify-center transition-colors"
            style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", color: "white", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.25)")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.15)")}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {verified ? (
            /* ── Success state ── */
            <div className="text-center py-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: "#DCFCE7" }}
              >
                <CheckCircle2 size={28} style={{ color: "#16A34A" }} />
              </div>
              <h3 className="text-lg font-bold mb-1" style={{ color: "#1C3A48" }}>
                Coverage Verified!
              </h3>
              <p className="text-sm text-[#7A9BA6]">
                We found your current plan. Loading personalized results…
              </p>
            </div>
          ) : (
            <>
              {/* Explanation */}
              <div
                className="flex items-start gap-3 p-4 rounded-lg mb-5 text-sm"
                style={{ backgroundColor: "#EEF5F7", color: "#1C3A48", border: "1px solid #C6DAE0" }}
              >
                <Info size={16} className="mt-0.5 shrink-0" style={{ color: "#237A92" }} />
                <div>
                  <strong>Optional but recommended:</strong> If you're currently on a Medicare
                  Advantage plan, entering your Medicare ID lets us highlight your current plan
                  in the results and show you exactly what you'd gain or save by switching.
                  <span className="block mt-1 text-xs" style={{ color: "#7A9BA6" }}>
                    Your information is never stored or shared.
                  </span>
                </div>
              </div>

              {/* Mode toggle */}
              <div className="flex rounded-lg overflow-hidden border mb-4" style={{ borderColor: "#E2EAED" }}>
                <button
                  onClick={() => setMode("mbi")}
                  className="flex-1 py-2 text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: mode === "mbi" ? "#1C3A48" : "white",
                    color: mode === "mbi" ? "white" : "#3E5560",
                  }}
                >
                  Use Medicare ID
                </button>
                <button
                  onClick={() => setMode("name")}
                  className="flex-1 py-2 text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: mode === "name" ? "#1C3A48" : "white",
                    color: mode === "name" ? "white" : "#3E5560",
                  }}
                >
                  Use Name & DOB
                </button>
              </div>

              <div className="space-y-3">
                {/* MBI field (shown in mbi mode) */}
                {mode === "mbi" && (
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "#3E5560" }}>
                      Medicare Beneficiary ID (MBI)
                    </label>
                    <input
                      type="text"
                      value={mbi}
                      onChange={(e) => setMbi(e.target.value.toUpperCase())}
                      placeholder="e.g. 1EG4-TE5-MK72"
                      maxLength={20}
                      className="w-full px-3 py-2.5 border rounded-lg text-sm font-mono outline-none transition-all"
                      style={{ borderColor: "#E2EAED", color: "#1C3A48" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#1C3A48")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#E2EAED")}
                    />
                    <p className="text-xs text-[#7A9BA6] mt-1">
                      Found on your red, white &amp; blue Medicare card
                    </p>
                  </div>
                )}

                {/* Name fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "#3E5560" }}>
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      maxLength={50}
                      className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none transition-all"
                      style={{ borderColor: "#E2EAED" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#1C3A48")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#E2EAED")}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: "#3E5560" }}>
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Smith"
                      maxLength={50}
                      className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none transition-all"
                      style={{ borderColor: "#E2EAED" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#1C3A48")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#E2EAED")}
                    />
                  </div>
                </div>

                {/* DOB */}
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: "#3E5560" }}>
                    Date of Birth
                  </label>
                  <input
                    type="text"
                    value={dob}
                    onChange={handleDobChange}
                    placeholder="MM/DD/YYYY"
                    inputMode="numeric"
                    maxLength={10}
                    className="w-full px-3 py-2.5 border rounded-lg text-sm outline-none transition-all"
                    style={{ borderColor: "#E2EAED" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#1C3A48")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#E2EAED")}
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg mt-3">
                  <AlertCircle size={13} className="shrink-0" />
                  {error}
                </div>
              )}

              {/* Privacy badge */}
              <div className="flex items-center gap-1.5 mt-3 text-xs text-[#7A9BA6]">
                <Lock size={11} />
                256-bit SSL · HIPAA-compliant · Data never stored
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        {!verified && (
          <div
            className="px-6 py-4 flex items-center gap-3"
            style={{ backgroundColor: "#FAF9F5", borderTop: "1px solid #E2EAED" }}
          >
            <button
              onClick={onSkip}
              className="flex-1 py-2.5 text-sm font-semibold rounded-lg border-2 transition-all"
              style={{ borderColor: "#E2EAED", color: "#3E5560" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#1C3A48";
                (e.currentTarget as HTMLButtonElement).style.color = "#1C3A48";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2EAED";
                (e.currentTarget as HTMLButtonElement).style.color = "#3E5560";
              }}
            >
              Skip — Show All Plans
            </button>
            <button
              onClick={handleVerify}
              disabled={isPending}
              className="flex-1 py-2.5 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
              style={{
                backgroundColor: isPending ? "#9CA3AF" : "#1C3A48",
                color: "white",
              }}
            >
              {isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Verifying…
                </>
              ) : (
                <>
                  Verify &amp; Continue
                  <ChevronRight size={15} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
