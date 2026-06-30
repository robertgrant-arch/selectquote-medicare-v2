// CarrierLogo component — renders carrier brand logo with color
// Accepts any carrier string; uses plan-provided colors with graceful fallback for unknown carriers

interface CarrierLogoProps {
  carrier: string;
  bgColor?: string;
  textColor?: string;
  size?: "sm" | "md" | "lg";
}

// Known carrier brand colors (fallback when plan doesn't provide colors)
const KNOWN_CARRIER_COLORS: Record<string, { bg: string; text: string }> = {
  UnitedHealthcare: { bg: "#002677", text: "#FFFFFF" },
  "AARP / UnitedHealthcare": { bg: "#002677", text: "#FFFFFF" },
  Humana: { bg: "#006D9D", text: "#FFFFFF" },
  Aetna: { bg: "#7D2248", text: "#FFFFFF" },
  "Aetna Medicare": { bg: "#7D2248", text: "#FFFFFF" },
  Cigna: { bg: "#E8002D", text: "#FFFFFF" },
  WellCare: { bg: "#00A651", text: "#FFFFFF" },
  Wellcare: { bg: "#00A651", text: "#FFFFFF" },
  "Blue KC": { bg: "#003087", text: "#FFFFFF" },
  "Blue Cross Blue Shield": { bg: "#003087", text: "#FFFFFF" },
  "Devoted Health": { bg: "#1A56DB", text: "#FFFFFF" },
  "Clover Health": { bg: "#00B5AD", text: "#FFFFFF" },
  "Alignment Health": { bg: "#C41E3A", text: "#FFFFFF" },
  "Bright Health": { bg: "#FF6B6B", text: "#FFFFFF" },
  "Oscar Health": { bg: "#FF6B6B", text: "#FFFFFF" },
  "Molina Healthcare": { bg: "#1B365D", text: "#FFFFFF" },
  "Anthem": { bg: "#003087", text: "#FFFFFF" },
  "Centene": { bg: "#005EB8", text: "#FFFFFF" },
  "WellPoint": { bg: "#003087", text: "#FFFFFF" },
};

// Derive a consistent color from carrier name hash for unknown carriers
function hashColor(str: string): string {
  const palette = ["#4B5563", "#6B7280", "#374151", "#1F2937", "#4338CA", "#0369A1", "#047857", "#7C3AED"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return palette[Math.abs(hash) % palette.length];
}

// Abbreviate carrier name for display
function abbreviate(carrier: string): string {
  // Try known abbreviations first
  const known: Record<string, string> = {
    UnitedHealthcare: "UHC",
    "AARP / UnitedHealthcare": "UHC",
    Humana: "HUM",
    Aetna: "AET",
    "Aetna Medicare": "AET",
    Cigna: "CGN",
    WellCare: "WLC",
    Wellcare: "WLC",
    "Blue KC": "BKC",
    "Devoted Health": "DEV",
    "Clover Health": "CLV",
    "Molina Healthcare": "MOL",
    "Bright Health": "BRT",
    "Oscar Health": "OSC",
    "Alignment Health": "ALN",
    "Anthem": "ANT",
    "Centene": "CTN",
  };
  if (known[carrier]) return known[carrier];
  // Auto-abbreviate: take first letter of each word, max 3
  const words = carrier.split(/\s+/);
  if (words.length === 1) return carrier.slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}

export default function CarrierLogo({ carrier, bgColor, textColor, size = "md" }: CarrierLogoProps) {
  const knownColors = KNOWN_CARRIER_COLORS[carrier];
  const bg = bgColor || knownColors?.bg || hashColor(carrier);
  const text = textColor || knownColors?.text || "#FFFFFF";
  const abbr = abbreviate(carrier);

  const dimensions = {
    sm: { width: 64, height: 32, fontSize: "9px" },
    md: { width: 96, height: 44, fontSize: "12px" },
    lg: { width: 120, height: 52, fontSize: "14px" },
  }[size];

  return (
    <div
      className="rounded-lg flex items-center justify-center font-bold shadow-sm"
      style={{
        backgroundColor: bg,
        color: text,
        width: dimensions.width,
        height: dimensions.height,
        fontFamily: "'Montserrat', sans-serif",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: dimensions.fontSize }}>{abbr}</span>
    </div>
  );
}
