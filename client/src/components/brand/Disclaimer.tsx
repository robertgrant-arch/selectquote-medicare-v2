import { BRAND } from "@/lib/brand";

interface DisclaimerProps {
  /** "slim" = one-line copyright only; "full" = disclaimer + copyright (default) */
  variant?: "full" | "slim";
  style?: React.CSSProperties;
  className?: string;
}

export default function Disclaimer({ variant = "full", style, className }: DisclaimerProps) {
  return (
    <div style={style} className={className}>
      {variant === "full" && (
        <p>
          {BRAND.disclaimer}
        </p>
      )}
      <p style={variant === "full" ? { marginTop: "4px" } : undefined}>
        {BRAND.copyright}
      </p>
    </div>
  );
}
