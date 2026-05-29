// Medicare Advantage Quote Engine — Header Component
// Design: Chapter-style | Navy #1B365D | Red #C41E3A | White background

import { Phone, Shield, ChevronDown, Menu, X, Sparkles, BookOpen } from "lucide-react";
import SkipLink from './SkipLink';
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";

// ── Dropdown menu definitions ────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  description?: string;
}

interface NavDropdownDef {
  label: string;
  icon: React.ReactNode;
  activeRoutes: string[];
  accentColor: string;
  accentBg: string;
  items: NavItem[];
}

const NAV_DROPDOWNS: NavDropdownDef[] = [
  {
    label: "Medicare Information",
    icon: <BookOpen size={14} />,
    activeRoutes: [
      "/medicare-advantage",
      "/medicare-supplement",
      "/medigap",
      "/part-d",
      "/resources",
      "/plans",
    ],
    accentColor: "#1B365D",
    accentBg: "#E8F0FE",
    items: [
      {
        label: "Medicare Advantage",
        href: "/medicare-advantage/hmo-plans",
        description: "HMO, PPO, SNP & drug coverage plans",
      },
      {
        label: "Medicare Supplement",
        href: "/medicare-supplement/compare",
        description: "Medigap Plans F, G, N & more",
      },
      {
        label: "Medicare Part D",
        href: "/part-d/compare",
        description: "Prescription drug plans & formularies",
      },
      {
        label: "Resources & Guides",
        href: "/resources/medicare-guide",
        description: "Medicare 101, enrollment periods, FAQ",
      },
    ],
  },
  {
    label: "Plan Tools",
    icon: <Sparkles size={14} />,
    activeRoutes: [
      "/ai-compare",
      "/plan-recommender",
      "/verify-coverage",
      "/find-best-plan",
      "/plan-lookup",
    ],
    accentColor: "#C41E3A",
    accentBg: "#FDEEF1",
    items: [
      {
        label: "AI Plan Compare",
        href: "/ai-compare",
        description: "Compare up to 3 plans side-by-side with AI",
      },
      {
        label: "AI Plan Recommender",
        href: "/plan-recommender",
        description: "Get personalized plan recommendations",
      },
      {
        label: "Verify Current Coverage",
        href: "/verify-coverage",
        description: "Look up your current Medicare plan details",
      },
      {
        label: "Find Best Plan",
        href: "/find-best-plan",
        description: "5-step health profile wizard with AI scoring",
      },
    ],
  },
];

