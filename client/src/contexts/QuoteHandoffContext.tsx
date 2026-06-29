/**
 * In-memory handoff channel for the Home → Plans navigation.
 *
 * Replaces the former sessionStorage keys ("mbi_eligibility", "workflow_data").
 * Data lives only in JS heap — never serialised to any browser storage API.
 * Cleared immediately after Plans reads it so it cannot linger.
 */

import { createContext, useContext, useRef, useCallback, type ReactNode } from "react";
import type { MBIVerifyResult } from "@/components/MBIVerifyModal";

export interface QuoteHandoffPayload {
  hasMA: boolean;
  verifyResult: MBIVerifyResult | null;
  doctors: any[];
  drugs: any[];
}

interface QuoteHandoffContextValue {
  /** Write the handoff payload immediately before navigating to /plans. */
  set: (payload: QuoteHandoffPayload) => void;
  /** Read and clear the payload in one atomic operation. Returns null if nothing was set. */
  take: () => QuoteHandoffPayload | null;
}

const QuoteHandoffContext = createContext<QuoteHandoffContextValue | null>(null);

export function QuoteHandoffProvider({ children }: { children: ReactNode }) {
  // useRef keeps the value stable across renders without triggering re-renders.
  const payloadRef = useRef<QuoteHandoffPayload | null>(null);

  const set = useCallback((payload: QuoteHandoffPayload) => {
    payloadRef.current = payload;
  }, []);

  const take = useCallback((): QuoteHandoffPayload | null => {
    const value = payloadRef.current;
    payloadRef.current = null; // clear immediately — single-use
    return value;
  }, []);

  return (
    <QuoteHandoffContext.Provider value={{ set, take }}>
      {children}
    </QuoteHandoffContext.Provider>
  );
}

export function useQuoteHandoff(): QuoteHandoffContextValue {
  const ctx = useContext(QuoteHandoffContext);
  if (!ctx) throw new Error("useQuoteHandoff must be used inside <QuoteHandoffProvider>");
  return ctx;
}
