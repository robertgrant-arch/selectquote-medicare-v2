// DoctorsModal — Add doctors to check in-network coverage

import { useState, useEffect } from "react";
import { X, UserRound, Search, Plus, Trash2, CheckCircle2, MapPin, Loader2, Navigation } from "lucide-react";
import type { Doctor } from "@/lib/types";

interface DoctorsModalProps {
  open: boolean;
  onClose: () => void;
  selectedDoctors: Doctor[];
  onSave: (doctors: Doctor[]) => void;
  zip?: string;
}

interface DoctorResult {
  npi: string;
  name: string;
  specialty: string;
  address: string;
  phone: string;
  city: string;
  state: string;
  zip: string;
  distance: number | null;
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

async function searchDoctors(name: string, zip: string): Promise<DoctorResult[]> {
  if (!name || name.length < 2) return [];
  const params = new URLSearchParams({ name, zip });
  const res = await fetch(`/api/doctors?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.doctors || [];
}

export default function DoctorsModal({ open, onClose, selectedDoctors, onSave, zip: defaultZip }: DoctorsModalProps) {
  const [search, setSearch] = useState("");
  const [zipInput, setZipInput] = useState(defaultZip || "");
  const [doctors, setDoctors] = useState<Doctor[]>(selectedDoctors);
  const [searchResults, setSearchResults] = useState<DoctorResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debouncedSearch = useDebounce(search, 500);
  const debouncedZip = useDebounce(zipInput, 600);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSearchResults([]);
      setHasSearched(false);
    } else {
      setDoctors(selectedDoctors);
      setZipInput(defaultZip || "");
    }
  }, [open, selectedDoctors, defaultZip]);

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    searchDoctors(debouncedSearch, debouncedZip).then((results) => {
      if (!cancelled) {
        setSearchResults(results);
        setIsLoading(false);
        setHasSearched(true);
      }
    }).catch(() => {
      if (!cancelled) {
        setSearchResults([]);
        setIsLoading(false);
        setHasSearched(true);
      }
    });
    return () => { cancelled = true; };
  }, [debouncedSearch, debouncedZip]);

  if (!open) return null;

  const filteredResults = searchResults.filter(
    (r) => !doctors.find((d) => d.npi === r.npi)
  );

  const addDoctor = (result: DoctorResult) => {
    const doctor: Doctor = {
      id: result.npi,
      name: result.name,
      specialty: result.specialty,
      npi: result.npi,
      address: result.address,
    };
    setDoctors([...doctors, doctor]);
  };

  const removeDoctor = (id: string) => {
    setDoctors(doctors.filter((d) => d.id !== id));
  };

  const handleSave = () => {
    onSave(doctors);
    onClose();
  };

  const zipIsValid = debouncedZip.length === 5 && /^\d{5}$/.test(debouncedZip);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(11,27,36,0.5)", backdropFilter: "blur(3px)" }}>
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
          style={{ backgroundColor: "#00353E", borderRadius: "10px 10px 0 0" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            >
              <UserRound size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Add Your Doctors
              </h2>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                Search by name within 25 miles of your ZIP
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

        {/* ZIP + Search inputs */}
        <div className="p-4 space-y-2" style={{ borderBottom: "1px solid #E8E8E8" }}>
          <div className="flex items-center gap-2">
            <div className="relative w-36">
              <Navigation size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8C8C8C" }} />
              <input
                type="text"
                value={zipInput}
                onChange={(e) => setZipInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="ZIP code"
                maxLength={5}
                className="w-full pl-8 pr-3 py-2.5 text-sm rounded-lg"
                style={{ border: "1.5px solid #E8E8E8", color: "#00353E", fontFamily: "'Montserrat', sans-serif", outline: "none" }}
                onFocus={e => { e.currentTarget.style.borderColor = "#00859A"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(35,122,146,0.14)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "#E8E8E8"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
            <span className="text-xs flex-1" style={{ color: "#8C8C8C" }}>
              {zipIsValid ? "Searching within 25 miles" : "Enter ZIP to filter by location"}
            </span>
          </div>

          <div className="relative">
            {isLoading ? (
              <Loader2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: "#8C8C8C" }} />
            ) : (
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8C8C8C" }} />
            )}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by doctor name (e.g. Smith, Johnson)..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg"
              style={{ border: "1.5px solid #E8E8E8", color: "#00353E", fontFamily: "'Montserrat', sans-serif", outline: "none" }}
              onFocus={e => { e.currentTarget.style.borderColor = "#00859A"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(35,122,146,0.14)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#E8E8E8"; e.currentTarget.style.boxShadow = "none"; }}
              autoFocus
            />
          </div>
          {search.length > 0 && search.length < 2 && (
            <p className="text-xs ml-1" style={{ color: "#8C8C8C" }}>Type at least 2 characters to search</p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: "50vh" }}>
          {/* Selected Doctors */}
          {doctors.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8C8C8C" }}>
                Your Doctors ({doctors.length})
              </p>
              {doctors.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-3 rounded-lg mb-2"
                  style={{ backgroundColor: "#E6F7F9", border: "1px solid #E8E8E8" }}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} style={{ color: "#059669", flexShrink: 0 }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>{d.name}</p>
                      <p className="text-xs" style={{ color: "#8C8C8C" }}>{d.specialty}</p>
                      {d.address && (
                        <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: "#8C8C8C" }}>
                          <MapPin size={10} />
                          {d.address}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeDoctor(d.id)}
                    className="p-1.5 rounded-full transition-colors"
                    style={{ color: "#8C8C8C" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#DC2626"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FEF2F2"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#8C8C8C"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search Results */}
          {filteredResults.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8C8C8C" }}>
                Search Results {zipIsValid && `(within 25 mi of ${debouncedZip})`}
              </p>
              {filteredResults.map((r) => (
                <div
                  key={r.npi}
                  className="flex items-center justify-between p-3 rounded-lg mb-2 transition-colors cursor-pointer"
                  style={{ border: "1px solid #E8E8E8" }}
                  onClick={() => addDoctor(r)}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#F9F9F9")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "#E6F7F9" }}
                    >
                      <UserRound size={14} style={{ color: "#00353E" }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>{r.name}</p>
                      <p className="text-xs" style={{ color: "#8C8C8C" }}>{r.specialty}</p>
                      {r.address && (
                        <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: "#8C8C8C" }}>
                          <MapPin size={10} />
                          {r.address}
                          {r.distance !== null && (
                            <span className="ml-1 font-medium" style={{ color: "#00859A" }}>· {r.distance} mi</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    className="p-1.5 rounded-full transition-colors"
                    style={{ color: "#00859A" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#E6F7F9")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Empty States */}
          {hasSearched && filteredResults.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: "#E6F7F9" }}>
                <UserRound size={22} style={{ color: "#E8E8E8" }} />
              </div>
              <p className="text-sm font-medium" style={{ color: "#303030" }}>No doctors found for "{search}"</p>
              <p className="text-xs mt-1" style={{ color: "#8C8C8C" }}>
                {zipIsValid ? `No results within 25 miles of ${debouncedZip}. Try a different ZIP or name.` : "Try a different name or spelling"}
              </p>
            </div>
          )}
          {!hasSearched && doctors.length === 0 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: "#E6F7F9" }}>
                <Search size={22} style={{ color: "#E8E8E8" }} />
              </div>
              <p className="text-sm font-medium" style={{ color: "#303030" }}>Search for your doctors above</p>
              <p className="text-xs mt-1" style={{ color: "#8C8C8C" }}>Enter a ZIP code and doctor name to find providers near you</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between p-4"
          style={{ borderTop: "1px solid #E8E8E8", backgroundColor: "#F9F9F9", borderRadius: "0 0 10px 10px" }}
        >
          <p className="text-xs" style={{ color: "#8C8C8C" }}>
            {doctors.length} doctor{doctors.length !== 1 ? "s" : ""} added
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              style={{ color: "#303030", border: "1.5px solid #E8E8E8", background: "white" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#00859A"; (e.currentTarget as HTMLButtonElement).style.color = "#00859A"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E8E8E8"; (e.currentTarget as HTMLButtonElement).style.color = "#303030"; }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-sm font-bold text-white rounded-lg transition-colors"
              style={{ backgroundColor: "#00353E" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#014951")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#00353E")}
            >
              Save Doctors
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
