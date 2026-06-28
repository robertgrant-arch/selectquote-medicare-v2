/**
 * Tests for the quote-session vertical slice.
 *
 * Strategy: use an in-memory stub for the DB (vi.mock) so the suite runs
 * without a live MySQL connection, while exercising the full encryption /
 * token hashing / assembly logic.
 *
 * Three core assertions (per spec):
 *   1. PHI columns stored as ciphertext — plaintext is never written to the DB.
 *   2. Resume token round-trip — save returns a token, resume returns PHI.
 *   3. Wrong / expired token returns null.
 *
 * Run: npm test -- server/quoteSession/quoteSession.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { generateResumeToken, hashResumeToken } from "./tokens";
import { enc, dec, decOrUndefined } from "./crypto";
import {
  createSession,
  updateSession,
  loadByTokenHash,
  loadById,
  markCompleted,
  markAbandoned,
} from "./repository";

// ── Crypto env setup ──────────────────────────────────────────────────────────

const KEY_K1 = "a".repeat(64);

function setCryptoEnv() {
  process.env.ACTIVE_KEY_ID = "k1";
  process.env.KEY_k1 = KEY_K1;
}
function clearCryptoEnv() {
  delete process.env.ACTIVE_KEY_ID;
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("KEY_")) delete process.env[k];
  }
}

// ── In-memory DB stub ─────────────────────────────────────────────────────────
// We capture every INSERT values object so tests can inspect the raw bytes
// that would land in the database.

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
  store = { sessions: [], contacts: [], eligibility: [], medications: [], providers: [], audit: [] };
}

// Build a chainable drizzle-like mock that records calls.
// Drizzle Column objects expose a `.name` property matching the DB column name.
function applyFilter(rows: any[], cond: any): any[] {
  if (!cond) return rows;
  if (cond._type === "eq") {
    const key = cond.column?.name ?? cond.column;
    return rows.filter(r => r[key] === cond.value);
  }
  if (cond._type === "gt") {
    const key = cond.column?.name ?? cond.column;
    return rows.filter(r => r[key] > cond.value);
  }
  if (cond._type === "and") {
    return cond.conditions.reduce((acc: any[], sub: any) => applyFilter(acc, sub), rows);
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

// Drizzle helpers mock — returns objects with _type so makeQueryBuilder can filter
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

// We import the actual table objects so the mock can route by object identity.
import {
  quoteSessions as tSessions,
  quoteSessionContact as tContact,
  quoteSessionEligibility as tElig,
  quoteSessionMedications as tMeds,
  quoteSessionProviders as tProvs,
  quoteSessionAuditEvents as tAudit,
} from "../../drizzle/schema";

vi.mock("../db", () => ({
  getDb: async () => ({
    insert: (table: any) => ({
      values: (data: any) => {
        if (table === tSessions) store.sessions.push({ ...data });
        else if (table === tContact) store.contacts.push(data);
        else if (table === tElig)    store.eligibility.push(data);
        else if (table === tMeds)    store.medications.push(...(Array.isArray(data) ? data : [data]));
        else if (table === tProvs)   store.providers.push(...(Array.isArray(data) ? data : [data]));
        else if (table === tAudit)   store.audit.push(data);
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
              if (vals.status !== undefined)           s.status = vals.status;
              if (vals.lastAccessedAt !== undefined)   s.lastAccessedAt = vals.lastAccessedAt;
              if (vals.expiresAt !== undefined)        s.expiresAt = vals.expiresAt;
              if (vals.consentStatus !== undefined)    s.consentStatus = vals.consentStatus;
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

// ── Token tests ───────────────────────────────────────────────────────────────

describe("token helpers", () => {
  it("generates a 64-char hex token", () => {
    const t = generateResumeToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique tokens", () => {
    expect(generateResumeToken()).not.toBe(generateResumeToken());
  });

  it("hash is deterministic", () => {
    const t = generateResumeToken();
    expect(hashResumeToken(t)).toBe(hashResumeToken(t));
  });

  it("different tokens produce different hashes", () => {
    expect(hashResumeToken(generateResumeToken())).not.toBe(hashResumeToken(generateResumeToken()));
  });

  it("hash is 64-char hex (SHA-256)", () => {
    expect(hashResumeToken(generateResumeToken())).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ── Crypto wrapper tests ──────────────────────────────────────────────────────

describe("slice crypto helpers", () => {
  beforeEach(() => setCryptoEnv());
  afterEach(() => clearCryptoEnv());

  it("enc/dec round-trip", () => {
    const ct = enc("1EG4-A22-AA11", "mbi");
    expect(dec(ct, "mbi")).toBe("1EG4-A22-AA11");
  });

  it("ciphertext does not contain plaintext", () => {
    const ct = enc("Metformin 500mg", "drugName");
    expect(ct).not.toContain("Metformin");
  });

  it("decOrUndefined returns undefined for null", () => {
    expect(decOrUndefined(null, "mbi")).toBeUndefined();
  });

  it("decOrUndefined returns undefined for tampered payload", () => {
    const ct = enc("test", "mbi");
    const tampered = ct.slice(0, -4) + "XXXX";
    expect(decOrUndefined(tampered, "mbi")).toBeUndefined();
  });

  it("purpose binding — wrong field name fails auth", () => {
    const ct = enc("test", "mbi");
    expect(decOrUndefined(ct, "email")).toBeUndefined();
  });
});

// ── Repository + PHI-at-rest assertions ──────────────────────────────────────

describe("repository", () => {
  beforeEach(() => {
    setCryptoEnv();
    resetStore();
  });
  afterEach(() => clearCryptoEnv());

  const SAMPLE_INPUT = {
    zip: "66208",
    county: "Johnson County",
    contact: {
      firstName: "Alice",
      lastName:  "Smith",
      email:     "alice@example.com",
      dateOfBirth: "1955-04-12",
      phone: "555-867-5309",
    },
    eligibility: {
      mbi: "1EG4-A22-AA11",
      eligibilityResultJson: JSON.stringify({ partA: { active: true } }),
      currentPlanName: "Aetna Gold PPO",
      currentPlanCarrier: "Aetna",
    },
    medications: [
      { name: "Metformin", dosage: "500mg", frequency: "twice daily" },
      { name: "Lisinopril", dosage: "10mg", frequency: "once daily" },
    ],
    providers: [
      { name: "Dr. Jane Doe", npi: "1234567890", specialty: "Cardiology" },
    ],
  };

  it("createSession stores resumeTokenHash (not raw token)", async () => {
    const raw = generateResumeToken();
    const hash = hashResumeToken(raw);
    await createSession(hash, SAMPLE_INPUT, "k1");
    const session = store.sessions[0];
    expect(session.resumeTokenHash).toBe(hash);
    expect(session.resumeTokenHash).not.toBe(raw);
  });

  it("CRITICAL — PHI is never stored as plaintext in DB (contact fields)", async () => {
    const raw = generateResumeToken();
    await createSession(hashResumeToken(raw), SAMPLE_INPUT, "k1");
    const contact = store.contacts[0];

    // Verify no plaintext appears in any contact column
    const storedValues = JSON.stringify(contact);
    expect(storedValues).not.toContain("Alice");
    expect(storedValues).not.toContain("Smith");
    expect(storedValues).not.toContain("alice@example.com");
    expect(storedValues).not.toContain("1955-04-12");
    expect(storedValues).not.toContain("555-867-5309");
  });

  it("CRITICAL — PHI is never stored as plaintext in DB (eligibility fields)", async () => {
    const raw = generateResumeToken();
    await createSession(hashResumeToken(raw), SAMPLE_INPUT, "k1");
    const elig = store.eligibility[0];

    const storedValues = JSON.stringify(elig);
    expect(storedValues).not.toContain("1EG4-A22-AA11");
    expect(storedValues).not.toContain("Aetna Gold PPO");
    expect(storedValues).not.toContain("partA");
  });

  it("CRITICAL — PHI is never stored as plaintext in DB (medications)", async () => {
    const raw = generateResumeToken();
    await createSession(hashResumeToken(raw), SAMPLE_INPUT, "k1");
    const meds = JSON.stringify(store.medications);
    expect(meds).not.toContain("Metformin");
    expect(meds).not.toContain("Lisinopril");
    expect(meds).not.toContain("500mg");
  });

  it("CRITICAL — PHI is never stored as plaintext in DB (providers)", async () => {
    const raw = generateResumeToken();
    await createSession(hashResumeToken(raw), SAMPLE_INPUT, "k1");
    const provs = JSON.stringify(store.providers);
    expect(provs).not.toContain("Dr. Jane Doe");
    expect(provs).not.toContain("Cardiology");
    // NPI alone is public, but it should still be encrypted since combined with session
    expect(provs).not.toContain("1234567890");
  });

  it("non-PHI columns (zip, county, status) are stored as plaintext", async () => {
    const raw = generateResumeToken();
    await createSession(hashResumeToken(raw), SAMPLE_INPUT, "k1");
    const session = store.sessions[0];
    expect(session.zip).toBe("66208");
    expect(session.county).toBe("Johnson County");
    expect(session.status).toBe("active");
  });

  it("resume round-trip — loadByTokenHash returns decrypted PHI", async () => {
    const raw = generateResumeToken();
    const hash = hashResumeToken(raw);
    const { sessionId } = await createSession(hash, SAMPLE_INPUT, "k1");

    // Patch the in-memory session to have a matching resumeTokenHash and non-expired date
    store.sessions[0].resumeTokenHash = hash;
    store.sessions[0].id = sessionId;
    store.sessions[0].status = "active";
    store.sessions[0].expiresAt = new Date(Date.now() + 86400000);
    store.contacts[0].sessionId = sessionId;
    store.eligibility[0].sessionId = sessionId;
    store.medications.forEach(m => m.sessionId = sessionId);
    store.providers.forEach(p => p.sessionId = sessionId);

    const result = await loadByTokenHash(hash);
    expect(result).not.toBeNull();
    expect(result!.contact?.firstName).toBe("Alice");
    expect(result!.contact?.lastName).toBe("Smith");
    expect(result!.contact?.email).toBe("alice@example.com");
    expect(result!.contact?.dateOfBirth).toBe("1955-04-12");
    expect(result!.eligibility?.mbi).toBe("1EG4-A22-AA11");
    expect(result!.eligibility?.currentPlanName).toBe("Aetna Gold PPO");
    expect(result!.medications?.[0]?.name).toBe("Metformin");
    expect(result!.medications?.[1]?.name).toBe("Lisinopril");
    expect(result!.providers?.[0]?.name).toBe("Dr. Jane Doe");
    expect(result!.providers?.[0]?.specialty).toBe("Cardiology");
  });

  it("wrong token returns null", async () => {
    const raw = generateResumeToken();
    const { sessionId } = await createSession(hashResumeToken(raw), SAMPLE_INPUT, "k1");
    store.sessions[0].id = sessionId;
    store.sessions[0].status = "active";
    store.sessions[0].expiresAt = new Date(Date.now() + 86400000);

    const wrongRaw = generateResumeToken();
    const result = await loadByTokenHash(hashResumeToken(wrongRaw));
    expect(result).toBeNull();
  });

  it("expired session returns null", async () => {
    const raw = generateResumeToken();
    const hash = hashResumeToken(raw);
    const { sessionId } = await createSession(hash, SAMPLE_INPUT, "k1");
    // Force expiry into the past
    store.sessions[0].id = sessionId;
    store.sessions[0].resumeTokenHash = hash;
    store.sessions[0].status = "active";
    store.sessions[0].expiresAt = new Date(Date.now() - 1000);

    const result = await loadByTokenHash(hash);
    expect(result).toBeNull();
  });

  it("markCompleted sets status", async () => {
    const raw = generateResumeToken();
    const { sessionId } = await createSession(hashResumeToken(raw), SAMPLE_INPUT, "k1");
    store.sessions[0].id = sessionId;
    await markCompleted(sessionId);
    expect(store.sessions[0].status).toBe("completed");
  });

  it("markAbandoned sets status", async () => {
    const raw = generateResumeToken();
    const { sessionId } = await createSession(hashResumeToken(raw), SAMPLE_INPUT, "k1");
    store.sessions[0].id = sessionId;
    await markAbandoned(sessionId);
    expect(store.sessions[0].status).toBe("abandoned");
  });

  it("audit events are appended on create and resume", async () => {
    const raw = generateResumeToken();
    const hash = hashResumeToken(raw);
    const { sessionId } = await createSession(hash, SAMPLE_INPUT, "k1");
    store.sessions[0].id = sessionId;
    store.sessions[0].resumeTokenHash = hash;
    store.sessions[0].status = "active";
    store.sessions[0].expiresAt = new Date(Date.now() + 86400000);
    store.contacts[0].sessionId = sessionId;
    store.eligibility[0].sessionId = sessionId;

    await loadByTokenHash(hash);

    const eventTypes = store.audit.map(e => e.eventType);
    expect(eventTypes).toContain("session_created");
    expect(eventTypes).toContain("session_resumed");
  });

  it("audit events never contain PHI field values", async () => {
    const raw = generateResumeToken();
    const { sessionId } = await createSession(hashResumeToken(raw), SAMPLE_INPUT, "k1");
    const auditStr = JSON.stringify(store.audit);
    expect(auditStr).not.toContain("Alice");
    expect(auditStr).not.toContain("1EG4-A22-AA11");
    expect(auditStr).not.toContain("Metformin");
    expect(auditStr).not.toContain("alice@example.com");
  });

  it("emailLookupHash is stored (not the raw email)", async () => {
    const raw = generateResumeToken();
    await createSession(hashResumeToken(raw), SAMPLE_INPUT, "k1");
    const contact = store.contacts[0];
    expect(contact.emailLookupHash).toBeTruthy();
    expect(contact.emailLookupHash).not.toContain("alice@example.com");
    expect(contact.emailLookupHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("key rotation — old session decrypts with old key, new session with new key", async () => {
    // Encrypt under k1
    process.env.ACTIVE_KEY_ID = "k1";
    process.env.KEY_k1 = KEY_K1;
    const raw1 = generateResumeToken();
    const hash1 = hashResumeToken(raw1);
    const { sessionId: sid1 } = await createSession(hash1, { ...SAMPLE_INPUT }, "k1");
    const legacyContactRow = { ...store.contacts[0], sessionId: sid1 };

    // Rotate to k2 — k1 still available for legacy decryption
    const KEY_K2 = "b".repeat(64);
    process.env.ACTIVE_KEY_ID = "k2";
    process.env.KEY_k2 = KEY_K2;

    // Decrypt legacy contact row (encrypted under k1)
    const firstName = decOrUndefined(legacyContactRow.firstName, "firstName");
    expect(firstName).toBe("Alice"); // k1 still in env

    // New encryption uses k2
    const raw2 = generateResumeToken();
    const hash2 = hashResumeToken(raw2);
    resetStore();
    await createSession(hash2, { ...SAMPLE_INPUT }, "k2");
    const newContactRow = store.contacts[0];
    expect(newContactRow.firstName).not.toBe(legacyContactRow.firstName); // different ciphertext
    expect(decOrUndefined(newContactRow.firstName, "firstName")).toBe("Alice");
  });
});
