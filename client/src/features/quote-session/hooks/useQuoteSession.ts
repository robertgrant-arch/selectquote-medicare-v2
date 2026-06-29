/**
 * Client-side quote-session hook.
 *
 * Identity model
 * ──────────────
 * Authenticated users   → session identified by userId (via auth cookie); no token needed for load.
 * Anonymous users       → session identified by resumeToken stored in localStorage.
 *
 * On mount, if a stored token exists, `claim` fires once. The server sets userId
 * on the session if the caller is authenticated (no-op for anonymous callers).
 * This covers the "chatted anonymously, then logged in" case without extra UI.
 *
 * Resume token contract
 * ─────────────────────
 * Raw token: generated server-side, returned once, stored in localStorage (not PHI).
 * Server stores only SHA-256(token). Never log or expose the raw token.
 */

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";

const STORAGE_KEY = "mqe_resume_token";

// Module-level flag so the claim fires once per browser session, not per hook mount.
let _claimAttempted = false;

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
  // storedToken in state so the load query reacts when a new session is created.
  const [storedToken, setStoredToken] = useState<string | null>(readToken);
  const tokenRef = useRef<string | null>(storedToken);
  const sessionIdRef = useRef<string | null>(null);

  // ── Save mutation ─────────────────────────────────────────────────────────
  const saveMutation = trpc.quoteSession.save.useMutation({
    onSuccess: (data) => {
      if (data.resumeToken) {
        localStorage.setItem(STORAGE_KEY, data.resumeToken);
        tokenRef.current = data.resumeToken;
        setStoredToken(data.resumeToken);
      }
      sessionIdRef.current = data.sessionId;
    },
  });

  const save = (partial: QuoteSessionSaveInput) => {
    saveMutation.mutate({
      ...partial,
      resumeToken: tokenRef.current ?? undefined,
    });
  };

  // ── Load query — unified: by userId (auth) or by token (anonymous) ────────
  // Returns null when no session exists; not an error condition.
  const loadQuery = trpc.quoteSession.load.useQuery(
    { resumeToken: storedToken ?? undefined },
    {
      staleTime: 5 * 60 * 1000, // treat as fresh for 5 minutes
      retry: false,              // absence of a session is normal — don't retry
    },
  );

  // ── Claim — fires once on mount if a stored token exists ──────────────────
  // The server sets userId on the anonymous session when the caller is authenticated.
  // No-op (returns { claimed: false }) when the caller is not authenticated.
  const claimMutation = trpc.quoteSession.claim.useMutation();

  useEffect(() => {
    if (_claimAttempted) return;
    const token = readToken();
    if (!token) return;
    _claimAttempted = true;
    claimMutation.mutate({ resumeToken: token });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Clear ─────────────────────────────────────────────────────────────────
  const clearSession = () => {
    localStorage.removeItem(STORAGE_KEY);
    tokenRef.current = null;
    sessionIdRef.current = null;
    setStoredToken(null);
  };

  return {
    /** True if a resume token exists in localStorage. */
    hasExistingSession: !!storedToken,
    resumeToken: tokenRef.current,
    save,
    clearSession,
    isSaving: saveMutation.isPending,
    /** Decrypted PHI for the current user/session; null while loading or when no session exists. */
    session: loadQuery.data ?? null,
    isLoadingSession: loadQuery.isLoading,
  };
}
