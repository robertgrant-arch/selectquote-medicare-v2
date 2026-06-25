/**
 * Medicare Advantage Homepage — IA restructure v4.
 *
 * ZIP validation / workflow / modal / routing: UNCHANGED.
 *
 * Section order:
 *   §1  Hero         — headline, subhead, ZIP CTA, trust line, inline 3-step
 *   §2  Trust strip  — licensed status, CMS data, carriers, no-cost
 *   §3  Why us       — 3 benefit blocks, asymmetric, no icon cards
 *   §4  Coverage     — doctor + drug + quality verification, premium layout
 *   §5  Credibility  — 500k stat, independence, market coverage, unified
 *   §6  CTA          — single strong dark closing section
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

const F = {
  serif: "'DM Serif Display', Georgia, 'Times New Roman', serif",
  sans:  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
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

// ─── SVG Illustration ─────────────────────────────────────────────────────────
function PlanIllustration() {
  return (
    <svg
      viewBox="0 0 480 520"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ width: "100%", maxWidth: "400px", height: "auto", display: "block" }}
    >
      <ellipse cx="240" cy="280" rx="200" ry="210" fill="#EBF3F6" fillOpacity="0.5" />
      <g transform="rotate(10 240 300)">
        <rect x="115" y="110" width="210" height="280" rx="14" fill="#D6E8EE" />
      </g>
      <g transform="rotate(-7 240 300)">
        <rect x="120" y="115" width="210" height="280" rx="14" fill="#C8DDE6" />
      </g>
      <rect x="110" y="95" width="228" height="296" rx="16" fill="white"
        style={{ filter: "drop-shadow(0 8px 32px rgba(11,27,36,0.09)) drop-shadow(0 2px 6px rgba(11,27,36,0.05))" }}
      />
      <rect x="110" y="95" width="228" height="5" rx="2.5" fill="#237A92" fillOpacity="0.65" />
      <rect x="134" y="122" width="52" height="6" rx="3" fill="#237A92" fillOpacity="0.18" />
      <rect x="194" y="122" width="80" height="6" rx="3" fill="#0B1B24" fillOpacity="0.09" />
      <line x1="134" y1="145" x2="314" y2="145" stroke={T.rule} strokeWidth="1" />
      <rect x="134" y="162" width="32" height="32" rx="8" fill="#EAF3F6" />
      <rect x="178" y="168" width="78" height="5" rx="2.5" fill="#0B1B24" fillOpacity="0.11" />
      <rect x="178" y="179" width="52" height="4" rx="2" fill="#0B1B24" fillOpacity="0.07" />
      <rect x="284" y="165" width="30" height="10" rx="3" fill="#0B1B24" fillOpacity="0.08" />
      <rect x="124" y="207" width="248" height="50" rx="10" fill="#237A92" fillOpacity="0.08" />
      <rect x="138" y="217" width="32" height="32" rx="8" fill="#237A92" fillOpacity="0.22" />
      <rect x="182" y="223" width="78" height="5" rx="2.5" fill="#0B1B24" fillOpacity="0.22" />
      <rect x="182" y="234" width="52" height="4" rx="2" fill="#237A92" fillOpacity="0.4" />
      <rect x="288" y="220" width="30" height="10" rx="3" fill="#237A92" fillOpacity="0.55" />
      <rect x="134" y="272" width="32" height="32" rx="8" fill="#EAF3F6" />
      <rect x="178" y="278" width="78" height="5" rx="2.5" fill="#0B1B24" fillOpacity="0.11" />
      <rect x="178" y="289" width="52" height="4" rx="2" fill="#0B1B24" fillOpacity="0.07" />
      <rect x="284" y="275" width="30" height="10" rx="3" fill="#0B1B24" fillOpacity="0.08" />
      <rect x="110" y="366" width="228" height="25" rx="0" fill="#F3F7F9" />
      <rect x="134" y="375" width="96" height="4" rx="2" fill="#0B1B24" fillOpacity="0.1" />
      <circle cx="340" cy="120" r="26" fill="#237A92" />
      <path d="M330 120 L337.5 127.5 L352 113" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Reveal ───────────────────────────────────────────────────────────────────
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
  const [zip, setZip] = useState("");
  const [inputError, setInputError] = useState("");
  const zipValidation = useZipValidation();
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [showMBIModal, setShowMBIModal] = useState(false);
  const [pendingZip, setPendingZip] = useState("");
  const [, navigate] = useLocation();

  const rBenefits  = useReveal();
  const rCoverage  = useReveal();
  const rCredibility = useReveal();
  const rCta       = useReveal();

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
    try {
      if (data.verifyResult) sessionStorage.setItem("mbi_eligibility", JSON.stringify(data.verifyResult));
      sessionStorage.setItem("workflow_data", JSON.stringify(data));
    } catch {}
    const p = new URLSearchParams({ zip: pendingZip });
    if (data.verifyResult) p.set("verified", "1");
    if (data.doctors.length > 0 || data.drugs.length > 0) p.set("personalized", "1");
    navigate(`/plans?${p.toString()}`);
  };

  // ── Shared style fragments ────────────────────────────────────────────────
  const overline: React.CSSProperties = {
    fontFamily: F.sans, fontSize: "12px", fontWeight: 600,
    letterSpacing: "0.1em", textTransform: "uppercase" as const,
    color: T.teal, marginBottom: "20px",
  };

  return (
    <div id="hm" style={{ minHeight: "100vh", backgroundColor: "#fff", fontFamily: F.sans, color: T.body }}>

      <a href="#main" className="hm-skip" style={{
        position: "absolute", top: "-100%", left: "16px", zIndex: 9999,
        backgroundColor: T.dark, color: "#fff", fontFamily: F.sans,
        fontSize: "13px", fontWeight: 600, padding: "10px 20px",
        borderRadius: "0 0 8px 8px", textDecoration: "none",
      }}>
        Skip to main content
      </a>

      <style>{`
        #hm .hm-skip:focus { top: 0 !important; }
        #hm .rv {
          opacity: 0; transform: translateY(18px);
          transition: opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1);
        }
        #hm .rv[data-v="1"] { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) {
          #hm .rv { opacity: 1 !important; transform: none !important; transition: none !important; }
        }
        #hm .zip-in:focus  { border-color: ${T.teal} !important; box-shadow: 0 0 0 3px rgba(35,122,146,0.14) !important; outline: none; }
        #hm .zip-dk:focus  { border-color: rgba(255,255,255,0.4) !important; box-shadow: 0 0 0 3px rgba(255,255,255,0.07) !important; outline: none; }
        #hm .btn-p         { transition: background-color 0.14s; }
        #hm .btn-p:hover   { background-color: #112333 !important; }
        #hm .btn-t:hover   { background-color: ${T.tealL} !important; }
        #hm .lnk:hover     { color: ${T.tealL} !important; }
        #hm .flnk:hover    { color: rgba(255,255,255,0.72) !important; }
        #hm .plnk:hover    { color: rgba(235,245,248,0.8) !important; }
        @media (max-width: 1023px) {
          #hm .hero-g    { grid-template-columns: 1fr !important; }
          #hm .illus     { display: none !important; }
          #hm .ben-g     { grid-template-columns: 1fr !important; gap: 0 !important; }
          #hm .ben-g > * { border-left: none !important; padding-left: 0 !important; padding-top: 36px !important; border-top: 1px solid ${T.rule} !important; }
          #hm .ben-g > *:first-child { padding-top: 0 !important; border-top: none !important; }
          #hm .cov-g     { grid-template-columns: 1fr !important; gap: 48px !important; }
          #hm .cred-g    { grid-template-columns: 1fr !important; gap: 56px !important; }
          #hm .footer-g  { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 639px) {
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
          <div style={{ width: "100%", maxWidth: "1160px", margin: "0 auto", padding: "80px 40px" }}>
            <div
              className="hero-g"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "80px", alignItems: "center" }}
            >
              {/* Left — content */}
              <div>
                <p style={overline}>Independent advisors · Licensed in all 50 states</p>

                <h1 style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(48px, 6.5vw, 88px)",
                  fontWeight: 400, lineHeight: 1.04,
                  letterSpacing: "-0.025em",
                  color: T.ink, marginBottom: "24px",
                }}>
                  Medicare<br />
                  Advantage,<br />
                  <em style={{ color: T.teal, fontStyle: "italic" }}>on your terms.</em>
                </h1>

                <p style={{
                  fontFamily: F.sans, fontSize: "18px",
                  lineHeight: 1.78, color: T.body,
                  maxWidth: "40ch", marginBottom: "48px",
                }}>
                  Compare every plan in your county — matched to your doctors, your prescriptions, and your budget. Free, no account required.
                </p>

                {/* ZIP input */}
                <div style={{ maxWidth: "440px", marginBottom: "28px" }}>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
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
                        padding: "17px 22px", fontSize: "17px", fontWeight: 500,
                        color: T.ink, backgroundColor: "#fff",
                        border: `1.5px solid ${inputError ? T.err : T.rule}`,
                        borderRadius: "10px", outline: "none",
                        boxShadow: "0 1px 4px rgba(11,27,36,0.06)",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSearch}
                      className="btn-p"
                      style={{
                        fontFamily: F.sans, padding: "17px 26px",
                        backgroundColor: T.dark, color: "#fff",
                        fontWeight: 600, fontSize: "15px",
                        borderRadius: "10px", border: "none",
                        cursor: "pointer", flexShrink: 0,
                        display: "flex", alignItems: "center", gap: "8px",
                        letterSpacing: "0.01em", whiteSpace: "nowrap",
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
                      minHeight: "18px", display: "flex", alignItems: "center", gap: "5px",
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

                  <p style={{ fontFamily: F.sans, fontSize: "13px", color: T.sub, marginTop: "14px" }}>
                    Always free · No account required · No sales calls unless you ask
                  </p>
                </div>

                {/* Inline 3-step process */}
                <div
                  aria-label="How it works in three steps"
                  style={{
                    display: "flex", alignItems: "center", gap: "0",
                    paddingTop: "24px", borderTop: `1px solid ${T.rule}`,
                  }}
                >
                  {[
                    { n: "1", label: "Enter ZIP" },
                    { n: "2", label: "Add doctors & Rx" },
                    { n: "3", label: "Compare plans" },
                  ].map((s, i) => (
                    <div key={s.n} style={{ display: "flex", alignItems: "center" }}>
                      {i > 0 && (
                        <span aria-hidden="true" style={{ color: T.rule, margin: "0 14px", fontSize: "14px" }}>→</span>
                      )}
                      <span style={{ fontFamily: F.sans, fontSize: "13px", color: T.sub }}>
                        <span style={{ fontWeight: 600, color: T.teal, marginRight: "6px" }}>{s.n}.</span>
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — illustration */}
              <div className="illus" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                <PlanIllustration />
              </div>
            </div>
          </div>
        </section>

        {/* ── §2 TRUST STRIP ────────────────────────────────────────────── */}
        <div
          aria-label="Service credentials"
          style={{ backgroundColor: T.warm, borderTop: `1px solid ${T.rule}` }}
        >
          <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
            {/* Credential pillars */}
            <div style={{
              display: "flex", alignItems: "center",
              flexWrap: "wrap", gap: "0", rowGap: "10px",
              padding: "18px 0",
            }}>
              {[
                "Licensed agents in all 50 states",
                "Plan data directly from CMS.gov",
                "No cost to you — ever",
                "Doctors & Rx verified before results",
              ].map((item, i) => (
                <div key={item} style={{ display: "flex", alignItems: "center" }}>
                  {i > 0 && (
                    <span aria-hidden="true" style={{
                      display: "inline-block", width: "1px", height: "12px",
                      backgroundColor: T.rule, margin: "0 22px", flexShrink: 0,
                    }} />
                  )}
                  <span style={{ fontFamily: F.sans, fontSize: "13px", color: T.body, whiteSpace: "nowrap" }}>
                    {item}
                  </span>
                </div>
              ))}
            </div>
            {/* Carriers */}
            <div style={{
              display: "flex", alignItems: "center", flexWrap: "wrap",
              gap: "0", rowGap: "8px",
              padding: "14px 0",
              borderTop: `1px solid ${T.rule}`,
            }}>
              <span style={{
                fontFamily: F.sans, fontSize: "11px", fontWeight: 600,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: T.sub, marginRight: "18px", whiteSpace: "nowrap",
              }}>
                Plans from
              </span>
              {CARRIERS.map((name, i) => (
                <span key={name} style={{ display: "flex", alignItems: "center" }}>
                  {i > 0 && <span aria-hidden="true" style={{ color: T.rule, margin: "0 14px" }}>·</span>}
                  <span style={{ fontFamily: F.sans, fontSize: "13px", fontWeight: 500, color: T.sub }}>{name}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── §3 WHY PEOPLE USE US ──────────────────────────────────────── */}
        <section
          id="why-us"
          aria-labelledby="why-h"
          style={{ backgroundColor: "#fff", padding: "160px 0" }}
        >
          <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
            <div style={{ marginBottom: "80px" }}>
              <p style={overline}>Why people use us</p>
              <h2
                id="why-h"
                style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(28px, 3.8vw, 48px)",
                  fontWeight: 400, lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: T.ink, maxWidth: "640px",
                }}
              >
                Built for an important decision —
                <em style={{ fontStyle: "italic", color: T.teal }}>{" "}not for speed.</em>
              </h2>
            </div>

            <div
              ref={rBenefits}
              className="rv ben-g"
              style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0" }}
            >
              {BENEFITS.map((b, i) => (
                <div
                  key={b.label}
                  style={{
                    paddingLeft: i > 0 ? "56px" : "0",
                    paddingRight: i < 2 ? "56px" : "0",
                    borderLeft: i > 0 ? `1px solid ${T.rule}` : "none",
                  }}
                >
                  <p style={{
                    fontFamily: F.sans, fontSize: "11px", fontWeight: 600,
                    letterSpacing: "0.09em", textTransform: "uppercase",
                    color: T.teal, marginBottom: "20px",
                  }}>
                    {b.label}
                  </p>
                  <div style={{ width: "24px", height: "2px", backgroundColor: T.teal, marginBottom: "22px", borderRadius: "1px" }} />
                  <h3 style={{
                    fontFamily: F.serif,
                    fontSize: "clamp(19px, 1.7vw, 22px)",
                    fontWeight: 400, lineHeight: 1.28,
                    letterSpacing: "-0.015em",
                    color: T.ink, marginBottom: "16px",
                  }}>
                    {b.title}
                  </h3>
                  <p style={{ fontFamily: F.sans, fontSize: "15px", lineHeight: 1.8, color: T.body }}>
                    {b.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── §4 DOCTOR & DRUG COVERAGE ─────────────────────────────────── */}
        <section
          id="coverage"
          aria-labelledby="cov-h"
          style={{ backgroundColor: T.warm, padding: "160px 0" }}
        >
          <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
            <div
              className="cov-g"
              style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: "100px", alignItems: "start" }}
            >
              {/* Left — editorial anchor */}
              <div style={{ position: "sticky", top: "48px" }}>
                <p style={overline}>Coverage verification</p>
                <h2
                  id="cov-h"
                  style={{
                    fontFamily: F.serif,
                    fontSize: "clamp(26px, 3vw, 38px)",
                    fontWeight: 400, lineHeight: 1.18,
                    letterSpacing: "-0.015em",
                    color: T.ink, marginBottom: "20px",
                  }}
                >
                  The two things people overlook — and that we check first.
                </h2>
                <p style={{
                  fontFamily: F.sans, fontSize: "16px",
                  lineHeight: 1.78, color: T.body, marginBottom: "32px",
                }}>
                  Switching Medicare plans and losing your doctor, or discovering your prescription costs tripled — these are the most common and most avoidable Medicare mistakes. We verify both before you see a single result.
                </p>
                <button
                  type="button"
                  className="lnk"
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

              {/* Right — 3 verification items */}
              <div ref={rCoverage} className="rv">
                {COVERAGE_CHECKS.map((c, i) => (
                  <div
                    key={c.label}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "160px 1fr",
                      gap: "32px",
                      paddingTop: i > 0 ? "44px" : "0",
                      paddingBottom: i < 2 ? "44px" : "0",
                      borderBottom: i < 2 ? `1px solid ${T.rule}` : "none",
                    }}
                  >
                    <div style={{ paddingTop: "3px" }}>
                      <p style={{
                        fontFamily: F.sans, fontSize: "11px", fontWeight: 600,
                        letterSpacing: "0.08em", textTransform: "uppercase",
                        color: T.sub, marginBottom: "8px",
                      }}>
                        {c.label}
                      </p>
                      <p style={{
                        fontFamily: F.serif,
                        fontSize: "22px", fontWeight: 400,
                        letterSpacing: "-0.01em", lineHeight: 1.2,
                        color: T.teal,
                      }}>
                        {c.title}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontFamily: F.sans, fontSize: "15px", lineHeight: 1.78, color: T.body, marginBottom: "10px" }}>
                        {c.body}
                      </p>
                      <p style={{ fontFamily: F.sans, fontSize: "12px", color: T.sub }}>
                        {c.proof}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── §5 CREDIBILITY ────────────────────────────────────────────── */}
        <section
          id="credibility"
          aria-labelledby="cred-h"
          style={{ backgroundColor: "#fff", padding: "160px 0" }}
        >
          <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
            <div
              ref={rCredibility}
              className="rv cred-g"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "100px", alignItems: "center" }}
            >
              {/* Left — proof stat */}
              <div aria-label="Since 2010, we've helped more than 500,000 seniors find better Medicare coverage.">
                <p style={overline}>Track record</p>
                <p style={{
                  fontFamily: F.serif, fontSize: "clamp(16px, 1.8vw, 21px)",
                  color: T.sub, lineHeight: 1.3, marginBottom: "10px",
                }}>
                  Since 2010, we've helped more than
                </p>
                <p
                  aria-hidden="true"
                  style={{
                    fontFamily: F.serif,
                    fontSize: "clamp(60px, 9vw, 112px)",
                    fontWeight: 400, lineHeight: 0.88,
                    letterSpacing: "-0.04em",
                    color: T.ink, margin: "0 0 10px",
                  }}
                >
                  500,000
                </p>
                <p style={{
                  fontFamily: F.serif, fontSize: "clamp(16px, 1.8vw, 21px)",
                  color: T.sub, lineHeight: 1.3,
                }}>
                  seniors find better Medicare coverage.
                </p>
              </div>

              {/* Right — independence + proof points */}
              <div>
                <p style={overline}>Our commitment</p>
                <p style={{
                  fontFamily: F.sans, fontSize: "18px",
                  lineHeight: 1.8, color: T.body, marginBottom: "40px",
                }}>
                  No carrier pays for referrals. No plan is hidden from your results. Every comparison is built on data published by CMS.gov — the same source Medicare itself uses.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {[
                    "24+ plans per county from every active carrier",
                    "No plan hidden, no carrier given preferred placement",
                    "CMS.gov public data, updated annually",
                  ].map(item => (
                    <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                      <span aria-hidden="true" style={{
                        display: "inline-block", width: "6px", height: "6px",
                        backgroundColor: T.teal, borderRadius: "50%",
                        flexShrink: 0, marginTop: "8px",
                      }} />
                      <p style={{ fontFamily: F.sans, fontSize: "15px", color: T.body, lineHeight: 1.65, margin: 0 }}>
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
                <p style={{
                  fontFamily: F.sans, fontSize: "12px", color: T.sub,
                  lineHeight: 1.65, marginTop: "32px",
                  paddingTop: "24px", borderTop: `1px solid ${T.rule}`,
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
          style={{ backgroundColor: T.night, padding: "160px 0" }}
        >
          <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
            <div ref={rCta} className="rv" style={{ maxWidth: "660px" }}>
              <p style={{ ...overline, color: T.teal }}>Free · No account · No obligation</p>
              <h2
                id="cta-h"
                style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(30px, 4.8vw, 60px)",
                  fontWeight: 400, lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: "#fff", marginBottom: "20px",
                }}
              >
                The plan you choose today shapes who can care for you next year.
              </h2>
              <p style={{
                fontFamily: F.sans, fontSize: "17px",
                color: "rgba(235,245,248,0.5)",
                lineHeight: 1.8, marginBottom: "52px", maxWidth: "46ch",
              }}>
                Start with your ZIP code. We surface every plan available in your county — with your doctors confirmed and your prescriptions costed.
              </p>
              <div style={{ display: "flex", gap: "8px", maxWidth: "420px", marginBottom: "22px" }}>
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
                    borderRadius: "10px", outline: "none",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                />
                <button
                  type="button"
                  className="btn-p btn-t"
                  onClick={handleSearch}
                  style={{
                    fontFamily: F.sans, padding: "16px 24px",
                    backgroundColor: T.teal, color: "#fff",
                    fontWeight: 600, fontSize: "14px",
                    borderRadius: "10px", border: "none",
                    cursor: "pointer", flexShrink: 0,
                    display: "flex", alignItems: "center", gap: "7px",
                    whiteSpace: "nowrap", transition: "background-color 0.14s",
                  }}
                >
                  See Plans
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
              <p style={{
                fontFamily: F.sans, fontSize: "13px",
                color: "rgba(235,245,248,0.3)",
                display: "flex", alignItems: "center", gap: "8px",
              }}>
                <Phone size={12} aria-hidden="true" />
                <span>
                  Or call{" "}
                  <a
                    href="tel:1-800-555-0100"
                    className="plnk"
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
            style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: "48px", marginBottom: "60px" }}
          >
            <div>
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontFamily: F.serif, fontSize: "20px", fontWeight: 400, color: "#fff", letterSpacing: "-0.01em", lineHeight: 1 }}>MedicarePlan</div>
                <div style={{ fontFamily: F.sans, fontSize: "10px", color: "rgba(255,255,255,0.26)", letterSpacing: "0.09em", textTransform: "uppercase", marginTop: "4px" }}>Finder</div>
              </div>
              <p style={{ fontSize: "13px", lineHeight: 1.75, color: "rgba(255,255,255,0.33)", maxWidth: "26ch" }}>
                Helping Americans find better Medicare Advantage plans since 2010. Licensed in all 50 states.
              </p>
            </div>
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
                { label: "Contact", href: "/contact" },
                { label: "Privacy Policy", href: "/privacy" },
              ]},
            ].map(col => (
              <nav key={col.title} aria-label={`${col.title} links`}>
                <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: "18px" }}>
                  {col.title}
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                  {col.links.map(link => (
                    <li key={link.label}>
                      <Link href={link.href} className="flnk" style={{ fontSize: "13px", color: "rgba(255,255,255,0.33)", textDecoration: "none", transition: "color 0.14s" }}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "24px", marginBottom: "20px" }}>
            <a
              href="https://d2xsxph8kpxj0f.cloudfront.net/310519663319810046/5TY7JcF275WMujMHZWWJT8/episode-alert-api-integration-guide_6a93d69a.pdf"
              target="_blank" rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: "7px",
                padding: "7px 13px", borderRadius: "5px",
                fontSize: "12px", color: "rgba(255,255,255,0.26)",
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                textDecoration: "none",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Episode Alert API Integration Guide
            </a>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px", fontSize: "12px", color: "rgba(255,255,255,0.17)", lineHeight: 1.72 }}>
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
