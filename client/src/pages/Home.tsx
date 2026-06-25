/**
 * Medicare Advantage Homepage — Production-quality redesign.
 *
 * Constraints respected:
 *   • ZIP validation / workflow / modal / routing: UNCHANGED
 *   • No other pages or components modified
 *   • Accessibility: semantic IDs, aria roles, reduced-motion, keyboard CTA
 *   • Responsiveness: CSS-class breakpoints, viewport-height hero
 *   • Performance: no images, no heavy deps, reveal via IntersectionObserver
 *   • Hover states: CSS only — no onMouseEnter/Leave for styling
 */

import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { Search, Phone, ChevronRight } from "lucide-react";
import GuidedWorkflowModal, { type MBIVerifyResult } from "@/components/GuidedWorkflowModal";
import { useZipValidation } from "@/features/zip-validation/lib/useZipValidation";
import CountySelector from "@/features/zip-validation/components/CountySelector";
import Header from "@/components/Header";

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  deep:   "#1D3D47",   // Primary — headings, buttons, logo
  mid:    "#2A6B7A",   // Interactive — accent bars, hover, labels
  pale:   "#EAF2F4",   // Tint — panel header, icon backgrounds
  faint:  "#D4E5EA",   // Lighter tint
  offwht: "#F7F5F2",   // Warm off-white — alternate section backgrounds
  dark:   "#0D1B20",   // Near-black — main headlines
  body:   "#4A5E65",   // Body text
  muted:  "#8FA3A8",   // Sub-labels, microcopy
  rule:   "#E4ECEE",   // Hairline dividers
  err:    "#C0392B",   // Error state (required by convention — do not remove)
  ctaBg:  "#0F2A30",   // Closing CTA section background
  ftrBg:  "#0A2028",   // Footer background
} as const;

