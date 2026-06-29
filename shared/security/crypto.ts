/**
 * Shared PHI/PII field-level encryption module.
 *
 * Uses AES-256-GCM with authenticated encryption and envelope-style payloads
 * so that key rotation, audit context, and tamper detection are all first-class.
 *
 * Required environment variables
 * --------------------------------
 *   ACTIVE_KEY_ID       – ID of the key used for NEW encryptions (e.g. "k1")
 *   KEY_<id>            – 64-char hex AES-256 key for each configured key ID
 *                         At minimum KEY_<ACTIVE_KEY_ID> must be present.
 *                         Keep old IDs present so legacy ciphertext can still
 *                         be decrypted during and after rotation.
 *   HMAC_LOOKUP_KEY     – 64-char hex key used ONLY for hashForLookup().
 *                         Separate from the encryption keys so it is stable
 *                         across encryption key rotations. Changing this key
 *                         invalidates all indexed lookup hashes in the DB.
 *
 * Design notes
 * ------------
 *   • encryptField / decryptField use the key_id embedded in the envelope,
 *     so decryption always works as long as that key is still in env.
 *   • hashForLookup uses HMAC_LOOKUP_KEY directly (not the active encryption
 *     key). This means lookup hashes remain stable when you rotate encryption
 *     keys, which is the expected operational behavior.
 *   • All keys must be valid 64-character lowercase hex strings (32 bytes).
 *   • There is no plaintext fallback mode. A missing or invalid key is always
 *     a hard error.
 *
 * Startup validation
 * ------------------
 *   Call validateCryptoEnv() once at server startup (before the first request).
 *   It checks all three conditions above and throws with a descriptive message
 *   if any is violated. This gives a clear startup failure rather than a
 *   confusing error on the first encrypt/decrypt call.
 *
 * Usage in a vertical slice (server-side only)
 * -------------------------------------------
 *   import { encryptField, decryptField, hashForLookup, maskValue,
 *            validateCryptoEnv } from "@shared/security/crypto";
 *
 *   const stored = encryptField(user.email, { purpose: "auth", field: "email" });
 *   const plain  = decryptField(stored,      { purpose: "auth", field: "email" });
 *   const lookup = hashForLookup(user.email);
 *   const masked = maskValue(user.email);        // "ro***@selectquote.com"
 */

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

// ---------------------------------------------------------------------------
// Envelope type (stored as JSON then base64-URL)
// ---------------------------------------------------------------------------

interface EncryptedEnvelope {
  version: 1;
  key_id: string;
  iv: string;         // base64
  ciphertext: string; // base64
  auth_tag: string;   // base64
}

// ---------------------------------------------------------------------------
// Key management internals
// ---------------------------------------------------------------------------

const HEX_RE = /^[0-9a-fA-F]{64}$/;

function getActiveKeyId(): string {
  const id = process.env.ACTIVE_KEY_ID;
  if (!id) throw new Error("[crypto] ACTIVE_KEY_ID env var is not set");
  if (!/^[\w-]+$/.test(id))
    throw new Error("[crypto] ACTIVE_KEY_ID must contain only alphanumerics, underscores, or hyphens");
  return id;
}

function loadKey(keyId: string): Buffer {
  const hex = process.env[`KEY_${keyId}`];
  if (!hex) throw new Error(`[crypto] KEY_${keyId} env var is not set`);
  if (!HEX_RE.test(hex))
    throw new Error(`[crypto] KEY_${keyId} must be exactly 64 hex characters (32 bytes)`);
  return Buffer.from(hex, "hex");
}

function loadHmacLookupKey(): Buffer {
  const hex = process.env.HMAC_LOOKUP_KEY;
  if (!hex) throw new Error("[crypto] HMAC_LOOKUP_KEY env var is not set");
  if (!HEX_RE.test(hex))
    throw new Error("[crypto] HMAC_LOOKUP_KEY must be exactly 64 hex characters (32 bytes)");
  return Buffer.from(hex, "hex");
}

