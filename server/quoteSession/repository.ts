/**
 * Quote-session repository — the only place that touches DB tables for this slice.
 *
 * Encryption contract
 * -------------------
 * Every PHI/PII field is encrypted via enc() before INSERT/UPDATE and
 * decrypted via decOrUndefined() after SELECT. Non-PHI columns (zip, county,
 * status, timestamps) are stored as plaintext.
 *
 * Resume token contract
 * ---------------------
 * Raw resume tokens never enter this module. Callers hash them first via
 * hashResumeToken() and pass the hash. This module stores only the hash.
 */

import { eq, and, gt, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db";
import {
  quoteSessions,
  quoteSessionContact,
  quoteSessionEligibility,
  quoteSessionMedications,
  quoteSessionProviders,
  quoteSessionAuditEvents,
} from "../../drizzle/schema";
import { enc, dec, decOrUndefined, hashForLookup } from "./crypto";
import type { SaveQuoteInputType, QuoteSessionOutputType } from "./schemas";

// Sessions expire after 30 days of inactivity.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// ── Internal helpers ─────────────────────────────────────────────────────────

function expiresAt(): Date {
  return new Date(Date.now() + SESSION_TTL_MS);
}

function ipHash(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  // Hash IP so we have audit breadcrumbs without storing raw addresses.
  const { createHash } = require("node:crypto");
  return createHash("sha256").update(ip).digest("hex");
}

// ── Create ───────────────────────────────────────────────────────────────────

export interface CreateSessionResult {
  sessionId: string;
}

export async function createSession(
  resumeTokenHash: string,
  input: SaveQuoteInputType,
  keyVersion: string,
  clientIp?: string,
): Promise<CreateSessionResult> {
  const db = await getDb();
  if (!db) throw new Error("[quoteSession] Database unavailable");

  const id = uuidv4();
  const now = new Date();

  await db.insert(quoteSessions).values({
    id,
    resumeTokenHash,
    encryptionKeyVersion: keyVersion,
    status: "active",
    consentStatus: input.consentGranted ? "granted" : "pending",
    dataMinimizationStatus: "full",
    zip: input.zip ?? null,
    county: input.county ?? null,
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: now,
    expiresAt: expiresAt(),
  });

  await writeChildRows(id, input);

  await appendAudit(id, "session_created", "New quote session created", clientIp);

  return { sessionId: id };
}

// ── Update ───────────────────────────────────────────────────────────────────

export async function updateSession(
  sessionId: string,
  input: SaveQuoteInputType,
  clientIp?: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("[quoteSession] Database unavailable");

  await db.update(quoteSessions)
    .set({
      zip: input.zip ?? undefined,
      county: input.county ?? undefined,
      consentStatus: input.consentGranted !== undefined
        ? (input.consentGranted ? "granted" : "revoked")
        : undefined,
      lastAccessedAt: new Date(),
      expiresAt: expiresAt(),
    })
    .where(eq(quoteSessions.id, sessionId));

  await writeChildRows(sessionId, input);
  await appendAudit(sessionId, "session_updated", "Quote session updated", clientIp);
}

// ── Load by resume token hash ─────────────────────────────────────────────────

export async function loadByTokenHash(
  tokenHash: string,
  clientIp?: string,
): Promise<QuoteSessionOutputType | null> {
  const db = await getDb();
  if (!db) throw new Error("[quoteSession] Database unavailable");

  const rows = await db
    .select()
    .from(quoteSessions)
    .where(
      and(
        eq(quoteSessions.resumeTokenHash, tokenHash),
        gt(quoteSessions.expiresAt, new Date()),
        eq(quoteSessions.status, "active"),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;
  const session = rows[0];

  // Touch lastAccessedAt and roll the expiry forward.
  await db.update(quoteSessions)
    .set({ lastAccessedAt: new Date(), expiresAt: expiresAt() })
    .where(eq(quoteSessions.id, session.id));

  await appendAudit(session.id, "session_resumed", "Quote session resumed", clientIp);

  return assembleOutput(session);
}

// ── Load by session ID ────────────────────────────────────────────────────────

export async function loadById(sessionId: string): Promise<QuoteSessionOutputType | null> {
  const db = await getDb();
  if (!db) throw new Error("[quoteSession] Database unavailable");

  const rows = await db
    .select()
    .from(quoteSessions)
    .where(eq(quoteSessions.id, sessionId))
    .limit(1);

  if (rows.length === 0) return null;
  return assembleOutput(rows[0]);
}

// ── Mark completed / abandoned ───────────────────────────────────────────────

export async function markCompleted(sessionId: string, clientIp?: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("[quoteSession] Database unavailable");
  await db.update(quoteSessions)
    .set({ status: "completed" })
    .where(eq(quoteSessions.id, sessionId));
  await appendAudit(sessionId, "session_completed", "Quote session marked completed", clientIp);
}

export async function markAbandoned(sessionId: string, clientIp?: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("[quoteSession] Database unavailable");
  await db.update(quoteSessions)
    .set({ status: "abandoned" })
    .where(eq(quoteSessions.id, sessionId));
  await appendAudit(sessionId, "session_abandoned", "Quote session abandoned", clientIp);
}

// ── Internal: write child table rows ─────────────────────────────────────────

async function writeChildRows(sessionId: string, input: SaveQuoteInputType): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Contact
  if (input.contact) {
    const c = input.contact;
    const emailHash = c.email ? hashForLookup(c.email) : undefined;

    // Upsert: delete existing row then insert fresh (simpler than merge for text blobs)
    await db.delete(quoteSessionContact).where(eq(quoteSessionContact.sessionId, sessionId));
    await db.insert(quoteSessionContact).values({
      sessionId,
      firstName:       c.firstName   ? enc(c.firstName,   "firstName")   : null,
      lastName:        c.lastName    ? enc(c.lastName,    "lastName")    : null,
      dateOfBirth:     c.dateOfBirth ? enc(c.dateOfBirth, "dateOfBirth") : null,
      email:           c.email       ? enc(c.email,       "email")       : null,
      phone:           c.phone       ? enc(c.phone,       "phone")       : null,
      emailLookupHash: emailHash ?? null,
    });
  }

  // Eligibility
  if (input.eligibility) {
    const e = input.eligibility;
    await db.delete(quoteSessionEligibility).where(eq(quoteSessionEligibility.sessionId, sessionId));
    await db.insert(quoteSessionEligibility).values({
      sessionId,
      mbi:                  e.mbi                   ? enc(e.mbi,                   "mbi")                   : null,
      eligibilityResultJson: e.eligibilityResultJson ? enc(e.eligibilityResultJson, "eligibilityResultJson") : null,
      currentPlanName:      e.currentPlanName        ? enc(e.currentPlanName,       "currentPlanName")       : null,
      currentPlanCarrier:   e.currentPlanCarrier     ? enc(e.currentPlanCarrier,    "currentPlanCarrier")    : null,
      verifiedAt:           e.verifiedAt             ? new Date(e.verifiedAt)                                : null,
    });
  }

  // Medications — full replace
  if (input.medications !== undefined) {
    await db.delete(quoteSessionMedications).where(eq(quoteSessionMedications.sessionId, sessionId));
    if (input.medications.length > 0) {
      await db.insert(quoteSessionMedications).values(
        input.medications.map((m) => ({
          sessionId,
          drugName:  enc(m.name,        "drugName"),
          dosage:    m.dosage    ? enc(m.dosage,    "dosage")    : null,
          frequency: m.frequency ?? null,
        })),
      );
    }
  }

  // Providers — full replace
  if (input.providers !== undefined) {
    await db.delete(quoteSessionProviders).where(eq(quoteSessionProviders.sessionId, sessionId));
    if (input.providers.length > 0) {
      await db.insert(quoteSessionProviders).values(
        input.providers.map((p) => ({
          sessionId,
          doctorName: enc(p.name,      "doctorName"),
          npi:        p.npi       ? enc(p.npi,       "npi")       : null,
          specialty:  p.specialty ? enc(p.specialty, "specialty") : null,
        })),
      );
    }
  }
}

// ── Internal: assemble decrypted output from DB rows ─────────────────────────

async function assembleOutput(session: typeof quoteSessions.$inferSelect): Promise<QuoteSessionOutputType> {
  const db = await getDb();
  if (!db) throw new Error("[quoteSession] Database unavailable");

  const [contactRows, eligRows, medRows, provRows] = await Promise.all([
    db.select().from(quoteSessionContact).where(eq(quoteSessionContact.sessionId, session.id)),
    db.select().from(quoteSessionEligibility).where(eq(quoteSessionEligibility.sessionId, session.id)),
    db.select().from(quoteSessionMedications).where(eq(quoteSessionMedications.sessionId, session.id)),
    db.select().from(quoteSessionProviders).where(eq(quoteSessionProviders.sessionId, session.id)),
  ]);

  const c = contactRows[0];
  const e = eligRows[0];

  return {
    sessionId: session.id,
    status: session.status,
    zip: session.zip ?? undefined,
    county: session.county ?? undefined,
    expiresAt: session.expiresAt,

    contact: c ? {
      firstName:   decOrUndefined(c.firstName,   "firstName"),
      lastName:    decOrUndefined(c.lastName,    "lastName"),
      dateOfBirth: decOrUndefined(c.dateOfBirth, "dateOfBirth"),
      email:       decOrUndefined(c.email,       "email"),
      phone:       decOrUndefined(c.phone,       "phone"),
    } : undefined,

    eligibility: e ? {
      mbi:                  decOrUndefined(e.mbi,                   "mbi"),
      eligibilityResultJson: decOrUndefined(e.eligibilityResultJson, "eligibilityResultJson"),
      currentPlanName:      decOrUndefined(e.currentPlanName,       "currentPlanName"),
      currentPlanCarrier:   decOrUndefined(e.currentPlanCarrier,    "currentPlanCarrier"),
      verifiedAt:           e.verifiedAt ?? undefined,
    } : undefined,

    medications: medRows.map((m) => ({
      id:        m.id,
      name:      dec(m.drugName, "drugName"),
      dosage:    decOrUndefined(m.dosage, "dosage"),
      frequency: m.frequency ?? undefined,
    })),

    providers: provRows.map((p) => ({
      id:        p.id,
      name:      dec(p.doctorName, "doctorName"),
      npi:       decOrUndefined(p.npi,       "npi"),
      specialty: decOrUndefined(p.specialty, "specialty"),
    })),
  };
}

// ── Internal: audit append ────────────────────────────────────────────────────

async function appendAudit(
  sessionId: string,
  eventType: string,
  description: string,
  clientIp?: string,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(quoteSessionAuditEvents).values({
      sessionId,
      eventType,
      description,
      ipHash: ipHash(clientIp),
    });
  } catch {
    // Audit failure must never block the primary operation.
  }
}
