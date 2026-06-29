/**
 * InlineCompare — "Compare to My Current Plan" feature embedded in each PlanCard.
 *
 * PRIVACY POLICY:
 * - Medicare ID is accepted only as transient input for a one-time eligibility lookup.
 * - It is NEVER stored in any database, log, localStorage, or persistent store.
 * - The state variable is cleared immediately after the pVerify API response is received.
 * - No PII is transmitted to or stored by the comparison endpoint.
 *
 * PERFORMANCE:
 * - Comparison table renders INSTANTLY from plan data after pVerify lookup (no AI wait)
 * - AI narrative streams token-by-token via SSE using claude-haiku-4-5
 */

import { useState, useRef, useEffect } from "react";
import { Streamdown } from "streamdown";
import {
  Lock,
  Shield,
  Loader2,
  CheckCircle2,
  X,
  TrendingDown,
  TrendingUp,
  Minus,
  ThumbsUp,
  ThumbsDown,
  DollarSign,
  Lightbulb,
  Phone,
  BookmarkPlus,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { MedicarePlan } from "@/lib/types";

interface InlineCompareProps {
  plan: MedicarePlan;
  isActive: boolean;
  onActivate: (planId: string | null) => void;
}

type CompareStep = "idle" | "lookup" | "table_ready" | "streaming" | "done" | "error";

interface CurrentPlanData {
  planName: string;
  planId: string;
  payerId?: string;
  status?: string;
  effectiveDate?: string;
  terminationDate?: string;
  premium: number;
  deductible: number;
  oopMax: number;
  pcpCopay: number;
  specialistCopay: number;
  urgentCareCopay: number;
  erCopay: number;
  inpatientCost?: string;
  drugTier1Copay: number;
  drugTier2Copay: number;
  drugTier3Copay: number;
  dentalCoverage?: string;
  visionCoverage?: string;
  hearingCoverage?: string;
  estimatedAnnualCost?: number;
}

function CompareCell({
  label,
  current,
  potential,
  lowerIsBetter = true,
}: {
  label: string;
  current: string | number;
  potential: string | number;
  lowerIsBetter?: boolean;
}) {
  const currentNum = typeof current === "number" ? current : parseFloat(String(current).replace(/[^0-9.]/g, ""));
  const potentialNum = typeof potential === "number" ? potential : parseFloat(String(potential).replace(/[^0-9.]/g, ""));
  const isNumeric = !isNaN(currentNum) && !isNaN(potentialNum);

  let potentialColor = "#3E5560";
  let potentialBg = "transparent";
  let Icon = Minus;

  if (isNumeric && currentNum !== potentialNum) {
    const isBetter = lowerIsBetter ? potentialNum < currentNum : potentialNum > currentNum;
    if (isBetter) {
      potentialColor = "#065F46";
      potentialBg = "#D1FAE5";
      Icon = TrendingDown;
    } else {
      potentialColor = "#991B1B";
      potentialBg = "#FEE2E2";
      Icon = TrendingUp;
    }
  }

  const fmt = (v: string | number) => {
    if (typeof v === "number") return v === 0 ? "$0" : `$${v}`;
    return v;
  };

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2.5 px-3 text-xs font-medium text-gray-600 w-1/3">{label}</td>
      <td className="py-2.5 px-3 text-xs font-semibold text-center text-gray-700">{fmt(current)}</td>
      <td className="py-2.5 px-3 text-center">
        <span
          className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ color: potentialColor, backgroundColor: potentialBg }}
        >
          <Icon size={10} />
          {fmt(potential)}
        </span>
      </td>
    </tr>
  );
}

// ── sessionStorage cache helpers ─────────────────────────────────────────────
// sessionStorage is tab-scoped and cleared on close; safer than localStorage
// for AI narratives that may be informed by plan selection patterns.
const CACHE_PREFIX = "medicare-compare-v1-";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  currentPlanId: string;
  currentPlanName: string;
  streamedText: string;
  savedAt: number;
}

