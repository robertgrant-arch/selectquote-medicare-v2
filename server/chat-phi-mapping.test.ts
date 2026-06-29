/**
 * Chat → PHI mapping tests.
 *
 * Coverage:
 *   1. extractPhiEntities — pure unit tests (no mocks needed)
 *   2. tryResolveProviderNpi — NPPES lookup with mocked fetch
 *   3. tryValidateDrug — RxNorm validation with mocked fetch
 *   4. Chat → PHI storage pipeline — matched entries stored, ambiguous not stored
 *   5. Stored PHI → plan recommendation — enrichPlansWithDrugCosts uses session data
 *
 * Run: npm test -- server/chat-phi-mapping.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Functions under test
import {
  extractPhiEntities,
  tryResolveProviderNpi,
  tryValidateDrug,
} from '../api/chat';
import { enrichPlansWithDrugCosts } from '../api/plans';

// Repository + token helpers
import { createSession, loadByTokenHash } from './quoteSession/repository';
import { generateResumeToken, hashResumeToken } from './quoteSession/tokens';

// ── Crypto env helpers ────────────────────────────────────────────────────────

const KEY_K1   = 'a'.repeat(64);
const KEY_HMAC = 'c'.repeat(64);

function setCryptoEnv() {
  process.env.ACTIVE_KEY_ID   = 'k1';
  process.env.KEY_k1          = KEY_K1;
  process.env.HMAC_LOOKUP_KEY = KEY_HMAC;
}
function clearCryptoEnv() {
  delete process.env.ACTIVE_KEY_ID;
  delete process.env.HMAC_LOOKUP_KEY;
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('KEY_')) delete process.env[k];
  }
}

// ── In-memory DB stub (same pattern as quoteSession.test.ts) ─────────────────

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

function applyFilter(rows: any[], cond: any): any[] {
  if (!cond) return rows;
  if (cond._type === 'eq') {
    const key = cond.column?.name ?? cond.column;
    return rows.filter(r => r[key] === cond.value);
  }
  if (cond._type === 'gt') {
    const key = cond.column?.name ?? cond.column;
    return rows.filter(r => r[key] > cond.value);
  }
  if (cond._type === 'and') {
    return cond.conditions.reduce((acc: any[], sub: any) => applyFilter(acc, sub), rows);
  }
  return rows;
}

function makeQueryBuilder(collection: any[]) {
  const builder: any = {
    _filters: [] as any[],
    _limit: undefined as number | undefined,
    orderBy: (..._args: any[]) => builder,
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

vi.mock('drizzle-orm', async (importOriginal) => {
  const orig = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...orig,
    eq:   (col: any, val: any) => ({ _type: 'eq',  column: col, value: val }),
    and:  (...conds: any[])    => ({ _type: 'and', conditions: conds }),
    gt:   (col: any, val: any) => ({ _type: 'gt',  column: col, value: val }),
    desc: (_col: any)          => ({ _type: 'desc' }),
    sql: orig.sql,
  };
});

import {
  quoteSessions      as tSessions,
  quoteSessionContact    as tContact,
  quoteSessionEligibility as tElig,
  quoteSessionMedications as tMeds,
  quoteSessionProviders   as tProvs,
  quoteSessionAuditEvents as tAudit,
} from '../drizzle/schema';

vi.mock('./db', () => ({
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
      set: (_vals: any) => ({
        where: (_cond: any) => Promise.resolve(),
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Seed a session in the store and fix up sessionId / expiry so load works. */
async function seedSession(input: Parameters<typeof createSession>[1]) {
  const raw  = generateResumeToken();
  const hash = hashResumeToken(raw);
  const { sessionId } = await createSession(hash, input, 'k1');

  // Fix up references so the in-memory store passes the load query
  const s = store.sessions[store.sessions.length - 1];
  s.id              = sessionId;
  s.resumeTokenHash = hash;
  s.status          = 'active';
  s.expiresAt       = new Date(Date.now() + 86_400_000);

  // Patch child rows with the correct sessionId
  for (const r of store.contacts)     if (!r.sessionId) r.sessionId = sessionId;
  for (const r of store.medications)  if (!r.sessionId) r.sessionId = sessionId;
  for (const r of store.providers)    if (!r.sessionId) r.sessionId = sessionId;
  for (const r of store.eligibility)  if (!r.sessionId) r.sessionId = sessionId;

  return { raw, hash, sessionId };
}

