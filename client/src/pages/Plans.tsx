// Medicare Advantage Quote Engine — Plans Results Page
// Design: Chapter-style | Navy #1B365D | Red #C41E3A | Light Blue #E8F0FE
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
  Sparkles,
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
  const [aiCompareOpen, setAICompareOpen] = useState(false);
  const [doctorNetworkMap, setDoctorNetworkMap] = useState<Record<string, PlanDoctorNetworkStatus>>({});

  // Read MBI eligibility from sessionStorage
  useEffect(() => {
    const verified = params.get("verified");
    if (verified === "1") {
      try {
        const stored = sessionStorage.getItem("mbi_eligibility");
        if (stored) {
          const parsed = JSON.parse(stored) as MBIVerifyResult;
          setEligibility(parsed);
          sessionStorage.removeItem("mbi_eligibility");
        }
      } catch {
        // ignore parse errors
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read workflow data from sessionStorage
  useEffect(() => {
    const personalized = params.get("personalized");
    if (personalized === "1") {
      try {
        const stored = sessionStorage.getItem("workflow_data");
        if (stored) {
          const data = JSON.parse(stored);
          if (data.doctors && Array.isArray(data.doctors) && data.doctors.length > 0) {
            setDoctors(data.doctors.map((doc: any) => ({
              id: doc.id, name: doc.name, specialty: doc.specialty || '',
              npi: doc.npi || doc.id, address: doc.address || ''
            })));
          }
          if (data.drugs && Array.isArray(data.drugs) && data.drugs.length > 0) {
            setRxDrugs(data.drugs.map((d: any) => ({
              id: d.id || d.name, name: d.name, dosage: d.dosage || "",
              frequency: d.frequency || "monthly", isGeneric: true
            })));
          }
          sessionStorage.removeItem("workflow_data");
        }
      } catch {
        // ignore parse errors
      }
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
    <div className="min-h-screen" style={{ backgroundColor: "#F8FAFC", fontFamily: "'DM Sans', sans-serif" }}>
      <Header />

      {/* ── Results Header Bar ────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 border-b" style={{ backgroundColor: "white", borderColor: "#E5E7EB" }}>
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">

          {/* Breadcrumb + location */}
          <div className="flex items-center gap-2 mr-2">
            <Link
              href="/"
              className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-navy transition-colors"
              style={{ color: "#6B7280" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#1B365D"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#6B7280"; }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />&nbsp;Back
            </Link>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <MapPin className="w-3.5 h-3.5" style={{ color: "#C41E3A" }} />
            ZIP {zip} &middot; {countyName}
          </div>

          {/* ZIP change + tools */}
          <div className="flex items-center gap-2 ml-auto flex-wrap">

            {/* ZIP input */}
            <div className="flex items-center border rounded-lg overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
              <Search className="w-3.5 h-3.5 ml-2.5 text-gray-400" />
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={zipInput}
                onChange={(e) => setZipInput(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleZipSearch()}
                className="w-20 px-2.5 py-1.5 text-sm font-semibold text-gray-700 focus:outline-none"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              />
            </div>

            {/* Add Rx */}
            <button onClick={() => setRxModalOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
              style={{ borderColor: rxDrugs.length > 0 ? "#1B365D" : "#E5E7EB", color: rxDrugs.length > 0 ? "#1B365D" : "#374151", backgroundColor: rxDrugs.length > 0 ? "#E8F0FE" : "white" }}>
              <Pill className="w-3.5 h-3.5" />
              {rxDrugs.length > 0 ? `${rxDrugs.length} Drug${rxDrugs.length > 1 ? "s" : ""}` : "Add Rx Drugs"}
            </button>

            {/* Add Doctors */}
            <button onClick={() => setDoctorsModalOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
              style={{ borderColor: doctors.length > 0 ? "#1B365D" : "#E5E7EB", color: doctors.length > 0 ? "#1B365D" : "#374151", backgroundColor: doctors.length > 0 ? "#E8F0FE" : "white" }}>
              <UserRound className="w-3.5 h-3.5" />
              {doctors.length > 0 ? `${doctors.length} Doctor${doctors.length > 1 ? "s" : ""}` : "Add Doctors"}
            </button>

            {/* Saved plans */}
            <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
              style={{ borderColor: showFavoritesOnly ? "#EF4444" : "#E5E7EB", color: showFavoritesOnly ? "#EF4444" : "#374151", backgroundColor: showFavoritesOnly ? "#FEF2F2" : "white" }}>
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
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
            {activeFilterCount > 0 && (<span className="ml-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>)}
          </button>

          {/* View mode toggle */}
          <div className="ml-auto flex rounded-lg overflow-hidden border" style={{ borderColor: "#E5E7EB" }}>
            <button onClick={() => setViewMode("grid")} className="p-1.5 transition-colors"
              style={{ backgroundColor: viewMode === "grid" ? "#1B365D" : "white", color: viewMode === "grid" ? "white" : "#6B7280" }}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode("list")} className="p-1.5 transition-colors"
              style={{ backgroundColor: viewMode === "list" ? "#1B365D" : "white", color: viewMode === "list" ? "white" : "#6B7280" }}>
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
              <h1 className="text-xl font-bold" style={{ color: "#1B365D" }}>
                {showFavoritesOnly ? "Saved Plans" : "Medicare Advantage Plans"}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {filteredPlans.length} plan{filteredPlans.length !== 1 ? "s" : ""} available
                {showFavoritesOnly ? " (saved)" : ` in ${countyName}`}
                {activeFilterCount > 0 && (
                  <span className="text-blue-600"> &middot; {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} applied</span>
                )}
              </p>
            </div>

            {/* AI Compare button */}
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: "#1B365D" }} />
              <span className="text-xs font-semibold" style={{ color: "#1B365D" }}>AI Compare</span>
              {/* Active filter chips */}
              {activeFilterCount > 0 && (
                <button onClick={() => setFilters(DEFAULT_FILTERS)} className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors">
                  <X className="w-3 h-3" /> Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* ── Current Plan Banner ────────────────── */}
          {eligibility?.currentPlan && showCurrentPlanBanner && (
            <div className="mb-4 p-4 rounded-xl border" style={{ borderColor: "#1B365D", backgroundColor: "#F0F4FF" }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4" style={{ color: "#1B365D" }} />
                    <span className="text-sm font-bold" style={{ color: "#1B365D" }}>Your Current Plan</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "#DCFCE7", color: "#166534" }}>✓ Active Coverage</span>
                    {eligibility.isMockData && (<span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Demo data</span>)}
                  </div>
                  <h3 className="font-bold text-base" style={{ color: "#1B365D" }}>{eligibility.currentPlan.planName}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{eligibility.currentPlan.carrier} &middot; Plan ID: {eligibility.currentPlan.planId}</p>
                  <div className="flex gap-4 mt-2">
                    {[
                      { icon: DollarSign, label: "Premium", value: eligibility.currentPlan.premium === 0 ? "$0/mo" : `$${eligibility.currentPlan.premium}/mo` },
                      { icon: TrendingDown, label: "Max OOP", value: `$${eligibility.currentPlan.oopMax.toLocaleString()}` },
                      { icon: CheckCircle2, label: "Deductible", value: eligibility.currentPlan.deductible === 0 ? "$0" : `$${eligibility.currentPlan.deductible}` },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center gap-1 text-xs">
                        <Icon className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-gray-500">{label}:</span>&nbsp;<span className="font-bold" style={{ color: "#1B365D" }}>{value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Plans below are compared against your current coverage. Look for better benefits or lower costs.</p>
                </div>
                <button onClick={() => setShowCurrentPlanBanner(false)} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
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
            <div className="mb-4 p-3 rounded-xl flex items-center gap-2" style={{ backgroundColor: "#E8F0FE" }}>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#1B365D", color: "white" }}>✓</span>
              <p className="text-xs text-gray-700">
                <span className="font-semibold" style={{ color: "#1B365D" }}>Personalized for you:</span>{" "}
                {rxDrugs.length > 0 && `${rxDrugs.length} medication${rxDrugs.length > 1 ? "s" : ""}`}
                {rxDrugs.length > 0 && doctors.length > 0 && " \u00b7 "}
                {doctors.length > 0 && `${doctors.length} doctor${doctors.length > 1 ? "s" : ""}`}&nbsp;added to your profile
              </p>
              <button onClick={() => { setRxDrugs([]); setDoctors([]); }} className="ml-auto text-xs text-gray-500 hover:text-red-500 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Extra Help "Not Sure" banner */}
          {extraHelp === "not-sure" && (
            <div className="mb-4 p-3 rounded-xl" style={{ backgroundColor: "#FEF3C7" }}>
              <p className="text-xs text-amber-800">
                Your results include all available plans.{" "}
                If you receive Extra Help from Medicare, you may qualify for lower costs on some plans &mdash; particularly those marked as D-SNP (Dual Special Needs Plans).
              </p>
            </div>
          )}

          {/* Loading state */}
          {plansLoading && (
            <div className="text-center py-16">
              <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full mx-auto mb-4" />
              <p className="text-sm font-semibold" style={{ color: "#1B365D" }}>Loading Medicare Advantage plans for ZIP {zip}\u2026</p>
              <p className="text-xs text-gray-500 mt-1">Fetching real CMS 2026 data \u2014 this may take 10\u201320 seconds on first load</p>
            </div>
          )}

          {/* Error state */}
          {plansError && (
            <div className="text-center py-16">
              <Info className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <h3 className="font-bold text-base" style={{ color: "#1B365D" }}>No Plans Found</h3>
              <p className="text-sm text-gray-500 mt-1">{plansError}</p>
              <p className="text-xs text-gray-400 mt-1">Try a different ZIP code or check back later.</p>
            </div>
          )}

          {/* No results */}
          {!plansLoading && !plansError && filteredPlans.length === 0 ? (
            <div className="text-center py-16">
              <Info className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <h3 className="font-bold text-base" style={{ color: "#1B365D" }}>No plans match your filters</h3>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or clearing them to see all available plans.</p>
              <button onClick={() => setFilters(DEFAULT_FILTERS)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white mt-4" style={{ backgroundColor: "#C41E3A" }}>
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
                        <h3 className="text-sm font-bold" style={{ color: "#1B365D" }}>{SNP_LABELS[plan.snpCategory!] || "Special Needs Plans"}</h3>
                        <p className="text-xs text-gray-500">
                          <span className="font-semibold">{filteredPlans.filter((p) => p.snpCategory === plan.snpCategory).length} plan{filteredPlans.filter((p) => p.snpCategory === plan.snpCategory).length !== 1 ? "s" : ""}</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {plan.snpCategory === "DSNP" && "For beneficiaries eligible for both Medicare and Medicaid"}
                          {plan.snpCategory === "CSNP" && "For beneficiaries with specific chronic conditions"}
                          {plan.snpCategory === "ISNP" && "For beneficiaries in institutional settings"}
                          {plan.snpCategory === "OTHER_SNP" && "Other special needs plan types"}
                        </p>
                      </div>
                    )}

                    {cp && (hasBetterPremium || hasBetterOOP) && (
                      <div className="absolute -top-2 right-4 z-10 text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#DCFCE7", color: "#166534" }}>
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
          <div className="mt-8 p-4 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-500">
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
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-80 max-w-full bg-white shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <span className="text-sm font-bold" style={{ color: "#1B365D" }}>Filter Plans</span>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-full hover:bg-gray-100">
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
