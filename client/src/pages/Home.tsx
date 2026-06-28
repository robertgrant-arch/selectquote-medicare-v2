/**
 * Medicare Advantage Homepage — production redesign v8.
 *
 * ZIP validation / workflow / modal / routing: UNCHANGED.
 *
 * Section order:
 *   §1  Hero      — headline, subhead, ZIP CTA, trust microcopy, editorial right panel
 *   §2  Byline    — credentials + carriers, single unified strip
 *   §3  Why us    — editorial heading + asymmetric 3-benefit layout
 *   §4  Coverage  — sticky editorial anchor + clean vertical check items
 *   §5  Proof     — 500k display stat + editorial independence statement
 *   §6  CTA       — single dark closing section, h2 direct to ZIP
 */

import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { Phone, ChevronRight } from "lucide-react";
import GuidedWorkflowModal, { type MBIVerifyResult } from "@/components/GuidedWorkflowModal";
import { useZipValidation } from "@/features/zip-validation/lib/useZipValidation";
import CountySelector from "@/features/zip-validation/components/CountySelector";
import Header from "@/components/Header";
import { useQuoteHandoff } from "@/contexts/QuoteHandoffContext";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  ink:   "#0B1B24",
  dark:  "#1C3A48",
  teal:  "#237A92",
  tealL: "#2E96B0",
  body:  "#3E5560",
  sub:   "#7A9BA6",
  rule:  "#E2EAED",
  warm:  "#FAF9F5",
  night: "#0A1820",
  ftr:   "#060E14",
  err:   "#C0392B",
} as const;

