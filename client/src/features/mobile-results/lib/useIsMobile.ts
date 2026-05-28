import { useState, useEffect } from 'react';
export const MOBILE_BREAKPOINT = 768;
export function isMobileWidth(width: number): boolean { return width < MOBILE_BREAKPOINT; }
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' ? isMobileWidth(window.innerWidth) : false);
  useEffect(() => {
    const h = () => setMobile(isMobileWidth(window.innerWidth));
    window.addEventListener('resize', h, { passive: true });
    return () => window.removeEventListener('resize', h);
  }, []);
  return mobile;
}
