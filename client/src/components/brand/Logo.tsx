import { Link } from "wouter";
import { T, F, BRAND } from "@/lib/brand";

interface LogoProps {
  /** "header" = ink text on white; "footer" = white text on dark */
  variant?: "header" | "footer";
  onClick?: () => void;
  href?: string;
}

export default function Logo({ variant = "header", onClick, href = "/" }: LogoProps) {
  const isFooter = variant === "footer";

  const nameColor  = isFooter ? "#fff"                      : T.ink;
  const tagColor   = isFooter ? "rgba(255,255,255,0.22)"    : T.sub;
  const barOpacity = isFooter ? 0                           : 1; // hide teal bar in footer variant
  const nameSz     = isFooter ? "20px"                      : "19px";
  const tagSz      = isFooter ? "10px"                      : "8.5px";
  const tagLetSp   = isFooter ? "0.1em"                     : "0.16em";
  const tagWt      = isFooter ? 600                         : 500;

  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        textDecoration: "none",
        display:        "inline-flex",
        alignItems:     "center",
        gap:            "11px",
      }}
    >
      {!isFooter && (
        <span
          aria-hidden="true"
          style={{
            display:         "block",
            width:           "3px",
            height:          "26px",
            borderRadius:    "2px",
            backgroundColor: T.teal,
            flexShrink:      0,
            opacity:         barOpacity,
          }}
        />
      )}
      <span style={{ display: "block", lineHeight: 1 }}>
        <span style={{
          display:       "block",
          fontFamily:    F.serif,
          fontSize:      nameSz,
          fontWeight:    isFooter ? 400 : 500,
          letterSpacing: "-0.02em",
          color:         nameColor,
          lineHeight:    1,
        }}>
          {BRAND.name}
        </span>
        <span style={{
          display:       "block",
          fontFamily:    F.sans,
          fontSize:      tagSz,
          fontWeight:    tagWt,
          letterSpacing: tagLetSp,
          textTransform: "uppercase",
          color:         tagColor,
          marginTop:     isFooter ? "5px" : "6px",
          lineHeight:    1,
        }}>
          {BRAND.tagline}
        </span>
      </span>
    </Link>
  );
}
