import { Link } from "wouter";
import { T, F, BRAND } from "@/lib/brand";

interface LogoProps {
  /** "header" = on white bg (orange mark + dark text)
   *  "footer" = on dark bg (white mark + white text)
   *  "orange" = on orange bg (white mark + white text) */
  variant?: "header" | "footer" | "orange";
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  href?: string;
}

/** SelectQuote ring mark — open concentric circle arcs */
function RingMark({ color, size = 40 }: { color: string; size?: number }) {
  const r1 = size * 0.40;   // outer ring radius
  const r2 = size * 0.245;  // inner ring radius
  const sw1 = size * 0.115; // outer stroke width
  const sw2 = size * 0.066; // inner stroke width
  const cx = size / 2;
  const cy = size / 2;

  // Outer ring: ~300° arc (gap at upper-left ~10 o'clock)
  const c1 = 2 * Math.PI * r1;
  const dash1 = (300 / 360) * c1;
  const gap1  = c1 - dash1;

  // Inner ring: ~220° arc, same gap zone
  const c2 = 2 * Math.PI * r2;
  const dash2 = (220 / 360) * c2;
  const gap2  = c2 - dash2;

  // dashoffset positions the gap — shift to upper-left area
  const offset1 = (330 / 360) * c1;
  const offset2 = (340 / 360) * c2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle
        cx={cx} cy={cy} r={r1}
        stroke={color}
        strokeWidth={sw1}
        strokeLinecap="round"
        strokeDasharray={`${dash1} ${gap1}`}
        strokeDashoffset={offset1}
      />
      <circle
        cx={cx} cy={cy} r={r2}
        stroke={color}
        strokeWidth={sw2}
        strokeLinecap="round"
        strokeDasharray={`${dash2} ${gap2}`}
        strokeDashoffset={offset2}
      />
    </svg>
  );
}

export default function Logo({ variant = "header", size = "md", onClick, href = "/" }: LogoProps) {
  const isLight = variant === "header";
  const markColor = isLight ? T.orange : "#FFFFFF";
  const nameColor = isLight ? T.ink    : "#FFFFFF";
  const tagColor  = isLight ? T.sub    : "rgba(255,255,255,0.55)";

  const markSize  = size === "sm" ? 28 : size === "lg" ? 52 : 38;
  const nameFontSize = size === "sm" ? "15px" : size === "lg" ? "26px" : "19px";
  const tagFontSize  = size === "sm" ? "7px"  : size === "lg" ? "11px" : "8.5px";

  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        textDecoration: "none",
        display:        "inline-flex",
        alignItems:     "center",
        gap:            size === "sm" ? "8px" : "10px",
      }}
    >
      <RingMark color={markColor} size={markSize} />
      <span style={{ display: "block", lineHeight: 1 }}>
        <span style={{
          display:       "block",
          fontFamily:    F.serif,
          fontSize:      nameFontSize,
          fontWeight:    700,
          letterSpacing: "-0.01em",
          color:         nameColor,
          lineHeight:    1,
        }}>
          {BRAND.name}
        </span>
        <span style={{
          display:       "block",
          fontFamily:    F.sans,
          fontSize:      tagFontSize,
          fontWeight:    600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color:         tagColor,
          marginTop:     "5px",
          lineHeight:    1,
        }}>
          {BRAND.tagline}
        </span>
      </span>
    </Link>
  );
}
