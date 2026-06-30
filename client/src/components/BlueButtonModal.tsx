// BlueButtonModal — CMS Blue Button 2.0 Medicare Data Consent & Integration
// Includes HIPAA/CMS disclaimers as required

import { useState } from "react";
import { X, Shield, ExternalLink, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

interface BlueButtonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDrugsFetched?: (drugs: DrugInfo[]) => void;
}

export interface DrugInfo {
  name: string;
  ndc?: string;
  rxnorm?: string;
  dosage?: string;
  supply?: string;
  lastFilled?: string;
}

type ModalStep = "consent" | "connecting" | "success" | "error";

const BB_SANDBOX_URL = "https://sandbox.bluebutton.cms.gov";
const BB_CLIENT_ID = import.meta.env.VITE_BB_CLIENT_ID || "DEMO_CLIENT_ID";
const REDIRECT_URI = `${window.location.origin}/api/bluebutton-callback`;

export default function BlueButtonModal({ isOpen, onClose, onDrugsFetched }: BlueButtonModalProps) {
  const [step, setStep] = useState<ModalStep>("consent");
  const [consentChecked, setConsentChecked] = useState(false);
  const [hipaaChecked, setHipaaChecked] = useState(false);
  const [drugs, setDrugs] = useState<DrugInfo[]>([]);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleConnect = () => {
    if (!consentChecked || !hipaaChecked) return;
    setStep("connecting");

    // Build CMS Blue Button OAuth URL
    const authUrl = `${BB_SANDBOX_URL}/v1/o/authorize/?client_id=${BB_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=${crypto.randomUUID()}`;

    // Open popup for OAuth
    const popup = window.open(authUrl, "bluebutton", "width=600,height=700,scrollbars=yes");

    // Listen for callback message
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "bluebutton-callback") {
        window.removeEventListener("message", handler);
        popup?.close();

        if (event.data.success && event.data.drugs) {
          setDrugs(event.data.drugs);
          setStep("success");
          onDrugsFetched?.(event.data.drugs);
        } else {
          setError(event.data.error || "Failed to fetch Medicare data");
          setStep("error");
        }
      }
    };

    window.addEventListener("message", handler);

    // Timeout after 5 minutes
    setTimeout(() => {
      window.removeEventListener("message", handler);
      if (step === "connecting") {
        setError("Connection timed out. Please try again.");
        setStep("error");
      }
    }, 300000);
  };

  const handleReset = () => {
    setStep("consent");
    setConsentChecked(false);
    setHipaaChecked(false);
    setDrugs([]);
    setError("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(11,27,36,0.5)", backdropFilter: "blur(3px)" }}
    >
      <div
        className="relative w-full max-w-lg mx-4 rounded-xl overflow-hidden"
        style={{ backgroundColor: "#FFFFFF", boxShadow: "0 8px 40px rgba(11,27,36,0.16)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ backgroundColor: "#00353E" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>Connect Your Medicare Data</h2>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>Powered by CMS Blue Button 2.0</p>
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

        {/* Content */}
        <div className="p-6">
          {step === "consent" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg" style={{ backgroundColor: "#E6F7F9", border: "1px solid #E8E8E8" }}>
                <p className="text-sm leading-relaxed" style={{ color: "#303030" }}>
                  Securely connect to <strong>Medicare.gov</strong> to automatically import your
                  prescription drug list. This helps us find the best plan that covers your medications
                  at the lowest cost.
                </p>
              </div>

              {/* HIPAA Disclaimer */}
              <div className="p-4 rounded-xl border border-amber-200" style={{ backgroundColor: "#FFFBEB" }}>
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-800 space-y-2">
                    <p className="font-bold">HIPAA Privacy Notice</p>
                    <p>
                      Your health information is protected under the Health Insurance Portability and
                      Accountability Act (HIPAA). By proceeding, you authorize SelectQuote to access your
                      Medicare claims data through the CMS Blue Button 2.0 API for the sole purpose of
                      providing personalized Medicare plan recommendations.
                    </p>
                    <p>
                      Your data will be encrypted in transit and at rest. We will not share your
                      Protected Health Information (PHI) with any third parties without your explicit
                      written consent, except as required by law.
                    </p>
                  </div>
                </div>
              </div>

              {/* CMS Disclaimer */}
              <div className="p-4 rounded-lg" style={{ backgroundColor: "#F9F9F9", border: "1px solid #E8E8E8" }}>
                <div className="text-xs space-y-2" style={{ color: "#303030" }}>
                  <p className="font-bold" style={{ color: "#00353E" }}>CMS Data Use Disclaimer</p>
                  <p>
                    This application uses the CMS Blue Button 2.0 API to access your Medicare data.
                    CMS does not endorse this application. The data retrieved is used solely to help
                    identify prescription drug coverage options. This is not a government service.
                  </p>
                  <p>
                    Your participation is voluntary. You may revoke access at any time through your
                    Medicare.gov account settings. Revoking access will not affect your current
                    Medicare coverage.
                  </p>
                </div>
              </div>

              {/* Consent Checkboxes */}
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded"
                    style={{ borderColor: "#E8E8E8", accentColor: "#00353E" }}
                  />
                  <span className="text-xs" style={{ color: "#303030" }}>
                    I consent to share my Medicare claims data with SelectQuote for the purpose
                    of receiving personalized Medicare plan recommendations. I understand I can
                    revoke this consent at any time.
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hipaaChecked}
                    onChange={(e) => setHipaaChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded"
                    style={{ borderColor: "#E8E8E8", accentColor: "#00353E" }}
                  />
                  <span className="text-xs" style={{ color: "#303030" }}>
                    I acknowledge that I have read and understand the HIPAA Privacy Notice and CMS
                    Data Use Disclaimer above. I understand that my Protected Health Information
                    will be handled in accordance with applicable federal and state privacy laws.
                  </span>
                </label>
              </div>

              {/* Connect Button */}
              <button
                onClick={handleConnect}
                disabled={!consentChecked || !hipaaChecked}
                className="w-full py-3 rounded-lg text-sm font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: consentChecked && hipaaChecked ? "#EF7000" : "#94A3B8" }}
              >
                <img
                  src="https://bluebutton.cms.gov/assets/img/bb-logo-vector.svg"
                  alt="Blue Button"
                  className="w-5 h-5"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                Connect to Medicare.gov
                <ExternalLink size={14} />
              </button>

              {/* Additional Legal Notices */}
              <div className="text-[10px] text-center space-y-1" style={{ color: "#8C8C8C" }}>
                <p>
                  SelectQuote is a licensed insurance agency. This tool is provided as a service
                  to help you compare Medicare plan options.
                </p>
                <p>
                  Not affiliated with or endorsed by the U.S. Government or the Federal
                  Medicare Program. This is a solicitation for insurance.
                </p>
                <p>
                  By connecting, you will be redirected to Medicare.gov to log in securely.
                  SelectQuote never sees your Medicare.gov password.
                </p>
              </div>
            </div>
          )}

          {step === "connecting" && (
            <div className="text-center py-12 space-y-4">
              <Loader2 size={48} className="mx-auto animate-spin" style={{ color: "#00859A" }} />
              <div>
                <p className="text-lg font-bold text-[#1A1A1A]">Connecting to Medicare.gov...</p>
                <p className="text-sm text-[#8C8C8C] mt-1">
                  Please complete the login in the popup window
                </p>
              </div>
              <p className="text-xs text-[#8C8C8C]">
                If no popup appeared, please check your browser's popup blocker settings.
              </p>
            </div>
          )}

          {step === "success" && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <CheckCircle2 size={48} className="mx-auto" style={{ color: "#16A34A" }} />
                <p className="text-lg font-bold text-[#1A1A1A] mt-3">
                  Medicare Data Retrieved Successfully
                </p>
                <p className="text-sm text-[#8C8C8C] mt-1">
                  Found {drugs.length} prescription drug{drugs.length !== 1 ? "s" : ""} on file
                </p>
              </div>

              {drugs.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg" style={{ border: "1px solid #E8E8E8" }}>
                  <table className="w-full text-xs">
                    <thead className="sticky top-0" style={{ backgroundColor: "#E6F7F9" }}>
                      <tr>
                        <th className="text-left p-2 font-bold" style={{ color: "#00353E" }}>Drug Name</th>
                        <th className="text-left p-2 font-bold" style={{ color: "#00353E" }}>Dosage</th>
                        <th className="text-left p-2 font-bold" style={{ color: "#00353E" }}>Last Filled</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drugs.map((drug, i) => (
                        <tr key={i} style={{ borderTop: "1px solid #E8E8E8" }}>
                          <td className="p-2 font-semibold text-[#1A1A1A]">{drug.name}</td>
                          <td className="p-2 text-[#8C8C8C]">{drug.dosage || "—"}</td>
                          <td className="p-2 text-[#8C8C8C]">{drug.lastFilled || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: "#EF7000" }}
              >
                Use These Drugs for Plan Comparison
              </button>
            </div>
          )}

          {step === "error" && (
            <div className="text-center py-8 space-y-4">
              <AlertTriangle size={48} className="mx-auto text-amber-500" />
              <div>
                <p className="text-lg font-bold text-[#1A1A1A]">Connection Issue</p>
                <p className="text-sm text-[#8C8C8C] mt-1">{error}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold border"
                  style={{ borderColor: "#00353E", color: "#00353E" }}
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: "#EF7000" }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
