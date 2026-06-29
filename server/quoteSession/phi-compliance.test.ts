/**
 * PHI Compliance Tests — Quote-Session Slice
 *
 * These tests make explicit compliance claims about the quote-session slice's
 * PHI handling. They are grouped by the guarantee they verify, not by the
 * function they exercise, so each describe block reads as a policy statement.
 *
 * Guarantees covered:
 *   1. Ciphertext randomness — same plaintext produces different ciphertext each write.
 *   2. Session state guards — completed/abandoned sessions cannot be resumed.
 *   3. Decryption failure isolation — tampered or mis-routed ciphertext returns
 *      undefined without leaking the plaintext or key material.
 *   4. HMAC_LOOKUP_KEY separation — lookup hashes are stable across encryption key rotations.
 *   5. Console log hygiene — no PHI appears in console output during session operations.
 *
 * The first four groups share the same in-memory DB mock used in quoteSession.test.ts.
 * Group 5 uses vi.spyOn on the console to intercept any accidental PHI leakage.
 *
 * Test data: all synthetic — no real beneficiary identifiers.
 *
 * Run: npm test -- server/quoteSession/phi-compliance.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { generateResumeToken, hashResumeToken } from "./tokens";
import { enc, dec, decOrUndefined } from "./crypto";
import {
  createSession,
  loadByTokenHash,
  markCompleted,
  markAbandoned,
} from "./repository";

// ── Crypto env setup ──────────────────────────────────────────────────────────

const KEY_K1   = "a".repeat(64);
const KEY_K2   = "b".repeat(64);
const KEY_HMAC = "c".repeat(64);

function setCryptoEnv(activeId = "k1", extraKeys: Record<string, string> = {}) {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("KEY_")) delete process.env[k];
  }
  process.env.ACTIVE_KEY_ID   = activeId;
  process.env.KEY_k1          = KEY_K1;
  process.env.HMAC_LOOKUP_KEY = KEY_HMAC;
  for (const [id, hex] of Object.entries(extraKeys)) {
    process.env[`KEY_${id}`] = hex;
  }
}

function clearCryptoEnv() {
  delete process.env.ACTIVE_KEY_ID;
  delete process.env.HMAC_LOOKUP_KEY;
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("KEY_")) delete process.env[k];
  }
}

// ── In-memory DB stub (identical pattern to quoteSession.test.ts) ─────────────

interface RowStore {
  sessions: any[];
  contacts: any[];
  eligibility: any[];
  medications: any[];
  providers: any[];
  audit: any[];
}

let store: RowStore;

function resetStore() {
  store = {
    sessions:  [],
    contacts:  [],
    eligibility: [],
    medications: [],
    providers: [],
    audit:     [],
  };
}

function applyFilter(rows: any[], cond: any): any[] {
  if (!cond) return rows;
  if (cond._type === "eq") {
    const key = cond.column?.name ?? cond.column;
    return rows.filter((r) => r[key] === cond.value);
  }
  if (cond._type === "gt") {
    const key = cond.column?.name ?? cond.column;
    return rows.filter((r) => r[key] > cond.value);
  }
  if (cond._type === "and") {
    return cond.conditions.reduce(
      (acc: any[], sub: any) => applyFilter(acc, sub),
      rows
    );
  }
  return rows;
}

function makeQueryBuilder(collection: any[]) {
  const builder: any = {
    _filters: [] as any[],
    _limit: undefined as number | undefined,
    where: (cond: any) => { builder._filters.push(cond); return builder; },
    limit: (n: number) => { builder._limit = n; return builder; },
    then: (resolve: any) => {
      let rows = [...collection];
      for (const f of builder._filters) rows = applyFilter(rows, f);
      if (builder._limit !== undefined) rows = rows.slice(0, builder._limit);
      return Promise.resolve(resolve ? resolve(rows) : rows);
    },
  };
  return builder;
}

vi.mock("drizzle-orm", async (importOriginal) => {
  const orig = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...orig,
    eq:  (col: string, val: any) => ({ _type: "eq",  column: col, value: val }),
    and: (...conds: any[])       => ({ _type: "and", conditions: conds }),
    gt:  (col: string, val: any) => ({ _type: "gt",  column: col, value: val }),
    sql: orig.sql,
  };
});

import {
  quoteSessions      as tSessions,
  quoteSessionContact as tContact,
  quoteSessionEligibility as tElig,
  quoteSessionMedications as tMeds,
  quoteSessionProviders   as tProvs,
  quoteSessionAuditEvents as tAudit,
} from "../../drizzle/schema";

vi.mock("../db", () => ({
  getDb: async () => ({
    insert: (table: any) => ({
      values: (data: any) => {
        if      (table === tSessions) store.sessions.push({ ...data });
        else if (table === tContact)  store.contacts.push(data);
        else if (table === tElig)     store.eligibility.push(data);
        else if (table === tMeds)     store.medications.push(...(Array.isArray(data) ? data : [data]));
        else if (table === tProvs)    store.providers.push(...(Array.isArray(data) ? data : [data]));
        else if (table === tAudit)    store.audit.push(data);
        return Promise.resolve();
      },
    }),
    delete: (_table: any) => ({
      where: (_cond: any) => Promise.resolve(),
    }),
    update: (_table: any) => ({
      set: (vals: any) => ({
        where: (_cond: any) => {
          if (_table === tSessions) {
            for (const s of store.sessions) {
              if (vals.status        !== undefined) s.status        = vals.status;
              if (vals.lastAccessedAt !== undefined) s.lastAccessedAt = vals.lastAccessedAt;
              if (vals.expiresAt     !== undefined) s.expiresAt     = vals.expiresAt;
            }
          }
          return Promise.resolve();
        },
      }),
    }),
    select: () => ({
      from: (table: any) => {
        let col: any[];
        if      (table === tSessions) col = store.sessions;
        else if (table === tContact)  col = store.contacts;
        else if (table === tElig)     col = store.eligibility;
        else if (table === tMeds)     col = store.medications;
        else if (table === tProvs)    col = store.providers;
        else                          col = store.audit;
        return makeQueryBuilder(col);
      },
    }),
  }),
}));

// ── Shared synthetic test data ────────────────────────────────────────────────

const SAMPLE_INPUT = {
  zip:    "66208",
  county: "Johnson County",
  contact: {
    firstName:   "Alice",
    lastName:    "Smith",
    email:       "alice@example.com",
    dateOfBirth: "1955-04-12",
    phone:       "555-867-5309",
  },
  eligibility: {
    mbi:                  "1EG4-A22-AA11",
    eligibilityResultJson: JSON.stringify({ partA: { active: true } }),
    currentPlanName:      "Aetna Gold PPO",
    currentPlanCarrier:   "Aetna",
  },
  medications: [
    { name: "Metformin",  dosage: "500mg", frequency: "twice daily" },
    { name: "Lisinopril", dosage: "10mg",  frequency: "once daily"  },
  ],
  providers: [
    { name: "Dr. Jane Doe", npi: "1234567890", specialty: "Cardiology" },
  ],
};

beforeEach(() => {
  setCryptoEnv();
  resetStore();
});
afterEach(clearCryptoEnv);

// ── 1. Ciphertext randomness ──────────────────────────────────────────────────

describe("COMPLIANCE: ciphertext randomness — same plaintext produces different ciphertext each write", () => {
  it("two encrypt calls for the same MBI produce different ciphertext (GCM random IV)", () => {
    const ct1 = enc("1EG4-A22-AA11", "mbi");
    const ct2 = enc("1EG4-A22-AA11", "mbi");
    expect(ct1).not.toBe(ct2);
    // Both must still decrypt correctly
    expect(dec(ct1, "mbi")).toBe("1EG4-A22-AA11");
    expect(dec(ct2, "mbi")).toBe("1EG4-A22-AA11");
  });

  it("two createSession calls for the same contact produce different ciphertext in the contact row", async () => {
    const raw1 = generateResumeToken();
    const raw2 = generateResumeToken();

    await createSession(hashResumeToken(raw1), SAMPLE_INPUT, "k1");
    const ct1 = store.contacts[0].firstName;
    store.contacts = [];

    await createSession(hashResumeToken(raw2), SAMPLE_INPUT, "k1");
    const ct2 = store.contacts[0].firstName;

    // Same plaintext "Alice" — but different ciphertext each time due to random IV
    expect(ct1).not.toBe(ct2);
    // Both decrypt to the same value
    expect(decOrUndefined(ct1, "firstName")).toBe("Alice");
    expect(decOrUndefined(ct2, "firstName")).toBe("Alice");
  });

  it("ciphertext stored for medication name does not contain the drug name as a substring", async () => {
    const raw = generateResumeToken();
    await createSession(hashResumeToken(raw), SAMPLE_INPUT, "k1");
    const medsJson = JSON.stringify(store.medications);
    expect(medsJson).not.toContain("Metformin");
    expect(medsJson).not.toContain("Lisinopril");
    // But must decrypt correctly
    expect(decOrUndefined(store.medications[0].drugName, "drugName")).toBe("Metformin");
  });
});

// ── 2. Session state guards ───────────────────────────────────────────────────

describe("COMPLIANCE: completed session cannot be resumed after enrollment", () => {
  it("loadByTokenHash returns null for a completed session — status filter enforced", async () => {
    const raw  = generateResumeToken();
    const hash = hashResumeToken(raw);
    const { sessionId } = await createSession(hash, SAMPLE_INPUT, "k1");

    // Mark the session as completed (consumer enrolled / called agent)
    store.sessions[0].id             = sessionId;
    store.sessions[0].resumeTokenHash = hash;
    store.sessions[0].expiresAt      = new Date(Date.now() + 86_400_000);
    await markCompleted(sessionId);
    // status is now "completed" in the mock store

    const result = await loadByTokenHash(hash);
    expect(result).toBeNull();
  });
});

describe("COMPLIANCE: abandoned session cannot be resumed", () => {
  it("loadByTokenHash returns null for an abandoned session — status filter enforced", async () => {
    const raw  = generateResumeToken();
    const hash = hashResumeToken(raw);
    const { sessionId } = await createSession(hash, SAMPLE_INPUT, "k1");

    store.sessions[0].id             = sessionId;
    store.sessions[0].resumeTokenHash = hash;
    store.sessions[0].expiresAt      = new Date(Date.now() + 86_400_000);
    await markAbandoned(sessionId);

    const result = await loadByTokenHash(hash);
    expect(result).toBeNull();
  });
});

describe("COMPLIANCE: expired session cannot be resumed — 30-day TTL enforced", () => {
  it("loadByTokenHash returns null when expiresAt is in the past", async () => {
    const raw  = generateResumeToken();
    const hash = hashResumeToken(raw);
    const { sessionId } = await createSession(hash, SAMPLE_INPUT, "k1");

    store.sessions[0].id             = sessionId;
    store.sessions[0].resumeTokenHash = hash;
    store.sessions[0].status         = "active";
    store.sessions[0].expiresAt      = new Date(Date.now() - 1); // expired 1ms ago

    const result = await loadByTokenHash(hash);
    expect(result).toBeNull();
  });
});

// ── 3. Decryption failure isolation ──────────────────────────────────────────

describe("COMPLIANCE: decryption failure returns undefined — no plaintext or key material in error", () => {
  it("tampered ciphertext returns undefined from decOrUndefined — error is swallowed", () => {
    const ct = enc("1EG4-A22-AA11", "mbi");
    // Corrupt the last 4 chars of the base64url envelope
    const tampered = ct.slice(0, -4) + "XXXX";
    const result = decOrUndefined(tampered, "mbi");
    expect(result).toBeUndefined();
  });

  it("wrong-field decryption returns undefined (purpose-binding enforced at repository level)", () => {
    const ct = enc("alice@example.com", "email");
    // Attempting to decrypt as 'firstName' fails because the AAD does not match
    const result = decOrUndefined(ct, "firstName");
    expect(result).toBeUndefined();
  });

  it("null or empty payload returns undefined — no throw propagated to callers", () => {
    expect(decOrUndefined(null,      "mbi")).toBeUndefined();
    expect(decOrUndefined(undefined, "mbi")).toBeUndefined();
    expect(decOrUndefined("",        "mbi")).toBeUndefined();
  });

  it("error message from a failed decrypt contains 'authentication failed', not the plaintext value", () => {
    // Verify the crypto module's error wording so callers can rely on it
    const ct = enc("SENSITIVE-VALUE-MUST-NOT-APPEAR-IN-ERROR", "mbi");
    const env = JSON.parse(Buffer.from(ct, "base64url").toString("utf8"));
    const ctBuf = Buffer.from(env.ciphertext, "base64");
    ctBuf[0] ^= 0xff;
    env.ciphertext = ctBuf.toString("base64");
    const tampered = Buffer.from(JSON.stringify(env)).toString("base64url");

    let errorMessage = "";
    try {
      dec(tampered, "mbi");
    } catch (err) {
      errorMessage = (err as Error).message;
    }

    expect(errorMessage).toContain("authentication failed");
    expect(errorMessage).not.toContain("SENSITIVE-VALUE-MUST-NOT-APPEAR-IN-ERROR");
    expect(errorMessage).not.toContain(KEY_K1); // no key material
  });
});

// ── 4. HMAC_LOOKUP_KEY separation ────────────────────────────────────────────

describe("COMPLIANCE: emailLookupHash is controlled by HMAC_LOOKUP_KEY — stable across encryption key rotations", () => {
  it("emailLookupHash does not change when the encryption key rotates from k1 to k2", async () => {
    // Record the hash computed under k1
    const raw = generateResumeToken();
    await createSession(hashResumeToken(raw), SAMPLE_INPUT, "k1");
    const hashUnderK1 = store.contacts[0].emailLookupHash;

    // Rotate to k2 (keep k1 for legacy decryption; HMAC_LOOKUP_KEY unchanged)
    resetStore();
    setCryptoEnv("k2", { k2: KEY_K2 });

    const raw2 = generateResumeToken();
    await createSession(hashResumeToken(raw2), SAMPLE_INPUT, "k2");
    const hashUnderK2 = store.contacts[0].emailLookupHash;

    // Lookup hash must be identical — changing encryption key must not break DB indexes
    expect(hashUnderK1).toBe(hashUnderK2);
  });

  it("emailLookupHash changes only when HMAC_LOOKUP_KEY changes — confirming separation", async () => {
    const raw = generateResumeToken();
    await createSession(hashResumeToken(raw), SAMPLE_INPUT, "k1");
    const hashWithOriginalHmac = store.contacts[0].emailLookupHash;

    // Change HMAC_LOOKUP_KEY (simulates a HMAC key rotation — rare, requires re-hash migration)
    resetStore();
    process.env.HMAC_LOOKUP_KEY = "d".repeat(64);

    const raw2 = generateResumeToken();
    await createSession(hashResumeToken(raw2), SAMPLE_INPUT, "k1");
    const hashWithNewHmac = store.contacts[0].emailLookupHash;

    // Now they differ — confirming HMAC_LOOKUP_KEY controls the hash value
    expect(hashWithOriginalHmac).not.toBe(hashWithNewHmac);
  });

  it("emailLookupHash stored is a 64-char hex SHA-256 digest — not the raw email", async () => {
    const raw = generateResumeToken();
    await createSession(hashResumeToken(raw), SAMPLE_INPUT, "k1");
    const hash = store.contacts[0].emailLookupHash;

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("alice@example.com");
    expect(hash).not.toContain("alice");
    expect(hash).not.toContain("example.com");
  });
});

// ── 5. Console log hygiene ────────────────────────────────────────────────────

describe("COMPLIANCE: no PHI appears in console output during session operations", () => {
  it("createSession emits no console output containing PHI field values", async () => {
    const logSpy  = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy  = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const raw = generateResumeToken();
      await createSession(hashResumeToken(raw), SAMPLE_INPUT, "k1");

      const allOutput = [
        ...logSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errSpy.mock.calls,
      ].flat().join(" ");

      expect(allOutput).not.toContain("Alice");
      expect(allOutput).not.toContain("1EG4-A22-AA11");
      expect(allOutput).not.toContain("alice@example.com");
      expect(allOutput).not.toContain("Metformin");
      expect(allOutput).not.toContain("555-867-5309");
      expect(allOutput).not.toContain("1955-04-12");
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errSpy.mockRestore();
    }
  });

  it("decryption failure emits no PHI in console output — error is swallowed silently", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy  = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const ct = enc("PLAINTEXT-PHI-VALUE", "mbi");
      const tampered = ct.slice(0, -4) + "XXXX";
      decOrUndefined(tampered, "mbi"); // must not throw and must not log

      const allOutput = [
        ...warnSpy.mock.calls,
        ...errSpy.mock.calls,
      ].flat().join(" ");

      expect(allOutput).not.toContain("PLAINTEXT-PHI-VALUE");
    } finally {
      warnSpy.mockRestore();
      errSpy.mockRestore();
    }
  });

  it("markCompleted and markAbandoned emit no PHI in console output", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const raw = generateResumeToken();
      const { sessionId } = await createSession(hashResumeToken(raw), SAMPLE_INPUT, "k1");
      store.sessions[0].id = sessionId;

      await markCompleted(sessionId);
      await markAbandoned(sessionId);

      const allOutput = [
        ...logSpy.mock.calls,
        ...errSpy.mock.calls,
      ].flat().join(" ");

      expect(allOutput).not.toContain("Alice");
      expect(allOutput).not.toContain("1EG4-A22-AA11");
    } finally {
      logSpy.mockRestore();
      errSpy.mockRestore();
    }
  });
});
