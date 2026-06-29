import TermTip from '@/features/education/components/TermTip';
// FilterSidebar component — plan filtering controls
// Design: Chapter-style | Navy #1C3A48 | Red #C41E3A | Light Blue #E8F2F5

import { useState } from "react";
import { SlidersHorizontal, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import type { FilterState, PlanType, SnpCategory } from "@/lib/types";

export interface FilterSidebarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  totalCount: number;
  filteredCount: number;
  plans?: any[]; // Plans array for dynamic counts
  availableCarriers?: string[]; // Dynamic carriers from real plan data
}

// SNP removed — now broken out into D-SNP / C-SNP / I-SNP in its own section
const PLAN_TYPES: PlanType[] = ["HMO", "PPO", "PFFS"];

const DEFAULT_CARRIERS: string[] = ["UnitedHealthcare", "Humana", "Aetna", "Cigna", "WellCare", "Blue KC"];

const BENEFITS_LIST = [
  { key: "dental", label: "Dental Coverage" },
  { key: "vision", label: "Vision Coverage" },
  { key: "hearing", label: "Hearing Coverage" },
  { key: "otc", label: "OTC Benefits" },
  { key: "fitness", label: "Fitness/Gym" },
  { key: "transportation", label: "Transportation" },
  { key: "telehealth", label: "Telehealth" },
  { key: "meals", label: "Meals Benefit" },
];

const SNP_TYPES: { key: SnpCategory; label: string; description: string; color: string; bg: string }[] = [
  { key: "DSNP", label: "D-SNP", description: "Dual Eligible (Medicare + Medicaid)", color: "#7C3AED", bg: "#F3E8FF" },
  { key: "CSNP", label: "C-SNP", description: "Chronic Condition Special Needs", color: "#C2410C", bg: "#FFF7ED" },
  { key: "ISNP", label: "I-SNP", description: "Institutional Special Needs", color: "#15803D", bg: "#F0FDF4" },
];

function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b pb-4 mb-4" style={{ borderColor: "rgba(226,234,237,0.6)" }}>
      <button
        className="flex items-center justify-between w-full mb-3"
        onClick={() => setOpen(!open)}
      >
        <span className="filter-section-title">{title}</span>
        {open ? (
          <ChevronUp size={14} className="text-gray-400" />
        ) : (
          <ChevronDown size={14} className="text-gray-400" />
        )}
      </button>
      {open && children}
    </div>
  );
}

