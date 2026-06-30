// PlanCard component — Medicare Advantage plan display card
// Design: Chapter-style | Navy #1A1A1A | Red #C41E3A | Light Blue #E6F7F9
import { useState } from "react";
import {
  Heart,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  Eye,
  Ear,
  ShoppingBag,
  Dumbbell,
  Car,
  Video,
  UtensilsCrossed,
  Pill,
  CheckCircle2,
  XCircle,
  Info,
  UserRound,
  X,
  DollarSign,
  AlertCircle,
  Building2,
  Hash,
} from "lucide-react";
import type { MedicarePlan, PlanDoctorNetworkStatus, RxDrug } from "@/lib/types";
import StarRating from "./StarRating";
import CarrierLogo from "./CarrierLogo";
import InlineCompare from "./InlineCompare";
import MatchScoreBadge from "@/features/match-score/components/MatchScoreBadge";
import AnnualCostDisplay from "@/features/plan-cost/components/AnnualCostDisplay";
import CompareCheckbox from "@/features/plan-compare/components/CompareCheckbox";
import TermTip from "@/features/education/components/TermTip";

interface PlanCardProps {
  plan: MedicarePlan;
  isFavorited: boolean;
  onToggleFavorite: (id: string) => void;
  onEnroll: (plan: MedicarePlan) => void;
  animationDelay?: number;
  isCompareActive?: boolean;
  onCompareActivate?: (planId: string | null) => void;
  doctorNetworkStatus?: PlanDoctorNetworkStatus;
  rxDrugs?: RxDrug[];
  subsidyLevel?: "full" | "partial" | "none";
  hasRxDrugs?: boolean;
  hasDoctors?: boolean;
  matchScore?: number;
  matchLabel?: string;
  isInCompare?: boolean;
  isCompareFull?: boolean;
  onCompareToggle?: (plan: MedicarePlan) => void;
}

const BENEFIT_ICONS = {
  dental: Stethoscope,
  vision: Eye,
  hearing: Ear,
  otc: ShoppingBag,
  fitness: Dumbbell,
  transportation: Car,
  telehealth: Video,
  meals: UtensilsCrossed,
};

const BENEFIT_LABELS: Record<string, string> = {
  dental: "Dental",
  vision: "Vision",
  hearing: "Hearing",
  otc: "OTC",
  fitness: "Fitness",
  transportation: "Transport",
  telehealth: "Telehealth",
  meals: "Meals",
};

// Benefits that show allowance amounts when available
const ALLOWANCE_BENEFITS = new Set(["dental", "vision", "hearing"]);

