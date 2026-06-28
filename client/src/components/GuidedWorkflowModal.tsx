/**
 * GuidedWorkflowModal - Post-ZIP guided workflow
 * Step 1: "Do you currently have a Medicare Advantage plan?"
 * If YES -> pVerify lookup (MBI or SSN) -> store current plan -> doctors/drugs -> AI recommendation
 * If NO -> doctors/drugs lookup -> AI recommendation
 * v2: uses /api/doctors with ZIP-based 25-mile radius filtering
 */
import { isValidZipFormat } from "@/features/zip-validation/lib/zipValidator";
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { POPULAR_RX_DRUGS } from "@/lib/mockData";
import type { Doctor } from "@/lib/types";
import {
  Shield, Lock, X, ChevronRight, ChevronLeft, Info, CheckCircle2,
  AlertCircle, Loader2, Stethoscope, Pill, Search, Plus, Trash2,
  Sparkles, MapPin
} from "lucide-react";

interface NpiDoctor {
  npi: string;
  name: string;
  specialty: string;
  address: string;
  phone: string;
  distance: number | null;
}

async function searchNpiDoctors(query: string, zip: string, limit = 10): Promise<NpiDoctor[]> {
  if (!query || query.length < 2) return [];
  try {
    const params = new URLSearchParams({ name: query, zip });
    const res = await fetch(`/api/doctors?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.doctors || []).slice(0, limit).map((d: any) => ({
      npi: d.npi,
      name: d.name,
      specialty: d.specialty,
      address: d.address,
      phone: d.phone || "",
      distance: d.distance,
    }));
  } catch {
    return [];
  }
}

// Re-export MBIVerifyResult type for backward compatibility
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

interface DrugEntry {
  name: string;
  dosage: string;
}

type Step = "maQuestion" | "pverifyLookup" | "planFound" | "doctorsDrugs" | "aiLoading";

interface Props {
  zip: string;
  onSkip: () => void;
  onComplete: (data: {
    hasMA: boolean;
    verifyResult: MBIVerifyResult | null;
    doctors: Doctor[];
    drugs: DrugEntry[];
  }) => void;
}

const COMMON_DRUGS: DrugEntry[] = POPULAR_RX_DRUGS.map(d => ({ name: d.name, dosage: d.dosage }));

const RXTERMS_API = "https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search";
interface RxTermResult { displayName: string; strength: string; }
async function searchRxTerms(term: string): Promise<RxTermResult[]> {
  if (!term || term.length < 2) return [];
  try {
    const res = await fetch(`${RXTERMS_API}?terms=${encodeURIComponent(term)}&ef=STRENGTHS_AND_FORMS&maxList=10`);
    const data = await res.json();
    if (data[0] === 0) return [];
    const names = data[1] as string[];
    const strengths = (data[2]?.["STRENGTHS_AND_FORMS"] || []) as string[][];
    return names.map((n: string, i: number) => ({ displayName: n, strength: strengths[i]?.[0] || "" }));
  } catch { return []; }
}

const STEP_TITLES: Record<Step, string> = {
  maQuestion: "Let's Personalize Your Results",
  pverifyLookup: "Look Up Your Current Plan",
  planFound: "Current Plan Found",
  doctorsDrugs: "Add Your Doctors & Drugs",
  aiLoading: "Finding Your Best Plan",
};

export default function GuidedWorkflowModal({ zip, onSkip, onComplete }: Props) {
  const [step, setStep] = useState<Step>("maQuestion");
  const [hasMA, setHasMA] = useState<boolean | null>(null);
  // pVerify state
  const [lookupMode, setLookupMode] = useState<"mbi" | "ssn">("mbi");
  const [mbi, setMbi] = useState("");
  const [ssn, setSsn] = useState("");
  const [verifyResult, setVerifyResult] = useState<MBIVerifyResult | null>(null);
  const [verifyError, setVerifyError] = useState("");
  // Doctor/Drug state
  const [doctorSearch, setDoctorSearch] = useState("");
  const [npiResults, setNpiResults] = useState<NpiDoctor[]>([]);
  const [npiLoading, setNpiLoading] = useState(false);
  const [selectedDoctors, setSelectedDoctors] = useState<Doctor[]>([]);
  const [drugSearch, setDrugSearch] = useState("");
  const [selectedDrugs, setSelectedDrugs] = useState<DrugEntry[]>([]);
  const [manualDrugName, setManualDrugName] = useState("");
  const [manualDrugDosage, setManualDrugDosage] = useState("");
  const [showManualDrug, setShowManualDrug] = useState(false);
  const [rxResults, setRxResults] = useState<RxTermResult[]>([]);
  const [rxLoading, setRxLoading] = useState(false);
  const rxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [manualDoctorName, setManualDoctorName] = useState("");
  const [manualDoctorSpecialty, setManualDoctorSpecialty] = useState("");
  const [showManualDoctor, setShowManualDoctor] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const npiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (npiTimerRef.current) clearTimeout(npiTimerRef.current); if (rxTimerRef.current) clearTimeout(rxTimerRef.current);
    };
  }, []);
  // Debounced NPI doctor search - now uses /api/doctors with ZIP
  useEffect(() => {
    if (!doctorSearch || doctorSearch.length < 2) {
      setNpiResults([]);
      return;
    }
    setNpiLoading(true);
    if (npiTimerRef.current) clearTimeout(npiTimerRef.current);
    npiTimerRef.current = setTimeout(async () => {
      const results = await searchNpiDoctors(doctorSearch, zip, 8);
      // Filter out already-selected doctors
      const filtered = results.filter(
        (r) => !selectedDoctors.find((sd) => sd.id === r.npi)
      );
      setNpiResults(filtered);
      setNpiLoading(false);
    }, 300);
  }, [doctorSearch, selectedDoctors, zip]);
  const eligibilityMutation = trpc.pverify.eligibilityCheck.useMutation({
    onSuccess: (data) => {
      const result = data.data as MBIVerifyResult;
      setVerifyResult(result);
      setStep("planFound");
    },
    onError: (err) => {
      setVerifyError(err.message || "Verification failed. You can skip this step.");
    },
  });
  const handleSsnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 9);
    setSsn(val);
  };
  const formatSsn = (value: string) => {
    if (value.length <= 3) return value;
    if (value.length <= 5) return value.slice(0, 3) + "-" + value.slice(3);
    return value.slice(0, 3) + "-" + value.slice(3, 5) + "-" + value.slice(5);
  };
  const handleVerify = () => {
    setVerifyError("");
    if (lookupMode === "mbi" && !mbi.trim()) {
      setVerifyError("Please enter your Medicare Beneficiary ID.");
      return;
    }
    if (lookupMode === "ssn" && ssn.length !== 9) {
      setVerifyError("Please enter a valid 9-digit SSN.");
      return;
    }
    eligibilityMutation.mutate({
      ...(lookupMode === "mbi" ? { mbi: mbi.trim() } : { ssn: ssn.trim() }),
    });
  };
// Debounced live drug search via NIH RxTerms API
  useEffect(() => {
    if (!drugSearch || drugSearch.length < 2) {
      setRxResults([]); return;
    }
    setRxLoading(true);
    if (rxTimerRef.current) clearTimeout(rxTimerRef.current);
    rxTimerRef.current = setTimeout(async () => {
      const results = await searchRxTerms(drugSearch);
      setRxResults(results.filter(r => !selectedDrugs.find(sd => sd.name === r.displayName)));
      setRxLoading(false);
    }, 300);
  }, [drugSearch, selectedDrugs]);
  const handleFinish = () => {
    setStep("aiLoading");
    timerRef.current = setTimeout(() => {
      onComplete({ hasMA: hasMA === true, verifyResult, doctors: selectedDoctors, drugs: selectedDrugs });
    }, 1500);
  };
  const addNpiDoctor = (doc: NpiDoctor) => {
    const doctor: Doctor = {
      id: doc.npi,
      name: doc.name,
      specialty: doc.specialty,
      address: doc.address,
      phone: doc.phone,
      acceptingPatients: true,
    };
    setSelectedDoctors([...selectedDoctors, doctor]);
    setDoctorSearch("");
    setNpiResults([]);
  };
  const addManualDoctor = () => {
    if (!manualDoctorName.trim()) return;
    const doc: Doctor = {
      id: `manual-${Date.now()}`,
      name: manualDoctorName.trim(),
      specialty: manualDoctorSpecialty.trim() || "General",
      address: zip,
      phone: "",
      acceptingPatients: true,
    };
    setSelectedDoctors([...selectedDoctors, doc]);
    setManualDoctorName(""); setManualDoctorSpecialty(""); setShowManualDoctor(false);
  };
  const addManualDrug = () => {
    if (!manualDrugName.trim()) return;
    setSelectedDrugs([...selectedDrugs, { name: manualDrugName.trim(), dosage: manualDrugDosage.trim() || "N/A" }]);
    setManualDrugName(""); setManualDrugDosage(""); setShowManualDrug(false);
  };
  const handleBack = () => {
    if (step === "pverifyLookup") setStep("maQuestion");
    else if (step === "planFound") setStep("pverifyLookup");
    else if (step === "doctorsDrugs" && hasMA) setStep("planFound");
    else if (step === "doctorsDrugs") setStep("maQuestion");
  };
  const isPending = eligibilityMutation.isPending;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(11,27,36,0.5)", backdropFilter: "blur(3px)" }}>
      <div className="relative bg-white rounded-xl w-full max-w-lg overflow-hidden" style={{ border: "1px solid #E2EAED", boxShadow: "0 8px 40px rgba(11,27,36,0.16)", maxHeight: "90vh", overflowY: "auto" }}>
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#1C3A48" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
              {step === "aiLoading" ? <Sparkles size={18} className="text-white" /> : <Shield size={18} className="text-white" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">{STEP_TITLES[step]}</h2>
              <p className="text-white/70 text-xs">ZIP {zip}</p>
            </div>
          </div>
          <button onClick={onSkip} className="text-white/60 hover:text-white transition-colors p-1 rounded"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">
          {/* STEP 1: MA Question */}
          {step === "maQuestion" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl text-sm" style={{ backgroundColor: "#EEF5F7", color: "#1C3A48" }}>
                <Info size={16} className="mt-0.5 shrink-0" />
                <div>This helps us find the best plan match for you. Your answer determines how we personalize your results.</div>
              </div>
              <p className="text-sm font-semibold text-center" style={{ color: "#1C3A48" }}>Do you currently have a Medicare Advantage plan?</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setHasMA(true); setStep("pverifyLookup"); }} className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all hover:border-[#237A92] hover:bg-[#EEF5F7]" style={{ borderColor: "#E2EAED" }}>
                  <CheckCircle2 size={28} style={{ color: "#16A34A" }} />
                  <span className="text-sm font-bold" style={{ color: "#1C3A48" }}>Yes, I do</span>
                  <span className="text-xs" style={{ color: "#7A9BA6" }}>We'll look up your current plan</span>
                </button>
                <button onClick={() => { setHasMA(false); setStep("doctorsDrugs"); }} className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all hover:border-[#237A92] hover:bg-[#EEF5F7]" style={{ borderColor: "#E2EAED" }}>
                  <X size={28} style={{ color: "#1C3A48" }} />
                  <span className="text-sm font-bold" style={{ color: "#1C3A48" }}>No, I don't</span>
                  <span className="text-xs" style={{ color: "#7A9BA6" }}>We'll help you find one</span>
                </button>
              </div>
            </div>
          )}
          {/* STEP 2: pVerify Lookup */}
          {step === "pverifyLookup" && (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: "#3E5560" }}>How would you like us to look up your current plan?</p>
              <div className="flex rounded-lg overflow-hidden border mb-2" style={{ borderColor: "#E2EAED" }}>
                <button onClick={() => setLookupMode("mbi")} className="flex-1 py-2 text-sm font-semibold" style={{ backgroundColor: lookupMode === "mbi" ? "#1C3A48" : "white", color: lookupMode === "mbi" ? "white" : "#3E5560" }}>Use Medicare ID</button>
                <button onClick={() => setLookupMode("ssn")} className="flex-1 py-2 text-sm font-semibold" style={{ backgroundColor: lookupMode === "ssn" ? "#1C3A48" : "white", color: lookupMode === "ssn" ? "white" : "#3E5560" }}>Use SSN</button>
              </div>
              {lookupMode === "mbi" && (
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: "#3E5560" }}>Medicare Beneficiary ID (MBI)</label>
                  <input type="text" value={mbi} onChange={(e) => setMbi(e.target.value.toUpperCase())} placeholder="e.g. 1EG4-TE5-MK72" maxLength={20} className="w-full px-3 py-2.5 border rounded-lg text-sm font-mono outline-none" style={{ borderColor: "#E2EAED" }} />
                  <p className="text-xs mt-1" style={{ color: "#7A9BA6" }}>Found on your red, white & blue Medicare card</p>
                </div>
              )}
              {lookupMode === "ssn" && (
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: "#3E5560" }}>Social Security Number (SSN)</label>
                  <input type="password" value={formatSsn(ssn)} onChange={handleSsnChange} placeholder="XXX-XX-XXXX" maxLength={11} className="w-full px-3 py-2.5 border rounded-lg text-sm font-mono outline-none" style={{ borderColor: "#E2EAED" }} />
                  <p className="text-xs mt-1" style={{ color: "#7A9BA6" }}>Your SSN is encrypted and never stored</p>
                </div>
              )}
              {verifyError && <div className="flex items-center gap-2 text-red-600 text-xs bg-[#FAF9F5] px-3 py-2 rounded-lg"><AlertCircle size={13} />{verifyError}</div>}
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "#7A9BA6" }}><Lock size={11} />256-bit SSL · HIPAA-compliant · Data never stored</div>
            </div>
          )}
          {/* STEP 3: Plan Found */}
          {step === "planFound" && (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: "#EEF5F7" }}>
                <CheckCircle2 size={28} style={{ color: "#16A34A" }} />
              </div>
              <h3 className="text-lg font-bold mb-1" style={{ color: "#1C3A48" }}>We Found Your Plan!</h3>
              {verifyResult?.currentPlan && (
                <div className="rounded-xl p-4 mt-3 text-left" style={{ backgroundColor: "#FAF9F5", border: "1px solid #E2EAED" }}>
                  <p className="text-sm font-bold" style={{ color: "#1C3A48" }}>{verifyResult.currentPlan.planName}</p>
                  <p className="text-xs" style={{ color: "#7A9BA6" }}>{verifyResult.currentPlan.carrier}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-600">
                    <span>Premium: ${verifyResult.currentPlan.premium}/mo</span>
                    <span>Deductible: ${verifyResult.currentPlan.deductible}</span>
                  </div>
                </div>
              )}
              <p className="text-sm text-gray-500 mt-3">Now let's add your doctors and prescriptions to find the best match.</p>
            </div>
          )}
          {/* STEP 4: Doctors & Drugs */}
          {step === "doctorsDrugs" && (
            <div className="space-y-4">
              {/* Doctors Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Stethoscope size={16} style={{ color: "#1C3A48" }} />
                  <span className="text-sm font-bold" style={{ color: "#1C3A48" }}>Your Doctors</span>
                  <span className="text-xs text-gray-400 ml-auto">{isValidZipFormat(zip) ? `Within 25 miles of ${zip}` : "Within your area"}</span>
                </div>
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-3 text-gray-400" />
                  <input type="text" value={doctorSearch} onChange={(e) => setDoctorSearch(e.target.value)} placeholder="Search any doctor by name..." className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm outline-none" style={{ borderColor: "#E2EAED" }} />
                  {npiLoading && <Loader2 size={14} className="absolute right-3 top-3 text-gray-400 animate-spin" />}
                </div>
                {doctorSearch.length >= 2 && npiResults.length > 0 && (
                  <div className="border rounded-lg max-h-40 overflow-y-auto mb-2" style={{ borderColor: "#E2EAED" }}>
                    {npiResults.map((d) => (
                      <button key={d.npi} onClick={() => addNpiDoctor(d)} className="w-full text-left px-3 py-2 text-sm hover:bg-[#EEF5F7] flex justify-between items-center border-b last:border-b-0" style={{ borderColor: "#E2EAED" }}>
                        <div className="flex-1 min-w-0">
                          <div><span className="font-medium" style={{ color: "#1C3A48" }}>{d.name}</span><span className="text-xs text-[#237A92] ml-2">{d.specialty}</span></div>
                          <div className="text-xs text-gray-400 truncate">{d.address}{d.distance !== null && <span className="ml-1 text-[#237A92] font-medium">· {d.distance} mi</span>}</div>
                        </div>
                        <Plus size={14} className="shrink-0 ml-2" style={{ color: "#7A9BA6" }} />
                      </button>
                    ))}
                  </div>
                )}
                {doctorSearch.length >= 2 && !npiLoading && npiResults.length === 0 && (
                  <p className="text-xs text-gray-400 mb-2">No doctors found within 25 miles. Try a different name or add manually.</p>
                )}
                {selectedDoctors.map((d) => (
                  <div key={d.id} className="flex items-center justify-between bg-[#EEF5F7] rounded-lg px-3 py-2 mb-1">
                    <div className="min-w-0">
                      <span className="text-sm font-medium" style={{ color: "#1C3A48" }}>{d.name}</span>
                      <span className="text-xs text-gray-500 ml-2">{d.specialty}</span>
                      {d.address && <div className="text-xs text-gray-400 truncate">{d.address}</div>}
                    </div>
                    <button onClick={() => setSelectedDoctors(selectedDoctors.filter((sd) => sd.id !== d.id))}><Trash2 size={14} className="text-red-400" /></button>
                  </div>
                ))}
                {!showManualDoctor ? (
                  <button onClick={() => setShowManualDoctor(true)} className="text-xs font-medium flex items-center gap-1 mt-1" style={{ color: "#1C3A48" }}><Plus size={12} />Add doctor manually</button>
                ) : (
                  <div className="border rounded-lg p-3 space-y-2 mt-1" style={{ borderColor: "#E2EAED" }}>
                    <input type="text" value={manualDoctorName} onChange={(e) => setManualDoctorName(e.target.value)} placeholder="Doctor name" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" style={{ borderColor: "#E2EAED" }} />
                    <input type="text" value={manualDoctorSpecialty} onChange={(e) => setManualDoctorSpecialty(e.target.value)} placeholder="Specialty (optional)" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" style={{ borderColor: "#E2EAED" }} />
                    <div className="flex gap-2"><button onClick={addManualDoctor} className="px-3 py-1.5 text-xs font-bold rounded-lg text-white" style={{ backgroundColor: "#1C3A48" }}>Add</button><button onClick={() => setShowManualDoctor(false)} className="px-3 py-1.5 text-xs rounded-lg border" style={{ borderColor: "#E2EAED" }}>Cancel</button></div>
                  </div>
                )}
              </div>
              {/* Divider */}
              <div className="border-t" style={{ borderColor: "#E8F2F5" }} />
              {/* Drugs Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Pill size={16} style={{ color: "#1C3A48" }} />
                  <span className="text-sm font-bold" style={{ color: "#1C3A48" }}>Your Prescriptions</span>
                </div>
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-3 text-gray-400" />
                  <input type="text" value={drugSearch} onChange={(e) => setDrugSearch(e.target.value)} placeholder="Search medications..." className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm outline-none" style={{ borderColor: "#E2EAED" }} />
                </div>
                {(rxLoading || rxResults.length > 0) && (
                  <div className="border rounded-lg max-h-32 overflow-y-auto mb-2" style={{ borderColor: "#E2EAED" }}>
                    {rxLoading ? (<div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2"><Loader2 size={12} className="animate-spin" />Searching...</div>) : rxResults.map((d) => (
                      <button key={d.displayName} onClick={() => { setSelectedDrugs([...selectedDrugs, { name: d.displayName, dosage: d.strength || "" }]); setDrugSearch(""); setRxResults([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[#FAF9F5] flex justify-between items-center">
                        <div><span className="font-medium" style={{ color: "#1C3A48" }}>{d.displayName}</span><span className="text-xs text-gray-500 ml-2">{d.strength}</span></div>
                        <Plus size={14} style={{ color: "#7A9BA6" }} />
                      </button>
                    ))}
                  </div>
                )}
                {selectedDrugs.map((d, i) => (
                  <div key={`${d.name}-${i}`} className="flex items-center justify-between bg-[#FAF9F5] rounded-lg px-3 py-2 mb-1">
                    <div><span className="text-sm font-medium" style={{ color: "#1C3A48" }}>{d.name}</span><span className="text-xs text-gray-500 ml-2">{d.dosage}</span></div>
                    <button onClick={() => setSelectedDrugs(selectedDrugs.filter((_, idx) => idx !== i))}><Trash2 size={14} className="text-red-400" /></button>
                  </div>
                ))}
                {!showManualDrug ? (
                  <button onClick={() => setShowManualDrug(true)} className="text-xs font-medium flex items-center gap-1 mt-1" style={{ color: "#1C3A48" }}><Plus size={12} />Add medication manually</button>
                ) : (
                  <div className="border rounded-lg p-3 space-y-2 mt-1" style={{ borderColor: "#E2EAED" }}>
                    <input type="text" value={manualDrugName} onChange={(e) => setManualDrugName(e.target.value)} placeholder="Medication name" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" style={{ borderColor: "#E2EAED" }} />
                    <input type="text" value={manualDrugDosage} onChange={(e) => setManualDrugDosage(e.target.value)} placeholder="Dosage (optional)" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" style={{ borderColor: "#E2EAED" }} />
                    <div className="flex gap-2"><button onClick={addManualDrug} className="px-3 py-1.5 text-xs font-bold rounded-lg text-white" style={{ backgroundColor: "#1C3A48" }}>Add</button><button onClick={() => setShowManualDrug(false)} className="px-3 py-1.5 text-xs rounded-lg border" style={{ borderColor: "#E2EAED" }}>Cancel</button></div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* STEP 5: AI Loading */}
          {step === "aiLoading" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#EEF5F7" }}>
                <Loader2 size={32} className="animate-spin" style={{ color: "#1C3A48" }} />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: "#1C3A48" }}>Analyzing Your Profile</h3>
              <p className="text-sm" style={{ color: "#7A9BA6" }}>Our AI is comparing plans based on your doctors, prescriptions{hasMA ? ", and current coverage" : ""}...</p>
            </div>
          )}
        </div>
        {/* Footer Buttons */}
        {step !== "aiLoading" && step !== "maQuestion" && (
          <div className="px-6 py-4 flex items-center gap-3" style={{ backgroundColor: "#FAF9F5", borderTop: "1px solid #E8F2F5" }}>
            <button onClick={handleBack} className="flex-1 py-2.5 text-sm font-semibold rounded-lg border-2 flex items-center justify-center gap-1" style={{ borderColor: "#E2EAED", color: "#3E5560" }}>
              <ChevronLeft size={15} />Back
            </button>
            {step === "pverifyLookup" && (
              <button onClick={handleVerify} disabled={isPending} className="flex-1 py-2.5 text-sm font-bold rounded-lg flex items-center justify-center gap-2 text-white" style={{ backgroundColor: isPending ? "#9CA3AF" : "#1C3A48" }}>
                {isPending ? <><Loader2 size={15} className="animate-spin" />Verifying...</> : <>Verify & Continue<ChevronRight size={15} /></>}
              </button>
            )}
            {step === "planFound" && (
              <button onClick={() => setStep("doctorsDrugs")} className="flex-1 py-2.5 text-sm font-bold rounded-lg flex items-center justify-center gap-2 text-white" style={{ backgroundColor: "#1C3A48" }}>
                Next: Doctors & Drugs<ChevronRight size={15} />
              </button>
            )}
            {step === "doctorsDrugs" && (
              <button onClick={handleFinish} className="flex-1 py-2.5 text-sm font-bold rounded-lg flex items-center justify-center gap-2 text-white" style={{ backgroundColor: "#1C3A48" }}>
                <Sparkles size={15} />Find My Best Plan
              </button>
            )}
          </div>
        )}
        {/* Skip link for maQuestion */}
        {step === "maQuestion" && (
          <div className="px-6 py-3 text-center" style={{ backgroundColor: "#FAF9F5", borderTop: "1px solid #E8F2F5" }}>
            <button onClick={onSkip} className="text-xs font-medium hover:text-[#3E5560] transition-colors" style={{ color: "#7A9BA6" }}>Skip — Show All Plans Without Personalization</button>
          </div>
        )}
      </div>
    </div>
  );
}
