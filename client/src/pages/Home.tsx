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

// Lora: warm editorial serif, strong italic, excellent on-screen legibility.
// DM Sans: designed to pair with Lora-class serifs; professional, not startup.
// Both loaded via Google Fonts import in the inline <style> block below.
const F = {
  serif: "'Lora', Georgia, 'Times New Roman', serif",
  sans:  "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

// ─── Type scale ───────────────────────────────────────────────────────────────
// Display h1:  Lora 600  clamp(42px,5vw,68px)  leading 1.1   tracking -0.02em
// Section h2:  Lora 500  clamp(26px,3vw,40px)  leading 1.18  tracking -0.015em
// Column h3:   Lora 400  clamp(18px,1.8vw,22px)leading 1.3   tracking -0.01em
// Body large:  DM Sans   18px                   leading 1.82
// Body:        DM Sans   16px                   leading 1.78  (min for senior legibility)
// Small:       DM Sans   13px                   leading 1.65
// Micro:       DM Sans   12px                   leading 1.6
// Section labels (overlines): DM Sans 500 13px sentence-case — NO uppercase

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
  // No uppercase — sentence case reads as regulated/professional, not startup.
  const overline: React.CSSProperties = {
    fontFamily: F.sans, fontSize: "13px", fontWeight: 500,
    letterSpacing: "0.01em",
    color: T.teal, marginBottom: "18px",
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
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=DM+Sans:wght@400;500;600&display=swap');

        #hm .hm-skip:focus { top: 0 !important; }
        #hm .rv {
          opacity: 0; transform: translateY(16px);
          transition: opacity 0.65s cubic-bezier(0.22,1,0.36,1), transform 0.65s cubic-bezier(0.22,1,0.36,1);
        }
        #hm .rv[data-v="1"] { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) {
          #hm .rv { opacity: 1 !important; transform: none !important; transition: none !important; }
        }
        #hm .zip-in:focus  { border-color: ${T.teal} !important; box-shadow: 0 0 0 3px rgba(35,122,146,0.13) !important; outline: none; }
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
          #hm .ben-g > *:first-child { border-right: none !important; padding-right: 0 !important; padding-bottom: 44px !important; border-bottom: 1px solid ${T.rule} !important; }
          #hm .ben-g > *:last-child  { padding-left: 0 !important; padding-top: 44px !important; }
          #hm .cov-g     { grid-template-columns: 1fr !important; gap: 56px !important; }
          #hm .cred-g    { grid-template-columns: 1fr !important; gap: 64px !important; }
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
          <div style={{ width: "100%", maxWidth: "1200px", margin: "0 auto", padding: "96px 40px" }}>
            <div
              className="hero-g"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "96px", alignItems: "center" }}
            >
              {/* ── Left ── */}
              <div>
                {/* Eyebrow */}
                <p style={{
                  fontFamily: F.sans, fontSize: "13px", fontWeight: 500,
                  letterSpacing: "0.01em", color: T.teal, marginBottom: "32px",
                }}>
                  Independent advisors · Licensed in all 50 states
                </p>

                {/* Headline */}
                <h1 style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(42px, 5vw, 68px)",
                  fontWeight: 600, lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: T.ink, marginBottom: "24px",
                }}>
                  Medicare Advantage,<br />
                  <em style={{ color: T.teal, fontStyle: "italic", fontWeight: 500 }}>made clear.</em>
                </h1>

                {/* Subhead */}
                <p style={{
                  fontFamily: F.sans, fontSize: "18px",
                  lineHeight: 1.82, color: T.body,
                  maxWidth: "44ch", marginBottom: "48px",
                }}>
                  Compare every plan in your county — matched to your doctors, prescriptions, and budget. Free. No account. No pressure.
                </p>

                {/* ZIP CTA */}
                <div style={{ maxWidth: "448px" }}>
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
                        padding: "18px 22px", fontSize: "17px", fontWeight: 500,
                        color: T.ink, backgroundColor: "#fff",
                        border: `1.5px solid ${inputError ? T.err : T.rule}`,
                        borderRadius: "10px", outline: "none",
                        boxShadow: "0 1px 6px rgba(11,27,36,0.07)",
                        transition: "border-color 0.15s, box-shadow 0.15s",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSearch}
                      className="btn-p"
                      style={{
                        fontFamily: F.sans, padding: "18px 28px",
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

                  {/* Error */}
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

                  {/* County selector */}
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

                  {/* Trust microcopy */}
                  <p style={{
                    fontFamily: F.sans, fontSize: "13px",
                    color: T.sub, marginTop: "14px",
                  }}>
                    Always free · No account required · No sales calls unless you ask
                  </p>
                </div>

                {/* Process reassurance */}
                <p
                  aria-label="How it works: Enter your ZIP, compare every plan, check doctors and Rx"
                  style={{
                    fontFamily: F.sans, fontSize: "13px", color: T.sub,
                    marginTop: "40px", paddingTop: "24px",
                    borderTop: `1px solid ${T.rule}`,
                  }}
                >
                  Enter your ZIP&ensp;·&ensp;Compare every plan&ensp;·&ensp;Check doctors &amp; Rx
                </p>
              </div>

              {/* ── Right — editorial proof statement ── */}
              <div className="illus" style={{ display: "flex", alignItems: "flex-start", paddingTop: "8px" }}>
                <div style={{ borderLeft: `2px solid ${T.teal}`, paddingLeft: "40px" }}>
                  <p style={{
                    fontFamily: F.serif,
                    fontSize: "clamp(28px, 3vw, 42px)",
                    fontWeight: 400, lineHeight: 1.28,
                    letterSpacing: "-0.015em",
                    color: T.ink, marginBottom: "36px",
                  }}>
                    Every plan.<br />
                    Every doctor.<br />
                    Every prescription.<br />
                    <em style={{ color: T.teal, fontStyle: "italic" }}>Checked first.</em>
                  </p>
                  <p style={{
                    fontFamily: F.sans, fontSize: "14px",
                    color: T.body, lineHeight: 1.72,
                    maxWidth: "34ch",
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

        {/* ── §2 TRUST STRIP + CARRIER ROW ──────────────────────────────── */}
        <div aria-label="Service credentials and plan carriers" style={{ borderTop: `1px solid ${T.rule}` }}>

          {/* Row A — four credential claims */}
          <div style={{ backgroundColor: T.warm }}>
            <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
              <div style={{
                display: "flex", alignItems: "center",
                flexWrap: "wrap", gap: "0", rowGap: "12px",
                padding: "20px 0",
              }}>
                {([
                  { claim: "Licensed independent agents", detail: "All 50 states" },
                  { claim: "Plan data from CMS.gov",       detail: "Official public records" },
                  { claim: "Free — no cost to you",         detail: "Carriers pay us, not you" },
                  { claim: "Doctors & Rx verified",         detail: "Before results appear" },
                ] as const).map((item, i) => (
                  <div key={item.claim} style={{ display: "flex", alignItems: "center" }}>
                    {i > 0 && (
                      <span aria-hidden="true" style={{
                        display: "inline-block", width: "1px", height: "28px",
                        backgroundColor: T.rule, margin: "0 28px", flexShrink: 0,
                      }} />
                    )}
                    <div>
                      <div style={{
                        fontFamily: F.sans, fontSize: "13px", fontWeight: 500,
                        color: T.ink, lineHeight: 1.3, whiteSpace: "nowrap",
                      }}>
                        {item.claim}
                      </div>
                      <div style={{
                        fontFamily: F.sans, fontSize: "11px",
                        color: T.sub, marginTop: "2px", whiteSpace: "nowrap",
                      }}>
                        {item.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row B — carrier names, given room to breathe */}
          <div style={{ backgroundColor: "#fff", borderTop: `1px solid ${T.rule}` }}>
            <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
              <div style={{
                display: "flex", alignItems: "baseline",
                flexWrap: "wrap", gap: "0", rowGap: "10px",
                padding: "22px 0",
              }}>
                <span style={{
                  fontFamily: F.sans, fontSize: "12px", fontWeight: 500,
                  color: T.sub, marginRight: "24px", whiteSpace: "nowrap",
                  paddingTop: "2px",
                }}>
                  Plans from
                </span>
                {CARRIERS.map((name, i) => (
                  <span key={name} style={{ display: "flex", alignItems: "center" }}>
                    {i > 0 && (
                      <span aria-hidden="true" style={{
                        display: "inline-block", width: "3px", height: "3px",
                        borderRadius: "50%", backgroundColor: T.rule,
                        margin: "0 16px", flexShrink: 0,
                      }} />
                    )}
                    <span style={{
                      fontFamily: F.sans, fontSize: "14px", fontWeight: 500,
                      color: T.body, whiteSpace: "nowrap",
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
          style={{ backgroundColor: "#fff", padding: "160px 0" }}
        >
          <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
            <div style={{ marginBottom: "80px" }}>
              <p style={overline}>Why people use us</p>
              <h2
                id="why-h"
                style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(26px, 3.2vw, 40px)",
                  fontWeight: 500, lineHeight: 1.18,
                  letterSpacing: "-0.015em",
                  color: T.ink, maxWidth: "560px",
                }}
              >
                Built for an important decision —
                <em style={{ fontStyle: "italic", color: T.teal, fontWeight: 400 }}>{" "}not for speed.</em>
              </h2>
            </div>

            {/* Asymmetric: first benefit leads (left), second + third stacked (right) */}
            <div
              ref={rBenefits}
              className="rv ben-g"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", alignItems: "start" }}
            >
              {/* Lead benefit */}
              <div style={{ paddingRight: "72px", borderRight: `1px solid ${T.rule}` }}>
                <p style={{
                  fontFamily: F.sans, fontSize: "12px", fontWeight: 500,
                  letterSpacing: "0.01em", color: T.teal, marginBottom: "20px",
                }}>
                  {BENEFITS[0].label}
                </p>
                <h3 style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(22px, 2.4vw, 30px)",
                  fontWeight: 500, lineHeight: 1.25,
                  letterSpacing: "-0.015em",
                  color: T.ink, marginBottom: "20px",
                }}>
                  {BENEFITS[0].title}
                </h3>
                <p style={{ fontFamily: F.sans, fontSize: "17px", lineHeight: 1.82, color: T.body }}>
                  {BENEFITS[0].body}
                </p>
              </div>

              {/* Supporting pair */}
              <div style={{ paddingLeft: "72px" }}>
                {([BENEFITS[1], BENEFITS[2]] as const).map((b, i) => (
                  <div
                    key={b.label}
                    style={{
                      paddingTop: i > 0 ? "44px" : "0",
                      paddingBottom: i < 1 ? "44px" : "0",
                      borderBottom: i < 1 ? `1px solid ${T.rule}` : "none",
                    }}
                  >
                    <p style={{
                      fontFamily: F.sans, fontSize: "12px", fontWeight: 500,
                      letterSpacing: "0.01em", color: T.teal, marginBottom: "14px",
                    }}>
                      {b.label}
                    </p>
                    <h3 style={{
                      fontFamily: F.serif,
                      fontSize: "clamp(18px, 1.8vw, 22px)",
                      fontWeight: 500, lineHeight: 1.3,
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
                    fontSize: "clamp(24px, 2.8vw, 36px)",
                    fontWeight: 500, lineHeight: 1.22,
                    letterSpacing: "-0.012em",
                    color: T.ink, marginBottom: "20px",
                  }}
                >
                  The two things people overlook — and that we check first.
                </h2>
                <p style={{
                  fontFamily: F.sans, fontSize: "16px",
                  lineHeight: 1.82, color: T.body, marginBottom: "32px",
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
                        fontFamily: F.sans, fontSize: "12px", fontWeight: 500,
                        letterSpacing: "0.01em", color: T.sub, marginBottom: "8px",
                      }}>
                        {c.label}
                      </p>
                      <p style={{
                        fontFamily: F.serif,
                        fontSize: "21px", fontWeight: 500,
                        letterSpacing: "-0.01em", lineHeight: 1.25,
                        color: T.teal,
                      }}>
                        {c.title}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontFamily: F.sans, fontSize: "16px", lineHeight: 1.78, color: T.body, marginBottom: "10px" }}>
                        {c.body}
                      </p>
                      <p style={{ fontFamily: F.sans, fontSize: "13px", color: T.sub }}>
                        {c.proof}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── §5 PROOF ──────────────────────────────────────────────────── */}
        <section
          id="credibility"
          aria-labelledby="cred-h"
          aria-label="Since 2010 we've helped more than 500,000 seniors find better Medicare coverage."
          style={{ backgroundColor: "#fff", padding: "160px 0" }}
        >
          <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
            <div
              ref={rCredibility}
              className="rv cred-g"
              style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gap: "100px", alignItems: "start" }}
            >
              {/* Left — anchor stat */}
              <div>
                <p style={overline}>Since 2010</p>
                <p
                  aria-hidden="true"
                  style={{
                    fontFamily: F.serif,
                    fontSize: "clamp(52px, 7.5vw, 96px)",
                    fontWeight: 600, lineHeight: 0.92,
                    letterSpacing: "-0.03em",
                    color: T.ink, margin: "0 0 16px",
                  }}
                >
                  500,000
                </p>
                <p style={{
                  fontFamily: F.serif, fontSize: "clamp(17px, 1.7vw, 22px)",
                  fontWeight: 400, color: T.body, lineHeight: 1.5, margin: 0,
                }}>
                  seniors helped find better Medicare Advantage coverage.
                </p>
              </div>

              {/* Right — editorial narrative + proof data */}
              <div>
                <p style={{
                  fontFamily: F.sans, fontSize: "17px",
                  lineHeight: 1.82, color: T.body, margin: "0 0 48px",
                }}>
                  No carrier pays us for referrals. No plan is hidden or ranked for commercial reasons. Every comparison is built entirely on data published by CMS.gov — the same official source Medicare uses — with your doctors and prescriptions checked before results appear.
                </p>

                <p style={{
                  fontFamily: F.sans, fontSize: "12px", color: T.sub,
                  lineHeight: 1.65, marginTop: "28px",
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
              <p style={overline}>Free · No account · No obligation</p>
              <h2
                id="cta-h"
                style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(28px, 4vw, 52px)",
                  fontWeight: 500, lineHeight: 1.15,
                  letterSpacing: "-0.015em",
                  color: "#fff", marginBottom: "20px",
                }}
              >
                The plan you choose today shapes who can care for you next year.
              </h2>
              <p style={{
                fontFamily: F.sans, fontSize: "17px",
                color: "rgba(235,245,248,0.5)",
                lineHeight: 1.82, marginBottom: "48px", maxWidth: "48ch",
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
                <div style={{ fontFamily: F.sans, fontSize: "11px", color: "rgba(255,255,255,0.26)", letterSpacing: "0.04em", marginTop: "4px" }}>Finder</div>
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
                <div style={{ fontSize: "12px", fontWeight: 500, letterSpacing: "0.01em", color: "rgba(255,255,255,0.28)", marginBottom: "18px" }}>
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