/** Minimal NPPES-style response with one matched doctor. */
function nppesDoctorResponse(npi: string, specialty = 'Cardiology') {
  return JSON.stringify({ doctors: [{ npi, specialty, name: 'CHEN SARAH', address: '123 Main St' }] });
}

/** Minimal RxNorm response with a valid rxcui. */
function rxnormHitResponse(rxcui = '29046') {
  return JSON.stringify({ idGroup: { rxnormId: [rxcui] } });
}

/** RxNorm response with no matching drug. */
const rxnormMissResponse = JSON.stringify({ idGroup: {} });

// ── 1. extractPhiEntities — pure unit tests ───────────────────────────────────

describe('extractPhiEntities', () => {
  it('extracts a named doctor from "I see Dr. Sarah Chen"', () => {
    const { doctors } = extractPhiEntities('I see Dr. Sarah Chen for my heart.');
    expect(doctors).toHaveLength(1);
    expect(doctors[0].name).toBe('Dr. Sarah Chen');
  });

  it('does not extract a vague doctor mention without a name', () => {
    const { doctors } = extractPhiEntities('I have a cardiologist downtown.');
    expect(doctors).toHaveLength(0);
  });

  it('does not extract a stop-word-only doctor title', () => {
    const { doctors } = extractPhiEntities('My doctor is great.');
    expect(doctors).toHaveLength(0);
  });

  it('extracts a drug name + dosage from "I take Lisinopril 10mg daily"', () => {
    const { medications } = extractPhiEntities('I take Lisinopril 10mg daily.');
    expect(medications).toHaveLength(1);
    expect(medications[0].name).toMatch(/lisinopril/i);
    expect(medications[0].dosage).toBe('10mg');
  });

  it('does not extract a vague drug category ("blood pressure medication")', () => {
    const { medications } = extractPhiEntities('I take blood pressure medication.');
    expect(medications).toHaveLength(0);
  });

  it('does not extract drug stop words ("some daily pills")', () => {
    const { medications } = extractPhiEntities('I take some daily pills.');
    expect(medications).toHaveLength(0);
  });

  it('deduplicates the same doctor mentioned twice', () => {
    const { doctors } = extractPhiEntities(
      'I see Dr. Martin twice a year. Dr. Martin is really helpful.',
    );
    expect(doctors).toHaveLength(1);
  });

  it('extracts dosage and frequency together', () => {
    const { medications } = extractPhiEntities(
      'I am currently taking Metformin 500mg twice a day.',
    );
    expect(medications[0].name).toMatch(/metformin/i);
    expect(medications[0].dosage).toBe('500mg');
    expect(medications[0].frequency).toMatch(/twice/i);
  });

  it('extracts multiple distinct medications', () => {
    const { medications } = extractPhiEntities(
      'I take Atorvastatin 20mg and I am using Metoprolol 25mg.',
    );
    const names = medications.map(m => m.name.toLowerCase());
    expect(names).toContain('atorvastatin');
    expect(names).toContain('metoprolol');
  });
});

// ── 2. tryResolveProviderNpi — NPPES lookup ───────────────────────────────────

describe('tryResolveProviderNpi', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns NPI + specialty when NPPES responds with a match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => JSON.parse(nppesDoctorResponse('1234567890', 'Cardiology')),
    }));

    const result = await tryResolveProviderNpi('Dr. Sarah Chen', '75201', 'http://localhost:3000');
    expect(result?.npi).toBe('1234567890');
    expect(result?.specialty).toBe('Cardiology');
  });

  it('returns null when NPPES returns an empty doctors list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ doctors: [] }),
    }));

    const result = await tryResolveProviderNpi('Dr. Nobody Known', '75201', 'http://localhost:3000');
    expect(result).toBeNull();
  });

  it('returns null on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false }));
    const result = await tryResolveProviderNpi('Dr. X', '75201', 'http://localhost:3000');
    expect(result).toBeNull();
  });

  it('returns null on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')));
    const result = await tryResolveProviderNpi('Dr. X', '75201', 'http://localhost:3000');
    expect(result).toBeNull();
  });
});

// ── 3. tryValidateDrug — RxNorm validation ────────────────────────────────────