// Lora: editorial serif with a beautiful italic. Authority without severity.
// DM Sans: clean DTC body copy, optically sized, pairs naturally with Lora.
const F = {
  serif: "'Lora', Georgia, 'Times New Roman', serif",
  sans:  "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

// ─── Page data ────────────────────────────────────────────────────────────────
const BENEFITS = [
  {
    label: "Independence",
    title: "Every plan in your county. Not a curated selection.",
    body: "As independent advisors, we compare every Medicare Advantage plan active in your area — across every carrier. No plan is filtered out. No carrier pays for preferred placement.",
  },
  {
    label: "Precision",
    title: "What you'll actually pay, calculated before you commit.",
    body: "We calculate your true annual drug cost for every plan: deductible, tier copays, and coverage gap included. The same math CMS uses — before you see a single result.",
  },
  {
    label: "Control",
    title: "Compare on your terms, at your own pace.",
    body: "You never have to speak with anyone to use this. Licensed advisors are available if you want them. If you'd rather decide independently, everything you need is here.",
  },
] as const;

const COVERAGE_CHECKS = [
  {
    label: "Provider directory",
    title: "Your doctors",
    body: "We cross-check every plan's provider directory before results appear. You'll know which plans keep your existing care team in-network — before you choose.",
    proof: "4,200+ providers checked in most counties",
  },
  {
    label: "Formulary check",
    title: "Your prescriptions",
    body: "Enter your medications and we calculate your estimated annual drug cost for every plan — including the deductible, tier copays, and the coverage gap.",
    proof: "Tier 1–4 with deductible and gap modelled",
  },
  {
    label: "Star ratings",
    title: "Plan quality",
    body: "Every plan shows its official CMS star rating alongside premiums and out-of-pocket costs. You see the full picture — not just the monthly premium.",
    proof: "CMS 1–5 star ratings on every result",
  },
] as const;

const CARRIERS = [
  "UnitedHealthcare", "Humana", "Aetna", "Cigna",
  "WellCare", "Blue Cross", "Devoted Health", "Clover Health",
] as const;

// ─── Scroll-reveal hook ───────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.dataset.v = "1"; return; }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.dataset.v = "1"; obs.unobserve(el); } },
      { threshold: 0.07, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

// ─── Home ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [zip, setZip]               = useState("");
  const [inputError, setInputError] = useState("");
  const zipValidation               = useZipValidation();
  const quoteHandoff                = useQuoteHandoff();
  const zipInputRef                 = useRef<HTMLInputElement>(null);
  const [showMBIModal, setShowMBIModal] = useState(false);
  const [pendingZip, setPendingZip]     = useState("");
  const [, navigate]                    = useLocation();

  const rBenefits    = useReveal();
  const rCoverage    = useReveal();
  const rCredibility = useReveal();
  const rCta         = useReveal();

  // ── Business logic (untouched) ───────────────────────────────────────────
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
    hasMA: boolean; verifyResult: MBIVerifyResult | null; doctors: any[]; drugs: any[];
  }) => {
    setShowMBIModal(false);
    // Store in-memory only — no sessionStorage, no PHI in browser storage.
    quoteHandoff.set(data);
    const p = new URLSearchParams({ zip: pendingZip });
    if (data.verifyResult) p.set("verified", "1");
    if (data.doctors.length > 0 || data.drugs.length > 0) p.set("personalized", "1");
    navigate(`/plans?${p.toString()}`);
  };

  // ── Shared style fragments ────────────────────────────────────────────────
  // Section labels: small-caps weight, muted, not brand-colored.
  // Used to orient — not to shout.
  const sectionLabel: React.CSSProperties = {
    fontFamily: F.sans, fontSize: "11px", fontWeight: 600,
    letterSpacing: "0.08em", textTransform: "uppercase" as const,
    color: T.sub, marginBottom: "22px",
  };

  return (
    <div id="hm" style={{ minHeight: "100vh", backgroundColor: "#fff", fontFamily: F.sans, color: T.body }}>

      <a href="#main" className="hm-skip" style={{
        position: "absolute", top: "-100%", left: "16px", zIndex: 9999,
        backgroundColor: T.dark, color: "#fff", fontFamily: F.sans,
        fontSize: "13px", fontWeight: 600, padding: "10px 20px",
        borderRadius: "0 0 6px 6px", textDecoration: "none",
      }}>
        Skip to main content
      </a>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap');

        #hm .hm-skip:focus { top: 0 !important; }

        #hm .rv {
          opacity: 0; transform: translateY(14px);
          transition: opacity 0.7s cubic-bezier(0.22,1,0.36,1),
                      transform 0.7s cubic-bezier(0.22,1,0.36,1);
        }
        #hm .rv[data-v="1"] { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) {
          #hm .rv { opacity: 1 !important; transform: none !important; transition: none !important; }
        }

        #hm .zip-in:focus {
          border-color: ${T.teal} !important;
          box-shadow: 0 0 0 3px rgba(35,122,146,0.12) !important;
          outline: none;
        }
        #hm .zip-dk:focus {
          border-color: rgba(255,255,255,0.5) !important;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.08) !important;
          outline: none;
        }
        #hm .btn-primary { transition: background-color 0.14s; }
        #hm .btn-primary:hover { background-color: #112333 !important; }
        #hm .btn-primary:focus-visible { outline: 2px solid ${T.teal}; outline-offset: 2px; }
        #hm .btn-teal { transition: background-color 0.14s; }
        #hm .btn-teal:hover { background-color: ${T.tealL} !important; }
        #hm .btn-teal:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
        #hm .text-link:hover  { color: ${T.tealL} !important; }
        #hm .footer-link:hover { color: rgba(255,255,255,0.7) !important; }
        #hm .phone-link:hover  { color: rgba(235,245,248,0.75) !important; }

        @media (max-width: 1023px) {
          #hm .hero-g    { grid-template-columns: 1fr !important; }
          #hm .hero-r    { display: none !important; }
          #hm .ben-g     { grid-template-columns: 1fr !important; }
          #hm .ben-lead  {
            border-right: none !important; padding-right: 0 !important;
            border-bottom: 1px solid ${T.rule} !important; padding-bottom: 52px !important;
          }
          #hm .ben-rest  { padding-left: 0 !important; padding-top: 52px !important; }
          #hm .cov-g     { grid-template-columns: 1fr !important; gap: 64px !important; }
          #hm .cov-anchor { position: static !important; }
          #hm .cred-g    { grid-template-columns: 1fr !important; gap: 64px !important; }
          #hm .footer-g  { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 639px) {
          #hm .byline-g  { flex-direction: column !important; gap: 14px !important; }
          #hm .footer-g  { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {showMBIModal && (
        <GuidedWorkflowModal zip={pendingZip} onSkip={handleMBISkip} onComplete={handleWorkflowComplete} />
      )}

      <Header />

      <main id="main">

        {/* ── §1 HERO ───────────────────────────────────────────────────── */}
        <section
          aria-label="Find your Medicare Advantage plan"
          style={{
            minHeight: "calc(100vh - 72px)",
            display: "flex", alignItems: "center",
            backgroundColor: "#fff",
          }}
        >
          <div style={{ width: "100%", maxWidth: "1200px", margin: "0 auto", padding: "96px 40px" }}>
            <div
              className="hero-g"
              style={{ display: "grid", gridTemplateColumns: "55fr 45fr", gap: "120px", alignItems: "center" }}
            >

              {/* Left — CTA column */}
              <div>
                <h1 style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(52px, 6.5vw, 88px)",
                  fontWeight: 600, lineHeight: 1.06,
                  letterSpacing: "-0.025em",
                  color: T.ink, marginBottom: "28px",
                }}>
                  Medicare Advantage,<br />
                  <em style={{ color: T.teal, fontStyle: "italic", fontWeight: 500 }}>made clear.</em>
                </h1>

                <p style={{
                  fontFamily: F.sans, fontSize: "19px",
                  lineHeight: 1.75, color: T.body,
                  maxWidth: "38ch", marginBottom: "52px",
                }}>
                  Compare every plan in your county — matched to your doctors, prescriptions, and budget. Free. No account. No pressure.
                </p>

                {/* ZIP CTA */}
                <div style={{ maxWidth: "440px" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      id="zip-hero"
                      ref={zipInputRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="Enter your ZIP code"
                      value={zip}
                      onChange={e => { setZip(e.target.value.replace(/\D/g, "")); setInputError(""); }}
                      onKeyDown={handleKeyDown}
                      aria-label="ZIP code"
                      aria-describedby="zip-err"
                      aria-invalid={!!inputError}
                      className="zip-in"
                      style={{
                        flex: 1, fontFamily: F.sans,
                        padding: "17px 20px", fontSize: "17px", fontWeight: 500,
                        color: T.ink, backgroundColor: "#fff",
                        border: `1.5px solid ${inputError ? T.err : "#D4DDE1"}`,
                        borderRadius: "6px", outline: "none",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSearch}
                      className="btn-primary"
                      style={{
                        fontFamily: F.sans, padding: "17px 26px",
                        backgroundColor: T.dark, color: "#fff",
                        fontWeight: 600, fontSize: "15px",
                        borderRadius: "6px", border: "none",
                        cursor: "pointer", flexShrink: 0,
                        display: "flex", alignItems: "center", gap: "8px",
                        letterSpacing: "0.005em", whiteSpace: "nowrap",
                      }}
                    >
                      See my plans
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  </div>

                  <p
                    id="zip-err"
                    role="alert" aria-live="assertive" aria-atomic="true"
                    style={{
                      fontFamily: F.sans, fontSize: "13px", color: T.err,
                      minHeight: "20px", marginTop: "8px",
                      display: "flex", alignItems: "center", gap: "5px",
                    }}
                  >
                    {inputError && <><span aria-hidden="true">⚠</span>{inputError}</>}
                  </p>

                  {zipValidation.result.status === "needs_county_selection" && zipValidation.result.counties && (
                    <CountySelector
                      zip={zip}
                      counties={zipValidation.result.counties}
                      onSelect={county => {
                        const r = zipValidation.selectCounty(county);
                        if (r.status === "valid") { setInputError(""); setPendingZip(zip.trim()); setShowMBIModal(true); }
                      }}
                    />
                  )}

                  <p style={{
                    fontFamily: F.sans, fontSize: "13px",
                    color: T.sub, marginTop: "16px", lineHeight: 1.5,
                  }}>
                    Always free · No account required · No sales calls unless you ask
                  </p>
                </div>
              </div>

              {/* Right — editorial proof statement */}
              <div className="hero-r" style={{ display: "flex", alignItems: "flex-start" }}>
                <div style={{ borderLeft: `2px solid ${T.teal}`, paddingLeft: "44px" }}>
                  <p style={{
                    fontFamily: F.serif,
                    fontSize: "clamp(28px, 3vw, 44px)",
                    fontWeight: 400, lineHeight: 1.26,
                    letterSpacing: "-0.015em",
                    color: T.ink, marginBottom: "40px",
                  }}>
                    Every plan.<br />
                    Every doctor.<br />
                    Every prescription.<br />
                    <em style={{ color: T.teal, fontStyle: "italic" }}>Checked first.</em>
                  </p>
                  <p style={{
                    fontFamily: F.sans, fontSize: "14px",
                    color: T.body, lineHeight: 1.75,
                    maxWidth: "32ch",
                    paddingTop: "28px",
                    borderTop: `1px solid ${T.rule}`,
                  }}>
                    All carriers. Nothing filtered or ranked for commercial reasons. Plan data from CMS.gov — the same source Medicare uses.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── §2 BYLINE STRIP ──────────────────────────────────────────── */}
        <div
          aria-label="Service credentials and plan carriers"
          style={{
            backgroundColor: T.warm,
            borderTop: `1px solid ${T.rule}`,
            borderBottom: `1px solid ${T.rule}`,
          }}
        >
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 40px" }}>
            <div
              className="byline-g"
              style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap", rowGap: "14px",
                padding: "18px 0",
              }}
            >
              {/* Credential facts — left */}
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: "8px" }}>
                {([
                  "Licensed independent agents",
                  "Plan data from CMS.gov",
                  "Free — always",
                  "Doctors & Rx verified",
                ] as const).map((claim, i) => (
                  <span key={claim} style={{ display: "inline-flex", alignItems: "center" }}>
                    {i > 0 && (
                      <span aria-hidden="true" style={{
                        display: "inline-block", width: "1px", height: "12px",
                        backgroundColor: "#C5D2D8", margin: "0 20px", flexShrink: 0,
                      }} />
                    )}
                    <span style={{
                      fontFamily: F.sans, fontSize: "12px", fontWeight: 500,
                      color: T.body, whiteSpace: "nowrap",
                    }}>
                      {claim}
                    </span>
                  </span>
                ))}
              </div>

              {/* Carrier names — right */}
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: "8px" }}>
                <span style={{
                  fontFamily: F.sans, fontSize: "11px", fontWeight: 500,
                  color: T.sub, marginRight: "16px", whiteSpace: "nowrap",
                  letterSpacing: "0.02em",
                }}>
                  Plans from
                </span>
                {CARRIERS.map((name, i) => (
                  <span key={name} style={{ display: "inline-flex", alignItems: "center" }}>
                    {i > 0 && (
                      <span aria-hidden="true" style={{
                        display: "inline-block", width: "3px", height: "3px",
                        borderRadius: "50%", backgroundColor: "#C5D2D8",
                        margin: "0 12px", flexShrink: 0,
                      }} />
                    )}
                    <span style={{
                      fontFamily: F.sans, fontSize: "12px", fontWeight: 500,
                      color: T.sub, whiteSpace: "nowrap",
                    }}>
                      {name}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── §3 WHY PEOPLE USE US ──────────────────────────────────────── */}
        <section
          id="why-us"
          aria-labelledby="why-h"
          style={{ backgroundColor: "#fff", padding: "180px 0" }}
        >
          <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>

            <div style={{ maxWidth: "600px", marginBottom: "96px" }}>
              <p style={sectionLabel}>Why people choose us</p>
              <h2
                id="why-h"
                style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(28px, 3.4vw, 44px)",
                  fontWeight: 500, lineHeight: 1.16,
                  letterSpacing: "-0.018em",
                  color: T.ink, margin: 0,
                }}
              >
                Built for an important decision —
                <em style={{ fontStyle: "italic", fontWeight: 400 }}>{" "}not for speed.</em>
              </h2>
            </div>

            <div
              ref={rBenefits}
              className="rv ben-g"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", alignItems: "start" }}
            >
              {/* Lead benefit */}
              <div className="ben-lead" style={{ paddingRight: "80px", borderRight: `1px solid ${T.rule}` }}>
                <h3 style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(24px, 2.8vw, 34px)",
                  fontWeight: 500, lineHeight: 1.22,
                  letterSpacing: "-0.014em",
                  color: T.ink, marginBottom: "20px",
                }}>
                  {BENEFITS[0].title}
                </h3>
                <p style={{ fontFamily: F.sans, fontSize: "17px", lineHeight: 1.82, color: T.body }}>
                  {BENEFITS[0].body}
                </p>
              </div>

              {/* Supporting pair */}
              <div className="ben-rest" style={{ paddingLeft: "80px" }}>
                {([BENEFITS[1], BENEFITS[2]] as const).map((b, i) => (
                  <div
                    key={b.label}
                    style={{
                      paddingTop:    i > 0 ? "48px" : "0",
                      paddingBottom: i < 1 ? "48px" : "0",
                      borderBottom:  i < 1 ? `1px solid ${T.rule}` : "none",
                    }}
                  >
                    <h3 style={{
                      fontFamily: F.serif,
                      fontSize: "clamp(19px, 1.9vw, 23px)",
                      fontWeight: 500, lineHeight: 1.28,
                      letterSpacing: "-0.01em",
                      color: T.ink, marginBottom: "12px",
                    }}>
                      {b.title}
                    </h3>
                    <p style={{ fontFamily: F.sans, fontSize: "15px", lineHeight: 1.78, color: T.body }}>
                      {b.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* ── §4 COVERAGE VERIFICATION ──────────────────────────────────── */}
        <section
          id="coverage"
          aria-labelledby="cov-h"
          style={{ backgroundColor: T.warm, padding: "180px 0" }}
        >
          <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
            <div
              className="cov-g"
              style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gap: "112px", alignItems: "start" }}
            >
              {/* Sticky editorial anchor */}
              <div className="cov-anchor" style={{ position: "sticky", top: "56px" }}>
                <p style={sectionLabel}>Coverage verification</p>
                <h2
                  id="cov-h"
                  style={{
                    fontFamily: F.serif,
                    fontSize: "clamp(24px, 2.8vw, 36px)",
                    fontWeight: 500, lineHeight: 1.22,
                    letterSpacing: "-0.012em",
                    color: T.ink, marginBottom: "24px",
                  }}
                >
                  The two things people overlook — and that we check first.
                </h2>
                <p style={{
                  fontFamily: F.sans, fontSize: "16px",
                  lineHeight: 1.82, color: T.body, marginBottom: "36px",
                }}>
                  Switching Medicare plans and losing your doctor, or discovering your prescriptions cost three times as much — these are the most common and most avoidable mistakes. We verify both before you see a single result.
                </p>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => navigate(`/plans?zip=${zip || "64106"}`)}
                  style={{
                    fontFamily: F.sans, fontSize: "14px", fontWeight: 600,
                    color: T.dark, background: "none", border: "none",
                    padding: "0", cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    textDecoration: "underline",
                    textDecorationColor: T.rule,
                    textUnderlineOffset: "3px",
                    transition: "color 0.12s",
                  }}
                >
                  Compare plans with doctors & Rx
                  <ChevronRight size={13} aria-hidden="true" />
                </button>
              </div>

              {/* Vertical check items — no nested grid, no mini-labels */}
              <div ref={rCoverage} className="rv">
                {COVERAGE_CHECKS.map((c, i) => (
                  <div
                    key={c.label}
                    style={{
                      paddingTop:    i > 0 ? "52px" : "0",
                      paddingBottom: i < 2 ? "52px" : "0",
                      borderBottom:  i < 2 ? `1px solid ${T.rule}` : "none",
                    }}
                  >
                    <h3 style={{
                      fontFamily: F.serif,
                      fontSize: "clamp(20px, 2vw, 26px)",
                      fontWeight: 500, lineHeight: 1.22,
                      letterSpacing: "-0.012em",
                      color: T.ink, marginBottom: "14px",
                    }}>
                      {c.title}
                    </h3>
                    <p style={{
                      fontFamily: F.sans, fontSize: "16px",
                      lineHeight: 1.78, color: T.body, marginBottom: "12px",
                    }}>
                      {c.body}
                    </p>
                    <p style={{
                      fontFamily: F.sans, fontSize: "12px",
                      color: T.sub, letterSpacing: "0.01em",
                    }}>
                      {c.proof}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── §5 PROOF ──────────────────────────────────────────────────── */}
        <section
          id="credibility"
          aria-label="Since 2010, we've helped more than 500,000 seniors find better Medicare coverage."
          style={{ backgroundColor: "#fff", padding: "200px 0" }}
        >
          <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
            <div
              ref={rCredibility}
              className="rv cred-g"
              style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gap: "120px", alignItems: "center" }}
            >
              {/* Display stat */}
              <div>
                <p
                  aria-hidden="true"
                  style={{
                    fontFamily: F.serif,
                    fontSize: "clamp(72px, 11vw, 144px)",
                    fontWeight: 600, lineHeight: 0.88,
                    letterSpacing: "-0.04em",
                    color: T.ink, margin: "0 0 28px",
                  }}
                >
                  500,000
                </p>
                <p style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(17px, 1.8vw, 22px)",
                  fontWeight: 400, lineHeight: 1.5,
                  color: T.body, margin: 0,
                }}>
                  seniors helped find better Medicare coverage since 2010.
                </p>
              </div>

              {/* Editorial independence statement */}
              <div>
                <p style={{
                  fontFamily: F.sans, fontSize: "18px",
                  lineHeight: 1.82, color: T.body, marginBottom: "28px",
                }}>
                  No carrier pays us for referrals. No plan is hidden or ranked for commercial reasons. Every comparison is built on data published by CMS.gov — the same official source Medicare uses — with your doctors and prescriptions verified before results appear.
                </p>
                <p style={{
                  fontFamily: F.sans, fontSize: "12px",
                  color: T.sub, lineHeight: 1.65,
                  paddingTop: "20px",
                  borderTop: `1px solid ${T.rule}`,
                }}>
                  Not affiliated with or endorsed by any insurance carrier or the federal Medicare program.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── §6 FINAL CTA ──────────────────────────────────────────────── */}
        <section
          id="start"
          aria-labelledby="cta-h"
          style={{ backgroundColor: T.night, padding: "180px 0" }}
        >
          <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
            <div ref={rCta} className="rv" style={{ maxWidth: "640px" }}>
              <h2
                id="cta-h"
                style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(32px, 4.8vw, 64px)",
                  fontWeight: 500, lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: "#fff", marginBottom: "52px",
                }}
              >
                The plan you choose today shapes who can care for you next year.
              </h2>

              <div style={{ display: "flex", gap: "8px", maxWidth: "420px", marginBottom: "20px" }}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="Enter ZIP code"
                  value={zip}
                  onChange={e => setZip(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={handleKeyDown}
                  aria-label="ZIP code for plan comparison"
                  className="zip-dk"
                  style={{
                    flex: 1, fontFamily: F.sans,
                    padding: "16px 20px", fontSize: "16px", fontWeight: 500,
                    color: T.ink, backgroundColor: "#fff",
                    border: "1.5px solid transparent",
                    borderRadius: "6px", outline: "none",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                />
                <button
                  type="button"
                  className="btn-teal"
                  onClick={handleSearch}
                  style={{
                    fontFamily: F.sans, padding: "16px 24px",
                    backgroundColor: T.teal, color: "#fff",
                    fontWeight: 600, fontSize: "14px",
                    borderRadius: "6px", border: "none",
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
                color: "rgba(235,245,248,0.35)",
                display: "flex", alignItems: "center", gap: "8px",
              }}>
                <Phone size={12} aria-hidden="true" />
                <span>
                  Or call{" "}
                  <a
                    href="tel:1-800-555-0100"
                    className="phone-link"
                    style={{ color: "rgba(235,245,248,0.5)", fontWeight: 500, textDecoration: "none", transition: "color 0.12s" }}
                  >
                    1-800-555-0100
                  </a>
                  {" "}— a licensed advisor, no script, no pressure
                </span>
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer aria-label="Site footer" style={{ backgroundColor: T.ftr, fontFamily: F.sans, padding: "80px 0 52px" }}>
        <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
          <div
            className="footer-g"
            style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: "48px", marginBottom: "64px" }}
          >
            {/* Brand */}
            <div>
              <div style={{ marginBottom: "24px" }}>
                <div style={{
                  fontFamily: F.serif, fontSize: "20px", fontWeight: 400,
                  color: "#fff", letterSpacing: "-0.01em", lineHeight: 1,
                }}>
                  MedicarePlan
                </div>
                <div style={{
                  fontFamily: F.sans, fontSize: "10px", fontWeight: 600,
                  color: "rgba(255,255,255,0.22)", letterSpacing: "0.1em",
                  textTransform: "uppercase", marginTop: "5px",
                }}>
                  Finder
                </div>
              </div>
              <p style={{
                fontFamily: F.sans, fontSize: "13px",
                lineHeight: 1.75, color: "rgba(255,255,255,0.3)",
                maxWidth: "26ch",
              }}>
                Helping Americans find better Medicare Advantage plans since 2010. Licensed in all 50 states.
              </p>
            </div>

            {/* Nav columns */}
            {[
              { title: "Plans", links: [
                { label: "Medicare Advantage", href: "/medicare-advantage/hmo-plans" },
                { label: "Medicare Supplement", href: "/medicare-supplement/compare" },
                { label: "Part D Drug Plans",   href: "/part-d/compare" },
                { label: "Dual Eligible",        href: "/dual-eligible" },
              ]},
              { title: "Resources", links: [
                { label: "Medicare 101",        href: "/resources/medicare-101" },
                { label: "Enrollment Periods",  href: "/resources/enrollment-periods" },
                { label: "Star Ratings Guide",  href: "/resources/star-ratings" },
                { label: "Compare Plans",       href: `/plans?zip=${zip || "64106"}` },
              ]},
              { title: "Company", links: [
                { label: "About Us",      href: "/about" },
                { label: "Licensed Agents", href: "/agents" },
                { label: "Contact",       href: "/contact" },
                { label: "Privacy Policy", href: "/privacy" },
              ]},
            ].map(col => (
              <nav key={col.title} aria-label={`${col.title} links`}>
                <div style={{
                  fontFamily: F.sans, fontSize: "11px", fontWeight: 600,
                  letterSpacing: "0.08em", textTransform: "uppercase" as const,
                  color: "rgba(255,255,255,0.25)", marginBottom: "20px",
                }}>
                  {col.title}
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                  {col.links.map(link => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="footer-link"
                        style={{
                          fontFamily: F.sans, fontSize: "13px",
                          color: "rgba(255,255,255,0.32)",
                          textDecoration: "none", transition: "color 0.14s",
                        }}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "24px",
            fontFamily: F.sans, fontSize: "12px",
            color: "rgba(255,255,255,0.17)", lineHeight: 1.72,
          }}>
            <p style={{ marginBottom: "4px" }}>
              Not affiliated with or endorsed by the U.S. government or the federal Medicare program. This is a demonstration application. Plan data sourced from CMS public datasets.
            </p>
            <p>© 2026 MedicarePlan Finder. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
