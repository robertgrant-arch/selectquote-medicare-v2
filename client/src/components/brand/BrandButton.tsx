import { T, F, CONTACT } from "@/lib/brand";
import { CSSProperties, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "cta";
type ButtonAs      = "button" | "a";

interface BrandButtonProps {
  variant?: ButtonVariant;
  as?: ButtonAs;
  href?: string;
  children?: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  "aria-label"?: string;
}

const BASE: CSSProperties = {
  display:        "inline-flex",
  alignItems:     "center",
  justifyContent: "center",
  fontFamily:     F.serif,   // Poppins for buttons per brand spec
  fontWeight:     600,
  fontSize:       "15px",
  letterSpacing:  "0.005em",
  borderRadius:   "6px",
  border:         "none",
  cursor:         "pointer",
  textDecoration: "none",
  transition:     "background-color 0.14s, color 0.14s, border-color 0.14s",
  lineHeight:     1,
  whiteSpace:     "nowrap",
  padding:        "0 24px",
  height:         "48px",
};

const VARIANTS: Record<ButtonVariant, CSSProperties> = {
  primary: {
    backgroundColor: T.orange,  // Orange CTA — brand primary on white/light bg
    color:           "#fff",
  },
  secondary: {
    backgroundColor: T.tealL,
    color:           T.tealD,
  },
  ghost: {
    backgroundColor: "transparent",
    color:           T.body,
    border:          `1px solid ${T.border}`,
  },
  cta: {
    backgroundColor: T.teal,
    color:           "#fff",
  },
};

/** Reusable brand-aware button/link. Use `as="a"` + `href` for link semantics. */
export default function BrandButton({
  variant = "primary",
  as: Tag = "button",
  href,
  children,
  onClick,
  style,
  className,
  disabled,
  type = "button",
  "aria-label": ariaLabel,
}: BrandButtonProps) {
  const merged: CSSProperties = { ...BASE, ...VARIANTS[variant], ...style };

  if (Tag === "a") {
    return (
      <a
        href={href}
        onClick={onClick}
        className={className}
        style={merged}
        aria-label={ariaLabel}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      className={className}
      style={merged}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

/** Pre-wired "Talk to an Advisor" phone CTA */
export function TalkToAgentButton({ style, className, height }: { style?: CSSProperties; className?: string; height?: string }) {
  return (
    <BrandButton
      variant="primary"
      as="a"
      href={CONTACT.phoneTel}
      style={{ height: height ?? "38px", ...style }}
      className={className}
    >
      Talk to an Advisor
    </BrandButton>
  );
}