export default function PlanCard({
  plan,
  isFavorited,
  onToggleFavorite,
  onEnroll,
  animationDelay = 0,
  isCompareActive = false,
  onCompareActivate,
  doctorNetworkStatus,
  rxDrugs = [],
  subsidyLevel = "none",
  hasRxDrugs = false,
  hasDoctors = false,
  matchScore,
  matchLabel,
  isInCompare = false,
  isCompareFull = false,
  onCompareToggle,
}: PlanCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [heartAnimating, setHeartAnimating] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [drugCostExpanded, setDrugCostExpanded] = useState(false);

  const handleFavorite = () => {
    setHeartAnimating(true);
    onToggleFavorite(plan.id);
    setTimeout(() => setHeartAnimating(false), 400);
  };

  const benefitKeys = Object.keys(BENEFIT_ICONS) as Array<keyof typeof BENEFIT_ICONS>;

  // Use server-calculated drug cost from formularyCalculator (per-plan unique cost)
  const planAny = plan as any;
  const drugCost: number | null = planAny.estimatedAnnualDrugCost != null ? planAny.estimatedAnnualDrugCost : null;
  const drugBreakdowns = planAny.formularyDrugCost?.drugBreakdowns ?? [];
  const reachesCatastrophic = planAny.formularyDrugCost?.reachesCatastrophic ?? false;
  const deductibleApplied = planAny.formularyDrugCost?.deductibleApplied ?? 0;
  const monthCatastrophicReached = planAny.formularyDrugCost?.monthCatastrophicReached ?? null;

  return (
    <>
      <div
        className="plan-card animate-fade-in-up"
        style={{
          animationDelay: `${animationDelay}ms`,
          animationFillMode: "both",
          ...(plan.isBestMatch ? { borderColor: "#00859A", borderTopWidth: "2px", borderTopColor: "#00859A" } : {}),
        }}
      >
        {/* Badge */}
        {plan.isBestMatch && <div className="badge-best-match">Best Match</div>}
        {!plan.isBestMatch && plan.isMostPopular && <div className="badge-popular">Most Popular</div>}
        {!plan.isBestMatch && !plan.isMostPopular && plan.isNewPlan && (
          <div className="badge-new">New Plan</div>
        )}
        {plan.isNonCommissionable && (
          <div className="absolute top-2 right-2 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Non-Commissionable</div>
        )}

        {/* Card Header */}
        <div className="flex items-start gap-3 p-4 pb-2">
          <div className="cursor-pointer" onClick={() => setModalImage(`https://logo.clearbit.com/${plan.carrier.toLowerCase().replace(/\s+/g, '')}.com`)}>
            <CarrierLogo carrier={plan.carrier} bgColor={plan.carrierLogoColor} textColor={plan.carrierLogoTextColor} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8C8C8C" }}>{plan.carrier}</p>
            <div className="flex items-start justify-between gap-2 mt-0.5">
              <h3 className="text-sm font-bold leading-tight" style={{ color: "#1A1A1A", fontFamily: "'Montserrat', sans-serif" }}>{plan.planName}</h3>
              {/* Contract ID — shown next to plan name */}
              {plan.contractId && (
                <span
                  className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: "#E6F7F9", color: "#8C8C8C", border: "1px solid #E8E8E8" }}
                  title={`Contract ID: ${plan.contractId} / Plan ID: ${plan.planId}`}
                >
                  <Hash size={8} />
                  {plan.contractId}/{plan.planId}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#E6F7F9", color: "#00353E" }}>{plan.planType}</span>
              {plan.snpType && (() => {
                const st = plan.snpType ?? "";
                const isDual = st.toLowerCase().includes("dual") || plan.planName?.includes("D-SNP");
                const isChronic = st.toLowerCase().includes("chronic") || st.toLowerCase().includes("disabling") || plan.planName?.includes("C-SNP");
                const isInstitutional = st.toLowerCase().includes("institutional") || plan.planName?.includes("I-SNP");
                if (isDual) return (<span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#F3E8FF", color: "#7C3AED" }}>Dual Eligible (D-SNP)</span>);
                if (isChronic) return (<span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#FFF7ED", color: "#C2410C" }}>Chronic Condition (C-SNP)</span>);
                if (isInstitutional) return (<span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#F0FDF4", color: "#15803D" }}>Institutional (I-SNP)</span>);
                return (<span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#E8E8E8", color: "#303030" }}>{plan.snpType}</span>);
              })()}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StarRating rating={plan.starRating.overall} />
            <button onClick={handleFavorite} aria-label={isFavorited ? `Remove ${plan.planName} from saved plans` : `Save ${plan.planName} to favorites`} aria-pressed={isFavorited} className={`p-1.5 rounded-full transition-all ${heartAnimating ? "scale-125" : ""}`}>
              <Heart size={16} className={isFavorited ? "fill-red-500 text-red-500" : "hover:text-red-400"} style={isFavorited ? {} : { color: "#E8E8E8" }} />
            </button>
          </div>
        </div>

        {/* Pricing Row */}
        <div className="grid grid-cols-3 gap-3 px-4 py-4" style={{ borderTop: "1px solid #E8E8E8", borderBottom: "1px solid #E8E8E8" }}>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: "#1A1A1A", fontFamily: "'Montserrat', sans-serif" }}>{plan.premium === 0 ? "$0" : `$${plan.premium}`}</p>
            <p className="text-[10px] mt-0.5" style={{ color: "#8C8C8C" }}>monthly premium</p>
            {plan.partBPremiumReduction > 0 && (
              <p className="text-[9px] font-semibold text-green-600">+${plan.partBPremiumReduction} Part B reduction</p>
            )}
          </div>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: "#1A1A1A", fontFamily: "'Montserrat', sans-serif" }}>${plan.deductible === 0 ? "0" : plan.deductible.toLocaleString()}</p>
            <p className="text-[10px] mt-0.5" style={{ color: "#8C8C8C" }}>drug deductible</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: "#1A1A1A", fontFamily: "'Montserrat', sans-serif" }}>${plan.maxOutOfPocket.toLocaleString()}</p>
            <p className="text-[10px] mt-0.5" style={{ color: "#8C8C8C" }}>max out-of-pocket</p>
          </div>
        </div>

        {/* Annual Cost Display */}
        <AnnualCostDisplay plan={plan} hasRxDrugs={hasRxDrugs} hasDoctors={hasDoctors} />

        {/* Match Score */}
        {matchScore !== undefined && matchLabel && (
          <div style={{ padding: "4px 16px 0" }}>
            <MatchScoreBadge score={matchScore} variant="inline" />
          </div>
        )}

        {/* Doctor Network Status */}
        {doctorNetworkStatus && doctorNetworkStatus.doctors.length > 0 && (
          <div className="mx-4 mt-2 p-3 rounded-lg" style={{ backgroundColor: "#E6F7F9", border: "1px solid #E8E8E8" }}>
            <p className="text-xs font-bold mb-2" style={{ color: "#00353E" }}><UserRound size={12} className="inline mr-1" />Your Doctors</p>
            {doctorNetworkStatus.doctors.map((doc, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs py-0.5">
                <span className="font-medium" style={{ color: "#303030" }}>{doc.doctorName}</span>
                <span className="ml-auto flex items-center gap-1">
                  {doc.inNetwork ? <CheckCircle2 size={12} className="text-green-500" /> : <XCircle size={12} className="text-red-400" />}
                  {doc.inNetwork ? 'In Network' : 'Out of Network'}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: "1px solid #E8E8E8" }}>
              <span className="text-[10px] font-semibold" style={{ color: "#8C8C8C" }}>Network Match</span>
              <span className={`ml-auto text-xs font-bold ${doctorNetworkStatus.inNetworkCount === doctorNetworkStatus.doctors.length ? 'text-green-600' : doctorNetworkStatus.inNetworkCount > 0 ? 'text-yellow-600' : 'text-red-500'}`}>
                {doctorNetworkStatus.inNetworkCount}/{doctorNetworkStatus.doctors.length} In Network
              </span>
            </div>
          </div>
        )}

        {/* Key Copays */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: "#8C8C8C", letterSpacing: "0.06em" }}>Key Copays</p>
          <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Primary Care", value: plan.copays.primaryCare },
            { label: "Specialist", value: plan.copays.specialist },
            { label: "Urgent Care", value: plan.copays.urgentCare },
            { label: "Emergency", value: plan.copays.emergency },
          ].map((item) => (
            <div key={item.label} className="text-center p-2 rounded-lg" style={{ backgroundColor: "#F9F9F9" }}>
              <p className="text-[10px] leading-tight mb-1" style={{ color: "#8C8C8C" }}>{item.label}</p>
              <p className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>{item.value}</p>
            </div>
          ))}
          </div>
        </div>

        {/* Rx Drug Coverage - with integrated drug cost calculator */}
        <div className="px-4 py-3" style={{ borderTop: "1px solid #E8E8E8" }}>
          <div className="flex items-center gap-2 mb-2">
            <Pill size={13} style={{ color: "#1A1A1A" }} />
            <span className="text-xs font-bold" style={{ color: "#1A1A1A" }}>Rx Drug Coverage</span>
            {plan.rxDrugs.gap && (<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">Gap Coverage</span>)}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { tier: "Tier 1", label: "Generic", value: plan.rxDrugs.tier1 },
              { tier: "Tier 2", label: "Pref Brand", value: plan.rxDrugs.tier2 },
              { tier: "Tier 3", label: "Non-Pref", value: plan.rxDrugs.tier3 },
              { tier: "Tier 4", label: "Specialty", value: plan.rxDrugs.tier4 },
            ].map((t) => (
              <div key={t.tier} className="text-center p-1.5 rounded-lg" style={{ backgroundColor: "#F9F9F9" }}>
                <p className="text-[9px] font-bold" style={{ color: "#8C8C8C" }}>{t.tier}</p>
                <p className="text-xs font-bold" style={{ color: "#1A1A1A" }}>{t.value.replace(" copay", "")}</p>
                <p className="text-[10px]" style={{ color: "#8C8C8C" }}>{t.label}</p>
              </div>
            ))}
          </div>
          {plan.rxDrugs.deductible !== "$0" && (
            <p className="text-[10px] mt-1" style={{ color: "#8C8C8C" }}>Drug deductible: {plan.rxDrugs.deductible}</p>
          )}

          {/* Estimated Drug Cost - clickable with monthly breakdown */}
          {drugCost !== null && (
            <div
              className="mt-3 p-3 rounded-lg cursor-pointer transition-all hover:shadow-sm"
              style={{ backgroundColor: reachesCatastrophic ? "#FEF2F2" : "#E6F7F9", border: `1px solid ${reachesCatastrophic ? "#FECACA" : "#E8E8E8"}` }}
              onClick={() => setDrugCostExpanded(!drugCostExpanded)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: reachesCatastrophic ? "#FEE2E2" : "#E6F7F9" }}>
                    <DollarSign size={16} style={{ color: reachesCatastrophic ? "#DC2626" : "#00859A" }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: "#1A1A1A" }}>Est. Annual Drug Cost</p>
                    <p className="text-[10px]" style={{ color: "#8C8C8C" }}>
                      Based on {rxDrugs.length} medication{rxDrugs.length > 1 ? "s" : ""}
                      {reachesCatastrophic ? " · Hits $2,100 OOP cap" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold" style={{ color: reachesCatastrophic ? "#DC2626" : "#1A1A1A" }}>${drugCost.toLocaleString()}</span>
                  <span className="text-[10px]" style={{ color: "#8C8C8C" }}>/yr</span>
                  {drugCostExpanded ? <ChevronUp size={14} style={{ color: "#8C8C8C" }} /> : <ChevronDown size={14} style={{ color: "#8C8C8C" }} />}
                </div>
              </div>

              {/* Monthly Breakdown - shown when clicked */}
              {drugCostExpanded && drugBreakdowns.length > 0 && (
                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${reachesCatastrophic ? "#FECACA" : "#E8E8E8"}` }}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#8C8C8C" }}>Monthly Drug Breakdown</p>
                    <p className="text-[10px] font-semibold" style={{ color: "#1A1A1A" }}>${Math.round(drugCost / 12).toLocaleString()}/mo avg</p>
                  </div>
                  {drugBreakdowns.map((bd: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between py-1.5" style={{ borderBottom: idx < drugBreakdowns.length - 1 ? "1px solid rgba(226,234,237,0.5)" : "none" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={
                          bd.tier === 1 ? { backgroundColor: "#E6F7F9", color: "#00353E" } :
                          bd.tier === 2 ? { backgroundColor: "#E6F7F9", color: "#00859A" } :
                          bd.tier === 3 ? { backgroundColor: "#FFF7ED", color: "#C2410C" } :
                                         { backgroundColor: "#FEF2F2", color: "#DC2626" }
                        }>T{bd.tier}</span>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>{bd.drugName}</p>
                          <p className="text-[10px]" style={{ color: "#8C8C8C" }}>Retail: ${bd.monthlyRetailCost}/mo · Copay: ${bd.monthlyCopay}/mo</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold" style={{ color: "#1A1A1A" }}>${Math.round(bd.annualCost / 12)}/mo</p>
                        <p className="text-[10px]" style={{ color: "#8C8C8C" }}>${bd.annualCost}/yr</p>
                      </div>
                    </div>
                  ))}
                  {deductibleApplied > 0 && (
                    <div className="flex justify-between text-[10px] mt-2 pt-2" style={{ borderTop: "1px solid #E8E8E8" }}>
                      <span style={{ color: "#8C8C8C" }}>Drug deductible applied</span>
                      <span className="font-semibold" style={{ color: "#1A1A1A" }}>${deductibleApplied}</span>
                    </div>
                  )}
                  {reachesCatastrophic && monthCatastrophicReached && (
                    <div className="flex items-center gap-1.5 mt-2 pt-2" style={{ borderTop: "1px solid #E8E8E8" }}>
                      <AlertCircle size={11} className="text-red-400" />
                      <span className="text-[10px] text-red-500 font-semibold">$2,100 OOP cap reached in month {monthCatastrophicReached} — $0 cost after</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Extra Benefits Chips */}
        <div className="px-4 py-3" style={{ borderTop: "1px solid #E8E8E8" }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "#8C8C8C" }}>Extra Benefits</p>
          <div className="flex flex-wrap gap-1.5">
            {benefitKeys.map((key) => {
              const benefit = plan.extraBenefits[key];
              const Icon = BENEFIT_ICONS[key];
              const showAllowance =
                ALLOWANCE_BENEFITS.has(key) &&
                benefit.covered &&
                benefit.annualLimit;
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${!benefit.covered ? 'line-through' : ''}`}
                  style={benefit.covered
                    ? { backgroundColor: "#E6F7F9", color: "#00353E", border: "1px solid #E8E8E8" }
                    : { backgroundColor: "#F4F6F7", color: "#8C8C8C", border: "1px solid #E8E8E8" }}
                  title={showAllowance ? `${BENEFIT_LABELS[key]}: ${benefit.annualLimit}` : undefined}
                >
                  <Icon size={10} />
                  {BENEFIT_LABELS[key]}
                  {/* Show allowance for dental, vision, hearing if available */}
                  {showAllowance && (
                    <span className="font-normal opacity-80 ml-0.5">{benefit.annualLimit}</span>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* Expandable Details */}
        {expanded && (
          <div className="px-4 py-3" style={{ borderTop: "1px solid #E8E8E8" }}>
            <div className="mb-4">
              <p className="text-xs font-bold mb-2" style={{ color: "#1A1A1A" }}><Building2 size={12} className="inline mr-1" />All Copays & Cost-Sharing</p>
              {[
                { label: "Primary Care Visit", value: plan.copays.primaryCare },
                { label: "Specialist Visit", value: plan.copays.specialist },
                { label: "Urgent Care", value: plan.copays.urgentCare },
                { label: "Emergency Room", value: plan.copays.emergency },
                { label: "Inpatient Hospital", value: plan.copays.inpatientHospital },
                { label: "Outpatient Surgery", value: plan.copays.outpatientSurgery },
              ].map((item) => (
                <div key={item.label} className="flex justify-between text-xs py-1 border-b" style={{ borderColor: "rgba(226,234,237,0.5)" }}>
                  <span style={{ color: "#8C8C8C" }}>{item.label}</span>
                  <span className="font-semibold" style={{ color: "#1A1A1A" }}>{item.value}</span>
                </div>
              ))}
            </div>
            <div className="mb-4">
              <p className="text-xs font-bold mb-2" style={{ color: "#1A1A1A" }}>Benefit Details</p>
              {benefitKeys.map((key) => {
                const benefit = plan.extraBenefits[key];
                const Icon = BENEFIT_ICONS[key];
                return (
                  <div key={key} className="flex items-start gap-2 py-1.5 border-b" style={{ borderColor: "rgba(226,234,237,0.5)" }}>
                    <div className="flex items-center gap-1.5 w-24 shrink-0">
                      {benefit.covered ? (<CheckCircle2 size={12} className="text-green-500" />) : (<XCircle size={12} style={{ color: "#E8E8E8" }} />)}
                      <Icon size={12} style={{ color: "#8C8C8C" }} />
                      <span className="text-[10px] font-semibold" style={{ color: "#303030" }}>{BENEFIT_LABELS[key]}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px]" style={{ color: "#8C8C8C" }}>{benefit.details}</p>
                      {benefit.annualLimit && (<p className="text-[9px] font-semibold" style={{ color: "#8C8C8C" }}>{benefit.annualLimit}</p>)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-[10px] space-y-0.5" style={{ color: "#8C8C8C" }}>
              <p><span className="font-semibold">Contract ID:</span> {plan.contractId}/{plan.planId}</p>
              <p><span className="font-semibold">Network:</span> {plan.networkSize.toLocaleString()}+ providers</p>
              <p><span className="font-semibold">Enrollment:</span> {plan.enrollmentPeriod}</p>
              <p><span className="font-semibold">Effective:</span> {plan.effectiveDate}</p>
            </div>
          </div>
        )}

        {/* Inline Compare */}
        {onCompareActivate && (
          <InlineCompare
            plan={plan}
            isActive={isCompareActive}
            onActivate={onCompareActivate}
          />
        )}

        {/* Compare Checkbox */}
        {onCompareToggle && (
          <CompareCheckbox plan={plan} isSelected={isInCompare} isFull={isCompareFull} onToggle={onCompareToggle} />
        )}

        {/* Card Footer */}
        <div className="flex items-center gap-2 p-4 pt-2">
          <button
            onClick={() => onEnroll(plan)}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ backgroundColor: "#EF7000", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.005em" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#CF4D01"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#EF7000"; }}
          >
            Enroll Now
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-3 py-2.5 rounded-lg text-sm font-medium border transition-all"
            style={{ borderColor: "#E8E8E8", color: "#303030", fontFamily: "'Montserrat', sans-serif" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#00859A"; (e.currentTarget as HTMLButtonElement).style.color = "#00859A"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E8E8E8"; (e.currentTarget as HTMLButtonElement).style.color = "#303030"; }}
          >
            {expanded ? (<>Less <ChevronUp size={14} /></>) : (<>Details <ChevronDown size={14} /></>)}
          </button>
        </div>
      </div>

      {/* Image Modal */}
      {modalImage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: "rgba(11,27,36,0.5)", backdropFilter: "blur(3px)" }} onClick={() => setModalImage(null)}>
          <div className="relative bg-white rounded-xl p-8 max-w-lg w-full mx-4" style={{ boxShadow: "0 8px 40px rgba(11,27,36,0.16)" }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setModalImage(null)} className="absolute top-3 right-3 p-1.5 rounded-full transition-colors" style={{ color: "#8C8C8C" }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#E6F7F9")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
              <X size={18} />
            </button>
            <div className="flex flex-col items-center gap-4">
              <div className="w-28 h-28 rounded-xl flex items-center justify-center" style={{ backgroundColor: plan.carrierLogoColor }}>
                <span className="text-3xl font-black" style={{ color: plan.carrierLogoTextColor, fontFamily: "'Montserrat', sans-serif" }}>
                  {plan.carrier.split(' ').map(w => w[0]).join('').slice(0, 3)}
                </span>
              </div>
              <h3 className="text-xl font-bold text-center" style={{ color: "#1A1A1A", fontFamily: "'Montserrat', sans-serif" }}>{plan.carrier}</h3>
              <p className="text-sm text-center" style={{ color: "#8C8C8C", fontFamily: "'Montserrat', sans-serif" }}>{plan.planName}</p>
              <div className="flex items-center gap-4 mt-2">
                <div className="text-center">
                  <p className="text-2xl font-bold" style={{ color: "#1A1A1A" }}>{plan.premium === 0 ? "$0" : `$${plan.premium}`}</p>
                  <p className="text-xs" style={{ color: "#8C8C8C" }}>/month</p>
                </div>
                <div className="w-px h-10" style={{ backgroundColor: "#E8E8E8" }} />
                <div className="text-center">
                  <p className="text-2xl font-bold" style={{ color: "#1A1A1A" }}>${plan.maxOutOfPocket.toLocaleString()}</p>
                  <p className="text-xs" style={{ color: "#8C8C8C" }}>max OOP</p>
                </div>
                <div className="w-px h-10" style={{ backgroundColor: "#E8E8E8" }} />
                <StarRating rating={plan.starRating.overall} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