const F = {
  serif: "'DM Serif Display', Georgia, 'Times New Roman', serif",
  sans:  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Page data
// ─────────────────────────────────────────────────────────────────────────────
const TRUST_PILLARS = [
  { claim: "Licensed agents",       note: "Certified independent advisors in all 50 states" },
  { claim: "No cost to you",        note: "We're paid by carriers, never by you" },
  { claim: "CMS public data",       note: "All plan data sourced directly from CMS.gov" },
  { claim: "Doctors & Rx verified", note: "We check coverage before results appear" },
] as const;

const CARRIERS = [
  "UnitedHealthcare", "Humana", "Aetna", "Cigna",
  "WellCare", "Blue Cross", "Devoted Health", "Clover Health",
] as const;

const BENEFITS = [
  {
    label: "Independence",
    headline: "Every plan in your county. Not a curated selection.",
    body: "As independent advisors, we compare all available Medicare Advantage plans across every carrier active in your area. No plans are filtered out. No carrier pays for preferred placement.",
  },
  {
    label: "Precision",
    headline: "What you'll actually pay — calculated before you commit.",
    body: "Add your prescriptions and we calculate your true annual drug cost for every plan: deductible, tier copays, and coverage gap included. Add your doctors and we verify in-network status first.",
  },
  {
    label: "Control",
    headline: "Compare on your terms, at your own pace.",
    body: "You never have to speak with anyone to use this. If you'd like guidance from a licensed advisor, they're available. If you prefer to decide independently, everything you need is right here.",
  },
] as const;

const COVERAGE_TYPES = [
  {
    label: "Provider directory",
    title: "Your doctors.",
    body: "We cross-check every plan's provider directory so you know exactly which plans keep your existing care team in-network — before you see results.",
    note: "4,200+ providers checked in most counties",
  },
  {
    label: "Formulary check",
    title: "Your prescriptions.",
    body: "Enter your medications and we calculate your estimated annual drug cost for every plan — including deductibles, tier copays, and coverage gap.",
    note: "Tier 1–4 with deductible and gap coverage",
  },
  {
    label: "Quality rating",
    title: "Your coverage quality.",
    body: "Every plan shows its official CMS star rating alongside premiums and out-of-pocket costs. You see the full picture, not just the monthly premium.",
    note: "CMS 1–5 star ratings on every plan",
  },
] as const;

const HERO_PLANS = [
  { initials: "UH", carrier: "UnitedHealthcare", plan: "Community Plan HMO", premium: "$0",  starsStr: "★★★★☆", ratingLabel: "4.0", avatarBg: T.deep },
  { initials: "HU", carrier: "Humana",           plan: "Gold Plus HMO",       premium: "$0",  starsStr: "★★★★★", ratingLabel: "4.5", avatarBg: T.mid  },
  { initials: "AE", carrier: "Aetna Medicare",   plan: "Eagle PPO",           premium: "$19", starsStr: "★★★½☆", ratingLabel: "3.5", avatarBg: "#4A8C98" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Scroll-reveal hook
// ─────────────────────────────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!motionOK) { el.classList.add("visible"); return; }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add("visible"); obs.unobserve(el); } },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

// ─────────────────────────────────────────────────────────────────────────────
// HeroPlanPanel
// ─────────────────────────────────────────────────────────────────────────────
function HeroPlanPanel() {
  return (
    <figure
      aria-label="Representative Medicare Advantage plan comparison. Data from CMS.gov."
      style={{
        margin: 0,
        width: "100%", maxWidth: "420px",
        borderRadius: "20px", overflow: "hidden",
        boxShadow: "0 20px 64px rgba(13,27,32,0.11), 0 2px 8px rgba(13,27,32,0.05)",
        backgroundColor: "#FFFFFF",
        fontFamily: F.sans,
      }}
    >
      <div style={{
        backgroundColor: T.pale, padding: "10px 20px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: `1px solid ${T.faint}`,
      }}>
        <span style={{ fontSize: "11px", fontWeight: 500, color: T.mid, letterSpacing: "0.01em" }}>
          Plans available in your county
        </span>
        <span style={{ fontSize: "10px", color: T.muted }}>Data: CMS.gov</span>
      </div>

      <div style={{ position: "relative" }}>
        {HERO_PLANS.map((plan, i) => (
          <div key={plan.carrier}>
            {i > 0 && <div aria-hidden="true" style={{ height: "1px", backgroundColor: T.rule, margin: "0 20px" }} />}
            <div style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  aria-hidden="true"
                  style={{
                    width: 36, height: 36, borderRadius: "8px",
                    backgroundColor: plan.avatarBg, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "12px", fontWeight: 700, color: "white",
                  }}
                >
                  {plan.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px", marginBottom: "6px" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: T.dark, lineHeight: 1.2 }}>{plan.carrier}</div>
                      <div style={{ fontSize: "11px", color: T.muted, marginTop: "1px" }}>{plan.plan}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: T.deep, lineHeight: 1, letterSpacing: "-0.02em" }}>{plan.premium}</div>
                      <div style={{ fontSize: "10px", color: T.muted, marginTop: "1px" }}>/month</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span aria-label={`${plan.ratingLabel} out of 5 stars`} style={{ fontSize: "11px", color: T.mid, letterSpacing: "1.5px" }}>
                      {plan.starsStr}
                    </span>
                    <span style={{ fontSize: "10px", color: T.muted }}>{plan.ratingLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div
          aria-hidden="true"
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "72px",
            background: "linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.97))",
            pointerEvents: "none",
          }}
        />
      </div>

      <figcaption style={{
        padding: "11px 20px", borderTop: `1px solid ${T.rule}`,
        backgroundColor: T.offwht,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: "11px", color: T.muted }}>Showing 3 of 24+ plans in your county</span>
        <span style={{ fontSize: "10px", color: T.muted, opacity: 0.65 }}>Representative</span>
      </figcaption>
    </figure>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SectionLabel
// ─────────────────────────────────────────────────────────────────────────────
function SectionLabel({ children, light = false }: { children: string; light?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      fontFamily: F.sans, fontSize: "13px", fontWeight: 500,
      color: light ? "rgba(234,242,244,0.52)" : T.mid,
      letterSpacing: "0.01em", marginBottom: "20px",
    }}>
      <span
        aria-hidden="true"
        style={{
          display: "inline-block", width: "2px", height: "16px",
          backgroundColor: T.mid, borderRadius: "1px", flexShrink: 0,
        }}
      />
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Home
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {

  const [zip, setZip] = useState("");
  const [inputError, setInputError] = useState("");
  const zipValidation = useZipValidation();
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [showMBIModal, setShowMBIModal] = useState(false);
  const [pendingZip, setPendingZip] = useState("");
  const [, navigate] = useLocation();

  const benefitsRef    = useReveal();
  const coverageRef    = useReveal();
  const credibilityRef = useReveal();
  const ctaRef         = useReveal();

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
    <div className="hm-page" style={{ minHeight: "100vh", backgroundColor: "#FFFFFF", fontFamily: F.sans }}>

      <a href="#main-content" className="hm-skip-link" style={{
        position: "absolute", top: "-100%", left: "16px",
        backgroundColor: T.deep, color: "white",
        fontFamily: F.sans, fontSize: "14px", fontWeight: 600,
        padding: "10px 20px", borderRadius: "0 0 8px 8px",
        textDecoration: "none", zIndex: 9999,
      }}>
        Skip to main content
      </a>

      <Header />

      <style>{`
        .hm-page .hm-section-hero {
          background: linear-gradient(to right, #FFFFFF 54%, rgba(234,242,244,0.38) 54%);
          min-height: calc(100vh - 80px);
          display: flex;
          align-items: center;
        }
        @media (max-width: 1023px) {
          .hm-page .hm-section-hero { background: #FFFFFF; min-height: auto; padding: 80px 0; }
        }
        @media (max-width: 639px) {
          .hm-page .hm-section-hero { padding: 56px 0; }
        }
        .hm-page .hm-skip-link:focus { top: 0 !important; }
        .hm-page .hm-btn-primary:hover { background-color: #163038; }
        .hm-page .hm-btn-pale:hover    { background-color: #163038; }
        .hm-page .hm-text-cta:hover    { color: #2A6B7A; text-decoration-color: #2A6B7A; }
        .hm-page .hm-footer-link:hover { opacity: 1 !important; color: ${T.pale} !important; }
        .hm-page .hm-phone-link:hover  { color: ${T.pale} !important; }
        .hm-page .hm-zip-input:focus {
          border-color: ${T.mid} !important;
          box-shadow: 0 0 0 3px rgba(42,107,122,0.12) !important;
          outline: none;
        }
        .hm-page .hm-cta-zip:focus {
          border-color: #2A6B7A !important;
          box-shadow: 0 0 0 3px rgba(42,107,122,0.22) !important;
          outline: none;
        }
        @media (max-width: 1023px) {
          .hm-page .hm-hero-flex      { flex-direction: column !important; }
          .hm-page .hm-plan-panel     { display: none !important; }
          .hm-page .hm-creds-grid     { grid-template-columns: repeat(2, 1fr) !important; }
          .hm-page .hm-benefits-asymm { grid-template-columns: 1fr !important; gap: 3.5rem !important; }
          .hm-page .hm-coverage-split { grid-template-columns: 1fr !important; gap: 3.5rem !important; }
          .hm-page .hm-proof-split    { grid-template-columns: 1fr !important; gap: 3rem !important; }
          .hm-page .hm-footer-grid    { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 639px) {
          .hm-page .hm-creds-grid  { grid-template-columns: 1fr !important; }
          .hm-page .hm-footer-grid { grid-template-columns: 1fr !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hm-page .reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
        }
      `}</style>

      {showMBIModal && (
        <GuidedWorkflowModal zip={pendingZip} onSkip={handleMBISkip} onComplete={handleWorkflowComplete} />
      )}

      <main id="main-content">

        {/* §1 HERO */}
        <section id="hero" aria-label="Find your Medicare Advantage plan" className="hm-section-hero">
          <div className="container hm-hero-flex" style={{ display: "flex", alignItems: "center", gap: "100px", width: "100%" }}>
            <div style={{ flex: "0 0 auto", maxWidth: "520px", width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", fontFamily: F.sans, fontSize: "13px", fontWeight: 500, color: T.muted, letterSpacing: "0.01em", marginBottom: "32px" }}>
                <span aria-hidden="true" style={{ display: "inline-block", width: "2px", height: "20px", backgroundColor: T.mid, borderRadius: "1px", flexShrink: 0 }} />
                Independent advisors · Licensed in all 50 states · No cost to you
              </div>
              <h1 style={{ fontFamily: F.serif, fontSize: "clamp(44px, 6vw, 80px)", fontWeight: 400, lineHeight: 1.06, letterSpacing: "-0.02em", color: T.dark, marginBottom: "24px" }}>
                Medicare Advantage,<br />
                <em style={{ color: T.deep, fontStyle: "italic" }}>made clear.</em>
              </h1>
              <p style={{ fontFamily: F.sans, fontSize: "18px", fontWeight: 400, lineHeight: 1.72, color: T.body, marginBottom: "48px", maxWidth: "420px" }}>
                Compare every plan in your county — matched to your doctors, prescriptions, and budget.
              </p>
              <div>
                <div style={{ display: "flex", gap: "10px", maxWidth: "440px" }}>
                  <input
                    id="zip-input-hero"
                    ref={zipInputRef}
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="Enter your ZIP code"
                    value={zip}
                    onChange={(e) => { setZip(e.target.value.replace(/\D/g, "")); setInputError(""); }}
                    onKeyDown={handleKeyDown}
                    aria-label="ZIP code"
                    aria-describedby="zip-error-hero"
                    aria-invalid={!!inputError}
                    className="hm-zip-input"
                    style={{
                      flex: 1, fontFamily: F.sans, padding: "16px 20px", fontSize: "17px", fontWeight: 600,
                      color: T.dark, backgroundColor: "#FFFFFF",
                      border: `2px solid ${inputError ? T.err : T.rule}`,
                      borderRadius: "10px", outline: "none",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                      boxSizing: "border-box", boxShadow: "0 1px 6px rgba(13,27,32,0.07)",
                    }}
                  />
                  <button type="button" onClick={handleSearch} className="hm-btn-primary" style={{ fontFamily: F.sans, padding: "16px 24px", backgroundColor: T.deep, color: "white", fontWeight: 600, fontSize: "15px", borderRadius: "10px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap", transition: "background-color 0.15s", flexShrink: 0, letterSpacing: "0.01em" }}>
                    See my plans
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </div>
                <p id="zip-error-hero" role="alert" aria-live="assertive" aria-atomic="true" style={{ fontFamily: F.sans, fontSize: "13px", color: T.err, marginTop: "8px", minHeight: "18px", display: "flex", alignItems: "center", gap: "5px" }}>
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
                <p style={{ fontFamily: F.sans, fontSize: "13px", color: T.muted, marginTop: "16px" }}>
                  Always free · No account required · No calls unless you want them
                </p>
              </div>
            </div>
            <div className="hm-plan-panel" style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", minWidth: 0 }}>
              <HeroPlanPanel />
            </div>
          </div>
        </section>

        {/* §2 CREDENTIALS */}
        <section id="credentials" aria-label="Service credentials and plan carriers" style={{ backgroundColor: T.offwht, borderTop: `1px solid ${T.rule}`, borderBottom: `1px solid ${T.rule}` }}>
          <div className="container">
            <div className="hm-creds-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
              {TRUST_PILLARS.map((p, i) => (
                <div key={p.claim} style={{ padding: "24px 28px", borderLeft: i > 0 ? `1px solid ${T.rule}` : "none", fontFamily: F.sans }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: T.dark, marginBottom: "3px", letterSpacing: "-0.005em" }}>{p.claim}</div>
                  <div style={{ fontSize: "12px", color: T.muted, lineHeight: 1.45 }}>{p.note}</div>
                </div>
              ))}
            </div>
            <div aria-hidden="true" style={{ height: "1px", backgroundColor: T.rule }} />
            <div style={{ padding: "16px 28px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0", rowGap: "6px" }}>
              <span style={{ fontFamily: F.sans, fontSize: "12px", color: T.muted, marginRight: "16px", whiteSpace: "nowrap" }}>Plans from</span>
              {CARRIERS.map((name, i) => (
                <span key={name} style={{ display: "flex", alignItems: "center" }}>
                  {i > 0 && <span aria-hidden="true" style={{ color: T.rule, margin: "0 12px", lineHeight: 1 }}>·</span>}
                  <span style={{ fontFamily: F.sans, fontSize: "13px", fontWeight: 500, color: T.body }}>{name}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* §3 WHY PEOPLE USE US */}
        <section id="why-us" aria-labelledby="why-us-heading" style={{ backgroundColor: "#FFFFFF", padding: "136px 0" }}>
          <div className="container">
            <div style={{ marginBottom: "64px" }}>
              <SectionLabel>Why people use us</SectionLabel>
              <h2 id="why-us-heading" style={{ fontFamily: F.serif, fontSize: "clamp(28px, 3.8vw, 48px)", fontWeight: 400, letterSpacing: "-0.015em", color: T.dark, lineHeight: 1.14, maxWidth: "640px" }}>
                Built for people making an important decision —{" "}not for people in a hurry.
              </h2>
            </div>
            <div ref={benefitsRef} className="reveal hm-benefits-asymm" style={{ display: "grid", gridTemplateColumns: "56fr 44fr", gap: "80px", alignItems: "start" }}>
              <article aria-label={BENEFITS[0].label}>
                <div style={{ borderLeft: `3px solid ${T.deep}`, paddingLeft: "24px" }}>
                  <div style={{ fontFamily: F.sans, fontSize: "12px", fontWeight: 500, color: T.mid, letterSpacing: "0.02em", marginBottom: "14px" }}>{BENEFITS[0].label}</div>
                  <p style={{ fontFamily: F.serif, fontSize: "clamp(22px, 2.5vw, 28px)", fontWeight: 400, color: T.dark, lineHeight: 1.25, letterSpacing: "-0.02em", marginBottom: "18px" }}>
                    {BENEFITS[0].headline}
                  </p>
                  <p style={{ fontFamily: F.sans, fontSize: "16px", lineHeight: 1.78, color: T.body, maxWidth: "36ch" }}>{BENEFITS[0].body}</p>
                </div>
              </article>
              <div style={{ borderTop: `1px solid ${T.rule}` }}>
                {BENEFITS.slice(1).map((b, i) => (
                  <div key={b.label} style={{ paddingTop: "32px", paddingBottom: i === 0 ? "32px" : "0", borderBottom: i === 0 ? `1px solid ${T.rule}` : "none" }}>
                    <div style={{ fontFamily: F.sans, fontSize: "12px", fontWeight: 500, color: T.mid, letterSpacing: "0.02em", marginBottom: "12px" }}>{b.label}</div>
                    <p style={{ fontFamily: F.sans, fontSize: "17px", fontWeight: 600, color: T.dark, lineHeight: 1.32, letterSpacing: "-0.01em", marginBottom: "12px" }}>{b.headline}</p>
                    <p style={{ fontFamily: F.sans, fontSize: "15px", lineHeight: 1.75, color: T.body, maxWidth: "30ch" }}>{b.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* §4 COVERAGE VERIFICATION */}
        <section id="coverage" aria-labelledby="coverage-heading" style={{ backgroundColor: T.offwht, padding: "136px 0" }}>
          <div className="container">
            <div className="hm-coverage-split" style={{ display: "grid", gridTemplateColumns: "38fr 62fr", gap: "80px", alignItems: "start" }}>
              <div>
                <SectionLabel>Coverage verification</SectionLabel>
                <h2 id="coverage-heading" style={{ fontFamily: F.serif, fontSize: "clamp(26px, 3.2vw, 36px)", fontWeight: 400, letterSpacing: "-0.01em", color: T.dark, lineHeight: 1.22, marginBottom: "18px" }}>
                  We verify what matters most before you see results.
                </h2>
                <p style={{ fontFamily: F.sans, fontSize: "16px", lineHeight: 1.75, color: T.body, marginBottom: "32px", maxWidth: "30ch" }}>
                  Switching Medicare plans and losing your doctor is the most common and most avoidable Medicare mistake. We check everything before a single plan appears on your screen.
                </p>
                <button type="button" className="hm-text-cta" onClick={() => navigate(`/plans?zip=${zip || "64106"}`)} style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "none", border: "none", padding: 0, fontFamily: F.sans, fontSize: "15px", fontWeight: 600, color: T.deep, cursor: "pointer", textDecoration: "underline", textDecorationColor: T.faint, textUnderlineOffset: "3px", transition: "color 0.12s, text-decoration-color 0.12s" }}>
                  Compare plans with your doctors and Rx
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
                <p style={{ fontFamily: F.sans, marginTop: "10px", fontSize: "12px", color: T.muted }}>No account required</p>
              </div>
              <div ref={coverageRef} className="reveal">
                {COVERAGE_TYPES.map((ct, i) => (
                  <div key={ct.label} style={{ display: "flex", alignItems: "flex-start", gap: "32px", paddingTop: i === 0 ? "0" : "32px", paddingBottom: i < COVERAGE_TYPES.length - 1 ? "32px" : "0", borderBottom: i < COVERAGE_TYPES.length - 1 ? `1px solid ${T.rule}` : "none" }}>
                    <div style={{ fontFamily: F.serif, fontSize: "21px", fontWeight: 400, color: T.deep, letterSpacing: "-0.01em", lineHeight: 1.2, width: "136px", flexShrink: 0, paddingTop: "2px" }}>{ct.title}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: F.sans, fontSize: "15px", lineHeight: 1.72, color: T.body, marginBottom: "10px" }}>{ct.body}</p>
                      <p style={{ fontFamily: F.sans, fontSize: "12px", color: T.muted, margin: 0 }}>{ct.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* §5 TRUST / PROOF */}
        <section id="trust" aria-labelledby="trust-heading" style={{ backgroundColor: "#FFFFFF", padding: "136px 0", borderTop: `1px solid ${T.rule}` }}>
          <div className="container">
            <SectionLabel>Why clients trust us</SectionLabel>
            <div ref={credibilityRef} className="reveal hm-proof-split" style={{ display: "grid", gridTemplateColumns: "4fr 6fr", gap: "80px", alignItems: "start" }}>
              <div>
                <p style={{ fontFamily: F.sans, fontSize: "17px", lineHeight: 1.75, color: T.body, marginBottom: "48px" }}>
                  We're independent advisors — no carrier pays for referrals, and no plan is hidden from your results. Every comparison uses plan data published directly by CMS.gov.
                </p>
                <p style={{ fontFamily: F.sans, fontSize: "14px", color: T.muted, lineHeight: 1.65, marginBottom: "24px" }}>
                  Comparing 24 or more plans per county from every active carrier — no plan hidden, no carrier given preferred placement.
                </p>
                <p style={{ fontFamily: F.sans, fontSize: "12px", color: T.muted, lineHeight: 1.65, paddingTop: "20px", borderTop: `1px solid ${T.rule}` }}>
                  All plan data from CMS.gov public records, updated annually. Not affiliated with or endorsed by any insurance carrier.
                </p>
              </div>
              <div aria-label="Since 2010, we've helped more than 500,000 seniors find better Medicare coverage.">
                <p style={{ fontFamily: F.serif, fontWeight: 400, color: T.body, lineHeight: 1.15, fontSize: "clamp(18px, 2.2vw, 26px)", margin: 0 }}>Since 2010, we've helped more than</p>
                <p aria-hidden="true" style={{ fontFamily: F.serif, fontWeight: 400, color: T.deep, lineHeight: 0.9, letterSpacing: "-0.03em", fontSize: "clamp(44px, 6.5vw, 80px)", margin: "10px 0" }}>500,000 seniors</p>
                <p style={{ fontFamily: F.serif, fontWeight: 400, color: T.body, lineHeight: 1.2, fontSize: "clamp(18px, 2.2vw, 26px)", margin: 0 }}>find better Medicare coverage.</p>
              </div>
            </div>
          </div>
        </section>

        {/* §6 FINAL CTA */}
        <section id="start" aria-labelledby="cta-heading" style={{ backgroundColor: T.ctaBg, padding: "136px 0" }}>
          <div ref={ctaRef} className="reveal container" style={{ maxWidth: "600px" }}>
            <SectionLabel light>Free comparison service</SectionLabel>
            <h2 id="cta-heading" style={{ fontFamily: F.serif, fontSize: "clamp(28px, 4.5vw, 48px)", fontWeight: 400, letterSpacing: "-0.01em", color: "#FFFFFF", lineHeight: 1.15, marginBottom: "18px" }}>
              The plan you choose today determines who can treat you next year.
            </h2>
            <p style={{ fontFamily: F.sans, fontSize: "16px", color: "rgba(234,242,244,0.62)", lineHeight: 1.75, marginBottom: "36px", maxWidth: "42ch" }}>
              Every doctor visit, every prescription, every out-of-pocket cost is shaped by your Medicare Advantage plan. Start with your ZIP code — we'll show you every plan available in your county.
            </p>
            <div style={{ display: "flex", gap: "10px", maxWidth: "400px", marginBottom: "18px" }}>
              <input type="text" inputMode="numeric" maxLength={5} placeholder="Enter ZIP code" value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} onKeyDown={handleKeyDown} aria-label="ZIP code for plan comparison" className="hm-cta-zip" style={{ flex: 1, fontFamily: F.sans, padding: "14px 18px", fontSize: "16px", fontWeight: 500, color: T.dark, backgroundColor: "#FFFFFF", border: "2px solid transparent", borderRadius: "10px", outline: "none", transition: "border-color 0.15s, box-shadow 0.15s" }} />
              <button type="button" className="hm-btn-pale" onClick={handleSearch} style={{ fontFamily: F.sans, padding: "14px 20px", backgroundColor: T.mid, color: "white", fontWeight: 600, fontSize: "14px", borderRadius: "10px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", whiteSpace: "nowrap", transition: "background-color 0.15s", flexShrink: 0 }}>
                <Search size={15} aria-hidden="true" />
                See Plans
              </button>
            </div>
            <p style={{ fontFamily: F.sans, fontSize: "13px", color: "rgba(234,242,244,0.38)", display: "flex", alignItems: "center", gap: "8px" }}>
              <Phone size={13} aria-hidden="true" />
              <span>Or call{" "}<a href="tel:1-800-555-0100" className="hm-phone-link" style={{ color: "rgba(234,242,244,0.72)", fontWeight: 500, textDecoration: "none", transition: "color 0.12s" }}>1-800-555-0100</a>{" "}to speak with a licensed advisor</span>
            </p>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer aria-label="Site footer" style={{ backgroundColor: T.ftrBg, color: "white", fontFamily: F.sans, padding: "64px 0" }}>
        <div className="container">
          <div className="hm-footer-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: "40px", marginBottom: "48px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "18px" }}>
                <div aria-hidden="true" style={{ width: "2px", height: "32px", backgroundColor: T.mid, flexShrink: 0, borderRadius: "1px" }} />
                <div>
                  <div style={{ fontFamily: F.serif, fontSize: "18px", fontWeight: 400, color: "white", lineHeight: 1.1, letterSpacing: "-0.01em" }}>MedicarePlan</div>
                  <div style={{ fontFamily: F.sans, fontSize: "10px", fontWeight: 400, color: "rgba(255,255,255,0.45)", letterSpacing: "0.05em", marginTop: "2px" }}>Finder</div>
                </div>
              </div>
              <p style={{ fontSize: "13px", lineHeight: 1.7, opacity: 0.5, maxWidth: "28ch" }}>Helping Americans find the right Medicare Advantage plan since 2010. Licensed in all 50 states.</p>
            </div>
            {[
              { title: "Plans", links: [{ label: "Medicare Advantage", href: "/medicare-advantage/hmo-plans" }, { label: "Medicare Supplement", href: "/medicare-supplement/compare" }, { label: "Part D Drug Plans", href: "/part-d/compare" }, { label: "Dual Eligible", href: "/dual-eligible" }] },
              { title: "Resources", links: [{ label: "Medicare 101", href: "/resources/medicare-101" }, { label: "Enrollment Periods", href: "/resources/enrollment-periods" }, { label: "Star Ratings Guide", href: "/resources/star-ratings" }, { label: "Compare Plans", href: `/plans?zip=${zip || "64106"}` }] },
              { title: "Company", links: [{ label: "About Us", href: "/about" }, { label: "Licensed Agents", href: "/agents" }, { label: "Contact Us", href: "/contact" }, { label: "Privacy Policy", href: "/privacy" }] },
            ].map((col) => (
              <nav key={col.title} aria-label={`${col.title} links`}>
                <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.4, marginBottom: "14px" }}>{col.title}</div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="hm-footer-link" style={{ fontSize: "13px", opacity: 0.5, color: "white", textDecoration: "none", transition: "opacity 0.12s, color 0.12s" }}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div style={{ borderTop: "1px solid rgba(234,242,244,0.08)", paddingTop: "20px", marginBottom: "20px" }}>
            <div style={{ fontSize: "11px", fontWeight: 500, letterSpacing: "0.04em", opacity: 0.3, marginBottom: "10px" }}>Technical resources</div>
            <a href="https://d2xsxph8kpxj0f.cloudfront.net/310519663319810046/5TY7JcF275WMujMHZWWJT8/episode-alert-api-integration-guide_6a93d69a.pdf" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "8px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 400, color: "rgba(234,242,244,0.55)", backgroundColor: "rgba(234,242,244,0.06)", border: "1px solid rgba(234,242,244,0.1)", textDecoration: "none", transition: "background-color 0.12s" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Episode Alert API Integration Guide (PDF)
            </a>
          </div>
          <div style={{ borderTop: "1px solid rgba(234,242,244,0.08)", paddingTop: "20px", fontSize: "12px", opacity: 0.3, lineHeight: 1.7 }}>
            <p style={{ marginBottom: "4px" }}>We are not affiliated with or endorsed by the U.S. government or the federal Medicare program. This is a demonstration application. Plan data is sourced from CMS public datasets.</p>
            <p>© 2026 MedicarePlan Finder. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
