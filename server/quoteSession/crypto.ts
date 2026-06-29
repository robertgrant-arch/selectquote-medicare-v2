/**
 * Thin re-export of the shared crypto helpers, namespaced for this slice.
 * The purpose tag "quote-session" is baked into every envelope's AAD so a
 * ciphertext from another purpose cannot be decrypted here.
 */

import {
  encryptField as _enc,
  decryptField as _dec,
  hashForLookup,
} from "../../shared/security/crypto";

const PURPOSE = "quote-session";

export function enc(plaintext: string, field: string): string {
  return _enc(plaintext, { purpose: PURPOSE, field });
}

export function dec(payload: string, field: string): string {
  return _dec(payload, { purpose: PURPOSE, field });
}

/** Deterministic HMAC-SHA-256 hash for indexed lookups (e.g. email). */
export { hashForLookup };

/** Safely decrypt, returning undefined if payload is null/undefined/empty. */
export function decOrUndefined(payload: string | null | undefined, field: string): string | undefined {
  if (!payload) return undefined;
  try {
    return dec(payload, field);
  } catch {
    // Tampered or wrong-key payload — treat as missing rather than crashing.
    return undefined;
  }
}
