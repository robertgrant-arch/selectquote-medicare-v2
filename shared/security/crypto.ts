/**
 * Shared PHI/PII field-level encryption module.
 *
 * Uses AES-256-GCM with authenticated encryption and envelope-style payloads
 * so that key rotation, audit context, and tamper detection are all first-class.
 *
 * Environment variables
 * ---------------------
 *   ACTIVE_KEY_ID   – ID of the key to use for new encryptions (e.g. "k1")
 *   KEY_<id>        – 32-byte hex-encoded AES-256 key (e.g. KEY_k1=aabbcc...)
 *
 * Usage in a vertical slice (server-side only)
 * -------------------------------------------
 *   import { encryptField, decryptField, hashForLookup, maskValue } from "@shared/security/crypto";
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
  timingSafeEqual,
} from "node:crypto";

// ---------------------------------------------------------------------------
// Envelope type (stored as JSON then base64-URL)
// ---------------------------------------------------------------------------

interface EncryptedEnvelope {
  version: 1;
  key_id: string;
  iv: string;       // base64
  ciphertext: string; // base64
  auth_tag: string; // base64
}

// ---------------------------------------------------------------------------
// Key management
// ---------------------------------------------------------------------------

function getActiveKeyId(): string {
  const id = process.env.ACTIVE_KEY_ID;
  if (!id) throw new Error("[crypto] ACTIVE_KEY_ID env var is not set");
  return id;
}

function loadKey(keyId: string): Buffer {
  const hex = process.env[`KEY_${keyId}`];
  if (!hex) throw new Error(`[crypto] KEY_${keyId} env var is not set`);
  if (hex.length !== 64)
    throw new Error(`[crypto] KEY_${keyId} must be a 64-char hex string (32 bytes)`);
  return Buffer.from(hex, "hex");
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
// Deterministic lookup hash (HMAC-SHA-256 keyed on the active key)
// ---------------------------------------------------------------------------

/**
 * Returns a stable, keyed hex digest suitable for indexed lookups (e.g. email).
 * Uses the same active key as encryption so it rotates when the key rotates.
 * NOT reversible — do not use this as a substitute for encryption.
 */
export function hashForLookup(value: string): string {
  const keyId = getActiveKeyId();
  const key = loadKey(keyId);
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
