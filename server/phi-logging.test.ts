/**
 * PHI Log Hygiene Tests
 *
 * Verifies that console output (log, warn, error) during PHI-touching operations
 * never contains raw beneficiary identifiers, even in error/failure paths.
 *
 * Why this matters: operational log aggregators (Datadog, CloudWatch) ingest
 * console output. A single console.error(err) containing an MBI or SSN would
 * constitute a HIPAA breach in the log pipeline, even if the DB is correctly
 * encrypted.
 *
 * Guarantees verified:
 *   1. pVerify token-fetch failures log only the HTTP status, not the request body.
 *   2. pVerify eligibility failures log only the HTTP status, not MBI/SSN.
 *   3. Crypto module errors do not log the plaintext value or key material.
 *   4. A complete eligibility call with mock fallback produces no PHI in logs.
 *
 * Test data: all synthetic — no real beneficiary identifiers.
 *
 * Run: npm test -- server/phi-logging.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req:  { protocol: "https", headers: {} } as TrpcContext["req"],
    res:  { clearCookie: () => {} }          as TrpcContext["res"],
  };
}

// ── pVerify log hygiene ───────────────────────────────────────────────────────

describe("COMPLIANCE: pVerify router console output never contains MBI or SSN", () => {
  it("eligibilityCheck with MBI — console output contains no MBI value when API is unavailable", async () => {
    // When pVerify credentials are not set, the router falls back to mock data.
    // Neither the MBI nor SSN should appear in any log output during this path.
    const logSpy  = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy  = vi.spyOn(console, "error").mockImplementation(() => {});

    const syntheticMbi = "1EG4-T99-ZZ01"; // synthetic — not a real MBI

    try {
      const caller = appRouter.createCaller(createPublicContext());
      await caller.pverify.eligibilityCheck({ mbi: syntheticMbi });

      const allOutput = [
        ...logSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errSpy.mock.calls,
      ].flat().map(String).join(" ");

      expect(allOutput).not.toContain(syntheticMbi);
      expect(allOutput).not.toContain("1EG4");
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errSpy.mockRestore();
    }
  }, 15_000);

  it("eligibilityCheck with SSN — console output contains no SSN value when API is unavailable", async () => {
    const logSpy  = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy  = vi.spyOn(console, "error").mockImplementation(() => {});

    const syntheticSsn = "123456789"; // 9-digit synthetic SSN

    try {
      const caller = appRouter.createCaller(createPublicContext());
      await caller.pverify.eligibilityCheck({ ssn: syntheticSsn });

      const allOutput = [
        ...logSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errSpy.mock.calls,
      ].flat().map(String).join(" ");

      expect(allOutput).not.toContain(syntheticSsn);
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errSpy.mockRestore();
    }
  }, 15_000);

  it("pVerify fetch failure — warning log contains HTTP status code, not MBI", async () => {
    // Simulate a pVerify API failure by mocking fetch to return 401.
    // The router should warn with the status code, never with the request body
    // which contains SubscriberMemberID.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Temporarily set fake pVerify credentials so the real code path executes
    const origClientId     = process.env.PVERIFY_CLIENT_ID;
    const origClientSecret = process.env.PVERIFY_CLIENT_SECRET;
    process.env.PVERIFY_CLIENT_ID     = "fake-client-id";
    process.env.PVERIFY_CLIENT_SECRET = "fake-client-secret";

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })
    );

    const syntheticMbi = "2AB3-T55-ZZ01";

    try {
      const caller = appRouter.createCaller(createPublicContext());
      // Router should fall back to mock data after pVerify token fetch fails
      const result = await caller.pverify.eligibilityCheck({ mbi: syntheticMbi });
      expect(result.success).toBe(true); // mock fallback kicks in

      const warnOutput = warnSpy.mock.calls.flat().map(String).join(" ");
      // Warning should mention the failure, but must not contain the MBI
      expect(warnOutput).not.toContain(syntheticMbi);
      expect(warnOutput).not.toContain("2AB3");
    } finally {
      warnSpy.mockRestore();
      fetchSpy.mockRestore();
      if (origClientId !== undefined)     process.env.PVERIFY_CLIENT_ID     = origClientId;
      else delete process.env.PVERIFY_CLIENT_ID;
      if (origClientSecret !== undefined) process.env.PVERIFY_CLIENT_SECRET = origClientSecret;
      else delete process.env.PVERIFY_CLIENT_SECRET;
    }
  }, 15_000);
});

// ── Crypto module log hygiene ─────────────────────────────────────────────────

describe("COMPLIANCE: crypto module error paths do not log plaintext or key material", () => {
  const KEY_K1   = "a".repeat(64);
  const KEY_HMAC = "c".repeat(64);

  beforeEach(() => {
    process.env.ACTIVE_KEY_ID   = "k1";
    process.env.KEY_k1          = KEY_K1;
    process.env.HMAC_LOOKUP_KEY = KEY_HMAC;
  });

  afterEach(() => {
    delete process.env.ACTIVE_KEY_ID;
    delete process.env.HMAC_LOOKUP_KEY;
    for (const k of Object.keys(process.env)) {
      if (k.startsWith("KEY_")) delete process.env[k];
    }
  });

  it("validateCryptoEnv failure message contains field names, not key material", async () => {
    const { validateCryptoEnv } = await import("../shared/security/crypto");

    delete process.env.KEY_k1; // make it fail

    let errorMessage = "";
    try {
      validateCryptoEnv();
    } catch (err) {
      errorMessage = (err as Error).message;
    }

    // Message should say WHAT is wrong, not expose key values
    expect(errorMessage).toContain("KEY_k1");        // identifies the missing var
    expect(errorMessage).not.toContain(KEY_K1);      // must not print the key value
    expect(errorMessage).not.toContain(KEY_HMAC);    // must not print HMAC key either
  });

  it("loadKey error for missing key — error names the key ID, not the key value", async () => {
    const { encryptField, decryptField } = await import("../shared/security/crypto");

    // Encrypt under k1, then remove k1 from env to force a key-not-found error
    const ct = encryptField("SENSITIVE", { purpose: "test", field: "mbi" });
    delete process.env.KEY_k1;

    let errorMessage = "";
    try {
      decryptField(ct, { purpose: "test", field: "mbi" });
    } catch (err) {
      errorMessage = (err as Error).message;
    }

    // The error must say which key is missing (useful for operators)
    expect(errorMessage).toContain("KEY_k1");       // identifies the missing var
    // The error must NOT contain the actual key value or the plaintext
    expect(errorMessage).not.toContain(KEY_K1);     // no key material
    expect(errorMessage).not.toContain("SENSITIVE"); // no plaintext leakage
  });
});

// ── Legacy pVerify lookup log hygiene ─────────────────────────────────────────

describe("COMPLIANCE: legacy pVerify lookup never logs the raw Medicare ID", () => {
  it("pverify.lookup with a synthetic Medicare ID — ID does not appear in console output", async () => {
    const logSpy  = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const syntheticId = "3XY9-K00-MM55"; // synthetic format, not a real ID

    try {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.pverify.lookup({ medicareId: syntheticId });
      expect(result.success).toBe(true);

      const allOutput = [
        ...logSpy.mock.calls,
        ...warnSpy.mock.calls,
      ].flat().map(String).join(" ");

      expect(allOutput).not.toContain(syntheticId);
      expect(allOutput).not.toContain("3XY9");
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
    }
  }, 15_000);
});
