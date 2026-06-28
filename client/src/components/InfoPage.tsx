// Shared layout for all informational placeholder pages
// Renders a consistent hero + content card + CTA section with the site header/footer

import { Link } from "wouter";
import { ChevronRight, ArrowLeft } from "lucide-react";
import Header from "@/components/Header";

export interface InfoPageProps {
  /** Breadcrumb label for the parent section, e.g. "Medicare Advantage" */
  section: string;
  /** Route of the parent section, e.g. "/plans" */
  sectionHref: string;
  /** Page title shown in the hero */
  title: string;
  /** One-sentence subtitle */
  subtitle: string;
  /** Hero accent color (defaults to brand dark) */
  accentColor?: string;
  /** Main body content rendered inside the content card */
  children: React.ReactNode;
}

export default function InfoPage({
  section,
  sectionHref,
  title,
  subtitle,
  accentColor = "#1C3A48",
  children,
}: InfoPageProps) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAF9F5" }}>
      <Header />

      {/* Hero */}
      <section
        className="py-12 text-white"
        style={{ backgroundColor: accentColor }}
      >
        <div className="container">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-white/60 text-sm mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <Link href="/" className="hover:text-white transition-colors no-underline text-white/60">
              Home
            </Link>
            <ChevronRight size={13} />
            <Link
              href={sectionHref}
              className="hover:text-white transition-colors no-underline text-white/60"
            >
              {section}
            </Link>
            <ChevronRight size={13} />
            <span className="text-white font-medium">{title}</span>
          </nav>

          <h1
            className="text-3xl lg:text-4xl font-bold mb-3"
            style={{ fontFamily: "'Lora', serif" }}
          >
            {title}
          </h1>
          <p className="text-white/75 text-lg max-w-2xl" style={{ fontFamily: "'DM Sans', sans-serif" }}>{subtitle}</p>
        </div>
      </section>

      {/* Content */}
      <div className="container py-12">
        <div className="max-w-3xl">
          {/* Back link */}
          <Link
            href={sectionHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 no-underline transition-colors"
            style={{ color: "#237A92", fontFamily: "'DM Sans', sans-serif" }}
          >
            <ArrowLeft size={14} />
            Back to {section}
          </Link>

          <div
            className="bg-white rounded-xl border p-8"
            style={{ borderColor: "#E2EAED", boxShadow: "0 1px 4px rgba(11,27,36,0.06)" }}
          >
            {children}
          </div>

          {/* CTA */}
          <div
            className="mt-8 rounded-xl p-8 text-white text-center"
            style={{ backgroundColor: "#1C3A48" }}
          >
            <h2
              className="text-2xl font-bold mb-2"
              style={{ fontFamily: "'Lora', serif" }}
            >
              Ready to Compare Plans?
            </h2>
            <p className="text-white/70 mb-5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Enter your ZIP code to see all available plans in your area — free, with no obligation.
            </p>
            <Link
              href="/plans?zip=64106"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-base font-semibold no-underline transition-all"
              style={{ backgroundColor: "#237A92", color: "white", fontFamily: "'DM Sans', sans-serif" }}
            >
              See Plans Near You
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      {/* Minimal footer */}
      <footer style={{ backgroundColor: "#0B1B24" }} className="text-gray-500 py-6 text-center text-xs">
        <p>
          We are not affiliated with or endorsed by the U.S. government or the federal Medicare
          program. This is a mock demonstration application for educational purposes only.
        </p>
        <p className="mt-1">© 2025 MedicarePlan Finder. All rights reserved.</p>
      </footer>
    </div>
  );
}
