// Medicare Advantage Quote Engine — Landing Page
// Design: Chapter-style Premium | Navy #1B365D | Red #C41E3A | Light Blue #E8F0FE

import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import {
  MapPin, Search, Shield, Star, Users, ChevronRight, CheckCircle2,
  Phone, Award, Zap, Lock, TrendingDown, HeartPulse, Stethoscope,
  BadgeCheck, Clock, DollarSign
} from "lucide-react";
import GuidedWorkflowModal, { type MBIVerifyResult } from "@/components/GuidedWorkflowModal";
import { useZipValidation } from "@/features/zip-validation/lib/useZipValidation";
import CountySelector from "@/features/zip-validation/components/CountySelector";
import { inputAriaProps } from "@/lib/a11y/focusTrap";
import Header from "@/components/Header";

const HERO_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663319810046/5TY7JcF275WMujMHZWWJT8/medicare-doctor-network-UbrpVenqJHVZiygzeBgcKi.webp";

const POPULAR_ZIPS = [
  { zip: "64106", city: "Kansas City, MO" },
  { zip: "10001", city: "New York, NY" },
  { zip: "90210", city: "Beverly Hills, CA" },
  { zip: "33101", city: "Miami, FL" },
];

const CARRIERS = [
  "UnitedHealthcare",
  "Humana",
  "Aetna",
  "Cigna",
  "WellCare",
  "Blue Cross",
  "Devoted Health",
  "Clover Health",
];

const STATS = [
  { value: "24+", label: "Plans Available", sub: "in most counties", icon: TrendingDown },
  { value: "$0", label: "Lowest Premium", sub: "many plans available", icon: DollarSign },
  { value: "8+", label: "Top Carriers", sub: "UHC, Humana, Aetna & more", icon: BadgeCheck },
  { value: "4.5★", label: "Top Rated Plans", sub: "CMS quality ratings", icon: Star },
];

const FEATURES = [
  {
    icon: Search,
    color: "#E8F0FE",
    iconColor: "#1B365D",
    title: "Compare All Plans Side-by-Side",
    desc: "See every Medicare Advantage plan available in your ZIP code with detailed benefits, copays, and drug coverage.",
  },
  {
    icon: Shield,
    color: "#FDEEF1",
    iconColor: "#C41E3A",
    title: "No Cost, No Obligation",
    desc: "Our service is 100% free. We're paid by insurance carriers, never by you. Compare plans without any pressure.",
  },
  {
    icon: Star,
    color: "#FFF8E1",
    iconColor: "#D97706",
    title: "CMS Star Ratings Included",
    desc: "Every plan shows its official CMS quality star rating so you can choose a plan with proven performance.",
  },
  {
    icon: Stethoscope,
    color: "#F0FDF4",
    iconColor: "#16A34A",
    title: "Check Your Doctors & Drugs",
    desc: "Add your doctors and prescriptions to see which plans cover them and estimate your total annual costs.",
  },
];

const TRUST_ITEMS = [
  { icon: Lock, title: "100% Secure & Private", desc: "Your information is never sold or shared with third parties." },
  { icon: BadgeCheck, title: "Licensed in All 50 States", desc: "Our agents are fully licensed and certified Medicare advisors." },
  { icon: Clock, title: "Free, No-Obligation Service", desc: "Compare plans at your own pace. No pressure, ever." },
  { icon: HeartPulse, title: "Trusted by 500,000+ Seniors", desc: "Helping Americans find better Medicare coverage since 2010." },
];

// ── Scroll-reveal hook ───────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