// ── NavDropdown ──────────────────────────────────────────────────────────────
interface NavDropdownProps {
  def: NavDropdownDef;
  isOpen: boolean;
  isActive: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function NavDropdown({ def, isOpen, isActive, onToggle, onClose }: NavDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg transition-all"
        style={{
          fontWeight: isActive ? 700 : 600,
          color: isActive ? def.accentColor : "#1B365D",
          backgroundColor: isActive ? def.accentBg : "transparent",
          fontFamily: "'Inter', sans-serif",
          border: isActive ? `1.5px solid ${def.accentColor}22` : "1.5px solid transparent",
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLButtonElement).style.color = def.accentColor;
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = def.accentBg;
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLButtonElement).style.color = "#1B365D";
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
          }
        }}
      >
        <span style={{ color: def.accentColor }}>{def.icon}</span>
        {def.label}
        <ChevronDown
          size={13}
          className="transition-transform duration-200"
          style={{
            opacity: 0.6,
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1.5 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50"
          style={{ borderTop: `3px solid ${def.accentColor}` }}
        >
          <div className="p-1.5">
            {def.items.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={onClose}
                className="flex flex-col px-3.5 py-3 rounded-lg transition-colors no-underline group"
                style={{ fontFamily: "'Inter', sans-serif" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.backgroundColor = def.accentBg;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "";
                }}
              >
                <span
                  className="text-sm font-semibold transition-colors"
                  style={{ color: "#1B365D" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLSpanElement).style.color = def.accentColor;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLSpanElement).style.color = "#1B365D";
                  }}
                >
                  {item.label}
                </span>
                {item.description && (
                  <span className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                    {item.description}
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MobileNavSection ─────────────────────────────────────────────────────────
interface MobileNavSectionProps {
  def: NavDropdownDef;
  onClose: () => void;
}

function MobileNavSection({ def, onClose }: MobileNavSectionProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #E8F0FE" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors"
        style={{
          color: "#1B365D",
          backgroundColor: open ? def.accentBg : "white",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <span className="flex items-center gap-2">
          <span style={{ color: def.accentColor }}>{def.icon}</span>
          {def.label}
        </span>
        <ChevronDown
          size={13}
          className="opacity-60 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open && (
        <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
          {def.items.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={onClose}
              className="flex flex-col px-4 py-3 no-underline transition-colors"
              style={{ backgroundColor: "white", fontFamily: "'Inter', sans-serif" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = def.accentBg;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "white";
              }}
            >
              <span className="text-sm font-semibold" style={{ color: "#1B365D" }}>
                {item.label}
              </span>
              {item.description && (
                <span className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                  {item.description}
                </span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────
export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [location] = useLocation();

  const toggleDropdown = (label: string) => {
    setOpenDropdown((prev) => (prev === label ? null : label));
  };

  const closeDropdown = () => setOpenDropdown(null);

  return (
    <header className="bg-white sticky top-0 z-50" style={{ boxShadow: "0 1px 12px rgba(27,54,93,0.10)" }}>
      {/* Top utility bar — Navy */}
      <div style={{ backgroundColor: "#1B365D" }} className="text-white py-1.5">
        <div className="container flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium">
              <Shield size={11} />
              <span>Licensed in all 50 states</span>
            </span>
            <span className="hidden sm:flex items-center gap-1.5 text-blue-200">
              <span>2026 Medicare Advantage Plans Available</span>
            </span>
          </div>
          <a
            href="tel:1-800-555-0100"
            className="flex items-center gap-1.5 font-semibold transition-colors"
            style={{ color: "white" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#FDEEF1"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "white"; }}
          >
            <Phone size={11} />
            <span>1-800-555-0100 (TTY 711)</span>
          </a>
        </div>
      </div>

      {/* Main nav */}
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 no-underline shrink-0" onClick={closeDropdown}>
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: "#1B365D" }}
            >
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800 }}>M</span>
            </div>
            <div>
              <div
                className="text-lg font-bold leading-tight"
                style={{ color: "#1B365D", fontFamily: "'Inter', sans-serif", fontWeight: 800 }}
              >
                MedicarePlan
              </div>
              <div className="text-[10px] font-semibold tracking-widest uppercase leading-tight" style={{ color: "#C41E3A" }}>
                FINDER
              </div>
            </div>
          </Link>

          {/* Desktop Nav — 2 dropdowns */}
          <nav className="hidden lg:flex items-center gap-2">
            {NAV_DROPDOWNS.map((nav) => (
              <NavDropdown
                key={nav.label}
                def={nav}
                isOpen={openDropdown === nav.label}
                isActive={nav.activeRoutes.some((r) => location.startsWith(r))}
                onToggle={() => toggleDropdown(nav.label)}
                onClose={closeDropdown}
              />
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              className="hidden sm:flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border-2 transition-all"
              style={{ borderColor: "#1B365D", color: "#1B365D", fontFamily: "'Inter', sans-serif" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1B365D";
                (e.currentTarget as HTMLButtonElement).style.color = "white";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "#1B365D";
              }}
            >
              Sign In
            </button>
            <a
              href="tel:1-800-555-0100"
              className="hidden md:flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg text-white transition-all"
              style={{ backgroundColor: "#C41E3A", fontFamily: "'Inter', sans-serif" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "#A01830";
                (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 12px rgba(196,30,58,0.3)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "#C41E3A";
                (e.currentTarget as HTMLAnchorElement).style.transform = "";
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = "";
              }}
            >
              <Phone size={14} />
              Talk to an Agent
            </a>
            {/* Hamburger — mobile only */}
            <button
              className="lg:hidden p-2 rounded-md transition-colors"
              style={{ color: "#1B365D" }}
              onClick={() => setMobileOpen(!mobileOpen)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#E8F0FE"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = ""; }}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t bg-white" style={{ borderColor: "#E8F0FE" }}>
          <div className="container py-4 space-y-3">
            {/* 2 accordion sections */}
            {NAV_DROPDOWNS.map((nav) => (
              <MobileNavSection
                key={nav.label}
                def={nav}
                onClose={() => setMobileOpen(false)}
              />
            ))}

            {/* Sign In + Call CTA */}
            <div className="pt-2 border-t flex gap-2" style={{ borderColor: "#E8F0FE" }}>
              <button
                className="flex-1 py-2.5 text-sm font-semibold rounded-lg border-2 transition-all"
                style={{ borderColor: "#1B365D", color: "#1B365D", fontFamily: "'Inter', sans-serif" }}
              >
                Sign In
              </button>
              <a
                href="tel:1-800-555-0100"
                className="flex-1 py-2.5 text-sm font-bold rounded-lg text-white text-center"
                style={{ backgroundColor: "#C41E3A", fontFamily: "'Inter', sans-serif" }}
              >
                Talk to an Agent
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