export default function FilterSidebar({
  filters,
  onChange,
  totalCount,
  filteredCount,
  plans = [],
  availableCarriers,
}: FilterSidebarProps) {
  const CARRIERS = availableCarriers && availableCarriers.length > 0 ? availableCarriers : DEFAULT_CARRIERS;

  const togglePlanType = (type: PlanType) => {
    const current = filters.planType;
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onChange({ ...filters, planType: updated });
  };

  const toggleCarrier = (carrier: string) => {
    const current = filters.carriers;
    const updated = current.includes(carrier)
      ? current.filter((c) => c !== carrier)
      : [...current, carrier];
    onChange({ ...filters, carriers: updated });
  };

  const toggleBenefit = (benefit: string) => {
    const current = filters.benefits;
    const updated = current.includes(benefit)
      ? current.filter((b) => b !== benefit)
      : [...current, benefit];
    onChange({ ...filters, benefits: updated });
  };

  const toggleSnpCategory = (cat: SnpCategory) => {
    if (!cat) return;
    const current = filters.snpCategories ?? [];
    const updated = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    onChange({ ...filters, snpCategories: updated });
  };

  const togglePlanStructure = (structure: string) => {
    const current = filters.planStructure ?? [];
    const updated = current.includes(structure)
      ? current.filter((s) => s !== structure)
      : [...current, structure];
    onChange({ ...filters, planStructure: updated });
  };

  const resetFilters = () => {
    onChange({
      planType: [],
      carriers: [],
      premiumRange: [0, 200],
      benefits: [],
      quickFilter: "all",
      sortBy: "moop-low",
      snpCategories: [],
      planStructure: [],
      drugCostRange: [0, 5000],
    });
  };

  const hasActiveFilters =
    filters.planType.length > 0 ||
    filters.carriers.length > 0 ||
    filters.benefits.length > 0 ||
    (filters.snpCategories?.length ?? 0) > 0 ||
    (filters.planStructure?.length ?? 0) > 0 ||
    filters.premiumRange[0] > 0 ||
    filters.premiumRange[1] < 200 ||
    (filters.drugCostRange && (filters.drugCostRange[0] > 0 || filters.drugCostRange[1] < 5000));

  // Dynamic plan counts
  const mapdCount = plans.filter((p: any) =>
    p.hasDrugCoverage === true || (p.rxDrugs?.tier1 && p.rxDrugs.tier1 !== "N/A" && p.rxDrugs.tier1 !== "")
  ).length;
  const maOnlyCount = plans.length - mapdCount;

  return (
    <div className="bg-white rounded-xl p-5 sticky top-20" style={{ border: "1px solid #E2EAED", boxShadow: "0 1px 0 rgba(11,27,36,0.06), 0 4px 16px rgba(11,27,36,0.05)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} style={{ color: "#1C3A48" }} />
          <span className="font-bold text-sm" style={{ color: "#1C3A48", fontFamily: "'DM Sans', sans-serif" }}>
            Filter Plans
          </span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-xs font-semibold hover:text-red-500 transition-colors"
            style={{ color: "#7A9BA6" }}
          >
            <RotateCcw size={11} />
            Reset
          </button>
        )}
      </div>

      {/* Results count */}
      <div
        className="text-xs font-medium px-3 py-2 rounded-lg mb-5 text-center"
        style={{ backgroundColor: "#FAF9F5", color: "#3E5560", border: "1px solid #E2EAED" }}
      >
        Showing {filteredCount} of {totalCount} plans
      </div>

      {/* Sort By */}
      <FilterSection title="Sort By">
        <select
          value={filters.sortBy}
          onChange={(e) =>
            onChange({ ...filters, sortBy: e.target.value as FilterState["sortBy"] })
          }
          className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none"
          style={{ borderColor: "#E2EAED", color: "#3E5560", fontFamily: "'DM Sans', sans-serif" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#1C3A48"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#E2EAED"; }}
        >
          <option value="moop-low">Lowest Out-of-Pocket Cost</option>
          <option value="premium-low">Premium: Low to High</option>
          <option value="premium-high">Premium: High to Low</option>
          <option value="star-rating">Star Rating (Highest First)</option>
          <option value="best-match">Best Match</option>
          <option value="total-cost">Total Annual Cost (Premium + Drugs)</option>
          <option value="drug-cost">Est. Drug Cost (Lowest First)</option>
          <option value="benefits-max">Most Extra Benefits</option>
          <option value="deductible-low">Drug Deductible (Lowest First)</option>
        </select>
      </FilterSection>

      {/* Plan Structure: MAPD vs MA-Only */}
      <FilterSection title="Plan Structure">
        <div className="space-y-2">
          {[
            {
              key: "MAPD",
              label: "MAPD",
              description: "Includes Part D drug coverage",
              count: mapdCount,
            },
            {
              key: "MA-Only",
              label: "MA-Only",
              description: "No Part D drug coverage",
              count: maOnlyCount,
            },
          ].map((item) => (
            <label key={item.key} className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={(filters.planStructure ?? []).includes(item.key)}
                onChange={() => togglePlanStructure(item.key)}
                className="w-4 h-4 rounded border-gray-300 mt-0.5 shrink-0"
                style={{ accentColor: "#1C3A48" }}
              />
              <span className="flex-1">
                <span className="text-sm font-semibold transition-colors group-hover:text-[#237A92] block" style={{ color: "#3E5560" }}>
                  {item.label}
                </span>
                <span className="text-[10px]" style={{ color: "#7A9BA6" }}>{item.description}</span>
              </span>
              <span className="text-xs shrink-0" style={{ color: "#7A9BA6" }}>{item.count}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Plan Type */}
      <FilterSection title="Plan Type">
        <div className="space-y-2">
          {PLAN_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.planType.includes(type)}
                onChange={() => togglePlanType(type)}
                className="w-4 h-4 rounded border-gray-300"
                style={{ accentColor: "#1C3A48" }}
              />
              <span className="text-sm font-medium transition-colors group-hover:text-[#237A92]" style={{ color: "#3E5560" }}>
                {type}
              </span>
              <span className="ml-auto text-xs" style={{ color: "#7A9BA6" }}>
                {plans.filter((p: any) => !p.snpCategory && p.planType === type).length}
              </span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Special Needs Plans (SNP) — broken out by sub-type */}
      <FilterSection title="Special Needs Plans (SNP)" defaultOpen={false}>
        <p className="text-[10px] mb-3" style={{ color: "#7A9BA6" }}>
          SNPs are specialized plans for beneficiaries with specific needs. Select one or more to filter.
        </p>
        <div className="space-y-2">
          {SNP_TYPES.map((snp) => {
            const count = plans.filter((p: any) => p.snpCategory === snp.key).length;
            const isChecked = (filters.snpCategories ?? []).includes(snp.key);
            return (
              <label key={snp.key} className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleSnpCategory(snp.key)}
                  className="w-4 h-4 rounded border-gray-300 mt-0.5 shrink-0"
                  style={{ accentColor: snp.color }}
                />
                <span className="flex-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: snp.bg, color: snp.color }}
                    >
                      {snp.label}
                    </span>
                    <span className="text-xs" style={{ color: "#7A9BA6" }}>{count} plans</span>
                  </span>
                  <span className="text-[10px] block mt-0.5" style={{ color: "#7A9BA6" }}>{snp.description}</span>
                </span>
              </label>
            );
          })}
        </div>
        {(filters.snpCategories?.length ?? 0) > 0 && (
          <button
            onClick={() => onChange({ ...filters, snpCategories: [] })}
            className="mt-2 text-[10px] hover:text-[#EF4444] transition-colors"
            style={{ color: "#7A9BA6" }}
          >
            Clear SNP filters
          </button>
        )}
      </FilterSection>

      {/* Insurance Company */}
      <FilterSection title="Insurance Company" defaultOpen={false}>
        <div className="space-y-2">
          {CARRIERS.map((carrier) => (
            <label key={carrier} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.carriers.includes(carrier)}
                onChange={() => toggleCarrier(carrier)}
                className="w-4 h-4 rounded border-gray-300"
                style={{ accentColor: "#1C3A48" }}
              />
              <span className="text-sm font-medium transition-colors group-hover:text-[#237A92]" style={{ color: "#3E5560" }}>
                {carrier}
              </span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Monthly Premium */}
      <FilterSection title="Monthly Premium">
        <div className="space-y-3">
          <div className="flex justify-between text-xs font-medium" style={{ color: "#7A9BA6" }}>
            <span>${filters.premiumRange[0]}/mo</span>
            <span>${filters.premiumRange[1] >= 200 ? "200+" : filters.premiumRange[1]}/mo</span>
          </div>
          <input
            type="range"
            min={0}
            max={200}
            step={10}
            value={filters.premiumRange[1]}
            onChange={(e) =>
              onChange({ ...filters, premiumRange: [filters.premiumRange[0], Number(e.target.value)] })
            }
            className="w-full"
            style={{ accentColor: "#1C3A48" }}
          />
          <div className="flex gap-2">
            {[0, 25, 50, 100].map((val) => (
              <button
                key={val}
                onClick={() => onChange({ ...filters, premiumRange: [0, val === 0 ? 0 : val] })}
                className="flex-1 text-xs py-1 rounded border transition-colors font-medium"
                style={{
                  borderColor:
                    filters.premiumRange[1] <= val || (val === 0 && filters.premiumRange[1] === 0)
                      ? "#1C3A48"
                      : "#E2EAED",
                  color:
                    filters.premiumRange[1] <= val || (val === 0 && filters.premiumRange[1] === 0)
                      ? "#1C3A48"
                      : "#7A9BA6",
                  backgroundColor:
                    filters.premiumRange[1] <= val || (val === 0 && filters.premiumRange[1] === 0)
                      ? "#E8F2F5"
                      : "transparent",
                }}
              >
                {val === 0 ? "$0" : `$${val}`}
              </button>
            ))}
          </div>
        </div>
      </FilterSection>

      {/* Estimated Annual Drug Cost */}
      <FilterSection title="Est. Annual Drug Cost" defaultOpen={false}>
        <div className="space-y-3">
          <p className="text-[10px]" style={{ color: "#7A9BA6" }}>
            Filter by estimated annual out-of-pocket drug cost based on your medications.
          </p>
          <div className="flex justify-between text-xs font-medium" style={{ color: "#7A9BA6" }}>
            <span>${(filters.drugCostRange?.[0] ?? 0).toLocaleString()}/yr</span>
            <span>
              {(filters.drugCostRange?.[1] ?? 5000) >= 5000
                ? "$5,000+/yr"
                : `$${(filters.drugCostRange?.[1] ?? 5000).toLocaleString()}/yr`}
            </span>
          </div>
          {/* Min slider */}
          <div className="space-y-1">
            <label className="text-[10px]" style={{ color: "#7A9BA6" }}>Minimum</label>
            <input
              type="range"
              min={0}
              max={5000}
              step={100}
              value={filters.drugCostRange?.[0] ?? 0}
              onChange={(e) =>
                onChange({
                  ...filters,
                  drugCostRange: [
                    Number(e.target.value),
                    Math.max(Number(e.target.value), filters.drugCostRange?.[1] ?? 5000),
                  ],
                })
              }
              className="w-full"
              style={{ accentColor: "#1C3A48" }}
            />
          </div>
          {/* Max slider */}
          <div className="space-y-1">
            <label className="text-[10px]" style={{ color: "#7A9BA6" }}>Maximum</label>
            <input
              type="range"
              min={0}
              max={5000}
              step={100}
              value={filters.drugCostRange?.[1] ?? 5000}
              onChange={(e) =>
                onChange({
                  ...filters,
                  drugCostRange: [
                    Math.min(filters.drugCostRange?.[0] ?? 0, Number(e.target.value)),
                    Number(e.target.value),
                  ],
                })
              }
              className="w-full"
              style={{ accentColor: "#1C3A48" }}
            />
          </div>
          {/* Quick presets */}
          <div className="flex gap-1.5 flex-wrap">
            {[
              { label: "Under $500", min: 0, max: 500 },
              { label: "Under $1K", min: 0, max: 1000 },
              { label: "Under $2K", min: 0, max: 2000 },
            ].map((preset) => {
              const isActive =
                (filters.drugCostRange?.[0] ?? 0) === preset.min &&
                (filters.drugCostRange?.[1] ?? 5000) === preset.max;
              return (
                <button
                  key={preset.label}
                  onClick={() =>
                    onChange({ ...filters, drugCostRange: [preset.min, preset.max] })
                  }
                  className="text-[10px] px-2 py-1 rounded border font-medium transition-colors"
                  style={{
                    borderColor: isActive ? "#1C3A48" : "#E2EAED",
                    color: isActive ? "#1C3A48" : "#7A9BA6",
                    backgroundColor: isActive ? "#E8F2F5" : "transparent",
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          {(filters.drugCostRange?.[0] ?? 0) > 0 || (filters.drugCostRange?.[1] ?? 5000) < 5000 ? (
            <button
              onClick={() => onChange({ ...filters, drugCostRange: [0, 5000] })}
              className="text-[10px] hover:text-[#EF4444] transition-colors"
              style={{ color: "#7A9BA6" }}
            >
              Clear range
            </button>
          ) : null}
        </div>
      </FilterSection>

      {/* Benefits */}
      <FilterSection title="Must-Have Benefits" defaultOpen={false}>
        <div className="space-y-2">
          {BENEFITS_LIST.map((b) => (
            <label key={b.key} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.benefits.includes(b.key)}
                onChange={() => toggleBenefit(b.key)}
                className="w-4 h-4 rounded border-gray-300"
                style={{ accentColor: "#1C3A48" }}
              />
              <span className="text-sm font-medium transition-colors group-hover:text-[#237A92]" style={{ color: "#3E5560" }}>
                {b.label}
              </span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Help CTA */}
      <div
        className="rounded-xl p-4 text-center"
        style={{ backgroundColor: "#FAF9F5", border: "1px solid #E2EAED" }}
      >
        <div className="text-xs font-semibold mb-1" style={{ color: "#0B1B24", fontFamily: "'DM Sans', sans-serif" }}>Need Help Choosing?</div>
        <div className="text-xs mb-3" style={{ color: "#7A9BA6" }}>
          Speak with a licensed Medicare agent — free, no obligation.
        </div>
        <a
          href="tel:1-800-555-0100"
          className="block w-full py-2 rounded-lg text-xs font-semibold text-white text-center transition-all"
          style={{ backgroundColor: "#1C3A48", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.005em" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "#112333"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "#1C3A48"; }}
        >
          Call 1-800-555-0100
        </a>
      </div>
    </div>
  );
}
