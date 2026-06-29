import { T, F } from "@/lib/brand";
import Disclaimer from "./Disclaimer";

interface SiteFooterProps {
  /** "slim" = single-bar disclaimer footer (InfoPage, MedicareGuide style) */
  variant?: "slim";
  className?: string;
}

export default function SiteFooter({ variant = "slim", className }: SiteFooterProps) {
  return (
    <footer
      aria-label="Site footer"
      className={className}
      style={{
        backgroundColor: T.footer,
        fontFamily:      F.sans,
        fontSize:        "12px",
        color:           "rgba(255,255,255,0.25)",
        padding:         "32px 40px",
        textAlign:       "center",
        lineHeight:      1.72,
      }}
    >
      <Disclaimer variant="full" />
    </footer>
  );
}