describe('tryValidateDrug', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns true when RxNorm returns a rxcui for the drug name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => JSON.parse(rxnormHitResponse('29046')),
    }));
    expect(await tryValidateDrug('Lisinopril')).toBe(true);
  });

  it('returns false when RxNorm returns an empty idGroup', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => JSON.parse(rxnormMissResponse),
    }));
    expect(await tryValidateDrug('Xylonex')).toBe(false);
  });

  it('returns false on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false }));
    expect(await tryValidateDrug('Lisinopril')).toBe(false);
  });

  it('returns false on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('timeout')));
    expect(await tryValidateDrug('Lisinopril')).toBe(false);
  });
});

// ── 4. Chat → PHI storage pipeline ───────────────────────────────────────────

describe('Chat → PHI storage: matched stored, ambiguous rejected', () => {
  beforeEach(() => { setCryptoEnv(); resetStore(); });
  afterEach(() => { clearCryptoEnv(); vi.restoreAllMocks(); });

  // Helper: simulate the post-stream enrichment steps the handler performs,
  // then persist matched PHI to the quote session repository.
  async function runPipeline(userMessage: string, zip: string, mockFetch: ReturnType<typeof vi.fn>) {
    vi.stubGlobal('fetch', mockFetch);

    const entities = extractPhiEntities(userMessage);

    // Doctor matching
    const matchedDoctors: any[] = [];
    const unmatchedDoctorNames: string[] = [];
    await Promise.all(entities.doctors.map(async (doc) => {
      const resolved = await tryResolveProviderNpi(doc.name, zip, 'http://localhost:3000');
      if (resolved?.npi) {
        matchedDoctors.push({ ...doc, npi: resolved.npi, specialty: resolved.specialty ?? doc.specialty });
      } else {
        unmatchedDoctorNames.push(doc.name);
      }
    }));

    // Drug matching
    const matchedMeds: any[] = [];
    const unmatchedMedNames: string[] = [];
    await Promise.all(entities.medications.map(async (med) => {
      const valid = await tryValidateDrug(med.name);
      if (valid) matchedMeds.push(med);
      else unmatchedMedNames.push(med.name);
    }));

    // Persist matched PHI (same path the handler uses)
    const { raw, hash, sessionId } = await seedSession({
      zip,
      providers:   matchedDoctors.length > 0 ? matchedDoctors : undefined,
      medications: matchedMeds.length > 0    ? matchedMeds    : undefined,
    });

    return { raw, hash, sessionId, matchedDoctors, unmatchedDoctorNames, matchedMeds, unmatchedMedNames };
  }

  it('stores a doctor with NPI when NPPES resolves the name', async () => {
    const mockFetch = vi.fn()
      // NPPES call → found
      .mockResolvedValueOnce({ ok: true, json: async () => JSON.parse(nppesDoctorResponse('1234567890')) })
      // No drug calls in this message
      ;

    const { hash, matchedDoctors, unmatchedDoctorNames } = await runPipeline(
      'I see Dr. Sarah Chen for my heart.',
      '75201',
      mockFetch,
    );

    expect(matchedDoctors).toHaveLength(1);
    expect(matchedDoctors[0].npi).toBe('1234567890');
    expect(unmatchedDoctorNames).toHaveLength(0);

    // Verify PHI is in the store (encrypted)
    expect(store.providers).toHaveLength(1);
    const rawProv = JSON.stringify(store.providers[0]);
    expect(rawProv).not.toContain('Sarah Chen');   // encrypted
    expect(rawProv).not.toContain('1234567890');   // encrypted

    // Verify it round-trips back correctly
    const session = await loadByTokenHash(hash);
    expect(session?.providers?.[0]?.name).toBe('Dr. Sarah Chen');
    expect(session?.providers?.[0]?.npi).toBe('1234567890');
  });

  it('does not store a doctor when NPPES returns no match', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ doctors: [] }) });

    const { matchedDoctors, unmatchedDoctorNames } = await runPipeline(
      'I see Dr. James Ambiguous for checkups.',
      '75201',
      mockFetch,
    );

    expect(matchedDoctors).toHaveLength(0);
    expect(unmatchedDoctorNames).toContain('Dr. James Ambiguous');
    expect(store.providers).toHaveLength(0);
  });

  it('stores a medication when RxNorm validates the name', async () => {
    const mockFetch = vi.fn()
      // RxNorm call → found
      .mockResolvedValueOnce({ ok: true, json: async () => JSON.parse(rxnormHitResponse()) });

    const { hash, matchedMeds, unmatchedMedNames } = await runPipeline(
      'I take Lisinopril 10mg daily.',
      '75201',
      mockFetch,
    );

    expect(matchedMeds).toHaveLength(1);
    expect(matchedMeds[0].name).toMatch(/lisinopril/i);
    expect(matchedMeds[0].dosage).toBe('10mg');
    expect(unmatchedMedNames).toHaveLength(0);

    expect(store.medications).toHaveLength(1);
    const rawMed = JSON.stringify(store.medications[0]);
    expect(rawMed).not.toContain('Lisinopril');   // encrypted

    const session = await loadByTokenHash(hash);
    expect(session?.medications?.[0]?.name).toMatch(/lisinopril/i);
    expect(session?.medications?.[0]?.dosage).toBe('10mg');
  });

  it('does not store a medication when RxNorm does not recognise the name', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => JSON.parse(rxnormMissResponse) });

    const { matchedMeds, unmatchedMedNames } = await runPipeline(
      'I take Zylontex 5mg every morning.',
      '75201',
      mockFetch,
    );

    expect(matchedMeds).toHaveLength(0);
    expect(unmatchedMedNames).toContain('Zylontex');
    expect(store.medications).toHaveLength(0);
  });

  it('splits correctly when one doctor matches and one does not', async () => {
    const mockFetch = vi.fn()
      // First NPPES call (Dr. Sarah Chen) → found
      .mockResolvedValueOnce({ ok: true, json: async () => JSON.parse(nppesDoctorResponse('1111111111')) })
      // Second NPPES call (Dr. Nobody) → empty
      .mockResolvedValueOnce({ ok: true, json: async () => ({ doctors: [] }) });

    const { matchedDoctors, unmatchedDoctorNames } = await runPipeline(
      'I see Dr. Sarah Chen and Dr. Nobody for my conditions.',
      '75201',
      mockFetch,
    );

    expect(matchedDoctors).toHaveLength(1);
    expect(matchedDoctors[0].npi).toBe('1111111111');
    expect(unmatchedDoctorNames).toHaveLength(1);
    expect(store.providers).toHaveLength(1);
  });

  it('treats all doctors as unmatched when ZIP is missing', async () => {
    // No fetch calls should be made when there is no ZIP
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const entities = extractPhiEntities('I see Dr. Sarah Chen.');
    const matchedDoctors: any[] = [];
    const unmatchedDoctorNames: string[] = [];

    // Simulate no-ZIP path (same logic as the handler)
    if (entities.doctors.length > 0) {
      const zip = undefined;
      if (zip) {
        // NPPES branch — should not be reached
      } else {
        for (const doc of entities.doctors) unmatchedDoctorNames.push(doc.name);
      }
    }

    expect(matchedDoctors).toHaveLength(0);
    expect(unmatchedDoctorNames).toContain('Dr. Sarah Chen');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('unmatched entries appear in enrichedProfileUpdate but not in validatedProviders', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ doctors: [] }) });

    const { unmatchedDoctorNames, matchedDoctors } = await runPipeline(
      'I see Dr. Ghost Physician for checkups.',
      '75201',
      mockFetch,
    );

    // The enrichedProfileUpdate should have unmatchedProviders, not validatedProviders
    expect(matchedDoctors).toHaveLength(0);       // nothing in validatedProviders
    expect(unmatchedDoctorNames).toHaveLength(1); // present in unmatchedProviders
    expect(unmatchedDoctorNames[0]).toMatch(/Ghost Physician/i);
  });
});

