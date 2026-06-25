/**
 * Medicare Advantage Homepage — Art direction v3.
 *
 * ZIP validation / workflow / modal / routing: UNCHANGED.
 * Only the visual layer has changed.
 *
 * Art direction:
 *   – White / warm off-white (#FAF9F5) palette, deep slate-teal accent
 *   – Premium editorial composition, left-aligned hierarchy
 *   – More whitespace, fewer boxes, fewer borders, subtle depth
 *   – Inline SVG hero illustration (no stock imagery)
 *   – Emotional tone: reassuring, expert, clear, regulated, human, premium
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
  ink:   "#0B1B24",   // Display headings
  dark:  "#1C3A48",   // Deep slate-teal — buttons, strong text
  teal:  "#237A92",   // Primary interactive accent
  tealL: "#2E96B0",   // Hover
  body:  "#3E5560",   // Body copy
  sub:   "#7A9BA6",   // Supporting / muted
  rule:  "#E2EAED",   // Hairlines — use sparingly
  warm:  "#FAF9F5",   // Warm off-white sections
  night: "#0A1820",   // Dark CTA section
  ftr:   "#060E14",   // Footer
  err:   "#C0392B",
} as const;

const F = {
  serif: "'DM Serif Display', Georgia, 'Times New Roman', serif",
  sans:  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

// ─── Page data ────────────────────────────────────────────────────────────────
const PRINCIPLES = [
  {
    num: "01",
    title: "Every plan in your county — nothing filtered.",
    body: "We compare all Medicare Advantage options across every carrier active in your area. No plans are hidden. No carrier pays for preferred placement.",
  },
  {
    num: "02",
    title: "Your true annual cost, calculated before you commit.",
    body: "Add your prescriptions and we calculate your real annual drug cost for every plan: deductible, tier copays, and coverage gap — before you see any result.",
  },
  {
    num: "03",
    title: "Your doctors confirmed in-network first.",
    body: "We cross-check provider directories so you never choose a plan and lose your care team. In-network status is verified before a single result appears.",
  },
] as const;

const STEPS = [
  { n: "1", label: "Enter your ZIP code",   note: "Instantly unlocks every plan in your county" },
  { n: "2", label: "Add doctors & Rx",      note: "Optional — personalizes costs and coverage" },
  { n: "3", label: "Compare, then decide",  note: "At your own pace, no pressure, no calls required" },
] as const;

// ─── SVG Hero Illustration ────────────────────────────────────────────────────
// Depicts three plan documents fanned and stacked — the centre card highlighted,
// representing "your best match surfaced from the full field."
// Pure geometry: no clip-art, no stock, no icons.
function PlanIllustration() {
  return (
    <svg
      viewBox="0 0 480 520"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
      style={{ width: "100%", maxWidth: "420px", height: "auto", display: "block" }}
    >
      {/* Ambient wash */}
      <ellipse cx="240" cy="280" rx="200" ry="210" fill="#EBF3F6" fillOpacity="0.55" />

      {/* Card 3 — rearmost, rotated right */}
      <g transform="rotate(10 240 300)">
        <rect x="115" y="110" width="210" height="280" rx="14" fill="#D6E8EE" />
      </g>

      {/* Card 2 — middle, rotated left */}
      <g transform="rotate(-7 240 300)">
        <rect x="120" y="115" width="210" height="280" rx="14" fill="#C8DDE6" />
      </g>

      {/* Card 1 — front, upright, white with shadow suggestion */}
      <rect x="110" y="95" width="228" height="296" rx="16"
        fill="white"
        style={{ filter: "drop-shadow(0 8px 32px rgba(11,27,36,0.09)) drop-shadow(0 2px 6px rgba(11,27,36,0.05))" }}
      />

      {/* Card header accent bar */}
      <rect x="110" y="95" width="228" height="5" rx="2.5" fill="#237A92" fillOpacity="0.7" />

      {/* Carrier row label */}
      <rect x="134" y="122" width="52" height="6" rx="3" fill="#237A92" fillOpacity="0.18" />
      <rect x="194" y="122" width="80" height="6" rx="3" fill="#0B1B24" fillOpacity="0.09" />

      {/* Divider */}
      <line x1="134" y1="145" x2="314" y2="145" stroke={T.rule} strokeWidth="1" />

      {/* Plan row A */}
      <rect x="134" y="162" width="32" height="32" rx="8" fill="#EAF3F6" />
      <rect x="178" y="168" width="78" height="5" rx="2.5" fill="#0B1B24" fillOpacity="0.11" />
      <rect x="178" y="179" width="52" height="4" rx="2" fill="#0B1B24" fillOpacity="0.07" />
      <rect x="284" y="165" width="30" height="10" rx="3" fill="#0B1B24" fillOpacity="0.08" />

      {/* Plan row B — highlighted as "recommended" */}
      <rect x="124" y="207" width="248" height="50" rx="10" fill="#237A92" fillOpacity="0.08" />
      <rect x="138" y="217" width="32" height="32" rx="8" fill="#237A92" fillOpacity="0.22" />
      <rect x="182" y="223" width="78" height="5" rx="2.5" fill="#0B1B24" fillOpacity="0.22" />
      <rect x="182" y="234" width="52" height="4" rx="2" fill="#237A92" fillOpacity="0.4" />
      <rect x="288" y="220" width="30" height="10" rx="3" fill="#237A92" fillOpacity="0.55" />

      {/* Plan row C */}
      <rect x="134" y="272" width="32" height="32" rx="8" fill="#EAF3F6" />
      <rect x="178" y="278" width="78" height="5" rx="2.5" fill="#0B1B24" fillOpacity="0.11" />
      <rect x="178" y="289" width="52" height="4" rx="2" fill="#0B1B24" fillOpacity="0.07" />
      <rect x="284" y="275" width="30" height="10" rx="3" fill="#0B1B24" fillOpacity="0.08" />

      {/* Footer caption strip */}
      <rect x="110" y="366" width="228" height="25" rx="0" fill="#F3F7F9" />
      <rect x="110" y="366" width="228" height="25" rx="0"
        style={{ clipPath: "inset(0 0 0 0 round 0 0 16px 16px)" }}
        fill="#F3F7F9"
      />
      <rect x="134" y="375" width="96" height="4" rx="2" fill="#0B1B24" fillOpacity="0.1" />

      {/* Check badge — "best match" indicator */}
      <circle cx="340" cy="120" r="26" fill="#237A92" />
      <path d="M330 120 L337.5 127.5 L352 113" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* CMS data source badge — lower right */}
      <rect x="258" y="420" width="88" height="26" rx="6" fill="white"
        style={{ filter: "drop-shadow(0 2px 8px rgba(11,27,36,0.1))" }}
      />
      <rect x="268" y="430" width="44" height="4" rx="2" fill="#237A92" fillOpacity="0.5" />
      <rect x="268" y="438" width="30" height="3" rx="1.5" fill="#0B1B24" fillOpacity="0.15" />
    </svg>
  );
}

