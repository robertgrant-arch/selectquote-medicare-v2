// Medicare Advantage Quote Engine — Plans Results Page
// Design: Chapter-style | Navy #1C3A48 | Red #C41E3A | Light Blue #E8F2F5
// Layout: Sticky top bar + horizontal quick filters + 2-col plan grid + left filter sidebar

import { useState, useMemo, useEffect } from "react";
import { useSearch, useLocation, Link } from "wouter";
import {
  MapPin,
  Pill,
  UserRound,
  Heart,
  ArrowLeft,
  SlidersHorizontal,
  X,
  ChevronDown,
  LayoutGrid,
  List,
  Search,
  Shield,
  CheckCircle2,
  TrendingDown,
  DollarSign,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import PlanCard from "@/components/PlanCard";
import FilterSidebar from "@/components/FilterSidebar";
import RxDrugsModal from "@/components/RxDrugsModal";
import DoctorsModal from "@/components/DoctorsModal";
import EnrollModal from "@/components/EnrollModal";
import { useCompareStore } from "@/features/plan-compare/lib/compareStore";
import { isValidZipFormat, doctorSearchLabel, buildValidResult } from "@/features/zip-validation/lib/zipValidator";
import CompareSelectionTray from "@/features/plan-compare/components/CompareSelectionTray";
import AICompareModal from "@/features/plan-compare/components/AICompareModal";
import PlanDetailsModal from "@/components/PlanDetailsModal";
import AITop3Cards from "@/components/AITop3Cards";
import { scoreAllPlans, MODEL_A, MODEL_B } from "@/lib/aiRecommendationEngine";
import type { ScoringModel } from "@/lib/aiRecommendationEngine";
import type { FilterState, MedicarePlan, RxDrug, Doctor, PlanDoctorNetworkStatus } from "@/lib/types";
import type { MBIVerifyResult } from "@/components/MBIVerifyModal";
import { useSessionState } from "@/hooks/useSessionState";
import { useQuoteHandoff } from "@/contexts/QuoteHandoffContext";

const DEFAULT_FILTERS: FilterState = {
  planType: [],
  carriers: [],
  premiumRange: [0, 200],
  benefits: [],
  quickFilter: "all",
  sortBy: "moop-low",
  snpCategories: [],
  planStructure: [],
  drugCostRange: [0, 5000],
};

// Helper: parse a dollar-string like "$545" → 545, "$0" → 0
function parseDollarString(val: string): number {
  if (!val) return 0;
  const num = parseFloat(val.replace(/[^0-9.]/g, ""));
  return isNaN(num) ? 0 : num;
}

function applyFilters(plans: MedicarePlan[], filters: FilterState): MedicarePlan[] {
  let result = [...plans];

  // Quick filter
  if (filters.quickFilter === "ppo") {
    result = result.filter((p) => p.planType === "PPO");
  } else if (filters.quickFilter === "hmo") {
    result = result.filter((p) => p.planType === "HMO");
  } else if (filters.quickFilter === "zero-premium") {
    result = result.filter((p) => p.premium === 0);
  }

  // Plan type
  if (filters.planType.length > 0) {
    result = result.filter((p) => {
      const effectiveType = p.snpCategory ? "SNP" : p.planType;
      return filters.planType.includes(effectiveType);
    });
  }

  // Carriers
  if (filters.carriers.length > 0) {
    result = result.filter((p) => filters.carriers.includes(p.carrier));
  }

  // Premium range
  result = result.filter(
    (p) => p.premium >= filters.premiumRange[0] && p.premium <= filters.premiumRange[1]
  );

  // Benefits
  if (filters.benefits.length > 0) {
    result = result.filter((p) =>
      filters.benefits.every(
        (b) => p.extraBenefits?.[b as keyof typeof p.extraBenefits]?.covered
      )
    );
  }

  // SNP Categories (D-SNP, C-SNP, I-SNP individually)
  if (filters.snpCategories && filters.snpCategories.length > 0) {
    result = result.filter((p) => {
      const cat = p.snpCategory || null;
      return filters.snpCategories.includes(cat as any);
    });
  }

  // Plan Structure: MAPD (with drug coverage) vs MA-Only (without)
  if (filters.planStructure && filters.planStructure.length > 0) {
    result = result.filter((p) => {
      // hasDrugCoverage: explicit flag if present; otherwise infer from rxDrugs
      const hasRx =
        p.hasDrugCoverage ??
        (p.rxDrugs?.tier1 != null && p.rxDrugs.tier1 !== "" && p.rxDrugs.tier1 !== "N/A");
      if (filters.planStructure.includes("MAPD") && hasRx) return true;
      if (filters.planStructure.includes("MA-Only") && !hasRx) return true;
      return false;
    });
  }

  // Drug cost range
  if (filters.drugCostRange && (filters.drugCostRange[0] > 0 || filters.drugCostRange[1] < 5000)) {
    result = result.filter((p) => {
      const cost = (p as any).estimatedAnnualDrugCost ?? 0;
      return cost >= filters.drugCostRange[0] && cost <= filters.drugCostRange[1];
    });
  }

  // Sort
  switch (filters.sortBy) {
    case "premium-low":
      result.sort((a, b) => a.premium - b.premium);
      break;
    case "premium-high":
      result.sort((a, b) => b.premium - a.premium);
      break;
    case "star-rating":
      result.sort((a, b) => b.starRating.overall - a.starRating.overall);
      break;
    case "moop-low":
      result.sort((a, b) => a.maxOutOfPocket - b.maxOutOfPocket);
      break;
    case "best-match":
      result.sort((a, b) => {
        if (a.isBestMatch && !b.isBestMatch) return -1;
        if (!a.isBestMatch && b.isBestMatch) return 1;
        if (a.isMostPopular && !b.isMostPopular) return -1;
        if (!a.isMostPopular && b.isMostPopular) return 1;
        return b.starRating.overall - a.starRating.overall;
      });
      break;
    case "total-cost":
      result.sort((a, b) => {
        const aCost = a.premium * 12 + ((a as any).estimatedAnnualDrugCost ?? 0);
        const bCost = b.premium * 12 + ((b as any).estimatedAnnualDrugCost ?? 0);
        return aCost - bCost;
      });
      break;
    // NEW sort options
    case "drug-cost":
      result.sort((a, b) => {
        const aCost = (a as any).estimatedAnnualDrugCost ?? 0;
        const bCost = (b as any).estimatedAnnualDrugCost ?? 0;
        return aCost - bCost;
      });
      break;
    case "benefits-max":
      result.sort((a, b) => {
        const countCovered = (p: MedicarePlan) =>
          Object.values(p.extraBenefits).filter((eb) => eb?.covered).length;
        return countCovered(b) - countCovered(a);
      });
      break;
    case "deductible-low":
      result.sort((a, b) => {
        const aDeduct = parseDollarString(a.rxDrugs?.deductible ?? "$0");
        const bDeduct = parseDollarString(b.rxDrugs?.deductible ?? "$0");
        return aDeduct - bDeduct;
      });
      break;
    default:
      result.sort((a, b) => a.maxOutOfPocket - b.maxOutOfPocket);
  }

  return result;
}

export default function Plans() {
  const searchStr = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(searchStr);
  const zip = params.get("zip") || "64106";

  const extraHelp = params.get("extraHelp") as "full" | "partial" | "no" | "not-sure" | "skip" | null;

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [rxDrugs, setRxDrugs] = useSessionState<RxDrug[]>("mqe_rxDrugs", []);
  const [doctors, setDoctors] = useSessionState<Doctor[]>("mqe_doctors", []);
  const [rxModalOpen, setRxModalOpen] = useState(false);
  const [doctorsModalOpen, setDoctorsModalOpen] = useState(false);
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollPlan, setEnrollPlan] = useState<MedicarePlan | null>(null);
  const [detailPlans, setDetailPlans] = useState<MedicarePlan[]>([]);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [detailIsAi, setDetailIsAi] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [zipInput, setZipInput] = useState(zip);
  const [activeCompareId, setActiveCompareId] = useState<string | null>(null);
  const [plans, setPlans] = useState<MedicarePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [locationInfo, setLocationInfo] = useState<{ stateAbbr: string; countyName: string } | null>(null);
  const [eligibility, setEligibility] = useState<MBIVerifyResult | null>(null);
  const [showCurrentPlanBanner, setShowCurrentPlanBanner] = useState(true);
  const [aiModel, setAiModel] = useState<ScoringModel>('B');
  const compareStore = useCompareStore();
  const quoteHandoff = useQuoteHandoff();
  const [aiCompareOpen, setAICompareOpen] = useState(false);
  const [doctorNetworkMap, setDoctorNetworkMap] = useState<Record<string, PlanDoctorNetworkStatus>>({});

  // Consume in-memory handoff from Home (replaces former sessionStorage reads).
  // take() clears the payload atomically — it is never written to any storage API.
  useEffect(() => {
    const handoff = quoteHandoff.take();
    if (!handoff) return;
    if (handoff.verifyResult) {
      setEligibility(handoff.verifyResult);
    }
    if (handoff.doctors && handoff.doctors.length > 0) {
      setDoctors(handoff.doctors.map((doc: any) => ({
        id: doc.id, name: doc.name, specialty: doc.specialty || '',
        npi: doc.npi || doc.id, address: doc.address || '',
      })));
    }
    if (handoff.drugs && handoff.drugs.length > 0) {
      setRxDrugs(handoff.drugs.map((d: any) => ({
        id: d.id || d.name, name: d.name, dosage: d.dosage || "",
        frequency: d.frequency || "monthly", isGeneric: true,
      })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCompareActivate = (planId: string | null) => {
    setActiveCompareId(planId);
  };

  // Fetch real CMS plans when ZIP changes
  useEffect(() => {
    if (!zip || !isValidZipFormat(zip)) {
      // Invalid ZIP reached /plans directly — redirect to home
      navigate("/");
      return;
    }
    setPlansLoading(true);
    setPlansError(null);
    const drugsStr = rxDrugs.length > 0 ? JSON.stringify(rxDrugs.map(d => ({ name: d.name, dosage: d.dosage }))) : '';
    fetch(`/api/plans?zip=${zip}${drugsStr ? `&drugs=${encodeURIComponent(drugsStr)}` : ''}`)
      .then((r) => r.json())
      .then((data: { plans?: MedicarePlan[]; location?: { stateAbbr: string; countyName: string }; error?: string }) => {
        if (data.error) {
          setPlansError(data.error);
          setPlans([]);
        } else {
          setPlans(data.plans ?? []);
          setLocationInfo(data.location ?? null);
        }
      })
      .catch((err: Error) => {
        setPlansError("Failed to load plans. Please try again.");
        console.error("[Plans] fetch error:", err);
      })
      .finally(() => setPlansLoading(false));
  }, [zip, rxDrugs]);

  // Fetch doctor network status
  useEffect(() => {
    if (doctors.length === 0 || plans.length === 0) {
      setDoctorNetworkMap({});
      return;
    }
    const fetchNetworkStatus = async () => {
      try {
        const res = await fetch("/api/provider-network", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            doctors: doctors.map(d => ({ npi: d.npi, name: d.name, specialty: d.specialty })),
            plans: plans.map(p => ({ planId: p.planId, contractId: p.contractId, carrier: p.carrier, networkSize: p.networkSize })),
            zip,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const map: Record<string, PlanDoctorNetworkStatus> = {};
        for (const r of data.results) { map[r.planId] = r; }
        setDoctorNetworkMap(map);
      } catch (err) {
        console.error("[Plans] provider-network error:", err);
      }
    };
    fetchNetworkStatus();
  }, [doctors, plans, zip]);

  const countyName = locationInfo ? `${locationInfo.countyName}, ${locationInfo.stateAbbr}` : "Loading...";

  const filteredPlans = useMemo(() => {
    let result = applyFilters(plans, filters);
    if (extraHelp === "no") {
      result = result.filter((p) => {
        const name = (p.planName || "").toUpperCase();
        const type = (p.planType || "").toUpperCase();
        if (type.includes("D-SNP") || name.includes("D-SNP") || name.includes("DUAL")) return false;
        return true;
      });
    }
    if (showFavoritesOnly) {
      result = result.filter((p) => favorites.has(p.id));
    }
    const SNP_ORDER: Record<string, number> = { DSNP: 1, CSNP: 2, ISNP: 3, OTHER_SNP: 4 };
    const nonSnp = result.filter((p) => !p.snpCategory);
    const snpPlans = result.filter((p) => !!p.snpCategory);
    snpPlans.sort((a, b) => (SNP_ORDER[a.snpCategory!] || 99) - (SNP_ORDER[b.snpCategory!] || 99));
    result = [...nonSnp, ...snpPlans];
    return result;
  }, [plans, filters, showFavoritesOnly, favorites, extraHelp]);

  const aiScores = useMemo(() => {
    const ep = filteredPlans.map(p => ({...p, doctorNetworkStatus: doctorNetworkMap[p.planId]}));
    return scoreAllPlans(ep as any, { rxDrugs, doctors }, aiModel);
  }, [filteredPlans, rxDrugs, doctors, aiModel, doctorNetworkMap]);

  const topPlan = aiScores.length > 0 ? aiScores[0] : null;
  const aiScoreMap = useMemo(() => Object.fromEntries(aiScores.map(s => [s.planId, s])), [aiScores]);

  const availableCarriers = useMemo(
    () => Array.from(new Set(plans.map((p) => p.carrier))).sort(),
    [plans]
  );

  const QUICK_FILTERS = useMemo(() => [
    { key: "all" as const, label: "All Plans", count: plans.length },
    { key: "ppo" as const, label: "PPO", count: plans.filter((p) => p.planType === "PPO").length },
    { key: "zero-premium" as const, label: "$0 Premium", count: plans.filter((p) => p.premium === 0).length },
    { key: "hmo" as const, label: "HMO", count: plans.filter((p) => p.planType === "HMO").length },
  ], [plans]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast.success("Plan removed from saved plans");
      } else {
        next.add(id);
        toast.success("Plan saved!", { description: "View your saved plans anytime", icon: "❤️" });
      }
      return next;
    });
  };

  const handleEnroll = (plan: MedicarePlan) => {
    setEnrollPlan(plan);
    setEnrollModalOpen(true);
  };

  const handleZipSearch = () => {
    if (/^\d{5}$/.test(zipInput.trim())) {
      navigate(`/plans?zip=${zipInput.trim()}`);
    }
  };

  const activeFilterCount =
    filters.planType.length +
    filters.carriers.length +
    (filters.snpCategories?.length ?? 0) +
    filters.benefits.length +
    (filters.premiumRange[1] < 200 ? 1 : 0) +
    (filters.planStructure?.length ?? 0) +
    (filters.drugCostRange && (filters.drugCostRange[0] > 0 || filters.drugCostRange[1] < 5000) ? 1 : 0);

  // Wire annual-cost and match-score modal events
  useEffect(() => {
    const openRx  = () => setRxModalOpen(true);
    const openDoc = () => setDoctorsModalOpen(true);
    window.addEventListener('annual-cost:open-rx-modal',      openRx);
    window.addEventListener('annual-cost:open-doctors-modal', openDoc);
    window.addEventListener('match-score:open-rx-modal',      openRx);
    window.addEventListener('match-score:open-doctors-modal', openDoc);
    return () => {
      window.removeEventListener('annual-cost:open-rx-modal',      openRx);
      window.removeEventListener('annual-cost:open-doctors-modal', openDoc);
      window.removeEventListener('match-score:open-rx-modal',      openRx);
      window.removeEventListener('match-score:open-doctors-modal', openDoc);
    };
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAF9F5", fontFamily: "'DM Sans', sans-serif" }}>
      <Header />

      {/* ── Results Header Bar ────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 border-b" style={{ backgroundColor: "white", borderColor: "#E2EAED", boxShadow: "0 1px 0 rgba(11,27,36,0.06)" }}>
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">

          {/* Breadcrumb + location */}
          <div className="flex items-center gap-2 mr-2">
            <Link
              href="/"
              className="flex items-center gap-1 text-xs font-semibold transition-colors"
              style={{ color: "#7A9BA6" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#1C3A48"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#7A9BA6"; }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />&nbsp;Back
            </Link>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#3E5560" }}>
            <MapPin className="w-3.5 h-3.5" style={{ color: "#237A92" }} />
            ZIP {zip} &middot; {countyName}
          </div>

          {/* ZIP change + tools */}
          <div className="flex items-center gap-2 ml-auto flex-wrap">

            {/* ZIP input */}
            <div className="flex items-center border rounded-lg overflow-hidden" style={{ borderColor: "#E2EAED" }}>
              <Search className="w-3.5 h-3.5 ml-2.5" style={{ color: "#7A9BA6" }} />
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={zipInput}
                onChange={(e) => setZipInput(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleZipSearch()}
                className="w-20 px-2.5 py-1.5 text-sm font-semibold focus:outline-none"
                style={{ fontFamily: "'DM Sans', sans-serif", color: "#1C3A48" }}
              />
            </div>

            {/* Add Rx */}
            <button onClick={() => setRxModalOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
              style={{ borderColor: rxDrugs.length > 0 ? "#1C3A48" : "#E2EAED", color: rxDrugs.length > 0 ? "#1C3A48" : "#3E5560", backgroundColor: rxDrugs.length > 0 ? "#E8F2F5" : "white" }}>
              <Pill className="w-3.5 h-3.5" />
              {rxDrugs.length > 0 ? `${rxDrugs.length} Drug${rxDrugs.length > 1 ? "s" : ""}` : "Add Rx Drugs"}
            </button>

            {/* Add Doctors */}
            <button onClick={() => setDoctorsModalOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
              style={{ borderColor: doctors.length > 0 ? "#1C3A48" : "#E2EAED", color: doctors.length > 0 ? "#1C3A48" : "#3E5560", backgroundColor: doctors.length > 0 ? "#E8F2F5" : "white" }}>
              <UserRound className="w-3.5 h-3.5" />
              {doctors.length > 0 ? `${doctors.length} Doctor${doctors.length > 1 ? "s" : ""}` : "Add Doctors"}
            </button>

            {/* Saved plans */}
            <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
              style={{ borderColor: showFavoritesOnly ? "#237A92" : "#E2EAED", color: showFavoritesOnly ? "#237A92" : "#3E5560", backgroundColor: showFavoritesOnly ? "#EEF5F7" : "white" }}>
              <Heart className="w-3.5 h-3.5" />
              {favorites.size > 0 ? `Saved (${favorites.size})` : "Saved"}
            </button>
          </div>
        </div>

        {/* ── Quick Filter Tabs ─────────────────────────────────────────────── */}
        <div className="max-w-screen-xl mx-auto px-4 pb-2 flex items-center gap-2 overflow-x-auto">
          {QUICK_FILTERS.map((qf) => (
            <button key={qf.key} onClick={() => setFilters({ ...filters, quickFilter: qf.key })}
              className={`quick-filter-tab whitespace-nowrap ${filters.quickFilter === qf.key ? "active" : ""}`}>
              {qf.label}&nbsp;<span className="opacity-60">{qf.count}</span>
            </button>
          ))}

          {/* Mobile filter toggle */}
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all" style={{ borderColor: "#E2EAED", color: "#3E5560" }}>
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
            {activeFilterCount > 0 && (<span className="ml-1 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center" style={{ backgroundColor: "#237A92" }}>{activeFilterCount}</span>)}
          </button>

          {/* View mode toggle */}
          <div className="ml-auto flex rounded-lg overflow-hidden border" style={{ borderColor: "#E2EAED" }}>
            <button onClick={() => setViewMode("grid")} className="p-1.5 transition-colors"
              style={{ backgroundColor: viewMode === "grid" ? "#1C3A48" : "white", color: viewMode === "grid" ? "white" : "#7A9BA6" }}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode("list")} className="p-1.5 transition-colors"
              style={{ backgroundColor: viewMode === "list" ? "#1C3A48" : "white", color: viewMode === "list" ? "white" : "#7A9BA6" }}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-4 py-6 flex gap-6">

        {/* ── Left Sidebar ────────────────────────────────────────────── */}
        <aside className="hidden lg:block w-64 shrink-0">
          <FilterSidebar filters={filters} onChange={setFilters} totalCount={plans.length} filteredCount={filteredPlans.length} availableCarriers={availableCarriers} plans={plans} />
        </aside>

        {/* ── Plan Grid ───────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">

          {/* Results summary */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: "#0B1B24", fontFamily: "'Lora', serif" }}>
                {showFavoritesOnly ? "Saved Plans" : "Medicare Advantage Plans"}
              </h1>
              <p className="mt-0.5" style={{ color: "#7A9BA6", fontSize: "13px" }}>
                {filteredPlans.length} plan{filteredPlans.length !== 1 ? "s" : ""} available
                {showFavoritesOnly ? " (saved)" : ` in ${countyName}`}
                {activeFilterCount > 0 && (
                  <span style={{ color: "#237A92" }}> &middot; {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} applied</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button onClick={() => setFilters(DEFAULT_FILTERS)} className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors" style={{ color: "#1C3A48", borderColor: "#E2EAED" }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#237A92"; (e.currentTarget as HTMLButtonElement).style.color = "#237A92"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2EAED"; (e.currentTarget as HTMLButtonElement).style.color = "#1C3A48"; }}>
                  <X className="w-3 h-3" /> Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* ── Current Plan Banner ────────────────── */}
          {eligibility?.currentPlan && showCurrentPlanBanner && (
            <div className="mb-4 p-4 rounded-xl border" style={{ borderColor: "#237A92", backgroundColor: "#EEF5F7" }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4" style={{ color: "#1C3A48" }} />
                    <span className="text-sm font-bold" style={{ color: "#1C3A48" }}>Your Current Plan</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "#EEF5F7", color: "#237A92", border: "1px solid #C6DAE0" }}>Active Coverage</span>
                    {eligibility.isMockData && (<span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Demo data</span>)}
                  </div>
                  <h3 className="font-bold text-base" style={{ color: "#1C3A48" }}>{eligibility.currentPlan.planName}</h3>
                  <p className="text-xs mt-0.5" style={{ color: "#7A9BA6" }}>{eligibility.currentPlan.carrier} &middot; Plan ID: {eligibility.currentPlan.planId}</p>
                  <div className="flex gap-4 mt-2">
                    {[
                      { icon: DollarSign, label: "Premium", value: eligibility.currentPlan.premium === 0 ? "$0/mo" : `$${eligibility.currentPlan.premium}/mo` },
                      { icon: TrendingDown, label: "Max OOP", value: `$${eligibility.currentPlan.oopMax.toLocaleString()}` },
                      { icon: CheckCircle2, label: "Deductible", value: eligibility.currentPlan.deductible === 0 ? "$0" : `$${eligibility.currentPlan.deductible}` },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center gap-1 text-xs">
                        <Icon className="w-3.5 h-3.5" style={{ color: "#7A9BA6" }} />
                        <span style={{ color: "#7A9BA6" }}>{label}:</span>&nbsp;<span className="font-bold" style={{ color: "#1C3A48" }}>{value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs mt-2" style={{ color: "#7A9BA6" }}>Plans below are compared against your current coverage. Look for better benefits or lower costs.</p>
                </div>
                <button onClick={() => setShowCurrentPlanBanner(false)} className="transition-colors shrink-0" style={{ color: "#7A9BA6" }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#1C3A48"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#7A9BA6"; }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* AI Recommendation Banner */}
          {topPlan && (
            <AITop3Cards
              scores={aiScores}
              model={aiModel}
              onEnroll={handleEnroll}
              doctors={doctors}
              doctorNetworkMap={doctorNetworkMap}
              onOpenDetails={(plans, index) => {
                setDetailPlans(plans);
                setDetailIndex(index);
                setDetailIsAi(true);
              }}
            />
          )}

          {/* Personalization banner */}
          {(rxDrugs.length > 0 || doctors.length > 0) && (
            <div className="mb-4 px-4 py-2.5 rounded-lg flex items-center gap-3" style={{ backgroundColor: "#EEF5F7", border: "1px solid #C6DAE0" }}>
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#237A92" }} />
              <p className="text-xs flex-1" style={{ color: "#3E5560" }}>
                <span className="font-semibold" style={{ color: "#1C3A48" }}>Personalized results —</span>{" "}
                {rxDrugs.length > 0 && `${rxDrugs.length} medication${rxDrugs.length > 1 ? "s" : ""}`}
                {rxDrugs.length > 0 && doctors.length > 0 && " \u00b7 "}
                {doctors.length > 0 && `${doctors.length} doctor${doctors.length > 1 ? "s" : ""}`}
              </p>
              <button onClick={() => { setRxDrugs([]); setDoctors([]); }} className="shrink-0 transition-colors" style={{ color: "#7A9BA6" }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#1C3A48"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#7A9BA6"; }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Extra Help "Not Sure" banner */}
          {extraHelp === "not-sure" && (
            <div className="mb-4 p-3 rounded-xl" style={{ backgroundColor: "#FAF9F5", border: "1px solid #E2EAED" }}>
              <p className="text-xs" style={{ color: "#3E5560" }}>
                Your results include all available plans.{" "}
                If you receive Extra Help from Medicare, you may qualify for lower costs on some plans — particularly those marked as D-SNP (Dual Special Needs Plans).
              </p>
            </div>
          )}

          {/* Loading state */}
          {plansLoading && (
            <div className="text-center py-16">
              <div className="animate-spin w-8 h-8 border-2 rounded-full mx-auto mb-4" style={{ borderColor: "#E2EAED", borderTopColor: "#237A92" }} />
              <p className="text-sm font-semibold" style={{ color: "#1C3A48" }}>Loading Medicare Advantage plans for ZIP {zip}\u2026</p>
              <p className="text-xs mt-1" style={{ color: "#7A9BA6" }}>Fetching real CMS 2026 data \u2014 this may take 10\u201320 seconds on first load</p>
            </div>
          )}

          {/* Error state */}
          {plansError && (
            <div className="text-center py-16">
              <Info className="w-10 h-10 mx-auto mb-3" style={{ color: "#C6DAE0" }} />
              <h3 className="font-semibold text-base" style={{ color: "#1C3A48", fontFamily: "'Lora', serif" }}>No Plans Found</h3>
              <p className="text-sm mt-1" style={{ color: "#7A9BA6" }}>{plansError}</p>
              <p className="text-xs mt-1" style={{ color: "#7A9BA6" }}>Try a different ZIP code or check back later.</p>
            </div>
          )}

          {/* No results */}
          {!plansLoading && !plansError && filteredPlans.length === 0 ? (
            <div className="text-center py-16">
              <Info className="w-10 h-10 mx-auto mb-3" style={{ color: "#C6DAE0" }} />
              <h3 className="font-semibold text-base" style={{ color: "#1C3A48", fontFamily: "'Lora', serif" }}>No plans match your filters</h3>
              <p className="text-sm mt-1" style={{ color: "#7A9BA6" }}>Try adjusting your filters or clearing them to see all available plans.</p>
              <button onClick={() => setFilters(DEFAULT_FILTERS)} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white mt-4" style={{ backgroundColor: "#1C3A48", fontFamily: "'DM Sans', sans-serif" }}>
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className={`grid gap-4 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
              {filteredPlans.map((plan, i) => {
                const cp = eligibility?.currentPlan;
                const premiumDiff = cp ? plan.premium - cp.premium : null;
                const oopDiff = cp ? plan.maxOutOfPocket - cp.oopMax : null;
                const prevPlan = i > 0 ? filteredPlans[i - 1] : null;
                const showSnpHeader = plan.snpCategory && (!prevPlan || prevPlan.snpCategory !== plan.snpCategory);
                const SNP_LABELS: Record<string, string> = {
                  DSNP: "Dual-Eligible Special Needs Plans (D-SNP)",
                  CSNP: "Chronic Condition Special Needs Plans (C-SNP)",
                  ISNP: "Institutional Special Needs Plans (I-SNP)",
                  OTHER_SNP: "Other Special Needs Plans",
                };
                const hasBetterPremium = premiumDiff !== null && premiumDiff < 0;
                const hasBetterOOP = oopDiff !== null && oopDiff < 0;
                const hasBetterBoth = hasBetterPremium && hasBetterOOP;

                return (
                  <div key={plan.id} className="relative">
                    {showSnpHeader && (
                      <div className="col-span-full mb-2 mt-4">
                        <h3 className="text-sm font-bold" style={{ color: "#1C3A48" }}>{SNP_LABELS[plan.snpCategory!] || "Special Needs Plans"}</h3>
                        <p className="text-xs" style={{ color: "#7A9BA6" }}>
                          <span className="font-semibold">{filteredPlans.filter((p) => p.snpCategory === plan.snpCategory).length} plan{filteredPlans.filter((p) => p.snpCategory === plan.snpCategory).length !== 1 ? "s" : ""}</span>
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "#7A9BA6" }}>
                          {plan.snpCategory === "DSNP" && "For beneficiaries eligible for both Medicare and Medicaid"}
                          {plan.snpCategory === "CSNP" && "For beneficiaries with specific chronic conditions"}
                          {plan.snpCategory === "ISNP" && "For beneficiaries in institutional settings"}
                          {plan.snpCategory === "OTHER_SNP" && "Other special needs plan types"}
                        </p>
                      </div>
                    )}

                    {cp && (hasBetterPremium || hasBetterOOP) && (
                      <div className="absolute -top-2 right-4 z-10 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#EEF5F7", color: "#237A92", border: "1px solid #C6DAE0" }}>
                        {hasBetterBoth ? `Save $${Math.abs(premiumDiff!)}/mo + lower OOP` : hasBetterPremium ? `Save $${Math.abs(premiumDiff!)}/mo vs current` : `Lower max OOP by $${Math.abs(oopDiff!).toLocaleString()}`}
                      </div>
                    )}

                    <PlanCard
                        plan={plan}
                        onEnroll={handleEnroll}
                        onFavorite={toggleFavorite}
                        isFavorite={favorites.has(plan.id)}
                        viewMode={viewMode}
                        onCompareActivate={handleCompareActivate}
                        isCompareActive={activeCompareId === plan.id}
                        allPlans={filteredPlans}
                        rxDrugs={rxDrugs}
                        doctors={doctors}
                        doctorNetworkStatus={doctorNetworkMap[plan.planId]}
                        hasRxDrugs={rxDrugs.length > 0}
                        hasDoctors={doctors.length > 0}
                        matchScore={aiScoreMap[plan.id]?.score}
                        matchLabel={aiScoreMap[plan.id] ? (() => { const s = aiScoreMap[plan.id].score; return s >= 85 ? 'Excellent fit' : s >= 70 ? 'Strong fit' : s >= 55 ? 'Good fit' : s >= 40 ? 'Possible fit' : 'Low fit'; })() : undefined}
                        isInCompare={compareStore.isSelected(plan.id)}
                        isCompareFull={compareStore.isFull() && !compareStore.isSelected(plan.id)}
                        onCompareToggle={(p) => compareStore.toggle(p)}
                      />
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom disclaimer */}
          <div className="mt-8 p-4 rounded-xl border text-xs" style={{ borderColor: "#E2EAED", backgroundColor: "#FAF9F5", color: "#7A9BA6" }}>
            <p><strong>Data Source:</strong> Plan information is sourced from the CMS CY2026 Medicare Advantage Landscape file. Benefit details are AI-estimated. Always verify plan details directly with the insurance carrier before enrolling. Medicare has neither reviewed nor endorsed this information.</p>
          </div>
        </main>
      </div>

      {/* Compare Tray */}
      <CompareSelectionTray onCompare={() => setAICompareOpen(true)} />

      <AICompareModal
        open={aiCompareOpen}
        plans={compareStore.selected}
        onClose={() => setAICompareOpen(false)}
      />

      {/* ── Mobile Filter Drawer ──────────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0" style={{ backgroundColor: "rgba(11,27,36,0.5)", backdropFilter: "blur(3px)" }} onClick={() => setSidebarOpen(false)} />
          <div className="relative w-80 max-w-full overflow-y-auto" style={{ backgroundColor: "#fff", boxShadow: "4px 0 24px rgba(11,27,36,0.12)" }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "#E2EAED" }}>
              <span className="text-sm font-bold" style={{ color: "#1C3A48" }}>Filter Plans</span>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-full hover:bg-[#EEF5F7] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <FilterSidebar filters={filters} onChange={(f) => { setFilters(f); setSidebarOpen(false); }} totalCount={plans.length} filteredCount={filteredPlans.length} availableCarriers={availableCarriers} plans={plans} />
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────── */}
      <RxDrugsModal open={rxModalOpen} onClose={() => setRxModalOpen(false)} selectedDrugs={rxDrugs} onSave={setRxDrugs} />
      <DoctorsModal open={doctorsModalOpen} onClose={() => setDoctorsModalOpen(false)} selectedDoctors={doctors} onSave={setDoctors} zip={zip} />
      <EnrollModal open={enrollModalOpen} onClose={() => setEnrollModalOpen(false)} plan={enrollPlan} />
      <PlanDetailsModal
        plans={detailPlans}
        selectedIndex={detailIndex}
        isOpen={detailIndex !== null}     isAiContext={detailIsAi}
        onClose={() => { setDetailIndex(null); setDetailPlans([]); setDetailIsAi(false); }}
        onChangeIndex={setDetailIndex}
        onEnroll={handleEnroll}
      />
    </div>
  );
}
