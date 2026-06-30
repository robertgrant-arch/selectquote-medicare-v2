// SelectQuote brand constants — single source of truth for all brand strings and tokens
// Source: SelectQuote Brand Playbook 2026 (External)
// Update this file to propagate changes across the entire app

// ── Identity ──────────────────────────────────────────────────────────────────
export const BRAND = {
  name:        "SelectQuote",
  product:     "SelectQuote Medicare",
  tagline:     "Medicare",
  subtagline:  "We shop. You save.",
  legalEntity: "SelectQuote Insurance Services, Inc.",
  copyright:   `© ${new Date().getFullYear()} SelectQuote Insurance Services, Inc. All rights reserved.`,
  disclaimer:  "SelectQuote is not affiliated with or endorsed by the U.S. government or the federal Medicare program. This is a demonstration application for educational purposes only.",
  notLicensed: "Not a licensed agent",
} as const;

// ── Contact ───────────────────────────────────────────────────────────────────
export const CONTACT = {
  phone:        "1-800-777-8002",
  phoneTel:     "tel:+18007778002",
  emailGeneral: "medicare@selectquote.com",
  emailPrivacy: "privacy@selectquote.com",
  address:      "11919 Roe Ave., Overland Park, KS 66209",
} as const;

// ── Color tokens — SelectQuote Brand Playbook 2026 ────────────────────────────
export const T = {
  // Primary Orange — dominant brand color
  orange:   "#EF7000",   // Orange 500 — CTAs, interactive elements, brand fills
  orangeD:  "#CF4D01",   // Orange 600 — hover/pressed state
  orangeDk: "#852F00",   // Orange 800 — text on light bg, dark emphasis
  orangeL:  "#FDF1E5",   // Orange 50  — light surface tints

  // Secondary Teal — calm, trustworthy
  teal:    "#00859A",    // Teal 500 — secondary CTAs, info accents
  tealD:   "#014951",    // Teal 700 — hover/dark
  tealDk:  "#00353E",    // Teal 900 — dark section backgrounds, footer
  tealL:   "#E6F7F9",    // Teal 50  — light tints

  // Neutral scale
  ink:     "#1A1A1A",    // Gray 950 — headings, near-black
  body:    "#303030",    // Gray 900 — body text
  sub:     "#8C8C8C",    // Gray 700 — muted/secondary text
  border:  "#E8E8E8",    // Gray 300 — borders, rules
  card:    "#F4F4F4",    // Gray 200 — card/section fills
  warm:    "#F9F9F9",    // Gray 100 — page background
  white:   "#FFFFFF",

  // Dark section aliases
  dark:    "#00353E",    // Teal 900 — dark hero/section backgrounds
  night:   "#00353E",    // Teal 900
  footer:  "#1A1A1A",    // Gray 950 — footer background

  // Legacy (kept for computed value compatibility — do not use in new code)
  rule:    "#E8E8E8",    // = border
} as const;

// ── Typography — Poppins (display/heading) + Montserrat (body) ─────────────────
// F.serif = display/heading font (Poppins replaces Lora)
// F.sans  = body/UI font (Montserrat replaces DM Sans)
export const F = {
  serif: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
  sans:  "'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;