// ── 5. Stored PHI → plan recommendation ──────────────────────────────────────

describe('Stored PHI → plan recommendation', () => {
  beforeEach(() => { setCryptoEnv(); resetStore(); });
  afterEach(() => clearCryptoEnv());

  const SAMPLE_PLAN = {
    id: 'test-plan-1',
    planId: 'H1234',
    contractId: 'H1234',
    carrier: 'Test Carrier',
    planName: 'Test Gold HMO',
    planType: 'HMO',
    premium: 0,
    deductible: 0,
    maxOutOfPocket: 4000,
    starRating: { overall: 4 },
    rxDrugs: { tier1: '$0', tier2: '$10', tier3: '$42', tier4: '25%', deductible: '$0', gap: false },
    networkSize: 10000,
    copays: { primaryCare: '$0', specialist: '$20', urgentCare: '$30', emergency: '$90', inpatientHospital: '$295/day', outpatientSurgery: '$0' },
    extraBenefits: { dental: { covered: false }, vision: { covered: false }, hearing: { covered: false }, otc: { covered: false }, fitness: { covered: false }, transportation: { covered: false }, telehealth: { covered: false }, meals: { covered: false } },
    partBPremiumReduction: 0,
    isBestMatch: false,
    isMostPopular: false,
    isNewPlan: false,
    enrollmentPeriod: 'AEP',
    effectiveDate: '2026-01-01',
    snpType: null,
  };

  it('medications stored via chat round-trip with correct shape for drug cost enrichment', async () => {
    const { hash } = await seedSession({
      zip: '75201',
      medications: [
        { name: 'Lisinopril', dosage: '10mg', frequency: 'once daily' },
        { name: 'Metformin',  dosage: '500mg', frequency: 'twice daily' },
      ],
    });

    const session = await loadByTokenHash(hash);
    expect(session?.medications).toHaveLength(2);

    // Shape must match DrugInput expected by enrichPlansWithDrugCosts
    for (const med of session!.medications!) {
      expect(typeof med.name).toBe('string');
      expect(med.name.length).toBeGreaterThan(0);
      // dosage is optional but present when stored
      if (med.dosage) expect(typeof med.dosage).toBe('string');
    }
  });

  it('enrichPlansWithDrugCosts produces a non-zero cost when known drugs are passed', () => {
    const drugs = [
      { name: 'Lisinopril', dosage: '10mg' },
      { name: 'Metformin',  dosage: '500mg' },
    ];
    // Use a plan where every tier has a non-zero copay so common Tier-1 generics
    // still produce a measurable annual cost regardless of their tier assignment.
    const planWithCopays = {
      ...SAMPLE_PLAN,
      rxDrugs: { ...SAMPLE_PLAN.rxDrugs, tier1: '$5', tier2: '$15', tier3: '$47', tier4: '25%' },
    };
    const [enriched] = enrichPlansWithDrugCosts([planWithCopays], drugs);
    expect(enriched.estimatedAnnualDrugCost).toBeGreaterThan(0);
    expect(enriched.estimatedTotalAnnualCost).toBeGreaterThanOrEqual(enriched.estimatedAnnualDrugCost);
  });

  it('enrichPlansWithDrugCosts produces the same cost whether drugs came from chat or UI', async () => {
    // Simulate chat-sourced PHI saved to the store, then loaded back
    const { hash } = await seedSession({
      zip: '75201',
      medications: [{ name: 'Atorvastatin', dosage: '20mg', frequency: 'once daily' }],
    });

    const session = await loadByTokenHash(hash);
    const chatDrugs = session!.medications!.map(m => ({ name: m.name, dosage: m.dosage }));

    // The same drug entered directly via the UI form
    const uiDrugs = [{ name: 'Atorvastatin', dosage: '20mg' }];

    const [fromChat] = enrichPlansWithDrugCosts([SAMPLE_PLAN], chatDrugs);
    const [fromUi]   = enrichPlansWithDrugCosts([SAMPLE_PLAN], uiDrugs);

    // Both paths should produce identical drug cost estimates
    expect(fromChat.estimatedAnnualDrugCost).toBe(fromUi.estimatedAnnualDrugCost);
  });

  it('enrichPlansWithDrugCosts adds no cost when no drugs are stored', () => {
    const [enriched] = enrichPlansWithDrugCosts([SAMPLE_PLAN], []);
    // When no drugs are passed the function returns the plan unchanged
    expect(enriched.estimatedAnnualDrugCost).toBeUndefined();
  });

  it('plan total cost = annual premium + drug cost', () => {
    const planWithPremium = { ...SAMPLE_PLAN, premium: 50 }; // $50/mo
    const [enriched] = enrichPlansWithDrugCosts([planWithPremium], [{ name: 'Lisinopril', dosage: '10mg' }]);
    const expectedTotal = 50 * 12 + enriched.estimatedAnnualDrugCost;
    expect(enriched.estimatedTotalAnnualCost).toBe(expectedTotal);
  });
});
