/**
 * Medicare Advantage Homepage — Premium redesign v2.
 *
 * ZIP validation / workflow / modal / routing: UNCHANGED.
 * Only the visual layer has been replaced.
 *
 * Design principles:
 *   – Editorial hierarchy: type does the work, not decoration
 *   – Restraint over embellishment: white space is the luxury signal
 *   – No equal-weight card grids, no icon rows, no loud gradients
 *   – Senior-legible (≥17px body) while still feeling high-end
 *   – Accessibility: aria roles, skip link, reduced-motion, focus rings
 */

import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { Phone, ChevronRight, ArrowRight } from "lucide-react";
import GuidedWorkflowModal, { type MBIVerifyResult } from "@/components/GuidedWorkflowModal";
import { useZipValidation } from "@/features/zip-validation/lib/useZipValidation";
import CountySelector from "@/features/zip-validation/components/CountySelector";
import Header from "@/components/Header";

// ─── Tokens ──────────────────────────────────────────────────────────────────
const T = {
  ink:    "#080F14",   // Display headings — near-black with blue cast
  deep:   "#152D3A",   // Primary dark — buttons, anchors
  mid:    "#1E6278",   // Teal — interactive, section accents
  teal:   "#2A7D96",   // Hover / lighter teal
  body:   "#3A5060",   // Body copy
  sub:    "#698898",   // Muted / supporting text
  rule:   "#DDE7EB",   // Hairline dividers
  tint:   "#F3F6F7",   // Alternate section bg
  warm:   "#F8F6F2",   // Warm off-white
  night:  "#09141A",   // Dark section bg
  ftr:    "#050D12",   // Footer bg
  err:    "#C0392B",
} as const;