// ---------------------------------------------------------------------------
// Startup validation — call once from server/_core/index.ts
// ---------------------------------------------------------------------------

/**
 * Validates all required crypto env vars and throws a descriptive Error if any
 * are missing or malformed. Call this at server startup before handling any
 * requests.
 *
 * Checks:
 *   1. ACTIVE_KEY_ID is set and contains only safe characters.
 *   2. KEY_<ACTIVE_KEY_ID> is set and is a valid 64-char hex string.
 *   3. At least one KEY_* var is present.
 *   4. Every KEY_* var that IS present is a valid 64-char hex string
 *      (so stale keys in env don't silently fail on first use).
 *   5. HMAC_LOOKUP_KEY is set and is a valid 64-char hex string.
 */
export function validateCryptoEnv(): void {
  const errors: string[] = [];

  // 1. ACTIVE_KEY_ID
  const activeId = process.env.ACTIVE_KEY_ID;
  if (!activeId) {
    errors.push("ACTIVE_KEY_ID is not set");
  } else if (!/^[\w-]+$/.test(activeId)) {
    errors.push("ACTIVE_KEY_ID contains invalid characters (use alphanumerics, underscores, hyphens)");
  } else {
    // 2. Active key must be present and valid
    const activeHex = process.env[`KEY_${activeId}`];
    if (!activeHex) {
      errors.push(`KEY_${activeId} is not set (required because ACTIVE_KEY_ID="${activeId}")`);
    } else if (!HEX_RE.test(activeHex)) {
      errors.push(`KEY_${activeId} must be exactly 64 hex characters (32 bytes)`);
    }
  }

  // 3 & 4. All KEY_* vars that exist must be valid
  const keyVars = Object.keys(process.env).filter((k) => k.startsWith("KEY_"));
  if (keyVars.length === 0) {
    errors.push("No KEY_<id> vars found — at least one encryption key is required");
  }
  for (const k of keyVars) {
    const hex = process.env[k]!;
    if (!HEX_RE.test(hex)) {
      errors.push(`${k} must be exactly 64 hex characters (32 bytes) — found length ${hex.length}`);
    }
  }

  // 5. HMAC_LOOKUP_KEY
  const hmacHex = process.env.HMAC_LOOKUP_KEY;
  if (!hmacHex) {
    errors.push("HMAC_LOOKUP_KEY is not set");
  } else if (!HEX_RE.test(hmacHex)) {
    errors.push("HMAC_LOOKUP_KEY must be exactly 64 hex characters (32 bytes)");
  }

  if (errors.length > 0) {
    throw new Error(
      `[crypto] Environment validation failed:\n${errors.map((e) => `  • ${e}`).join("\n")}\n` +
        "See docs/key-management.md for setup instructions."
    );
  }
}

// ---------------------------------------------------------------------------
// Core encrypt / decrypt
// ---------------------------------------------------------------------------

/**
 * Encrypts a plaintext string and returns an opaque base64url envelope.
 * The context is bound into the AAD so the ciphertext cannot be moved to a
 * different field or purpose without decryption failing.
 */
export function encryptField(
  plaintext: string,
  context: { purpose: string; field: string }
): string {
  const keyId = getActiveKeyId();
  const key = loadKey(keyId);
  const iv = randomBytes(12); // 96-bit IV for GCM
  const aad = buildAAD(keyId, context);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const envelope: EncryptedEnvelope = {
    version: 1,
    key_id: keyId,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    auth_tag: authTag.toString("base64"),
  };

  return Buffer.from(JSON.stringify(envelope)).toString("base64url");
}

/**
 * Decrypts an envelope produced by encryptField.
 * Throws if the envelope is malformed, the key is missing, or authentication fails.
 * Uses the key_id embedded in the envelope — works transparently across rotations.
 */