export default function Home() {
  const [zip, setZip] = useState("");
  const [inputError, setInputError] = useState("");
  const zipValidation = useZipValidation();
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [showMBIModal, setShowMBIModal] = useState(false);
  const [pendingZip, setPendingZip] = useState("");
  const [, navigate] = useLocation();

  const statsRef = useReveal();
  const featuresRef = useReveal();
  const trustRef = useReveal();
  const ctaRef = useReveal();

  const handleSearch = async () => {
    const trimmed = zip.trim();
    const result = await zipValidation.validate(trimmed);

    if (result.status === 'invalid_format' || result.status === 'invalid_zip' || result.status === 'error') {
      setInputError(result.errorMessage);
      // Return focus to ZIP input for accessibility
      setTimeout(() => zipInputRef.current?.focus(), 50);
      return;
    }

    if (result.status === 'needs_county_selection') {
      setInputError('');
      // County selector renders below — user must pick before proceeding
      return;
    }

    if (result.status === 'valid') {
      setInputError('');
      setPendingZip(trimmed);
      setShowMBIModal(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleMBISkip = () => {
    setShowMBIModal(false);
    navigate(`/plans?zip=${pendingZip}`);
  };

  const handleWorkflowComplete = (data: { hasMA: boolean; verifyResult: MBIVerifyResult | null; doctors: any[]; drugs: any[] }) => {
    setShowMBIModal(false);
    // Store workflow data in sessionStorage for Plans.tsx
    try {
      if (data.verifyResult) {
        sessionStorage.setItem("mbi_eligibility", JSON.stringify(data.verifyResult));
      }
      sessionStorage.setItem("workflow_data", JSON.stringify(data));
    } catch {
      // sessionStorage unavailable
    }
    const params = new URLSearchParams({ zip: pendingZip });
    if (data.verifyResult) params.set("verified", "1");
    if (data.doctors.length > 0 || data.drugs.length > 0) params.set("personalized", "1");
    navigate(`/plans?${params.toString()}`);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FFFFFF" }}>
      <Header />

      {/* ── Guided Workflow Modal ─────────────────────────────────── */}
        {showMBIModal && (
          <GuidedWorkflowModal
            zip={pendingZip}
            onSkip={handleMBISkip}
            onComplete={handleWorkflowComplete}
          />
        )}

      {/* ── Hero Section — Split Layout ──────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ backgroundColor: "#F7F8FA", minHeight: "600px" }}>
        {/* Subtle background pattern */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, #E8F0FE 0%, transparent 50%), radial-gradient(circle at 80% 20%, #FDEEF1 0%, transparent 40%)",
          }}
        />

        <div className="relative container py-16 lg:py-20">
          <div className="grid lg:grid-cols-5 gap-12 items-center">
            {/* Left: Text content (60%) */}
            <div className="lg:col-span-3">
              {/* Eyebrow badge */}
              <div
                className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full mb-6"
                style={{ backgroundColor: "#FDEEF1", color: "#C41E3A", border: "1px solid #F5C6CE" }}
              >
                <Award size={12} />
                2026 Medicare Advantage Open Enrollment
              </div>

              {/* Headline */}
              <h1
                className="text-4xl lg:text-5xl xl:text-[56px] font-extrabold leading-tight mb-5"
                style={{ color: "#1B365D", fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}
              >
                Find the Best
                <br />
                <span style={{ color: "#C41E3A" }}>Medicare Advantage</span>
                <br />
                Plans Near You
              </h1>

              <p className="text-lg mb-8 leading-relaxed max-w-xl" style={{ color: "#555555" }}>
                Compare plans from top carriers — including{" "}
                <strong style={{ color: "#1B365D" }}>$0 premium options</strong> with dental, vision,
                and prescription drug coverage. Free, no obligation.
              </p>

              {/* ZIP Search Box */}
              <div
                className="bg-white rounded-2xl p-6 mb-6"
                style={{ boxShadow: "0 4px 32px rgba(27,54,93,0.12)", border: "1px solid #E8F0FE" }}
              >
                <div
                  className="text-sm font-semibold mb-3 flex items-center gap-2"
                  style={{ color: "#1B365D" }}
                >
                  <MapPin size={15} style={{ color: "#C41E3A" }} />
                  Enter your ZIP code to see plans in your area
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="e.g. 64106"
                      value={zip}
                      onChange={(e) => {
                        setZip(e.target.value.replace(/\D/g, ""));
                        setInputError("");
                      }}
                      onKeyDown={handleKeyDown}
                      className="w-full px-4 py-4 text-lg font-semibold border-2 rounded-xl outline-none transition-all"
                      style={{
                        borderColor: inputError ? "#C41E3A" : "#E5E7EB",
                        color: "#1B365D",
                        fontFamily: "'Inter', sans-serif",
                      }}
                      onFocus={(e) => {
                        if (!inputError) e.currentTarget.style.borderColor = "#1B365D";
                        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(27,54,93,0.12)";
                      }}
                      onBlur={(e) => {
                        if (!inputError) e.currentTarget.style.borderColor = "#E5E7EB";
                        e.currentTarget.style.boxShadow = "";
                      }}
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    className="btn-cta px-6 py-4 text-base font-bold flex items-center gap-2 whitespace-nowrap"
                    style={{ backgroundColor: "#C41E3A", color: "white", borderRadius: "12px" }}
                  >
                    <Search size={18} />
                    See Plans
                  </button>
                </div>
                {/* Accessible error — always in DOM as live region */}
                <p
                  id="zip-error-msg"
                  role="alert"
                  aria-live="assertive"
                  aria-atomic="true"
                  className="text-sm mt-2 flex items-center gap-1"
                  style={{ color: "#C41E3A", minHeight: "20px" }}
                >
                  {inputError && <><span aria-hidden="true">⚠</span> {inputError}</>}
                </p>

                {/* Multi-county selector — shown before advancing */}
                {zipValidation.result.status === 'needs_county_selection' && zipValidation.result.counties && (
                  <CountySelector
                    zip={zip}
                    counties={zipValidation.result.counties}
                    onSelect={(county) => {
                      const r = zipValidation.selectCounty(county);
                      if (r.status === 'valid') {
                        setInputError('');
                        setPendingZip(zip.trim());
                        setShowMBIModal(true);
                      }
                    }}
                  />
                )}

                {/* Popular ZIPs */}
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-medium" style={{ color: "#9CA3AF" }}>Popular:</span>
                  {POPULAR_ZIPS.map((z) => (
                    <button
                      key={z.zip}
                      onClick={() => {
                        setZip(z.zip);
                        setPendingZip(z.zip);
                        setShowMBIModal(true);
                      }}
                      className="text-xs px-3 py-1 rounded-full border transition-all font-medium"
                      style={{ borderColor: "#E5E7EB", color: "#555555" }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#1B365D";
                        (e.currentTarget as HTMLButtonElement).style.color = "#1B365D";
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#E8F0FE";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#E5E7EB";
                        (e.currentTarget as HTMLButtonElement).style.color = "#555555";
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = "";
                      }}
                    >
                      {z.zip} – {z.city}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trust signals */}
              <div className="flex flex-wrap items-center gap-5">
                {[
                  { icon: CheckCircle2, text: "No cost to compare" },
                  { icon: CheckCircle2, text: "Licensed agents available" },
                  { icon: CheckCircle2, text: "All major carriers" },
                ].map((t) => (
                  <div key={t.text} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "#555555" }}>
                    <t.icon size={15} style={{ color: "#16A34A" }} />
                    {t.text}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Image (40%) */}
            <div className="lg:col-span-2 relative hidden lg:block">
              <div className="relative rounded-3xl overflow-hidden" style={{ boxShadow: "0 20px 60px rgba(27,54,93,0.18)" }}>
                <img
                  src={HERO_IMG}
                  alt="Medicare advisor helping senior"
                  className="w-full h-[480px] object-cover object-top"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to top, rgba(27,54,93,0.5) 0%, transparent 50%)" }}
                />
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <div className="text-sm font-bold">4,200+ In-Network Providers</div>
                  <div className="text-xs opacity-80">Available in your area</div>
                </div>
              </div>

              {/* Floating badge — top right */}
              <div
                className="absolute -top-4 -right-4 bg-white rounded-2xl p-4"
                style={{ boxShadow: "0 8px 32px rgba(27,54,93,0.15)", border: "1px solid #E8F0FE" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: "#FFF8E1" }}
                  >
                    <Star size={18} style={{ color: "#D97706", fill: "#D97706" }} />
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ color: "#1B365D" }}>Top Rated</div>
                    <div className="text-xs" style={{ color: "#6B7280" }}>4.5★ Plans Available</div>
                  </div>
                </div>
              </div>

              {/* Floating badge — bottom left */}
              <div
                className="absolute -bottom-4 -left-4 bg-white rounded-2xl p-4"
                style={{ boxShadow: "0 8px 32px rgba(27,54,93,0.15)", border: "1px solid #E8F0FE" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: "#FDEEF1" }}
                  >
                    <DollarSign size={18} style={{ color: "#C41E3A" }} />
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ color: "#1B365D" }}>$0 Premium</div>
                    <div className="text-xs" style={{ color: "#6B7280" }}>Plans available</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Section ─────────────────────────────────────────────────── */}
      <section className="py-16" style={{ backgroundColor: "#E8F0FE" }}>
        <div className="container">
          <div ref={statsRef} className="reveal grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className="bg-white rounded-2xl p-6 text-center transition-all"
                style={{
                  boxShadow: "0 2px 16px rgba(27,54,93,0.08)",
                  animationDelay: `${i * 80}ms`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(27,54,93,0.15)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 16px rgba(27,54,93,0.08)";
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: "#E8F0FE" }}
                >
                  <stat.icon size={22} style={{ color: "#1B365D" }} />
                </div>
                <div
                  className="text-3xl font-extrabold mb-1"
                  style={{ color: "#C41E3A", fontFamily: "'Inter', sans-serif" }}
                >
                  {stat.value}
                </div>
                <div className="text-sm font-bold" style={{ color: "#1B365D" }}>{stat.label}</div>
                <div className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Carrier Logos ─────────────────────────────────────────────────── */}
      <section className="py-12 bg-white" style={{ borderTop: "1px solid #F0F4FF", borderBottom: "1px solid #F0F4FF" }}>
        <div className="container">
          <p
            className="text-center text-xs font-bold uppercase tracking-widest mb-8"
            style={{ color: "#9CA3AF" }}
          >
            Compare plans from these top carriers
          </p>
          <div className="flex flex-wrap justify-center items-center gap-4">
            {CARRIERS.map((name) => (
              <div
                key={name}
                className="px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  backgroundColor: "#F7F8FA",
                  color: "#1B365D",
                  border: "1.5px solid #E8F0FE",
                  fontFamily: "'Inter', sans-serif",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = "#E8F0FE";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#1B365D";
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(27,54,93,0.12)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = "#F7F8FA";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#E8F0FE";
                  (e.currentTarget as HTMLDivElement).style.transform = "";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "";
                }}
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Grid ─────────────────────────────────────────────────── */}
      <section className="py-20" style={{ backgroundColor: "#F7F8FA" }}>
        <div className="container">
          <div className="text-center mb-14">
            <div
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full mb-4"
              style={{ backgroundColor: "#E8F0FE", color: "#1B365D" }}
            >
              <Zap size={12} />
              Why Choose Us
            </div>
            <h2
              className="text-3xl lg:text-4xl font-extrabold mb-4"
              style={{ color: "#1B365D", fontFamily: "'Inter', sans-serif" }}
            >
              Why Compare Plans With Us?
            </h2>
            <p className="text-lg max-w-xl mx-auto" style={{ color: "#555555" }}>
              We make it easy to find the right Medicare Advantage plan for your health needs and budget.
            </p>
          </div>
          <div ref={featuresRef} className="reveal grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="bg-white rounded-2xl p-8 transition-all"
                style={{
                  border: "1.5px solid #F0F4FF",
                  boxShadow: "0 2px 12px rgba(27,54,93,0.06)",
                  animationDelay: `${i * 80}ms`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#1B365D";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(27,54,93,0.12)";
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#F0F4FF";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(27,54,93,0.06)";
                  (e.currentTarget as HTMLDivElement).style.transform = "";
                }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                  style={{ backgroundColor: f.color }}
                >
                  <f.icon size={22} style={{ color: f.iconColor }} />
                </div>
                <h3
                  className="text-base font-bold mb-2"
                  style={{ color: "#1B365D", fontFamily: "'Inter', sans-serif" }}
                >
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Doctor Network CTA ────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div
                className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full mb-5"
                style={{ backgroundColor: "#E8F0FE", color: "#1B365D" }}
              >
                <Shield size={12} />
                Doctor & Drug Coverage Check
              </div>
              <h2
                className="text-3xl lg:text-4xl font-extrabold mb-5"
                style={{ color: "#1B365D", fontFamily: "'Inter', sans-serif" }}
              >
                Make Sure Your Doctors
                <br />
                <span style={{ color: "#C41E3A" }}>Are In-Network</span>
              </h2>
              <p className="text-lg mb-7 leading-relaxed" style={{ color: "#555555" }}>
                Add your current doctors and prescription drugs to instantly see which plans cover
                them — and estimate your total out-of-pocket costs for the year.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Check if your doctors accept the plan",
                  "See exact drug costs for your medications",
                  "Compare total annual cost estimates",
                  "Find plans with the lowest out-of-pocket maximum",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm font-medium" style={{ color: "#333333" }}>
                    <CheckCircle2 size={16} style={{ color: "#16A34A" }} className="shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate(`/plans?zip=${zip || "64106"}`)}
                className="btn-cta inline-flex items-center gap-2 px-7 py-4 text-base font-bold"
                style={{ backgroundColor: "#C41E3A", color: "white", borderRadius: "10px" }}
              >
                Compare Plans Now
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="relative">
              <div className="relative rounded-3xl overflow-hidden" style={{ boxShadow: "0 20px 60px rgba(27,54,93,0.18)" }}>
                <img
                  src={HERO_IMG}
                  alt="Doctor network"
                  className="w-full h-80 object-cover object-top"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to top, rgba(27,54,93,0.6) 0%, transparent 60%)" }}
                />
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <div className="text-sm font-bold">4,200+ In-Network Providers</div>
                  <div className="text-xs opacity-80">in your area</div>
                </div>
              </div>
              {/* Floating badge */}
              <div
                className="absolute -top-5 -right-5 bg-white rounded-2xl p-4"
                style={{ boxShadow: "0 8px 32px rgba(27,54,93,0.15)", border: "1px solid #E8F0FE" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#FFF8E1" }}>
                    <Star size={18} style={{ color: "#D97706", fill: "#D97706" }} />
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ color: "#1B365D" }}>Top Rated</div>
                    <div className="text-xs" style={{ color: "#6B7280" }}>4.5★ Plans Available</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust Section ─────────────────────────────────────────────────── */}
      <section className="py-20" style={{ backgroundColor: "#F7F8FA" }}>
        <div className="container">
          <div className="text-center mb-14">
            <h2
              className="text-3xl lg:text-4xl font-extrabold mb-4"
              style={{ color: "#1B365D", fontFamily: "'Inter', sans-serif" }}
            >
              Why Seniors Trust Us
            </h2>
            <p className="text-lg max-w-xl mx-auto" style={{ color: "#555555" }}>
              We're committed to helping you find the best coverage with complete transparency.
            </p>
          </div>
          <div ref={trustRef} className="reveal grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TRUST_ITEMS.map((item, i) => (
              <div
                key={item.title}
                className="bg-white rounded-2xl p-7 text-center transition-all"
                style={{
                  border: "1.5px solid #F0F4FF",
                  boxShadow: "0 2px 12px rgba(27,54,93,0.06)",
                  animationDelay: `${i * 80}ms`,
                }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: "#E8F0FE" }}
                >
                  <item.icon size={24} style={{ color: "#1B365D" }} />
                </div>
                <h3 className="text-sm font-bold mb-2" style={{ color: "#1B365D" }}>{item.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
      <section
        className="py-20 text-white text-center"
        style={{ background: "linear-gradient(135deg, #122444 0%, #1B365D 50%, #2A4A7F 100%)" }}
      >
        <div ref={ctaRef} className="reveal container max-w-2xl">
          <div
            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full mb-6"
            style={{ backgroundColor: "rgba(232,240,254,0.15)", color: "#E8F0FE", border: "1px solid rgba(232,240,254,0.3)" }}
          >
            <Award size={12} />
            Free Comparison Service
          </div>
          <h2
            className="text-3xl lg:text-4xl font-extrabold mb-4"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Ready to Find Your Plan?
          </h2>
          <p className="text-lg mb-8 opacity-80">
            Enter your ZIP code to compare all available Medicare Advantage plans in your area —
            free, with no obligation.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="Enter ZIP code"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
              onKeyDown={handleKeyDown}
              className="flex-1 px-5 py-4 rounded-xl font-semibold text-lg outline-none border-2 border-transparent"
              style={{
                color: "#1B365D",
                fontFamily: "'Inter', sans-serif",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#C41E3A";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(196,30,58,0.2)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "transparent";
                e.currentTarget.style.boxShadow = "";
              }}
            />
            <button
              onClick={handleSearch}
              className="btn-cta px-7 py-4 text-base font-bold flex items-center justify-center gap-2"
              style={{ backgroundColor: "#C41E3A", color: "white", borderRadius: "12px" }}
            >
              <Search size={18} />
              See Plans
            </button>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm opacity-70">
            <Phone size={14} />
            <span>
              Or call{" "}
              <a href="tel:1-800-555-0100" className="font-semibold underline text-white">
                1-800-555-0100
              </a>{" "}
              to speak with a licensed agent
            </span>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{ backgroundColor: "#1B365D" }} className="text-white py-14">
        <div className="container">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-extrabold text-lg"
                  style={{ backgroundColor: "#C41E3A" }}
                >
                  M
                </div>
                <div>
                  <div className="text-base font-extrabold leading-tight">MedicarePlan</div>
                  <div className="text-[10px] font-semibold tracking-widest uppercase opacity-60">FINDER</div>
                </div>
              </div>
              <p className="text-sm leading-relaxed opacity-70">
                Helping Americans find the right Medicare Advantage plan since 2010. Licensed in all
                50 states.
              </p>
            </div>
            {[
              {
                title: "Plans",
                links: [
                  { label: "Medicare Advantage", href: "/medicare-advantage/hmo-plans" },
                  { label: "Medicare Supplement", href: "/medicare-supplement/compare" },
                  { label: "Part D Drug Plans", href: "/part-d/compare" },
                  { label: "Dual Eligible", href: "/dual-eligible" },
                ],
              },
              {
                title: "Resources",
                links: [
                  { label: "Medicare 101", href: "/resources/medicare-101" },
                  { label: "Enrollment Periods", href: "/resources/enrollment-periods" },
                  { label: "Star Ratings Guide", href: "/resources/star-ratings" },
                  { label: "Compare Plans", href: `/plans?zip=${zip || "64106"}` },
                ],
              },
              {
                title: "Company",
                links: [
                  { label: "About Us", href: "/about" },
                  { label: "Licensed Agents", href: "/agents" },
                  { label: "Contact Us", href: "/contact" },
                  { label: "Privacy Policy", href: "/privacy" },
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <div className="text-xs font-bold mb-4 uppercase tracking-widest opacity-60">
                  {col.title}
                </div>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm opacity-70 no-underline transition-all"
                        style={{ color: "white" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.opacity = "1";
                          (e.currentTarget as HTMLAnchorElement).style.color = "#FDEEF1";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.opacity = "0.7";
                          (e.currentTarget as HTMLAnchorElement).style.color = "white";
                        }}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {/* Developer / Technical Resources */}
          <div className="border-t pt-6 mb-6" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
            <div className="text-xs font-bold uppercase tracking-widest opacity-60 mb-3">Technical Resources</div>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://d2xsxph8kpxj0f.cloudfront.net/310519663319810046/5TY7JcF275WMujMHZWWJT8/episode-alert-api-integration-guide_6a93d69a.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all no-underline"
                style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.2)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "rgba(255,255,255,0.18)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "rgba(255,255,255,0.1)"; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Episode Alert API Integration Guide (PDF)
              </a>
            </div>
          </div>

          <div className="border-t pt-6 text-xs opacity-40" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
            <p className="mb-2">
              We are not affiliated with or endorsed by the U.S. government or the federal Medicare
              program. This is a demonstration application. Plan data is sourced from CMS public datasets.
            </p>
            <p>© 2026 MedicarePlan Finder. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