function getCacheKey(currentPlanId: string, newPlanId: string): string {
  const sorted = [currentPlanId, newPlanId].sort().join("|");
  return CACHE_PREFIX + sorted;
}

function readCache(key: string): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.savedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function writeCache(key: string, entry: CacheEntry): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore storage errors (private mode, quota exceeded)
  }
}

export default function InlineCompare({ plan, isActive, onActivate }: InlineCompareProps) {
  // PRIVACY: medicareId is transient — cleared immediately after lookup response
  const [medicareId, setMedicareId] = useState("");
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState<CompareStep>("idle");
  const [currentPlan, setCurrentPlan] = useState<CurrentPlanData | null>(null);
  const [streamedText, setStreamedText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isCached, setIsCached] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cacheKeyRef = useRef<string | null>(null);

  // Auto-focus the Medicare ID input when panel opens
  useEffect(() => {
    if (isActive && step === "idle" && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isActive, step]);

  // Cleanup streaming on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // When unchecked: collapse panel and clear Medicare ID immediately
  const handleCheckboxChange = (checked: boolean) => {
    if (checked) {
      onActivate(plan.id);
    } else {
      // PRIVACY: clear Medicare ID immediately on uncheck
      abortRef.current?.abort();
      setMedicareId("");
      setConsent(false);
      setStep("idle");
      setCurrentPlan(null);
      setStreamedText("");
      setErrorMsg("");
      onActivate(null);
    }
  };

  const lookupMutation = trpc.pverify.lookup.useMutation();

  // Refresh analysis: re-run streaming using already-loaded currentPlan (skips pVerify)
  const handleRefreshAnalysis = async () => {
    if (!currentPlan) return;
    setStep("streaming");
    setStreamedText("");
    setIsCached(false);

    const cpData = currentPlan;
    const currentPlanForStream = {
      id: cpData.planId || "current-plan",
      carrier: cpData.payerId || "Unknown",
      planName: cpData.planName,
      planType: "HMO",
      premium: cpData.premium,
      deductible: cpData.deductible,
      maxOutOfPocket: cpData.oopMax,
      partBPremiumReduction: 0,
      starRating: { overall: 4.0 },
      copays: {
        primaryCare: `$${cpData.pcpCopay} copay`,
        specialist: `$${cpData.specialistCopay} copay`,
        urgentCare: `$${cpData.urgentCareCopay} copay`,
        emergency: `$${cpData.erCopay} copay`,
        inpatientHospital: cpData.inpatientCost ?? "$275/day days 1-7",
        outpatientSurgery: "$200 copay",
      },
      rxDrugs: {
        tier1: `$${cpData.drugTier1Copay}`,
        tier2: `$${cpData.drugTier2Copay}`,
        tier3: `$${cpData.drugTier3Copay}`,
        tier4: "$100",
        deductible: "$0",
        gap: false,
      },
      extraBenefits: {
        dental: { covered: (cpData.dentalCoverage ?? "") !== "Not covered", details: cpData.dentalCoverage ?? "" },
        vision: { covered: (cpData.visionCoverage ?? "") !== "Not covered", details: cpData.visionCoverage ?? "" },
        hearing: { covered: (cpData.hearingCoverage ?? "") !== "Not covered", details: cpData.hearingCoverage ?? "" },
        otc: { covered: false, details: "Not covered" },
        fitness: { covered: false, details: "Not covered" },
        transportation: { covered: false, details: "Not covered" },
        telehealth: { covered: true, details: "Virtual visits available" },
        meals: { covered: false, details: "Not covered" },
      },
      networkSize: 3000,
      enrollmentPeriod: "Annual Enrollment Period",
      effectiveDate: cpData.effectiveDate ?? "2025-01-01",
    };
    const newPlanForStream = {
      id: plan.id, carrier: plan.carrier, planName: plan.planName, planType: plan.planType,
      snpType: plan.snpType, premium: plan.premium, deductible: plan.deductible,
      maxOutOfPocket: plan.maxOutOfPocket, partBPremiumReduction: plan.partBPremiumReduction,
      starRating: { overall: plan.starRating.overall },
      copays: { primaryCare: plan.copays.primaryCare, specialist: plan.copays.specialist,
        urgentCare: plan.copays.urgentCare, emergency: plan.copays.emergency,
        inpatientHospital: plan.copays.inpatientHospital, outpatientSurgery: plan.copays.outpatientSurgery },
      rxDrugs: { tier1: plan.rxDrugs.tier1, tier2: plan.rxDrugs.tier2, tier3: plan.rxDrugs.tier3,
        tier4: plan.rxDrugs.tier4, deductible: plan.rxDrugs.deductible, gap: plan.rxDrugs.gap },
      extraBenefits: {
        dental: { covered: plan.extraBenefits.dental.covered, details: plan.extraBenefits.dental.details },
        vision: { covered: plan.extraBenefits.vision.covered, details: plan.extraBenefits.vision.details },
        hearing: { covered: plan.extraBenefits.hearing.covered, details: plan.extraBenefits.hearing.details },
        otc: { covered: plan.extraBenefits.otc.covered, details: plan.extraBenefits.otc.details },
        fitness: { covered: plan.extraBenefits.fitness.covered, details: plan.extraBenefits.fitness.details },
        transportation: { covered: plan.extraBenefits.transportation.covered, details: plan.extraBenefits.transportation.details },
        telehealth: { covered: plan.extraBenefits.telehealth.covered, details: plan.extraBenefits.telehealth.details },
        meals: { covered: plan.extraBenefits.meals.covered, details: plan.extraBenefits.meals.details },
      },
      networkSize: plan.networkSize, enrollmentPeriod: plan.enrollmentPeriod, effectiveDate: plan.effectiveDate,
      isBestMatch: plan.isBestMatch, isMostPopular: plan.isMostPopular, isNewPlan: plan.isNewPlan,
      contractId: plan.contractId, planId: plan.planId,
    };

    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const resp = await fetch("/api/compare-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPlan: currentPlanForStream, newPlan: newPlanForStream }),
        signal: ctrl.signal,
      });
      if (!resp.ok) throw new Error("Streaming comparison failed");
      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("event: ")) continue;
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (!data) continue;
              try {
                const parsed = JSON.parse(data);
                if (typeof parsed === "string" && parsed.length > 0) {
                  setStreamedText(prev => prev + parsed);
                }
              } catch { /* skip malformed */ }
            }
          }
        }
      }
      if (cacheKeyRef.current) {
        setStreamedText(prev => {
          writeCache(cacheKeyRef.current!, {
            currentPlanId: currentPlanForStream.id,
            currentPlanName: currentPlanForStream.planName,
            streamedText: prev,
            savedAt: Date.now(),
          });
          return prev;
        });
      }
      setStep("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setStep("error");
      setErrorMsg(err instanceof Error ? err.message : "Refresh failed. Please try again.");
    }
  };

  const handleRunComparison = async () => {
    if (!medicareId.trim() || !consent) return;

    setStep("lookup");
    setErrorMsg("");
    setStreamedText("");
    setIsCached(false);

    try {
      // Step 1: pVerify eligibility lookup
      // PRIVACY: medicareId is passed transiently and cleared immediately after response
      const lookupResult = await lookupMutation.mutateAsync({ medicareId: medicareId.trim() });

      // PRIVACY: Clear the Medicare ID from state immediately after the API response
      // It is never stored in any database, log, or persistent store.
      setMedicareId(""); // purge from UI state immediately

      if (!lookupResult.success) {
        throw new Error("Eligibility lookup failed");
      }

      const cpData = lookupResult.data as unknown as CurrentPlanData;
      setCurrentPlan(cpData);

      // Step 2: INSTANTLY show the comparison table — no AI wait needed
      setStep("table_ready");

      // Check localStorage cache before streaming
      const cacheKey = getCacheKey(cpData.planId || "current", plan.id);
      cacheKeyRef.current = cacheKey;
      const cached = readCache(cacheKey);
      if (cached) {
        setStreamedText(cached.streamedText);
        setIsCached(true);
        setStep("done");
        return;
      }

      // Step 3: Stream AI narrative in the background
      // Transform pVerify current plan data to the full PlanInputSchema format
      const currentPlanForStream = {
        id: cpData.planId || "current-plan",
        carrier: cpData.payerId || "Unknown",
        planName: cpData.planName,
        planType: "HMO",
        premium: cpData.premium,
        deductible: cpData.deductible,
        maxOutOfPocket: cpData.oopMax,
        partBPremiumReduction: 0,
        starRating: { overall: 4.0 },
        copays: {
          primaryCare: `$${cpData.pcpCopay} copay`,
          specialist: `$${cpData.specialistCopay} copay`,
          urgentCare: `$${cpData.urgentCareCopay} copay`,
          emergency: `$${cpData.erCopay} copay`,
          inpatientHospital: cpData.inpatientCost ?? "$275/day days 1-7",
          outpatientSurgery: "$200 copay",
        },
        rxDrugs: {
          tier1: `$${cpData.drugTier1Copay}`,
          tier2: `$${cpData.drugTier2Copay}`,
          tier3: `$${cpData.drugTier3Copay}`,
          tier4: "$100",
          deductible: "$0",
          gap: false,
        },
        extraBenefits: {
          dental: { covered: cpData.dentalCoverage !== "Not covered", details: cpData.dentalCoverage },
          vision: { covered: cpData.visionCoverage !== "Not covered", details: cpData.visionCoverage },
          hearing: { covered: cpData.hearingCoverage !== "Not covered", details: cpData.hearingCoverage },
          otc: { covered: false, details: "Not covered" },
          fitness: { covered: false, details: "Not covered" },
          transportation: { covered: false, details: "Not covered" },
          telehealth: { covered: true, details: "Virtual visits available" },
          meals: { covered: false, details: "Not covered" },
        },
        networkSize: 3000,
        enrollmentPeriod: "Annual Enrollment Period",
        effectiveDate: cpData.effectiveDate ?? "2025-01-01",
      };

      // Transform the plan card data to the full PlanInputSchema format
      const newPlanForStream = {
        id: plan.id,
        carrier: plan.carrier,
        planName: plan.planName,
        planType: plan.planType,
        snpType: plan.snpType,
        premium: plan.premium,
        deductible: plan.deductible,
        maxOutOfPocket: plan.maxOutOfPocket,
        partBPremiumReduction: plan.partBPremiumReduction,
        starRating: { overall: plan.starRating.overall },
        copays: {
          primaryCare: plan.copays.primaryCare,
          specialist: plan.copays.specialist,
          urgentCare: plan.copays.urgentCare,
          emergency: plan.copays.emergency,
          inpatientHospital: plan.copays.inpatientHospital,
          outpatientSurgery: plan.copays.outpatientSurgery,
        },
        rxDrugs: {
          tier1: plan.rxDrugs.tier1,
          tier2: plan.rxDrugs.tier2,
          tier3: plan.rxDrugs.tier3,
          tier4: plan.rxDrugs.tier4,
          deductible: plan.rxDrugs.deductible,
          gap: plan.rxDrugs.gap,
        },
        extraBenefits: {
          dental: { covered: plan.extraBenefits.dental.covered, details: plan.extraBenefits.dental.details },
          vision: { covered: plan.extraBenefits.vision.covered, details: plan.extraBenefits.vision.details },
          hearing: { covered: plan.extraBenefits.hearing.covered, details: plan.extraBenefits.hearing.details },
          otc: { covered: plan.extraBenefits.otc.covered, details: plan.extraBenefits.otc.details },
          fitness: { covered: plan.extraBenefits.fitness.covered, details: plan.extraBenefits.fitness.details },
          transportation: { covered: plan.extraBenefits.transportation.covered, details: plan.extraBenefits.transportation.details },
          telehealth: { covered: plan.extraBenefits.telehealth.covered, details: plan.extraBenefits.telehealth.details },
          meals: { covered: plan.extraBenefits.meals.covered, details: plan.extraBenefits.meals.details },
        },
        networkSize: plan.networkSize,
        enrollmentPeriod: plan.enrollmentPeriod,
        effectiveDate: plan.effectiveDate,
        isBestMatch: plan.isBestMatch,
        isMostPopular: plan.isMostPopular,
        isNewPlan: plan.isNewPlan,
        contractId: plan.contractId,
        planId: plan.planId,
      };

      setStep("streaming");

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const resp = await fetch("/api/compare-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPlan: currentPlanForStream, newPlan: newPlanForStream }),
        signal: ctrl.signal,
      });

      if (!resp.ok) throw new Error("Streaming comparison failed");

      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              // SSE event name line — handled by next data line
              continue;
            }
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (!data) continue;
              try {
                const parsed = JSON.parse(data);
                // The SSE endpoint sends the text as a JSON string directly
                if (typeof parsed === "string" && parsed.length > 0) {
                  setStreamedText(prev => prev + parsed);
                }
              } catch {
                // skip malformed chunks
              }
            }
          }
        }
      }

      // Write the full streamed result to cache
      if (cacheKeyRef.current) {
        setStreamedText(prev => {
          writeCache(cacheKeyRef.current!, {
            currentPlanId: currentPlanForStream.id,
            currentPlanName: currentPlanForStream.planName,
            streamedText: prev,
            savedAt: Date.now(),
          });
          return prev;
        });
      }

      setStep("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      // PRIVACY: ensure medicareId is cleared even on error
      setMedicareId("");
      setStep("error");
      setErrorMsg(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
    }
  };

  const handleClose = () => {
    abortRef.current?.abort();
    setCurrentPlan(null);
    setStep("idle");
    setMedicareId("");
    setConsent(false);
    setStreamedText("");
    onActivate(null);
  };

  const canRun = medicareId.trim().length >= 4 && consent && step === "idle";

  // Compute estimated annual costs from plan data
  // pVerify stub doesn't return estimatedAnnualCost, so compute it from raw fields
  const estimatedCurrentCost = currentPlan
    ? (currentPlan.estimatedAnnualCost ??
        (currentPlan.premium * 12 +
          currentPlan.pcpCopay * 6 +
          currentPlan.specialistCopay * 4 +
          currentPlan.urgentCareCopay * 2 +
          currentPlan.drugTier1Copay * 12 +
          currentPlan.drugTier2Copay * 6))
    : 0;
  const estimatedPotentialCost = (() => {
    if (!plan) return 0;
    const pcpCopay = parseInt(plan.copays.primaryCare.replace(/[^0-9]/g, "")) || 0;
    const specCopay = parseInt(plan.copays.specialist.replace(/[^0-9]/g, "")) || 0;
    const t1 = parseInt(plan.rxDrugs.tier1.replace(/[^0-9]/g, "")) || 0;
    const t2 = parseInt(plan.rxDrugs.tier2.replace(/[^0-9]/g, "")) || 0;
    return plan.premium * 12 + plan.deductible + pcpCopay * 6 + specCopay * 4 + t1 * 12 + t2 * 6;
  })();
  const savings = estimatedCurrentCost - estimatedPotentialCost;

  const showTable = step === "table_ready" || step === "streaming" || step === "done";

  return (
    <div className="border-t border-gray-100 mt-1">
      {/* ── Checkbox trigger ─────────────────────────────────────────────── */}
      <label
        className="flex items-center gap-2.5 px-5 py-3 cursor-pointer select-none group"
        style={{ backgroundColor: isActive ? "#EEF5F7" : "transparent" }}
      >
        <div
          className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all"
          style={{
            borderColor: isActive ? "#1C3A48" : "#D1D5DB",
            backgroundColor: isActive ? "#1C3A48" : "white",
          }}
        >
          {isActive && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <input
          type="checkbox"
          className="sr-only"
          checked={isActive}
          onChange={(e) => handleCheckboxChange(e.target.checked)}
        />
        <span className="text-xs font-semibold" style={{ color: isActive ? "#1C3A48" : "#7A9BA6" }}>
          Compare to my current plan
        </span>
        {isActive && (
          <span
            className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: "#1C3A48", color: "white" }}
          >
            Active
          </span>
        )}
      </label>

      {/* ── Slide-down panel (input form) ────────────────────────────────── */}
      {isActive && !showTable && (
        <div
          className="animate-slide-down mx-4 mb-4 rounded-xl border overflow-hidden"
          style={{ borderColor: "#C6DAE0", backgroundColor: "#EEF5F7" }}
        >
          {/* Panel header */}
          <div
            className="flex items-center gap-2.5 px-4 py-3 border-b"
            style={{ borderColor: "#C6DAE0", backgroundColor: "#E8F2F5" }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#1C3A48" }}
            >
              <Lock size={13} color="white" />
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: "#1C3A48" }}>
                Enter Your Medicare ID to Compare
              </div>
              <div className="text-[11px] text-gray-500">
                Your Medicare ID is never stored · Purged after lookup
              </div>
            </div>
          </div>

          <div className="p-4">
            {/* ── Idle / Input state ──────────────────────────────────────── */}
            {(step === "idle" || step === "error") && (
              <>
                {/* Medicare ID input */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Medicare ID
                  </label>
                  <input
                    ref={inputRef}
                    type="text"
                    value={medicareId}
                    onChange={(e) => setMedicareId(e.target.value)}
                    placeholder="e.g. 1EG4-TE5-MK72"
                    maxLength={20}
                    className="w-full px-3 py-2.5 text-sm font-semibold border-2 rounded-lg outline-none transition-all"
                    style={{
                      borderColor: medicareId.length >= 4 ? "#1C3A48" : "#D1D5DB",
                      backgroundColor: "white",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#1C3A48"; }}
                    onBlur={(e) => {
                      if (medicareId.length < 4) e.currentTarget.style.borderColor = "#D1D5DB";
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" && canRun) handleRunComparison(); }}
                  />
                  {/* Privacy note */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Shield size={10} className="text-gray-400 shrink-0" />
                    <span className="text-[10px] text-gray-400">
                      Never stored · Purged after lookup · Not logged
                    </span>
                  </div>
                </div>

                {/* Consent checkbox */}
                <label className="flex items-start gap-2 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 w-3.5 h-3.5 accent-[#1C3A48] shrink-0"
                  />
                  <span className="text-[11px] text-gray-600 leading-relaxed">
                    I consent to a one-time eligibility lookup. I understand this is a simulated
                    lookup for demonstration purposes only.
                  </span>
                </label>

                {/* Error message */}
                {step === "error" && errorMsg && (
                  <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                    <X size={12} className="shrink-0 mt-0.5" />
                    {errorMsg}
                  </div>
                )}

                {/* Run button */}
                <button
                  onClick={() => handleRunComparison()}
                  disabled={!canRun}
                  className="w-full py-2.5 rounded-lg text-sm font-bold text-white transition-all"
                  style={{
                    backgroundColor: canRun ? "#1C3A48" : "#D1D5DB",
                    cursor: canRun ? "pointer" : "not-allowed",
                  }}
                  onMouseEnter={(e) => {
                    if (canRun) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#112333";
                  }}
                  onMouseLeave={(e) => {
                    if (canRun) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1C3A48";
                  }}
                >
                  Run Plan Comparison
                </button>
              </>
            )}

            {/* ── Loading: pVerify lookup ──────────────────────────────────── */}
            {step === "lookup" && (
              <div className="py-6 flex flex-col items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "#E8F2F5" }}
                >
                  <Loader2 size={22} className="animate-spin" style={{ color: "#1C3A48" }} />
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-gray-800">Looking up your plan...</div>
                  <div className="text-xs text-gray-500 mt-0.5">Checking eligibility via pVerify</div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                  <Shield size={10} />
                  Medicare ID purged after this step
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Inline comparison result (shows instantly after lookup) ─────── */}
      {isActive && showTable && currentPlan && (
        <div className="mx-4 mb-4 rounded-xl border overflow-hidden" style={{ borderColor: "#C6DAE0" }}>
          {/* ── Result header ──────────────────────────────────────────────── */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ backgroundColor: "#1C3A48" }}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={18} color="white" />
              <div>
                <div className="text-sm font-bold text-white">Comparison Complete</div>
                <div className="text-[11px] text-green-200">
                  {currentPlan.planName} vs {plan.planName}
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
            >
              <X size={16} color="white" />
            </button>
          </div>

          <div className="p-4 space-y-4" style={{ backgroundColor: "#FAF9F5" }}>
            {/* ── Side-by-side comparison table (INSTANT) ──────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="grid grid-cols-3 text-center text-[10px] font-bold uppercase tracking-wide py-2 border-b border-gray-100"
                style={{ backgroundColor: "#FAF9F5" }}>
                <div className="px-3 text-left text-gray-500">Benefit</div>
                <div className="text-gray-600">Your Current Plan</div>
                <div style={{ color: "#1C3A48" }}>{plan.carrier} Plan</div>
              </div>
              <table className="w-full">
                <tbody>
                  <CompareCell label="Monthly Premium" current={currentPlan.premium} potential={plan.premium} />
                  <CompareCell label="Deductible" current={currentPlan.deductible} potential={plan.deductible} />
                  <CompareCell label="Max Out-of-Pocket" current={currentPlan.oopMax} potential={plan.maxOutOfPocket} />
                  <CompareCell label="PCP Visit" current={currentPlan.pcpCopay} potential={parseInt(plan.copays.primaryCare.replace(/[^0-9]/g, "")) || 0} />
                  <CompareCell label="Specialist" current={currentPlan.specialistCopay} potential={parseInt(plan.copays.specialist.replace(/[^0-9]/g, "")) || 0} />
                  <CompareCell label="Tier 1 Drug" current={currentPlan.drugTier1Copay} potential={parseInt(plan.rxDrugs.tier1.replace(/[^0-9]/g, "")) || 0} />
                  <CompareCell label="Tier 2 Drug" current={currentPlan.drugTier2Copay} potential={parseInt(plan.rxDrugs.tier2.replace(/[^0-9]/g, "")) || 0} />
                  <CompareCell label="Tier 3 Drug" current={currentPlan.drugTier3Copay} potential={parseInt(plan.rxDrugs.tier3.replace(/[^0-9]/g, "")) || 0} />
                </tbody>
              </table>
            </div>

            {/* ── AI Analysis (streaming) ───────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={13} style={{ color: "#1C3A48" }} />
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">AI Analysis</span>
                {step === "streaming" && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-gray-400">
                    <Loader2 size={10} className="animate-spin" />
                    Claude Haiku is writing...
                  </span>
                )}
                {step === "done" && !isCached && (
                  <span className="ml-auto text-[10px] text-gray-400">claude-haiku-4-5</span>
                )}
                {step === "done" && isCached && (
                  <span className="ml-auto flex items-center gap-1.5">
                    <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded-full">Cached</span>
                    <button
                      onClick={() => handleRefreshAnalysis()}
                      className="text-[10px] text-gray-400 hover:text-gray-600 underline"
                    >
                      Refresh
                    </button>
                  </span>
                )}
              </div>
              {streamedText ? (
                <div className="text-xs text-gray-600 leading-relaxed [&_h2]:text-xs [&_h2]:font-bold [&_h2]:text-gray-800 [&_h2]:mt-2 [&_h2]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:mb-0.5 [&_strong]:font-semibold [&_strong]:text-gray-800">
                  <Streamdown>{streamedText}</Streamdown>
                </div>
              ) : (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 size={12} className="animate-spin text-gray-400" />
                  <span className="text-xs text-gray-400">Generating AI analysis...</span>
                </div>
              )}
            </div>

            {/* ── Annual Cost Comparison ───────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign size={13} style={{ color: "#1C3A48" }} />
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Estimated Annual Cost
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="text-center p-2.5 rounded-lg" style={{ backgroundColor: "#FAF9F5" }}>
                  <div className="text-[10px] text-gray-500 mb-1">Your Current Plan</div>
                  <div className="text-xl font-bold text-gray-800" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    ${estimatedCurrentCost.toLocaleString()}
                  </div>
                  <div className="text-[9px] text-gray-400">typical usage/year</div>
                </div>
                <div
                  className="text-center p-2.5 rounded-lg"
                  style={{
                    backgroundColor: savings > 0 ? "#D1FAE5" : savings < 0 ? "#FEE2E2" : "#FAF9F5",
                  }}
                >
                  <div className="text-[10px] text-gray-500 mb-1">{plan.carrier} Plan</div>
                  <div
                    className="text-xl font-bold"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      color: savings > 0 ? "#065F46" : savings < 0 ? "#991B1B" : "#1F2937",
                    }}
                  >
                    ${estimatedPotentialCost.toLocaleString()}
                  </div>
                  <div className="text-[9px] text-gray-400">typical usage/year</div>
                </div>
              </div>

              {/* Savings callout */}
              {savings !== 0 && (
                <div
                  className="flex items-center gap-2 p-2.5 rounded-lg"
                  style={{
                    backgroundColor: savings > 0 ? "#EEF5F7" : "#FEF2F2",
                    border: `1.5px solid ${savings > 0 ? "#C6DAE0" : "#FECACA"}`,
                  }}
                >
                  <DollarSign size={14} style={{ color: savings > 0 ? "#237A92" : "#EF4444" }} />
                  <span
                    className="text-xs font-bold"
                    style={{ color: savings > 0 ? "#237A92" : "#B91C1C" }}
                  >
                    {savings > 0
                      ? `You could save ~$${savings.toLocaleString()}/year by switching to this plan`
                      : `This plan costs ~$${Math.abs(savings).toLocaleString()} more per year than your current plan`}
                  </span>
                </div>
              )}
            </div>

            {/* ── Action buttons ───────────────────────────────────────────── */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  alert("Comparison saved! (In production, this would save to your account.)");
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border transition-all"
                style={{ borderColor: "#C6DAE0", color: "#1C3A48" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#E8F2F5";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                }}
              >
                <BookmarkPlus size={12} />
                Save Comparison
              </button>
              <a
                href="tel:1-800-777-8002"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-white no-underline transition-all"
                style={{ backgroundColor: "#1C3A48" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "#112333";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "#1C3A48";
                }}
              >
                <Phone size={12} />
                Talk to an Agent
              </a>
            </div>

            {/* Privacy disclaimer */}
            <p className="text-[9px] text-gray-400 leading-relaxed text-center">
              Your Medicare ID was used only for this one-time eligibility lookup and has been
              purged from memory. It was never stored in a database, log, or any persistent system.
              Plan data shown is for illustrative purposes only.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
