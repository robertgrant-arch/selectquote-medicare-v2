import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import Header from "@/components/Header";

// ── Design tokens (mirrors Home.tsx) ─────────────────────────────────────────
const T = {
  ink:   "#0B1B24",
  dark:  "#1C3A48",
  teal:  "#237A92",
  body:  "#3E5560",
  sub:   "#7A9BA6",
  rule:  "#E2EAED",
  warm:  "#FAF9F5",
  night: "#0A1820",
  ftr:   "#060E14",
} as const;

const F = {
  serif: "'Lora', Georgia, 'Times New Roman', serif",
  sans:  "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

export interface InfoPageProps {
  section: string;
  sectionHref: string;
  title: string;
  subtitle: string;
  /** @deprecated — hero is now always white; kept for API compatibility */
  accentColor?: string;
  children: React.ReactNode;
}

export default function InfoPage({
  section,
  sectionHref,
  title,
  subtitle,
  children,
}: InfoPageProps) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.warm, fontFamily: F.sans, color: T.body }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap');
        .ip-nav-link:hover { color: rgba(255,255,255,0.9) !important; }
        .ip-cta-btn:hover  { background-color: #2E96B0 !important; }
      `}</style>

      <Header />

      {/* ── Hero — dark navy, matches AI Compare ────────────────────────────── */}
      <section
        aria-label={title}
        style={{ backgroundColor: T.dark, position: "relative", overflow: "hidden" }}
      >
        {/* Subtle dot pattern overlay */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute", inset: 0, opacity: 0.05,
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div style={{ position: "relative", maxWidth: "1160px", margin: "0 auto", padding: "44px 40px 52px" }}>

          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              marginBottom: "32px",
              fontFamily: F.sans, fontSize: "12px", fontWeight: 500,
            }}
          >
            <Link
              href="/"
              className="ip-nav-link"
              style={{ color: "rgba(255,255,255,0.55)", textDecoration: "none", transition: "color 0.12s" }}
            >
              Home
            </Link>
            <ChevronRight size={12} aria-hidden="true" style={{ color: "rgba(255,255,255,0.28)", flexShrink: 0 }} />
            <Link
              href={sectionHref}
              className="ip-nav-link"
              style={{ color: "rgba(255,255,255,0.55)", textDecoration: "none", transition: "color 0.12s" }}
            >
              {section}
            </Link>
            <ChevronRight size={12} aria-hidden="true" style={{ color: "rgba(255,255,255,0.28)", flexShrink: 0 }} />
            <span style={{ color: "rgba(255,255,255,0.88)", fontWeight: 500 }}>{title}</span>
          </nav>

          {/* Title + subtitle */}
          <div style={{ maxWidth: "720px" }}>
            <h1
              style={{
                fontFamily: F.sans,
                fontSize: "clamp(28px, 4vw, 44px)",
                fontWeight: 700, lineHeight: 1.08,
                letterSpacing: "-0.022em",
                color: "#fff", marginBottom: "16px",
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontFamily: F.sans,
                fontSize: "17px", lineHeight: 1.68,
                color: "rgba(255,255,255,0.75)", margin: 0,
                maxWidth: "58ch",
              }}
            >
              {subtitle}
            </p>
          </div>
        </div>
      </section>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: T.warm, padding: "56px 0 80px" }}>
        <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
          <div style={{ maxWidth: "760px" }}>

            {/* Content card */}
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: "12px",
                border: `1px solid ${T.rule}`,
                padding: "48px 52px",
                boxShadow: "0 1px 6px rgba(11,27,36,0.05), 0 4px 20px rgba(11,27,36,0.03)",
              }}
            >
              {children}
            </div>

          </div>
        </div>
      </div>

      {/* ── CTA — deep dark, mirrors homepage §6 night section ────────────── */}
      <section
        aria-labelledby="ip-cta-h"
        style={{ backgroundColor: T.night, padding: "100px 0" }}
      >
        <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "0 40px" }}>
          <div style={{ maxWidth: "600px" }}>
            <h2
              id="ip-cta-h"
              style={{
                fontFamily: F.serif,
                fontSize: "clamp(26px, 3.6vw, 44px)",
                fontWeight: 500, lineHeight: 1.14,
                letterSpacing: "-0.018em",
                color: "#fff", marginBottom: "18px",
              }}
            >
              Ready to Compare Plans?
            </h2>
            <p
              style={{
                fontFamily: F.sans, fontSize: "17px",
                lineHeight: 1.72, color: "rgba(235,245,248,0.55)",
                marginBottom: "40px", maxWidth: "44ch",
              }}
            >
              Enter your ZIP code to see every available Medicare Advantage plan in your area — free, with no obligation.
            </p>
            <Link
              href="/plans?zip=64106"
              className="ip-cta-btn"
              style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                fontFamily: F.sans, fontSize: "15px", fontWeight: 600,
                backgroundColor: T.teal, color: "#fff",
                padding: "16px 28px", borderRadius: "6px",
                textDecoration: "none",
                transition: "background-color 0.14s",
                letterSpacing: "0.005em",
              }}
            >
              See Plans Near You
              <ChevronRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer
        aria-label="Site footer"
        style={{
          backgroundColor: T.ftr,
          fontFamily: F.sans, fontSize: "12px",
          color: "rgba(255,255,255,0.25)",
          padding: "32px 40px",
          textAlign: "center",
          lineHeight: 1.72,
        }}
      >
        <p>
          We are not affiliated with or endorsed by the U.S. government or the federal Medicare
          program. This is a demonstration application for educational purposes only.
        </p>
        <p style={{ marginTop: "4px" }}>© 2026 SelectQuote Insurance Services, Inc. All rights reserved.</p>
      </footer>

    </div>
  );
}
