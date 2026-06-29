// SelectQuote brand constants — single source of truth for all brand strings and tokens
// Update this file to propagate changes across the entire app

// ── Identity ──────────────────────────────────────────────────────────────────
export const BRAND = {
  name:        "SelectQuote",
  product:     "SelectQuote Medicare",
  tagline:     "Medicare",
  legalEntity: "SelectQuote Insurance Services, Inc.",
  copyright:   `© ${new Date().getFullYear()} SelectQuote Insurance Services, Inc. All rights reserved.`,
  disclaimer:  "SelectQuote is not affiliated with or endorsed by the U.S. government or the federal Medicare program. This is a demonstration application for educational purposes only.",
  notLicensed: "Not a licensed agent",
} as const;

// ── Contact ───────────────────────────────────────────────────────────────────
export const CONTACT = {
  phone:       "1-800-777-8002",
  phoneTel:    "tel:+18007778002",
  emailGeneral: "medicare@selectquote.com",
  emailPrivacy: "privacy@selectquote.com",
  address:     "11919 Roe Ave., Overland Park, KS 66209",
} as const;

// ── Design tokens ─────────────────────────────────────────────────────────────
// Phase 1: mirrors the existing navy/teal palette.
// Phase 2: full SelectQuote orange-primary system applied below.
export const T = {
  // SelectQuote brand primary — vibrant orange
  orange:    "#F26522",
  orangeD:   "#D4561A",  // dark hover
  orangeL:   "#FEF0E6",  // light fill

  // Inherited/complementary teal — "rich teal" per brand doc
  teal:      "#237A92",
  tealD:     "#1C6478",
  tealL:     "#E8F2F5",

  // Navy / ink
  ink:       "#0B1B24",
  dark:      "#1C3A48",
  body:      "#3E5560",
  sub:       "#7A9BA6",

  // Surface
  warm:      "#FAF9F5",
  rule:      "#E2EAED",
  white:     "#FFFFFF",

  // Dark sections
  night:     "#0A1820",
  footer:    "#060E14",
} as const;

export const F = {
  serif: "'Lora', Georgia, 'Times New Roman', serif",
  sans:  "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;