export function decryptField(
  payload: string,
  context: { purpose: string; field: string }
): string {
  let envelope: EncryptedEnvelope;
  try {
    envelope = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as EncryptedEnvelope;
  } catch {
    throw new Error("[crypto] decryptField: malformed envelope");
  }

  if (envelope.version !== 1) {
    throw new Error(`[crypto] decryptField: unknown envelope version ${envelope.version}`);
  }

  const key = loadKey(envelope.key_id);
  const iv = Buffer.from(envelope.iv, "base64");
  const ciphertext = Buffer.from(envelope.ciphertext, "base64");
  const authTag = Buffer.from(envelope.auth_tag, "base64");
  const aad = buildAAD(envelope.key_id, context);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);

  try {
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    // Don't surface internal details — caller only needs to know it failed.
    throw new Error("[crypto] decryptField: authentication failed");
  }
}

// ---------------------------------------------------------------------------
// Deterministic lookup hash (HMAC-SHA-256 keyed on HMAC_LOOKUP_KEY)
// ---------------------------------------------------------------------------

/**
 * Returns a stable, keyed hex digest suitable for indexed lookups (e.g. email).
 *
 * Uses HMAC_LOOKUP_KEY — a dedicated key that is SEPARATE from the encryption
 * keys. This means lookup hashes remain stable when you rotate encryption keys,
 * which is the expected operational behavior. You only need to re-hash when
 * HMAC_LOOKUP_KEY itself is rotated (which should be rare — only if compromised).
 *
 * NOT reversible — do not use this as a substitute for encryption.
 */
export function hashForLookup(value: string): string {
  const key = loadHmacLookupKey();
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Masking (for logs and admin UI)
// ---------------------------------------------------------------------------

export interface MaskOptions {
  /** Number of characters to reveal at the start. Default: 2. */
  showStart?: number;
  /** Number of characters to reveal at the end. Default: 0 (hide all suffix). */
  showEnd?: number;
  /** Character to use for the masked portion. Default: "*". */
  char?: string;
}

/**
 * Returns a masked version of a sensitive value for use in logs and admin UI.
 * Preserves enough structure to identify values in support contexts without
 * exposing the full string.
 *
 * Examples
 *   maskValue("robert@example.com")          → "ro***@example.com"
 *   maskValue("1AB2C3DE4EF5", {showEnd: 4})  → "1A***EF5"
 *   maskValue("123-45-6789")                 → "12***"
 */
export function maskValue(value: string, options?: MaskOptions): string {
  if (!value) return "";
  const showStart = options?.showStart ?? 2;
  const showEnd = options?.showEnd ?? 0;
  const char = options?.char ?? "*";

  // Special handling for email: mask local part, preserve domain.
  const atIdx = value.indexOf("@");
  if (atIdx > 0 && showEnd === 0) {
    const local = value.slice(0, atIdx);
    const domain = value.slice(atIdx); // includes @
    const visible = local.slice(0, Math.min(showStart, local.length));
    return `${visible}${char.repeat(3)}${domain}`;
  }

  const total = value.length;
  if (total <= showStart + showEnd) return char.repeat(total);

  const start = value.slice(0, showStart);
  const end = showEnd > 0 ? value.slice(total - showEnd) : "";
  return `${start}${char.repeat(3)}${end}`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds the Additional Authenticated Data buffer.
 * Binds key_id + purpose + field so the ciphertext is tied to its intended use.
 */
function buildAAD(keyId: string, context: { purpose: string; field: string }): Buffer {
  return Buffer.from(`v1:${keyId}:${context.purpose}:${context.field}`, "utf8");
}

// ---------------------------------------------------------------------------
// Guard: prevent accidental client-side import
// ---------------------------------------------------------------------------

if (typeof window !== "undefined") {
  throw new Error(
    "[crypto] shared/security/crypto.ts must only be imported server-side. " +
      "Never import this module in client code."
  );
}
