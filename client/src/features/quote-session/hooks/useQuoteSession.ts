/**
 * Client-side quote-session hook.
 *
 * Manages the lifecycle of a quote session:
 *   - Stores the opaque resume token in localStorage (not PHI)
 *   - Calls trpc.quoteSession.save to create or update the server session
 *   - Provides the current token so callers can check for an existing session
 *
 * The resume token is an opaque 64-char hex credential — not PHI — so
 * localStorage is appropriate here (it was explicitly removed only for PHI).
 */

import { useRef } from "react";
import { trpc } from "@/lib/trpc";

const STORAGE_KEY = "mqe_resume_token";

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export interface QuoteSessionSaveInput {
  zip?: string;
  county?: string;
  eligibility?: {
    mbi?: string;
    eligibilityResultJson?: string;
    currentPlanName?: string;
    currentPlanCarrier?: string;
    verifiedAt?: string;
  };
  medications?: Array<{ name: string; dosage?: string; frequency?: string }>;
  providers?: Array<{ name: string; npi?: string; specialty?: string }>;
  consentGranted?: boolean;
}

export function useQuoteSession() {
  const tokenRef = useRef<string | null>(readToken());
  const sessionIdRef = useRef<string | null>(null);

  const saveMutation = trpc.quoteSession.save.useMutation({
    onSuccess: (data) => {
      if (data.resumeToken) {
        localStorage.setItem(STORAGE_KEY, data.resumeToken);
        tokenRef.current = data.resumeToken;
      }
      sessionIdRef.current = data.sessionId;
    },
  });

  const save = (partial: QuoteSessionSaveInput) => {
    const token = tokenRef.current;
    saveMutation.mutate({
      ...partial,
      resumeToken: token ?? undefined,
    });
  };

  const clearSession = () => {
    localStorage.removeItem(STORAGE_KEY);
    tokenRef.current = null;
    sessionIdRef.current = null;
  };

  return {
    /** True if a resume token exists in localStorage. Validate with trpc.quoteSession.resume. */
    hasExistingSession: !!readToken(),
    resumeToken: tokenRef.current,
    save,
    clearSession,
    isSaving: saveMutation.isPending,
  };
}
