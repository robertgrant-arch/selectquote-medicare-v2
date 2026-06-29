/**
 * Unit tests for shared/security/crypto.ts
 *
 * Run: npm test -- shared/security/crypto.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encryptField,
  decryptField,
  hashForLookup,
  maskValue,
  validateCryptoEnv,
} from "./crypto";

// ---------------------------------------------------------------------------
// Test key fixtures (64-char hex = 32 bytes each)
// ---------------------------------------------------------------------------

const KEY_K1   = "a".repeat(64); // encryption key ID "k1" — active key
const KEY_K2   = "b".repeat(64); // encryption key ID "k2" — legacy key for rotation tests
const KEY_HMAC = "c".repeat(64); // dedicated HMAC lookup key

const CTX = { purpose: "eligibility", field: "mbi" };

function setEnv(
  activeId: string,
  keys: Record<string, string>,
  hmacKey: string = KEY_HMAC
) {
  // Clear all existing KEY_* vars so tests don't bleed into each other.
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("KEY_")) delete process.env[k];
  }
  delete process.env.HMAC_LOOKUP_KEY;
  process.env.ACTIVE_KEY_ID = activeId;
  for (const [id, hex] of Object.entries(keys)) {
    process.env[`KEY_${id}`] = hex;
  }
  process.env.HMAC_LOOKUP_KEY = hmacKey;
}

function clearEnv() {
  delete process.env.ACTIVE_KEY_ID;
  delete process.env.HMAC_LOOKUP_KEY;
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("KEY_")) delete process.env[k];
  }
}

beforeEach(() => setEnv("k1", { k1: KEY_K1 }));
afterEach(() => clearEnv());

// ---------------------------------------------------------------------------
// encryptField / decryptField — round trip
// ---------------------------------------------------------------------------

describe("encryptField / decryptField", () => {
  it("round-trips a plaintext value", () => {
    const plain = "1EG4-A22-AA11";
    const payload = encryptField(plain, CTX);
    expect(decryptField(payload, CTX)).toBe(plain);
  });

  it("produces a different ciphertext each call (random IV)", () => {
    const plain = "1EG4-A22-AA11";
    const a = encryptField(plain, CTX);
    const b = encryptField(plain, CTX);
    expect(a).not.toBe(b);
  });

  it("output is a valid base64url string (no +, /, =)", () => {
    const payload = encryptField("test", CTX);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("envelope contains expected fields when decoded", () => {
    const payload = encryptField("test", CTX);
    const env = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    expect(env.version).toBe(1);
    expect(env.key_id).toBe("k1");
    expect(typeof env.iv).toBe("string");
    expect(typeof env.ciphertext).toBe("string");
    expect(typeof env.auth_tag).toBe("string");
  });

  it("handles empty string", () => {
    const payload = encryptField("", CTX);
    expect(decryptField(payload, CTX)).toBe("");
  });

  it("handles unicode and special characters", () => {
    const plain = "Ñoño 漢字 🏥 <script>alert(1)</script>";
    const payload = encryptField(plain, CTX);
    expect(decryptField(payload, CTX)).toBe(plain);
  });

  it("throws on malformed payload", () => {
    expect(() => decryptField("not-valid-base64url!!!", CTX)).toThrow(
      /malformed envelope/
    );
  });
});

// ---------------------------------------------------------------------------
// AAD binding — context must match
// ---------------------------------------------------------------------------

describe("AAD context binding", () => {
  it("fails if purpose is different", () => {
    const payload = encryptField("secret", { purpose: "auth", field: "email" });
    expect(() =>
      decryptField(payload, { purpose: "billing", field: "email" })
    ).toThrow(/authentication failed/);
  });

  it("fails if field is different", () => {
    const payload = encryptField("secret", { purpose: "auth", field: "email" });
    expect(() =>
      decryptField(payload, { purpose: "auth", field: "ssn" })
    ).toThrow(/authentication failed/);
  });
});

// ---------------------------------------------------------------------------
// Tamper detection
// ---------------------------------------------------------------------------

describe("tamper detection", () => {
  it("fails when ciphertext is modified", () => {
    const payload = encryptField("1EG4-A22-AA11", CTX);
    const env = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    // Flip one byte in the ciphertext
    const ct = Buffer.from(env.ciphertext, "base64");
    ct[0] ^= 0xff;
    env.ciphertext = ct.toString("base64");

    const tampered = Buffer.from(JSON.stringify(env)).toString("base64url");
    expect(() => decryptField(tampered, CTX)).toThrow(/authentication failed/);
  });

  it("fails when auth_tag is modified", () => {
    const payload = encryptField("1EG4-A22-AA11", CTX);
    const env = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    const tag = Buffer.from(env.auth_tag, "base64");
    tag[0] ^= 0xff;
    env.auth_tag = tag.toString("base64");

    const tampered = Buffer.from(JSON.stringify(env)).toString("base64url");
    expect(() => decryptField(tampered, CTX)).toThrow(/authentication failed/);
  });

  it("fails when iv is modified", () => {
    const payload = encryptField("1EG4-A22-AA11", CTX);
    const env = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    const iv = Buffer.from(env.iv, "base64");
    iv[0] ^= 0xff;
    env.iv = iv.toString("base64");

    const tampered = Buffer.from(JSON.stringify(env)).toString("base64url");
    expect(() => decryptField(tampered, CTX)).toThrow(/authentication failed/);
  });
});

// ---------------------------------------------------------------------------
// Wrong key
// ---------------------------------------------------------------------------

describe("wrong key", () => {
  it("fails when the decryption environment has a different key for the same key_id", () => {
    const payload = encryptField("secret", CTX);

    // Swap k1 for a different key value
    process.env.KEY_k1 = "d".repeat(64);
    expect(() => decryptField(payload, CTX)).toThrow(/authentication failed/);
  });

  it("fails when the key for the envelope's key_id is missing", () => {
    const payload = encryptField("secret", CTX);
    delete process.env.KEY_k1;
    expect(() => decryptField(payload, CTX)).toThrow(/KEY_k1 env var is not set/);
  });
});

// ---------------------------------------------------------------------------
// Key rotation — new key encrypts; old key still decrypts legacy values
// ---------------------------------------------------------------------------

describe("key rotation", () => {
  it("values encrypted with k1 are still decryptable after rotating to k2", () => {
    // Encrypt with k1 (current active key)
    setEnv("k1", { k1: KEY_K1 });
    const legacyPayload = encryptField("legacy-mbi-value", CTX);

    // Rotate: k2 is now active; k1 is kept for legacy decryption
    setEnv("k2", { k1: KEY_K1, k2: KEY_K2 });

    // New encryptions use k2
    const newPayload = encryptField("new-mbi-value", CTX);
    const newEnv = JSON.parse(Buffer.from(newPayload, "base64url").toString("utf8"));
    expect(newEnv.key_id).toBe("k2");

    // Legacy value still decrypts using k1
    expect(decryptField(legacyPayload, CTX)).toBe("legacy-mbi-value");
    // New value decrypts using k2
    expect(decryptField(newPayload, CTX)).toBe("new-mbi-value");
  });

  it("legacy value cannot decrypt if old key is removed after rotation", () => {
    setEnv("k1", { k1: KEY_K1 });
    const legacyPayload = encryptField("legacy-mbi-value", CTX);

    // Rotate and drop k1 (bad practice, but must fail gracefully)
    setEnv("k2", { k2: KEY_K2 }); // k1 no longer available

    expect(() => decryptField(legacyPayload, CTX)).toThrow(/KEY_k1 env var is not set/);
  });
});

// ---------------------------------------------------------------------------
// hashForLookup — uses HMAC_LOOKUP_KEY (separate from encryption keys)
// ---------------------------------------------------------------------------

describe("hashForLookup", () => {
  it("is deterministic for the same value and key", () => {
    const h1 = hashForLookup("robert@example.com");
    const h2 = hashForLookup("robert@example.com");
    expect(h1).toBe(h2);
  });

  it("produces different hashes for different values", () => {
    expect(hashForLookup("a@example.com")).not.toBe(hashForLookup("b@example.com"));
  });

  it("is controlled by HMAC_LOOKUP_KEY, not by the encryption key", () => {
    const h1 = hashForLookup("robert@example.com");

    // Changing the active encryption key has NO effect on lookup hashes.
    // This is the desired behavior: lookup hashes are stable across encryption key rotations.
    process.env.KEY_k1 = "d".repeat(64);
    process.env.ACTIVE_KEY_ID = "k1";
    const h2 = hashForLookup("robert@example.com");
    expect(h1).toBe(h2); // stable — same HMAC_LOOKUP_KEY, different encryption key
  });

  it("changes when HMAC_LOOKUP_KEY changes (rare — only if lookup key is rotated)", () => {
    const h1 = hashForLookup("robert@example.com");

    // Changing HMAC_LOOKUP_KEY DOES change the hash (and invalidates all DB lookup indexes).
    // This should only happen if HMAC_LOOKUP_KEY is compromised — not on normal rotation.
    process.env.HMAC_LOOKUP_KEY = "e".repeat(64);
    const h2 = hashForLookup("robert@example.com");
    expect(h1).not.toBe(h2);
  });

  it("returns a 64-char hex string", () => {
    expect(hashForLookup("test")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws if HMAC_LOOKUP_KEY is missing", () => {
    delete process.env.HMAC_LOOKUP_KEY;
    expect(() => hashForLookup("test")).toThrow(/HMAC_LOOKUP_KEY/);
  });

  it("throws if HMAC_LOOKUP_KEY is not valid hex", () => {
    process.env.HMAC_LOOKUP_KEY = "not-valid-hex!!";
    expect(() => hashForLookup("test")).toThrow(/64 hex characters/);
  });
});

// ---------------------------------------------------------------------------
// maskValue
// ---------------------------------------------------------------------------

describe("maskValue", () => {
  it("masks email preserving domain", () => {
    expect(maskValue("robert@selectquote.com")).toBe("ro***@selectquote.com");
  });

  it("masks short strings entirely", () => {
    expect(maskValue("ab")).toBe("**");
  });

  it("masks with custom showStart", () => {
    expect(maskValue("1EG4-A22-AA11", { showStart: 4 })).toBe("1EG4***");
  });

  it("masks with showEnd", () => {
    expect(maskValue("1EG4-A22-AA11", { showStart: 2, showEnd: 3 })).toBe("1E***A11");
  });

  it("returns empty string for empty input", () => {
    expect(maskValue("")).toBe("");
  });

  it("uses custom mask char", () => {
    expect(maskValue("secret", { showStart: 2, char: "·" })).toBe("se···");
  });
});

// ---------------------------------------------------------------------------
// validateCryptoEnv
// ---------------------------------------------------------------------------

describe("validateCryptoEnv", () => {
  it("passes with all required vars set correctly", () => {
    setEnv("k1", { k1: KEY_K1 });
    expect(() => validateCryptoEnv()).not.toThrow();
  });

  it("passes with multiple encryption keys (rotation scenario)", () => {
    setEnv("k2", { k1: KEY_K1, k2: KEY_K2 });
    expect(() => validateCryptoEnv()).not.toThrow();
  });

  it("fails if ACTIVE_KEY_ID is missing", () => {
    delete process.env.ACTIVE_KEY_ID;
    expect(() => validateCryptoEnv()).toThrow(/ACTIVE_KEY_ID is not set/);
  });

  it("fails if the active key's KEY_<id> var is missing", () => {
    process.env.ACTIVE_KEY_ID = "k99";
    // KEY_k99 not set; KEY_k1 is present from beforeEach
    expect(() => validateCryptoEnv()).toThrow(/KEY_k99 is not set/);
  });

  it("fails if any KEY_* var is not valid 64-char hex", () => {
    process.env.KEY_k1 = "tooshort";
    expect(() => validateCryptoEnv()).toThrow(/64 hex characters/);
  });

  it("fails if HMAC_LOOKUP_KEY is missing", () => {
    delete process.env.HMAC_LOOKUP_KEY;
    expect(() => validateCryptoEnv()).toThrow(/HMAC_LOOKUP_KEY is not set/);
  });

  it("fails if HMAC_LOOKUP_KEY is not valid 64-char hex", () => {
    process.env.HMAC_LOOKUP_KEY = "badhex!";
    expect(() => validateCryptoEnv()).toThrow(/64 hex characters/);
  });

  it("reports all errors at once (not just the first)", () => {
    clearEnv();
    try {
      validateCryptoEnv();
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toMatch(/ACTIVE_KEY_ID/);
      expect(msg).toMatch(/HMAC_LOOKUP_KEY/);
    }
  });
});

// ---------------------------------------------------------------------------
// Environment validation (inline — called by encrypt/decrypt/hash)
// ---------------------------------------------------------------------------

describe("environment validation", () => {
  it("throws if ACTIVE_KEY_ID is not set", () => {
    delete process.env.ACTIVE_KEY_ID;
    expect(() => encryptField("x", CTX)).toThrow(/ACTIVE_KEY_ID/);
  });

  it("throws if KEY_<id> is wrong length", () => {
    process.env.KEY_k1 = "tooshort";
    expect(() => encryptField("x", CTX)).toThrow(/64 hex characters/);
  });

  it("throws if KEY_<id> contains non-hex characters", () => {
    process.env.KEY_k1 = "g".repeat(64); // "g" is not valid hex
    expect(() => encryptField("x", CTX)).toThrow(/64 hex characters/);
  });
});