const F = {
  serif: "'DM Serif Display', Georgia, 'Times New Roman', serif",
  sans:  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

// ─── Page data ────────────────────────────────────────────────────────────────
const PRINCIPLES = [
  {
    num: "01",
    title: "Every plan, nothing filtered.",
    body: "We're independent advisors. No carrier pays for placement and no plan is hidden. You see every Medicare Advantage option active in your county — ranked by what matters to you.",
  },
  {
    num: "02",
    title: "Your true cost, calculated upfront.",
    body: "Add your prescriptions and we calculate real annual drug cost for every plan: deductible, tier copays, and coverage gap. Not estimates — the same math CMS uses.",
  },
  {
    num: "03",
    title: "Your doctors verified before you see results.",
    body: "We cross-check provider directories so you never choose a plan only to lose your care team. In-network status is confirmed before a single result appears.",
  },
] as const;

const STEPS = [
  { step: "1", label: "Enter your ZIP", note: "Unlocks every plan in your county" },
  { step: "2", label: "Add doctors & Rx", note: "Optional — personalizes your results" },
  { step: "3", label: "Compare & decide", note: "At your own pace, no pressure" },
] as const;

const CARRIERS = [
  "UnitedHealthcare", "Humana", "Aetna", "Cigna",
  "WellCare", "Blue Cross", "Devoted Health", "Clover Health",
] as const;

// ─── Scroll-reveal ────────────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) { el.dataset.visible = "true"; return; }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.dataset.visible = "true"; obs.unobserve(el); } },
      { threshold: 0.07, rootMargin: "0px 0px -48px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

// ─── Home ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [zip, setZip] = useState("");
  const [inputError, setInputError] = useState("");
  const zipValidation = useZipValidation();
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [showMBIModal, setShowMBIModal] = useState(false);
  const [pendingZip, setPendingZip] = useState("");
  const [, navigate] = useLocation();

  const principlesRef = useReveal();
  const stepsRef      = useReveal();
  const trustRef      = useReveal();
  const ctaRef        = useReveal();

  // ── ZIP handlers — identical to previous version ──────────────────────────
  const handleSearch = async () => {
    const trimmed = zip.trim();
    const result = await zipValidation.validate(trimmed);
    if (result.status === "invalid_format" || result.status === "invalid_zip" || result.status === "error") {
      setInputError(result.errorMessage);
      setTimeout(() => zipInputRef.current?.focus(), 50);
      return;
    }
    if (result.status === "needs_county_selection") { setInputError(""); return; }
    if (result.status === "valid") { setInputError(""); setPendingZip(trimmed); setShowMBIModal(true); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearch(); };
  const handleMBISkip = () => { setShowMBIModal(false); navigate(`/plans?zip=${pendingZip}`); };
  const handleWorkflowComplete = (data: {
    hasMA: boolean;
    verifyResult: MBIVerifyResult | null;
    doctors: any[];
    drugs: any[];
  }) => {
    setShowMBIModal(false);
    try {
      if (data.verifyResult) sessionStorage.setItem("mbi_eligibility", JSON.stringify(data.verifyResult));
      sessionStorage.setItem("workflow_data", JSON.stringify(data));
    } catch { /* sessionStorage unavailable */ }
    const params = new URLSearchParams({ zip: pendingZip });
    if (data.verifyResult) params.set("verified", "1");
    if (data.doctors.length > 0 || data.drugs.length > 0) params.set("personalized", "1");
    navigate(`/plans?${params.toString()}`);
  };

  return (
    <div id="hm" style={{ minHeight: "100vh", backgroundColor: "#fff", fontFamily: F.sans, color: T.body }}>

      {/* Skip link */}
      <a href="#main" className="hm-skip" style={{
        position: "absolute", top: "-100%", left: "16px", zIndex: 9999,
        backgroundColor: T.deep, color: "#fff", fontFamily: F.sans,
        fontSize: "13px", fontWeight: 600, padding: "10px 20px",
        borderRadius: "0 0 8px 8px", textDecoration: "none",
      }}>
        Skip to main content
      </a>

      <style>{`
        /* Skip link */
        #hm .hm-skip:focus { top: 0 !important; }

        /* Reveal animation */
        #hm .rv {
          opacity: 0;
          transform: translateY(22px);
          transition: opacity 0.55s cubic-bezier(0.22,1,0.36,1), transform 0.55s cubic-bezier(0.22,1,0.36,1);
        }
        #hm .rv[data-visible="true"] { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) {
          #hm .rv { opacity: 1 !important; transform: none !important; transition: none !important; }
        }

        /* ZIP input focus */
        #hm .zip-field:focus {
          border-color: ${T.mid} !important;
          box-shadow: 0 0 0 3px rgba(30,98,120,0.13) !important;
          outline: none;
        }
        #hm .zip-field-dark:focus {
          border-color: rgba(255,255,255,0.5) !important;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.08) !important;
          outline: none;
        }

        /* Buttons */
        #hm .btn-primary { transition: background-color 0.14s, transform 0.1s; }
        #hm .btn-primary:hover { background-color: #0F2230 !important; }
        #hm .btn-primary:active { transform: scale(0.98); }
        #hm .btn-ghost { transition: color 0.12s, border-color 0.12s; }
        #hm .btn-ghost:hover { color: ${T.teal} !important; border-color: ${T.teal} !important; }
        #hm .text-link { transition: color 0.12s; }
        #hm .text-link:hover { color: ${T.teal} !important; }
        #hm .footer-link { transition: color 0.14s; }
        #hm .footer-link:hover { color: rgba(255,255,255,0.85) !important; }
        #hm .phone-link { transition: color 0.12s; }
        #hm .phone-link:hover { color: rgba(243,246,247,0.85) !important; }

        /* Responsive */
        @media (max-width: 1023px) {
          #hm .hero-grid  { grid-template-columns: 1fr !important; }
          #hm .hero-right { display: none !important; }
          #hm .steps-row  { grid-template-columns: 1fr !important; }
          #hm .principles-list > * + * { border-top: 1px solid ${T.rule}; border-left: none !important; }
          #hm .footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 639px) {
          #hm .footer-grid { grid-template-columns: 1fr !important; }
          #hm .cred-strip  { flex-direction: column !important; gap: 10px !important; }
          #hm .cred-divider { display: none !important; }
        }
      `}</style>

      {showMBIModal && (
        <GuidedWorkflowModal zip={pendingZip} onSkip={handleMBISkip} onComplete={handleWorkflowComplete} />
      )}

      <Header />

      <main id="main">

        {/* ── §1 HERO ──────────────────────────────────────────────────────── */}
        <section
          aria-label="Find your Medicare Advantage plan"
          style={{
            minHeight: "calc(100vh - 72px)",
            display: "flex", alignItems: "center",
            backgroundColor: "#fff",
            borderBottom: `1px solid ${T.rule}`,
          }}
        >
          <div style={{ width: "100%", maxWidth: "1200px", margin: "0 auto", padding: "0 40px" }}>
            <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "100px", alignItems: "center" }}>

              {/* Left — headline + CTA */}
              <div style={{ maxWidth: "580px" }}>
                <p style={{
                  fontFamily: F.sans, fontSize: "12px", fontWeight: 600,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: T.mid, marginBottom: "36px",
                }}>
                  Independent · Licensed in all 50 states · No cost to you
                </p>

                <h1 style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(52px, 7.5vw, 104px)",
                  fontWeight: 400, lineHeight: 1.02,
                  letterSpacing: "-0.025em",
                  color: T.ink,
                  marginBottom: "28px",
                }}>
                  Medicare<br />
                  Advantage,<br />
                  <em style={{ color: T.mid, fontStyle: "italic" }}>made clear.</em>
                </h1>

                <p style={{
                  fontFamily: F.sans, fontSize: "18px", fontWeight: 400,
                  lineHeight: 1.75, color: T.body,
                  maxWidth: "42ch", marginBottom: "52px",
                }}>
                  Compare every plan in your county — matched to your doctors, prescriptions, and budget. Free. No account needed.
                </p>

                {/* ZIP input */}
                <div style={{ maxWidth: "460px" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      id="zip-hero"
                      ref={zipInputRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="Enter your ZIP code"
                      value={zip}
                      onChange={(e) => { setZip(e.target.value.replace(/\D/g, "")); setInputError(""); }}
                      onKeyDown={handleKeyDown}
                      aria-label="ZIP code"
                      aria-describedby="zip-err-hero"
                      aria-invalid={!!inputError}
                      className="zip-field"
                      style={{
                        flex: 1, fontFamily: F.sans,
                        padding: "17px 22px", fontSize: "17px", fontWeight: 500,
                        color: T.ink, backgroundColor: "#fff",
                        border: `1.5px solid ${inputError ? T.err : T.rule}`,
                        borderRadius: "8px", outline: "none",
                        boxShadow: "0 1px 4px rgba(8,15,20,0.06)",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSearch}
                      className="btn-primary"
                      style={{
                        fontFamily: F.sans, padding: "17px 28px",
                        backgroundColor: T.deep, color: "#fff",
                        fontWeight: 600, fontSize: "15px",
                        borderRadius: "8px", border: "none",
                        cursor: "pointer", flexShrink: 0,
                        display: "flex", alignItems: "center", gap: "8px",
                        letterSpacing: "0.01em", whiteSpace: "nowrap",
                      }}
                    >
                      See my plans
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>
                  </div>

                  <p
                    id="zip-err-hero"
                    role="alert"
                    aria-live="assertive"
                    aria-atomic="true"
                    style={{
                      fontFamily: F.sans, fontSize: "13px",
                      color: T.err, marginTop: "8px",
                      minHeight: "18px", display: "flex", alignItems: "center", gap: "5px",
                    }}
                  >
                    {inputError && <><span aria-hidden="true">⚠</span>{inputError}</>}
                  </p>

                  {zipValidation.result.status === "needs_county_selection" && zipValidation.result.counties && (
                    <CountySelector
                      zip={zip}
                      counties={zipValidation.result.counties}
                      onSelect={(county) => {
                        const r = zipValidation.selectCounty(county);
                        if (r.status === "valid") { setInputError(""); setPendingZip(zip.trim()); setShowMBIModal(true); }
                      }}
                    />
                  )}

                  <p style={{ fontFamily: F.sans, fontSize: "13px", color: T.sub, marginTop: "18px" }}>
                    Always free · No account required · No sales calls unless you want them
                  </p>
                </div>
              </div>

              {/* Right — editorial stat block */}
              <div
                className="hero-right"
                aria-hidden="true"
                style={{ paddingLeft: "40px", borderLeft: `1px solid ${T.rule}` }}
              >
                {[
                  { figure: "24+",    unit: "plans",    note: "available in most counties" },
                  { figure: "$0",     unit: "/month",   note: "plans in most counties" },
                  { figure: "500k+",  unit: "seniors",  note: "helped since 2010" },
                ].map((s, i) => (
                  <div
                    key={s.figure}
                    style={{
                      paddingTop: i === 0 ? "0" : "32px",
                      paddingBottom: i < 2 ? "32px" : "0",
                      borderBottom: i < 2 ? `1px solid ${T.rule}` : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "4px" }}>
                      <span style={{
                        fontFamily: F.serif,
                        fontSize: "56px", fontWeight: 400, lineHeight: 1,
                        letterSpacing: "-0.03em", color: T.ink,
                      }}>
                        {s.figure}
                      </span>
                      <span style={{
                        fontFamily: F.sans, fontSize: "14px",
                        fontWeight: 500, color: T.mid,
                        letterSpacing: "-0.01em",
                      }}>
                        {s.unit}
                      </span>
                    </div>
                    <p style={{ fontFamily: F.sans, fontSize: "13px", color: T.sub, margin: 0 }}>{s.note}</p>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </section>

        {/* ── §2 CREDIBILITY STRIP ─────────────────────────────────────────── */}
        <div
          aria-label="Service credentials"
          style={{
            backgroundColor: T.warm,
            borderBottom: `1px solid ${T.rule}`,
          }}
        >
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 40px" }}>
            {/* Trust pillars */}
            <div
              className="cred-strip"
              style={{
                display: "flex", alignItems: "center",
                padding: "20px 0", gap: "0",
              }}
            >
              {[
                "Licensed agents in all 50 states",
                "We're paid by carriers — never by you",
                "All plan data sourced from CMS.gov",
                "Doctors & prescriptions verified before results",
              ].map((item, i) => (
                <div key={item} style={{ display: "flex", alignItems: "center" }}>
                  {i > 0 && (
                    <span
                      className="cred-divider"
                      aria-hidden="true"
                      style={{
                        width: "1px", height: "14px",
                        backgroundColor: T.rule,
                        margin: "0 24px", flexShrink: 0,
                      }}
                    />
                  )}
                  <span style={{ fontFamily: F.sans, fontSize: "13px", color: T.body, whiteSpace: "nowrap" }}>
                    {item}
                  </span>
                </div>
              ))}
            </div>
            {/* Carrier row */}
            <div
              style={{
                display: "flex", alignItems: "center",
                padding: "14px 0", gap: "0",
                borderTop: `1px solid ${T.rule}`,
              }}
            >
              <span style={{ fontFamily: F.sans, fontSize: "11px", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: T.sub, marginRight: "20px", whiteSpace: "nowrap" }}>
                Plans from
              </span>
              {CARRIERS.map((name, i) => (
                <span key={name} style={{ display: "flex", alignItems: "center" }}>
                  {i > 0 && (
                    <span aria-hidden="true" style={{ color: T.rule, margin: "0 14px", fontSize: "12px" }}>·</span>
                  )}
                  <span style={{ fontFamily: F.sans, fontSize: "12px", fontWeight: 500, color: T.sub }}>{name}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── §3 THREE PRINCIPLES ──────────────────────────────────────────── */}
        <section
          id="principles"
          aria-labelledby="principles-heading"
          style={{ backgroundColor: "#fff", padding: "160px 0" }}
        >
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 40px" }}>
            <div style={{ marginBottom: "72px" }}>
              <p style={{
                fontFamily: F.sans, fontSize: "12px", fontWeight: 600,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: T.mid, marginBottom: "18px",
              }}>
                Why people use us
              </p>
              <h2
                id="principles-heading"
                style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(30px, 4vw, 52px)",
                  fontWeight: 400, lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: T.ink, maxWidth: "680px",
                }}
              >
                Built for an important decision —{" "}
                <em style={{ fontStyle: "italic", color: T.mid }}>not for people in a hurry.</em>
              </h2>
            </div>

            <div
              ref={principlesRef}
              className="rv principles-list"
              style={{ display: "flex", alignItems: "stretch" }}
            >
              {PRINCIPLES.map((p, i) => (
                <div
                  key={p.num}
                  style={{
                    flex: 1,
                    paddingRight: i < 2 ? "56px" : "0",
                    paddingLeft: i > 0 ? "56px" : "0",
                    borderLeft: i > 0 ? `1px solid ${T.rule}` : "none",
                  }}
                >
                  <div style={{
                    fontFamily: F.serif, fontSize: "13px",
                    color: T.rule, letterSpacing: "0.02em",
                    marginBottom: "24px",
                  }}>
                    {p.num}
                  </div>
                  <h3 style={{
                    fontFamily: F.serif,
                    fontSize: "clamp(20px, 2vw, 24px)",
                    fontWeight: 400, lineHeight: 1.22,
                    letterSpacing: "-0.015em",
                    color: T.ink, marginBottom: "16px",
                  }}>
                    {p.title}
                  </h3>
                  <p style={{
                    fontFamily: F.sans, fontSize: "15px",
                    lineHeight: 1.78, color: T.body,
                  }}>
                    {p.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── §4 HOW IT WORKS ──────────────────────────────────────────────── */}
        <section
          id="how"
          aria-labelledby="how-heading"
          style={{
            backgroundColor: T.tint,
            padding: "120px 0",
            borderTop: `1px solid ${T.rule}`,
            borderBottom: `1px solid ${T.rule}`,
          }}
        >
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 40px" }}>
            <p style={{
              fontFamily: F.sans, fontSize: "12px", fontWeight: 600,
              letterSpacing: "0.1em", textTransform: "uppercase",
              color: T.mid, marginBottom: "18px",
            }}>
              How it works
            </p>
            <h2
              id="how-heading"
              style={{
                fontFamily: F.serif,
                fontSize: "clamp(28px, 3.5vw, 44px)",
                fontWeight: 400, lineHeight: 1.15,
                letterSpacing: "-0.015em",
                color: T.ink, marginBottom: "64px",
                maxWidth: "480px",
              }}
            >
              Three steps. No account. No pressure.
            </h2>

            <div
              ref={stepsRef}
              className="rv steps-row"
              style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0" }}
            >
              {STEPS.map((s, i) => (
                <div
                  key={s.step}
                  style={{
                    padding: i > 0 ? "0 0 0 48px" : "0 48px 0 0",
                    borderLeft: i > 0 ? `1px solid ${T.rule}` : "none",
                  }}
                >
                  <div style={{
                    fontFamily: F.serif,
                    fontSize: "48px", fontWeight: 400,
                    lineHeight: 1, letterSpacing: "-0.02em",
                    color: T.rule, marginBottom: "20px",
                  }}>
                    {s.step}
                  </div>
                  <div style={{
                    fontFamily: F.sans, fontSize: "17px", fontWeight: 600,
                    color: T.ink, marginBottom: "8px",
                    letterSpacing: "-0.01em",
                  }}>
                    {s.label}
                  </div>
                  <div style={{ fontFamily: F.sans, fontSize: "14px", color: T.sub, lineHeight: 1.6 }}>
                    {s.note}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── §5 TRUST — THE BIG STATEMENT ────────────────────────────────── */}
        <section
          id="trust"
          aria-labelledby="trust-heading"
          style={{ backgroundColor: "#fff", padding: "160px 0" }}
        >
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 40px" }}>
            <div
              ref={trustRef}
              className="rv"
              style={{
                display: "grid", gridTemplateColumns: "5fr 7fr",
                gap: "100px", alignItems: "center",
              }}
            >
              {/* Left — prose */}
              <div>
                <p style={{
                  fontFamily: F.sans, fontSize: "12px", fontWeight: 600,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: T.mid, marginBottom: "24px",
                }}>
                  Our commitment
                </p>
                <p style={{
                  fontFamily: F.sans, fontSize: "18px",
                  lineHeight: 1.78, color: T.body, marginBottom: "36px",
                }}>
                  We are independent advisors. No carrier pays for referrals, and no plan is hidden from your results. Every comparison is built on plan data published directly by CMS.gov — the same source Medicare itself uses.
                </p>
                <div style={{ borderTop: `1px solid ${T.rule}`, paddingTop: "28px" }}>
                  <p style={{ fontFamily: F.sans, fontSize: "14px", color: T.sub, lineHeight: 1.7, marginBottom: "16px" }}>
                    Comparing 24+ plans per county · every active carrier · no preferred placement
                  </p>
                  <p style={{ fontFamily: F.sans, fontSize: "12px", color: T.sub, lineHeight: 1.65 }}>
                    All plan data from CMS.gov public records, updated annually. Not affiliated with or endorsed by any insurance carrier.
                  </p>
                </div>
              </div>

              {/* Right — display stat */}
              <div
                aria-label="Since 2010, we've helped more than 500,000 seniors find better Medicare coverage."
                style={{ borderLeft: `1px solid ${T.rule}`, paddingLeft: "72px" }}
              >
                <p style={{
                  fontFamily: F.serif, fontSize: "clamp(16px, 2vw, 22px)",
                  color: T.sub, lineHeight: 1.3, marginBottom: "12px",
                }}>
                  Since 2010, we've helped more than
                </p>
                <p
                  aria-hidden="true"
                  style={{
                    fontFamily: F.serif,
                    fontSize: "clamp(56px, 8vw, 104px)",
                    fontWeight: 400, lineHeight: 0.88,
                    letterSpacing: "-0.035em",
                    color: T.ink, margin: "0 0 12px",
                  }}
                >
                  500,000
                </p>
                <p style={{
                  fontFamily: F.serif, fontSize: "clamp(16px, 2vw, 22px)",
                  color: T.sub, lineHeight: 1.3, marginBottom: "32px",
                }}>
                  seniors find better Medicare coverage.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => { zipInputRef.current?.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  style={{
                    fontFamily: F.sans, fontSize: "14px", fontWeight: 600,
                    color: "#fff", backgroundColor: T.deep,
                    padding: "14px 24px", borderRadius: "7px", border: "none",
                    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px",
                    letterSpacing: "0.01em",
                  }}
                >
                  Find plans in your county
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── §6 DARK CTA ──────────────────────────────────────────────────── */}
        <section
          id="start"
          aria-labelledby="cta-heading"
          style={{ backgroundColor: T.night, padding: "160px 0" }}
        >
          <div
            ref={ctaRef}
            className="rv"
            style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 40px" }}
          >
            <div style={{ maxWidth: "640px" }}>
              <p style={{
                fontFamily: F.sans, fontSize: "12px", fontWeight: 600,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: T.mid, marginBottom: "24px",
              }}>
                Free comparison service
              </p>
              <h2
                id="cta-heading"
                style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(32px, 5vw, 60px)",
                  fontWeight: 400, lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: "#fff", marginBottom: "20px",
                }}
              >
                The plan you choose today determines who can treat you next year.
              </h2>
              <p style={{
                fontFamily: F.sans, fontSize: "17px",
                color: "rgba(243,246,247,0.55)",
                lineHeight: 1.75, marginBottom: "48px", maxWidth: "44ch",
              }}>
                Start with your ZIP code. We'll show you every plan available in your county — with your doctors checked and your prescriptions priced.
              </p>
              <div style={{ display: "flex", gap: "8px", maxWidth: "420px", marginBottom: "20px" }}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="Enter ZIP code"
                  value={zip}
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={handleKeyDown}
                  aria-label="ZIP code for plan comparison"
                  className="zip-field-dark"
                  style={{
                    flex: 1, fontFamily: F.sans,
                    padding: "16px 20px", fontSize: "16px", fontWeight: 500,
                    color: T.ink, backgroundColor: "#fff",
                    border: "1.5px solid transparent",
                    borderRadius: "8px", outline: "none",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSearch}
                  style={{
                    fontFamily: F.sans, padding: "16px 24px",
                    backgroundColor: T.mid, color: "#fff",
                    fontWeight: 600, fontSize: "14px",
                    borderRadius: "8px", border: "none",
                    cursor: "pointer", flexShrink: 0,
                    display: "flex", alignItems: "center", gap: "7px",
                    whiteSpace: "nowrap",
                  }}
                >
                  See Plans
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
              <p style={{
                fontFamily: F.sans, fontSize: "13px",
                color: "rgba(243,246,247,0.32)",
                display: "flex", alignItems: "center", gap: "8px",
              }}>
                <Phone size={12} aria-hidden="true" />
                <span>
                  Or call{" "}
                  <a
                    href="tel:1-800-555-0100"
                    className="phone-link"
                    style={{ color: "rgba(243,246,247,0.55)", fontWeight: 500, textDecoration: "none" }}
                  >
                    1-800-555-0100
                  </a>
                  {" "}to speak with a licensed advisor
                </span>
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer
        aria-label="Site footer"
        style={{ backgroundColor: T.ftr, fontFamily: F.sans, padding: "72px 0 48px" }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 40px" }}>
          <div
            className="footer-grid"
            style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: "48px", marginBottom: "56px" }}
          >
            {/* Brand */}
            <div>
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontFamily: F.serif, fontSize: "20px", fontWeight: 400, color: "#fff", letterSpacing: "-0.01em", lineHeight: 1.1 }}>
                  MedicarePlan
                </div>
                <div style={{ fontFamily: F.sans, fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: "3px" }}>
                  Finder
                </div>
              </div>
              <p style={{ fontSize: "13px", lineHeight: 1.72, color: "rgba(255,255,255,0.38)", maxWidth: "26ch" }}>
                Helping Americans find the right Medicare Advantage plan since 2010.
              </p>
            </div>

            {/* Link columns */}
            {[
              { title: "Plans", links: [
                { label: "Medicare Advantage", href: "/medicare-advantage/hmo-plans" },
                { label: "Medicare Supplement", href: "/medicare-supplement/compare" },
                { label: "Part D Drug Plans", href: "/part-d/compare" },
                { label: "Dual Eligible", href: "/dual-eligible" },
              ]},
              { title: "Resources", links: [
                { label: "Medicare 101", href: "/resources/medicare-101" },
                { label: "Enrollment Periods", href: "/resources/enrollment-periods" },
                { label: "Star Ratings Guide", href: "/resources/star-ratings" },
                { label: "Compare Plans", href: `/plans?zip=${zip || "64106"}` },
              ]},
              { title: "Company", links: [
                { label: "About Us", href: "/about" },
                { label: "Licensed Agents", href: "/agents" },
                { label: "Contact Us", href: "/contact" },
                { label: "Privacy Policy", href: "/privacy" },
              ]},
            ].map((col) => (
              <nav key={col.title} aria-label={`${col.title} links`}>
                <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: "16px" }}>
                  {col.title}
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "11px" }}>
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="footer-link"
                        style={{ fontSize: "13px", color: "rgba(255,255,255,0.38)", textDecoration: "none" }}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          {/* Technical resource */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "24px", marginBottom: "24px" }}>
            <a
              href="https://d2xsxph8kpxj0f.cloudfront.net/310519663319810046/5TY7JcF275WMujMHZWWJT8/episode-alert-api-integration-guide_6a93d69a.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: "7px",
                padding: "7px 13px", borderRadius: "5px",
                fontSize: "12px", color: "rgba(255,255,255,0.3)",
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                textDecoration: "none",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Episode Alert API Integration Guide (PDF)
            </a>
          </div>

          {/* Legal */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px", fontSize: "12px", color: "rgba(255,255,255,0.2)", lineHeight: 1.7 }}>
            <p style={{ marginBottom: "4px" }}>
              We are not affiliated with or endorsed by the U.S. government or the federal Medicare program. This is a demonstration application. Plan data is sourced from CMS public datasets.
            </p>
            <p>© 2026 MedicarePlan Finder. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
