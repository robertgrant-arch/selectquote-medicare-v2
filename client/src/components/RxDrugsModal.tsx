// RxDrugsModal — Add prescription drugs to personalize plan comparison
// Uses live NIH RxTerms API for comprehensive drug search

import { useState, useEffect } from "react";
import { X, Pill, Search, Plus, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { POPULAR_RX_DRUGS } from "@/lib/mockData";
import type { RxDrug } from "@/lib/types";

const RXTERMS_API = "https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search";

interface RxTermsResult {
  displayName: string;
  strengths: string[];
  rxcuis: string[];
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

async function searchRxTerms(term: string): Promise<RxTermsResult[]> {
  if (!term || term.length < 2) return [];
  const params = new URLSearchParams({
    terms: term,
    ef: "STRENGTHS_AND_FORMS,RXCUIS",
    maxList: "12",
  });
  const res = await fetch(`${RXTERMS_API}?${params}`);
  const data = await res.json();
  const count = data[0] as number;
  if (count === 0) return [];
  const names = data[1] as string[];
  const fields = data[2] as Record<string, string[][]>;
  const results: RxTermsResult[] = [];
  for (let i = 0; i < names.length; i++) {
    results.push({
      displayName: names[i],
      strengths: fields["STRENGTHS_AND_FORMS"]?.[i] || [],
      rxcuis: fields["RXCUIS"]?.[i] || [],
    });
  }
  return results;
}

function parseDrugName(displayName: string): { name: string; route: string } {
  const match = displayName.match(/^(.+?)\s*\((.+)\)$/);
  if (match) return { name: match[1].trim(), route: match[2].trim() };
  return { name: displayName, route: "" };
}

interface RxDrugsModalProps {
  open: boolean;
  onClose: () => void;
  selectedDrugs: RxDrug[];
  onSave: (drugs: RxDrug[]) => void;
}

export default function RxDrugsModal({ open, onClose, selectedDrugs, onSave }: RxDrugsModalProps) {
  const [search, setSearch] = useState("");
  const [drugs, setDrugs] = useState<RxDrug[]>(selectedDrugs);
  const [apiResults, setApiResults] = useState<RxTermsResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedDrug, setExpandedDrug] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setApiResults([]);
      setHasSearched(false);
      setExpandedDrug(null);
    } else {
      setDrugs(selectedDrugs);
    }
  }, [open, selectedDrugs]);

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setApiResults([]);
      setHasSearched(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    searchRxTerms(debouncedSearch).then((results) => {
      if (!cancelled) {
        setApiResults(results);
        setIsLoading(false);
        setHasSearched(true);
      }
    }).catch(() => {
      if (!cancelled) {
        setApiResults([]);
        setIsLoading(false);
        setHasSearched(true);
      }
    });
    return () => { cancelled = true; };
  }, [debouncedSearch]);

  if (!open) return null;

  const commonDrugs = POPULAR_RX_DRUGS.filter(
    (d) => !drugs.find((sd) => sd.id === d.id)
  ).slice(0, 8);

  const addDrug = (drug: RxDrug) => {
    setDrugs([...drugs, drug]);
  };

  const addFromApi = (result: RxTermsResult, strength?: string, rxcui?: string) => {
    const { name } = parseDrugName(result.displayName);
    const dosage = strength || (result.strengths[0] || "");
    const drug: RxDrug = {
      id: rxcui || `rx-${name}-${dosage}`.replace(/\s+/g, "-").toLowerCase(),
      name: name,
      dosage: dosage.trim(),
      frequency: "Once daily",
      isGeneric: !name.match(/^[A-Z]/),
    };
    setDrugs([...drugs, drug]);
    setExpandedDrug(null);
  };

  const removeDrug = (id: string) => {
    setDrugs(drugs.filter((d) => d.id !== id));
  };

  const handleSave = () => {
    onSave(drugs);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(11,27,36,0.5)", backdropFilter: "blur(3px)" }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative bg-white rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col"
        style={{ boxShadow: "0 8px 40px rgba(11,27,36,0.16)", animation: "fadeInUp 0.25s ease" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5"
          style={{ backgroundColor: "#1C3A48", borderRadius: "10px 10px 0 0" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            >
              <Pill size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Add Your Prescriptions
              </h2>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                See how plans cover your medications
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center transition-colors"
            style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)", border: "none", color: "white", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.25)")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.15)")}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4" style={{ borderBottom: "1px solid #E2EAED" }}>
          <div className="relative">
            {isLoading ? (
              <Loader2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: "#7A9BA6" }} />
            ) : (
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#7A9BA6" }} />
            )}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search any drug name (e.g. Crestor, Metformin)..."
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg"
              style={{ border: "1.5px solid #E2EAED", color: "#1C3A48", fontFamily: "'DM Sans', sans-serif", outline: "none" }}
              onFocus={e => { e.currentTarget.style.borderColor = "#237A92"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(35,122,146,0.14)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#E2EAED"; e.currentTarget.style.boxShadow = "none"; }}
              autoFocus
            />
          </div>
          {search.length > 0 && search.length < 2 && (
            <p className="text-xs mt-1 ml-1" style={{ color: "#7A9BA6" }}>Type at least 2 characters to search</p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5" style={{ maxHeight: "50vh" }}>
          {/* Added drugs */}
          {drugs.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7A9BA6" }}>
                Your Medications ({drugs.length})
              </p>
              {drugs.map((drug) => (
                <div
                  key={drug.id}
                  className="flex items-center justify-between p-3 rounded-lg mb-2"
                  style={{ backgroundColor: "#EEF5F7", border: "1px solid #C6DAE0" }}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} style={{ color: "#059669", flexShrink: 0 }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#0B1B24" }}>{drug.name}</p>
                      <p className="text-xs" style={{ color: "#7A9BA6" }}>
                        {drug.dosage} {drug.dosage && drug.frequency ? " · " : ""}{drug.frequency}
                        {drug.isGeneric && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ color: "#15803D", backgroundColor: "#F0FDF4" }}>Generic</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeDrug(drug.id)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: "#7A9BA6" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#DC2626"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FEF2F2"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#7A9BA6"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* API Search Results */}
          {hasSearched && apiResults.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7A9BA6" }}>
                Search Results
              </p>
              {apiResults.map((result) => {
                const { name, route } = parseDrugName(result.displayName);
                const isExpanded = expandedDrug === result.displayName;
                return (
                  <div key={result.displayName} className="mb-2">
                    <div
                      className="flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer"
                      style={{ border: "1px solid #E2EAED" }}
                      onClick={() => {
                        if (result.strengths.length > 1) {
                          setExpandedDrug(isExpanded ? null : result.displayName);
                        } else {
                          addFromApi(result, result.strengths[0], result.rxcuis[0]);
                        }
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#FAF9F5")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: "#E8F2F5" }}
                        >
                          <Pill size={14} style={{ color: "#1C3A48" }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "#0B1B24" }}>{name}</p>
                          <p className="text-xs" style={{ color: "#7A9BA6" }}>
                            {route}{result.strengths.length > 1 ? ` · ${result.strengths.length} strengths` : result.strengths[0] ? ` · ${result.strengths[0]}` : ""}
                          </p>
                        </div>
                      </div>
                      <button
                        className="p-1.5 rounded-full transition-colors"
                        style={{ color: "#237A92" }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#EEF5F7")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    {isExpanded && result.strengths.length > 1 && (
                      <div className="ml-11 mt-1 space-y-1">
                        {result.strengths.map((strength, idx) => (
                          <button
                            key={strength}
                            onClick={() => addFromApi(result, strength, result.rxcuis[idx])}
                            className="w-full text-left px-3 py-2 text-xs rounded-lg transition-colors"
                            style={{ color: "#3E5560" }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#EEF5F7")}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                          >
                            {strength.trim()}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* No results */}
          {hasSearched && apiResults.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: "#EEF5F7" }}>
                <Pill size={22} style={{ color: "#C6DAE0" }} />
              </div>
              <p className="text-sm font-medium" style={{ color: "#3E5560" }}>No results for "{search}"</p>
              <p className="text-xs mt-1" style={{ color: "#7A9BA6" }}>Try a different name or spelling</p>
            </div>
          )}

          {/* Common Medications */}
          {!hasSearched && !search && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#7A9BA6" }}>
                Common Medications
              </p>
              {commonDrugs.map((drug) => (
                <div
                  key={drug.id}
                  className="flex items-center justify-between p-3 rounded-lg mb-2 transition-colors cursor-pointer"
                  style={{ border: "1px solid #E2EAED" }}
                  onClick={() => addDrug(drug)}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#FAF9F5")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "#E8F2F5" }}
                    >
                      <Pill size={14} style={{ color: "#1C3A48" }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#0B1B24" }}>{drug.name}</p>
                      <p className="text-xs" style={{ color: "#7A9BA6" }}>
                        {drug.dosage} · {drug.frequency}
                        {drug.isGeneric && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ color: "#15803D", backgroundColor: "#F0FDF4" }}>Generic available</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: "#237A92", border: "1px solid #C6DAE0", backgroundColor: "#EEF5F7" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#E8F2F5")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#EEF5F7")}
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between p-4"
          style={{ borderTop: "1px solid #E2EAED", backgroundColor: "#FAF9F5", borderRadius: "0 0 10px 10px" }}
        >
          <p className="text-xs" style={{ color: "#7A9BA6" }}>
            {drugs.length} medication{drugs.length !== 1 ? "s" : ""} added
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              style={{ color: "#3E5560", border: "1.5px solid #E2EAED", background: "white" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#237A92"; (e.currentTarget as HTMLButtonElement).style.color = "#237A92"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2EAED"; (e.currentTarget as HTMLButtonElement).style.color = "#3E5560"; }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-sm font-bold text-white rounded-lg transition-colors"
              style={{ backgroundColor: "#1C3A48" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#112333")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#1C3A48")}
            >
              Save {drugs.length > 0 ? `(${drugs.length}) ` : ""}Medications
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