// ─── Scroll-reveal ────────────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.dataset.v = "1"; return;
    }
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

  const r1 = useReveal();
  const r2 = useReveal();
  const r3 = useReveal();
  const r4 = useReveal();

  // ── ZIP handlers ─────────────────────────────────────────────────────────
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
    } catch { /* sessionStorage unavailable */ }
    const p = new URLSearchParams({ zip: pendingZip });
    if (data.verifyResult) p.set("verified", "1");
    if (data.doctors.length > 0 || data.drugs.length > 0) p.set("personalized", "1");
    navigate(`/plans?${p.toString()}`);
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

        /* Reveal */
        #hm .rv { opacity: 0; transform: translateY(18px);
          transition: opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1); }
        #hm .rv[data-v="1"] { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) {
          #hm .rv { opacity: 1 !important; transform: none !important; transition: none !important; }
        }

        /* Focus rings */
        #hm .zip-in:focus   { border-color: ${T.teal} !important; box-shadow: 0 0 0 3px rgba(35,122,146,0.14) !important; outline: none; }
        #hm .zip-dk:focus   { border-color: rgba(255,255,255,0.45) !important; box-shadow: 0 0 0 3px rgba(255,255,255,0.07) !important; outline: none; }

        /* Buttons */
        #hm .btn-p  { transition: background-color 0.14s; }
        #hm .btn-p:hover  { background-color: #122736 !important; }
        #hm .link-a { transition: color 0.12s; }
        #hm .link-a:hover { color: ${T.tealL} !important; }
        #hm .flink  { transition: color 0.14s; }
        #hm .flink:hover  { color: rgba(255,255,255,0.75) !important; }
        #hm .plink  { transition: color 0.12s; }
        #hm .plink:hover  { color: rgba(235,245,248,0.85) !important; }

        /* Responsive */
        @media (max-width: 1023px) {
          #hm .hero-g    { grid-template-columns: 1fr !important; }
          #hm .illus     { display: none !important; }
          #hm .princ-g   { grid-template-columns: 1fr !important; gap: 48px !important; }
          #hm .steps-g   { grid-template-columns: 1fr !important; gap: 40px !important; }
          #hm .trust-g   { grid-template-columns: 1fr !important; gap: 64px !important; }
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
              {/* Left */}
              <div>
                <p style={{
                  fontFamily: F.sans, fontSize: "12px", fontWeight: 600,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: T.teal, marginBottom: "40px",
                }}>
                  Independent advisors · Licensed in all 50 states
                </p>

                <h1 style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(48px, 6.5vw, 88px)",
                  fontWeight: 400, lineHeight: 1.04,
                  letterSpacing: "-0.025em",
                  color: T.ink,
                  marginBottom: "28px",
                }}>
                  Medicare<br />
                  Advantage,<br />
                  <em style={{ color: T.teal, fontStyle: "italic" }}>on your terms.</em>
                </h1>

                <p style={{
                  fontFamily: F.sans, fontSize: "18px",
                  lineHeight: 1.78, color: T.body,
                  maxWidth: "40ch", marginBottom: "56px",
                }}>
                  We compare every plan in your county — matched to your doctors, your prescriptions, and your budget. Free. No account. No pressure.
                </p>

                {/* ZIP CTA */}
                <div style={{ maxWidth: "440px" }}>
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

                  <p style={{ fontFamily: F.sans, fontSize: "13px", color: T.sub, marginTop: "16px" }}>
                    Always free · No account required · No sales calls unless you ask
                  </p>
                </div>
              </div>

              {/* Right — illustration */}
              <div
                className="illus"
                style={{ display: "flex", justifyContent: "center", alignItems: "center" }}
              >
                <PlanIllustration />
              </div>
            </div>
          </div>
        </section>

        {/* ── §2 TRUST BAR ──────────────────────────────────────────────── */}
        <div
          aria-label="Service credentials"
          style={{ backgroundColor: T.warm, borderTop: `1px solid ${T.rule}` }}
        >
          <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "22px 40px" }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0", rowGap: "10px" }}>
              {[
                "Licensed agents in all 50 states",
                "Paid by carriers — never by you",
                "Plan data from CMS.gov",
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
          </div>
        </div>

        {/* ── §3 THREE PRINCIPLES ───────────────────────────────────────── */}
        <section
          id="principles"
          aria-labelledby="princ-h"
          style={{ backgroundColor: "#fff", padding: "168px 0 160px" }}
        >
          <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>

            <div style={{ marginBottom: "80px" }}>
              <p style={{
                fontFamily: F.sans, fontSize: "12px", fontWeight: 600,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: T.teal, marginBottom: "20px",
              }}>
                Our approach
              </p>
              <h2
                id="princ-h"
                style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(28px, 3.8vw, 48px)",
                  fontWeight: 400, lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: T.ink, maxWidth: "660px",
                }}
              >
                Built for a consequential decision —
                <em style={{ fontStyle: "italic", color: T.teal }}>{" "}not for speed.</em>
              </h2>
            </div>

            <div
              ref={r1}
              className="rv princ-g"
              style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "72px" }}
            >
              {PRINCIPLES.map(p => (
                <div key={p.num}>
                  <div style={{
                    fontFamily: F.serif, fontSize: "11px",
                    color: T.sub, letterSpacing: "0.06em",
                    marginBottom: "28px",
                  }}>
                    {p.num}
                  </div>
                  <div style={{
                    width: "28px", height: "2px",
                    backgroundColor: T.teal, marginBottom: "24px",
                    borderRadius: "1px",
                  }} />
                  <h3 style={{
                    fontFamily: F.serif,
                    fontSize: "clamp(20px, 1.8vw, 23px)",
                    fontWeight: 400, lineHeight: 1.25,
                    letterSpacing: "-0.015em",
                    color: T.ink, marginBottom: "16px",
                  }}>
                    {p.title}
                  </h3>
                  <p style={{
                    fontFamily: F.sans, fontSize: "15px",
                    lineHeight: 1.8, color: T.body,
                  }}>
                    {p.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── §4 HOW IT WORKS ───────────────────────────────────────────── */}
        <section
          id="how"
          aria-labelledby="how-h"
          style={{ backgroundColor: T.warm, padding: "128px 0" }}
        >
          <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 2fr",
              gap: "80px", alignItems: "start",
            }}>
              <div>
                <p style={{
                  fontFamily: F.sans, fontSize: "12px", fontWeight: 600,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: T.teal, marginBottom: "20px",
                }}>
                  How it works
                </p>
                <h2
                  id="how-h"
                  style={{
                    fontFamily: F.serif,
                    fontSize: "clamp(26px, 3vw, 38px)",
                    fontWeight: 400, lineHeight: 1.18,
                    letterSpacing: "-0.015em",
                    color: T.ink,
                  }}
                >
                  Three steps.<br />No account.<br />No pressure.
                </h2>
              </div>
              <div ref={r2} className="rv steps-g" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0" }}>
                {STEPS.map((s, i) => (
                  <div
                    key={s.n}
                    style={{
                      paddingLeft: i > 0 ? "40px" : "0",
                      paddingRight: i < 2 ? "40px" : "0",
                      borderLeft: i > 0 ? `1px solid ${T.rule}` : "none",
                    }}
                  >
                    <div style={{
                      fontFamily: F.serif,
                      fontSize: "52px", fontWeight: 400,
                      lineHeight: 1, letterSpacing: "-0.02em",
                      color: T.rule, marginBottom: "20px",
                    }}>
                      {s.n}
                    </div>
                    <div style={{
                      fontFamily: F.sans, fontSize: "16px", fontWeight: 600,
                      color: T.ink, marginBottom: "8px", letterSpacing: "-0.01em",
                    }}>
                      {s.label}
                    </div>
                    <div style={{ fontFamily: F.sans, fontSize: "14px", color: T.sub, lineHeight: 1.65 }}>
                      {s.note}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── §5 INDEPENDENCE / TRUST ───────────────────────────────────── */}
        <section
          id="trust"
          aria-labelledby="trust-h"
          style={{ backgroundColor: "#fff", padding: "168px 0" }}
        >
          <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
            <div
              ref={r3}
              className="rv trust-g"
              style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gap: "112px", alignItems: "center" }}
            >
              <div>
                <p style={{
                  fontFamily: F.sans, fontSize: "12px", fontWeight: 600,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: T.teal, marginBottom: "24px",
                }}>
                  Independence
                </p>
                <p style={{
                  fontFamily: F.sans, fontSize: "18px",
                  lineHeight: 1.8, color: T.body, marginBottom: "40px",
                }}>
                  No carrier pays for referrals. No plan is hidden from your results. Every comparison is built on data published directly by CMS.gov — the same source Medicare itself uses.
                </p>
                <p style={{
                  fontFamily: F.sans, fontSize: "14px",
                  color: T.sub, lineHeight: 1.72, marginBottom: "28px",
                }}>
                  24+ plans per county · every active carrier · no preferred placement
                </p>
                <p style={{
                  fontFamily: F.sans, fontSize: "12px",
                  color: T.sub, lineHeight: 1.65,
                  paddingTop: "24px", borderTop: `1px solid ${T.rule}`,
                }}>
                  All plan data from CMS.gov public records, updated annually. Not affiliated with or endorsed by any insurance carrier.
                </p>
              </div>

              <div aria-label="Since 2010, we've helped more than 500,000 seniors find better Medicare coverage.">
                <p style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(17px, 2vw, 24px)",
                  color: T.sub, lineHeight: 1.25, marginBottom: "10px",
                }}>
                  Since 2010, we've helped more than
                </p>
                <p
                  aria-hidden="true"
                  style={{
                    fontFamily: F.serif,
                    fontSize: "clamp(64px, 9.5vw, 116px)",
                    fontWeight: 400, lineHeight: 0.86,
                    letterSpacing: "-0.04em",
                    color: T.ink, margin: "0 0 10px",
                  }}
                >
                  500,000
                </p>
                <p style={{
                  fontFamily: F.serif,
                  fontSize: "clamp(17px, 2vw, 24px)",
                  color: T.sub, lineHeight: 1.25, marginBottom: "40px",
                }}>
                  seniors find better coverage.
                </p>
                <button
                  type="button"
                  className="btn-p"
                  onClick={() => { zipInputRef.current?.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  style={{
                    fontFamily: F.sans, fontSize: "14px", fontWeight: 600,
                    color: "#fff", backgroundColor: T.dark,
                    padding: "14px 24px", borderRadius: "8px", border: "none",
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

        {/* ── §6 DARK CTA ───────────────────────────────────────────────── */}
        <section
          id="start"
          aria-labelledby="cta-h"
          style={{ backgroundColor: T.night, padding: "168px 0" }}
        >
          <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
            <div
              ref={r4}
              className="rv"
              style={{ maxWidth: "660px" }}
            >
              <p style={{
                fontFamily: F.sans, fontSize: "12px", fontWeight: 600,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: T.teal, marginBottom: "24px",
              }}>
                Free · No account · No obligation
              </p>
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
                  className="btn-p"
                  onClick={handleSearch}
                  style={{
                    fontFamily: F.sans, padding: "16px 24px",
                    backgroundColor: T.teal, color: "#fff",
                    fontWeight: 600, fontSize: "14px",
                    borderRadius: "10px", border: "none",
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
                color: "rgba(235,245,248,0.3)",
                display: "flex", alignItems: "center", gap: "8px",
              }}>
                <Phone size={12} aria-hidden="true" />
                <span>
                  Or call{" "}
                  <a
                    href="tel:1-800-555-0100"
                    className="plink"
                    style={{ color: "rgba(235,245,248,0.52)", fontWeight: 500, textDecoration: "none" }}
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
      <footer
        aria-label="Site footer"
        style={{ backgroundColor: T.ftr, fontFamily: F.sans, padding: "80px 0 52px" }}
      >
        <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
          <div
            className="footer-g"
            style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: "48px", marginBottom: "60px" }}
          >
            <div>
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontFamily: F.serif, fontSize: "20px", fontWeight: 400, color: "#fff", letterSpacing: "-0.01em", lineHeight: 1 }}>
                  MedicarePlan
                </div>
                <div style={{ fontFamily: F.sans, fontSize: "10px", color: "rgba(255,255,255,0.28)", letterSpacing: "0.09em", textTransform: "uppercase", marginTop: "4px" }}>
                  Finder
                </div>
              </div>
              <p style={{ fontSize: "13px", lineHeight: 1.75, color: "rgba(255,255,255,0.35)", maxWidth: "26ch" }}>
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
                <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", marginBottom: "18px" }}>
                  {col.title}
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                  {col.links.map(link => (
                    <li key={link.label}>
                      <Link href={link.href} className="flink" style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>
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
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: "7px",
                padding: "7px 13px", borderRadius: "5px",
                fontSize: "12px", color: "rgba(255,255,255,0.28)",
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

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px", fontSize: "12px", color: "rgba(255,255,255,0.18)", lineHeight: 1.72 }}>
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
