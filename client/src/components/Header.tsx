// Medicare Advantage Quote Engine — Header v10 (production)
import { ChevronDown, Menu, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";

const T = {
  ink:   "#0B1B24",
  dark:  "#1C3A48",
  teal:  "#237A92",
  tealL: "#2E96B0",
  body:  "#3E5560",
  sub:   "#7A9BA6",
  rule:  "#E2EAED",
  warm:  "#FAF9F5",
} as const;

const F = {
  serif: "'Lora', Georgia, 'Times New Roman', serif",
  sans:  "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

// ── Nav data ──────────────────────────────────────────────────────────────────
interface NavItem {
  label: string;
  href: string;
  description?: string;
}
interface NavDropdownDef {
  label: string;
  activeRoutes: string[];
  items: NavItem[];
}

const NAV_DROPDOWNS: NavDropdownDef[] = [
  {
    label: "Medicare",
    activeRoutes: ["/medicare-advantage", "/medicare-supplement", "/medigap", "/part-d", "/resources", "/plans"],
    items: [
      { label: "Medicare Advantage",  href: "/medicare-advantage/hmo-plans",  description: "HMO, PPO, SNP & drug coverage plans"    },
      { label: "Medicare Supplement", href: "/medicare-supplement/compare",    description: "Medigap Plans F, G, N & more"          },
      { label: "Medicare Part D",     href: "/part-d/compare",                 description: "Prescription drug plans & formularies" },
      { label: "Resources & Guides",  href: "/resources/medicare-guide",       description: "Medicare 101, enrollment periods, FAQ" },
    ],
  },
  {
    label: "Tools",
    activeRoutes: ["/ai-compare", "/plan-recommender", "/verify-coverage", "/find-best-plan", "/plan-lookup"],
    items: [
      { label: "AI Plan Compare",         href: "/ai-compare",       description: "Compare up to 3 plans side-by-side with AI" },
      { label: "AI Plan Recommender",     href: "/plan-recommender", description: "Get personalized plan recommendations"       },
      { label: "Verify Current Coverage", href: "/verify-coverage",  description: "Look up your current Medicare plan details"  },
      { label: "Find Best Plan",          href: "/find-best-plan",   description: "5-step health profile wizard with AI scoring" },
    ],
  },
];

// ── NavDropdown ───────────────────────────────────────────────────────────────
interface NavDropdownProps {
  def: NavDropdownDef;
  isOpen: boolean;
  isActive: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function NavDropdown({ def, isOpen, isActive, onToggle, onClose }: NavDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="hdr-navbtn"
        data-active={isActive ? "true" : "false"}
        style={{
          display:         "inline-flex",
          alignItems:      "center",
          gap:             "4px",
          padding:         "10px 16px",
          fontFamily:      F.sans,
          fontSize:        "14px",
          fontWeight:      500,
          letterSpacing:   "0",
          color:           isActive ? T.teal : T.body,
          background:      isOpen ? "rgba(35,122,146,0.06)" : "none",
          border:          "none",
          cursor:          "pointer",
          borderRadius:    "6px",
          transition:      "color 0.18s, background-color 0.15s",
          lineHeight:      1,
        }}
      >
        {def.label}
        <ChevronDown
          size={11}
          aria-hidden="true"
          style={{
            opacity:    isOpen ? 0.6 : 0.35,
            flexShrink: 0,
            transition: "transform 0.2s, opacity 0.15s",
            transform:  isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="hdr-dropdown-panel"
          style={{
            position:        "absolute",
            top:             "calc(100% + 8px)",
            left:            0,
            width:           "296px",
            backgroundColor: "#fff",
            border:          `1px solid ${T.rule}`,
            borderTop:       `3px solid ${T.teal}`,
            borderRadius:    "0 0 10px 10px",
            boxShadow:       "0 4px 16px rgba(11,27,36,0.07), 0 16px 48px rgba(11,27,36,0.10)",
            zIndex:          100,
            padding:         "6px 6px 8px",
          }}
        >
          {def.items.map(item => (
            <a
              key={item.label}
              href={item.href}
              role="menuitem"
              onClick={onClose}
              className="hdr-dropitem"
              style={{
                display:        "flex",
                flexDirection:  "column",
                padding:        "11px 14px",
                borderRadius:   "6px",
                textDecoration: "none",
                transition:     "background-color 0.12s",
              }}
            >
              <span style={{
                fontFamily:    F.sans,
                fontSize:      "13.5px",
                fontWeight:    500,
                color:         T.ink,
                lineHeight:    1.3,
                letterSpacing: "0",
              }}>
                {item.label}
              </span>
              {item.description && (
                <span style={{
                  fontFamily: F.sans,
                  fontSize:   "12px",
                  color:      T.sub,
                  marginTop:  "3px",
                  lineHeight: 1.5,
                }}>
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

// ── MobileNavSection ──────────────────────────────────────────────────────────
interface MobileNavSectionProps {
  def: NavDropdownDef;
  onClose: () => void;
}

function MobileNavSection({ def, onClose }: MobileNavSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderBottom: `1px solid ${T.rule}` }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="hdr-mob-section"
        style={{
          width:           "100%",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "space-between",
          padding:         "0",
          height:          "56px",
          fontFamily:      F.sans,
          fontSize:        "15px",
          fontWeight:      500,
          letterSpacing:   "0",
          color:           open ? T.teal : T.ink,
          background:      "none",
          border:          "none",
          cursor:          "pointer",
          lineHeight:      1,
          transition:      "color 0.18s",
        }}
      >
        {def.label}
        <ChevronDown
          size={14}
          aria-hidden="true"
          style={{
            color:      open ? T.teal : T.sub,
            flexShrink: 0,
            transition: "transform 0.22s ease, color 0.18s",
            transform:  open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div style={{ paddingBottom: "12px" }}>
          {def.items.map(item => (
            <a
              key={item.label}
              href={item.href}
              onClick={onClose}
              className="hdr-mob-item"
              style={{
                display:        "flex",
                flexDirection:  "column",
                justifyContent: "center",
                padding:        "11px 4px 11px 16px",
                textDecoration: "none",
                minHeight:      "48px",
                borderLeft:     `2px solid ${T.rule}`,
                marginLeft:     "1px",
                transition:     "border-color 0.15s",
              }}
            >
              <span
                className="hdr-mob-item-label"
                style={{
                  fontFamily:    F.sans,
                  fontSize:      "14px",
                  fontWeight:    500,
                  color:         T.ink,
                  letterSpacing: "0",
                  transition:    "color 0.15s",
                }}
              >
                {item.label}
              </span>
              {item.description && (
                <span style={{
                  fontFamily: F.sans,
                  fontSize:   "12px",
                  color:      T.sub,
                  marginTop:  "3px",
                  lineHeight: 1.4,
                }}>
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

// ── Header ────────────────────────────────────────────────────────────────────
export default function Header() {
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [scrolled, setScrolled]         = useState(false);
  const [location]                      = useLocation();

  // Elevate shadow on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location]);

  const toggleDropdown = (label: string) => setOpenDropdown(prev => prev === label ? null : label);
  const closeDropdown  = () => setOpenDropdown(null);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap');

        @keyframes hdr-drop-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes hdr-mob-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0);    }
        }

        .hdr-dropdown-panel { animation: hdr-drop-in 0.15s ease-out both; }

        .hdr-navbtn:hover                    { color: ${T.teal}  !important; }
        .hdr-navbtn[data-active="true"]:hover { color: ${T.tealL} !important; }

        .hdr-dropitem:hover { background-color: ${T.warm} !important; }

        .hdr-signin:hover { color: ${T.body} !important; }

        .hdr-cta:hover         { background-color: #112333 !important; }
        .hdr-cta:focus-visible { outline: 2px solid ${T.teal}; outline-offset: 2px; }

        .hdr-mob-cta:hover         { background-color: #112333 !important; }
        .hdr-mob-cta:focus-visible { outline: 2px solid ${T.teal}; outline-offset: 2px; }

        .hdr-ham:hover { background-color: ${T.warm} !important; }

        .hdr-mob-section:hover { color: ${T.teal} !important; }

        .hdr-mob-item:hover .hdr-mob-item-label  { color: ${T.teal} !important; }
        .hdr-mob-item:hover                       { border-left-color: ${T.teal} !important; }

        .hdr-mob-menu { animation: hdr-mob-in 0.18s ease-out both; }

        @media (min-width: 1024px) {
          .hdr-mobile-only { display: none !important; }
        }
        @media (max-width: 1023px) {
          .hdr-desktop-nav  { display: none !important; }
          .hdr-desktop-only { display: none !important; }
          .hdr-mobile-only  { display: flex !important; }
          .hdr-rail { padding-left: 20px !important; padding-right: 20px !important; }
        }
        @media (max-width: 374px) {
          .hdr-rail { padding-left: 16px !important; padding-right: 16px !important; }
        }
      `}</style>

      <header
        style={{
          backgroundColor: "#fff",
          position:        "sticky",
          top:             0,
          zIndex:          50,
          transition:      "box-shadow 0.2s ease",
          boxShadow:       scrolled
            ? "0 1px 0 rgba(11,27,36,0.08), 0 4px 20px rgba(11,27,36,0.07)"
            : "0 1px 0 rgba(11,27,36,0.08)",
        }}
      >
        {/* ── Desktop / tablet bar ─────────────────────────────────── */}
        <div className="hdr-rail" style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 40px" }}>
          <div style={{ display: "flex", alignItems: "center", height: "72px" }}>

            {/* Left: brand lockup — flex:1 for geometric centering */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link
                href="/"
                onClick={closeDropdown}
                style={{
                  textDecoration: "none",
                  display:        "inline-flex",
                  alignItems:     "center",
                  gap:            "11px",
                }}
              >
                {/* Teal vertical bar — brand mark */}
                <span
                  aria-hidden="true"
                  style={{
                    display:         "block",
                    width:           "3px",
                    height:          "26px",
                    borderRadius:    "2px",
                    backgroundColor: T.teal,
                    flexShrink:      0,
                  }}
                />
                {/* Two-line text lockup */}
                <span style={{ display: "block", lineHeight: 1 }}>
                  <span style={{
                    display:       "block",
                    fontFamily:    F.serif,
                    fontSize:      "19px",
                    fontWeight:    500,
                    letterSpacing: "-0.02em",
                    color:         T.ink,
                    lineHeight:    1,
                  }}>
                    SelectQuote
                  </span>
                  <span style={{
                    display:       "block",
                    fontFamily:    F.sans,
                    fontSize:      "8.5px",
                    fontWeight:    500,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color:         T.sub,
                    marginTop:     "6px",
                    lineHeight:    1,
                  }}>
                    Medicare
                  </span>
                </span>
              </Link>
            </div>

            {/* Center: nav — auto width, always centered between the two flex:1 zones */}
            <nav
              aria-label="Main navigation"
              className="hdr-desktop-nav"
              style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}
            >
              {NAV_DROPDOWNS.map(nav => (
                <NavDropdown
                  key={nav.label}
                  def={nav}
                  isOpen={openDropdown === nav.label}
                  isActive={nav.activeRoutes.some(r => location.startsWith(r))}
                  onToggle={() => toggleDropdown(nav.label)}
                  onClose={closeDropdown}
                />
              ))}
            </nav>

            {/* Right: actions — flex:1, justified to end */}
            <div style={{
              flex:           1,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "flex-end",
              gap:            "6px",
            }}>
              {/* Sign in — demoted, returning users only */}
              <button
                className="hdr-signin hdr-desktop-only"
                style={{
                  display:       "inline-flex",
                  alignItems:    "center",
                  height:        "38px",
                  padding:       "0 12px",
                  fontFamily:    F.sans,
                  fontSize:      "13px",
                  fontWeight:    400,
                  letterSpacing: "0",
                  color:         T.sub,
                  background:    "none",
                  border:        "none",
                  cursor:        "pointer",
                  borderRadius:  "6px",
                  transition:    "color 0.18s",
                  lineHeight:    1,
                  whiteSpace:    "nowrap",
                }}
              >
                Sign in
              </button>

              {/* 1px vertical separator */}
              <span
                className="hdr-desktop-only"
                aria-hidden="true"
                style={{
                  display:      "inline-block",
                  width:        "1px",
                  height:       "16px",
                  background:   "rgba(11,27,36,0.12)",
                  borderRadius: "1px",
                  flexShrink:   0,
                }}
              />

              {/* Primary CTA — matches hero btn-primary exactly */}
              <a
                href="tel:1-800-777-8002"
                className="hdr-cta hdr-desktop-only"
                style={{
                  display:         "inline-flex",
                  alignItems:      "center",
                  height:          "38px",
                  padding:         "0 24px",
                  fontFamily:      F.sans,
                  fontSize:        "15px",
                  fontWeight:      600,
                  letterSpacing:   "0.005em",
                  color:           "#fff",
                  backgroundColor: T.dark,
                  borderRadius:    "6px",
                  textDecoration:  "none",
                  transition:      "background-color 0.14s",
                  lineHeight:      1,
                  whiteSpace:      "nowrap",
                }}
              >
                Talk to an Agent
              </a>

              {/* Hamburger — mobile only */}
              <button
                className="hdr-ham hdr-mobile-only"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
                aria-controls="hdr-mobile-menu"
                onClick={() => setMobileOpen(v => !v)}
                style={{
                  display:        "none",
                  alignItems:     "center",
                  justifyContent: "center",
                  width:          "44px",
                  height:         "44px",
                  background:     "none",
                  border:         "none",
                  cursor:         "pointer",
                  color:          T.ink,
                  borderRadius:   "8px",
                  transition:     "background-color 0.18s",
                  marginRight:    "-6px",
                  flexShrink:     0,
                }}
              >
                {mobileOpen
                  ? <X    size={20} aria-hidden="true" />
                  : <Menu size={20} aria-hidden="true" />}
              </button>
            </div>

          </div>
        </div>

        {/* ── Mobile menu ──────────────────────────────────────────── */}
        {mobileOpen && (
          <div
            id="hdr-mobile-menu"
            className="hdr-mob-menu"
            style={{
              backgroundColor: "#fff",
              borderTop:       `1px solid ${T.rule}`,
              boxShadow:       "0 8px 32px rgba(11,27,36,0.08)",
            }}
          >
            <div
              className="hdr-rail"
              style={{ maxWidth: "1200px", margin: "0 auto", padding: "4px 40px 36px" }}
            >
              {NAV_DROPDOWNS.map(nav => (
                <MobileNavSection
                  key={nav.label}
                  def={nav}
                  onClose={() => setMobileOpen(false)}
                />
              ))}

              <div style={{ paddingTop: "28px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {/* CTA — full width, primary */}
                <a
                  href="tel:1-800-777-8002"
                  className="hdr-mob-cta"
                  style={{
                    display:         "flex",
                    alignItems:      "center",
                    justifyContent:  "center",
                    height:          "52px",
                    fontFamily:      F.sans,
                    fontSize:        "15px",
                    fontWeight:      600,
                    letterSpacing:   "0.005em",
                    color:           "#fff",
                    backgroundColor: T.dark,
                    borderRadius:    "6px",
                    textDecoration:  "none",
                    transition:      "background-color 0.14s",
                  }}
                >
                  Talk to an Agent
                </a>
                {/* Sign in — ghost, secondary */}
                <button
                  style={{
                    height:        "44px",
                    fontFamily:    F.sans,
                    fontSize:      "14px",
                    fontWeight:    400,
                    letterSpacing: "0",
                    color:         T.sub,
                    background:    "none",
                    border:        "none",
                    cursor:        "pointer",
                    borderRadius:  "6px",
                    transition:    "color 0.18s",
                  }}
                >
                  Sign in
                </button>
              </div>
            </div>
          </div>
        )}

      </header>
    </>
  );
}
