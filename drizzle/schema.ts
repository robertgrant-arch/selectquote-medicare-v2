import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  index,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
/**
 * PHI/PII classification: INTERNAL ADMIN USERS ONLY.
 * name + email are plaintext here because:
 *   1. These are SelectQuote internal staff accounts, not consumer records.
 *   2. Login lookup relies on openId (OAuth token), not email — so a hash
 *      column is not needed for the auth flow.
 *   3. Encrypting staff credentials would break admin UI without providing
 *      meaningful protection against a DB breach (attackers with DB access
 *      already have admin-level context).
 * If this table ever stores consumer accounts, revisit: encrypt name/email
 * and add emailLookupHash before expanding scope.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  /** Soft-delete timestamp — set on account deactivation, never hard-delete. */
  deletedAt: timestamp("deletedAt"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Admin: Carrier Overrides ────────────────────────────────────────────────
// Controls whether a carrier's plans appear on the public-facing results page.
export const carrierOverrides = mysqlTable("carrier_overrides", {
  id: int("id").autoincrement().primaryKey(),
  /** Normalized carrier name (e.g. "UnitedHealthcare") */
  carrierName: varchar("carrierName", { length: 128 }).notNull().unique(),
  /** When false, ALL plans from this carrier are hidden from public results */
  isEnabled: boolean("isEnabled").default(true).notNull(),
  /** Optional admin note */
  notes: text("notes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: varchar("updatedBy", { length: 128 }),
});

export type CarrierOverride = typeof carrierOverrides.$inferSelect;
export type InsertCarrierOverride = typeof carrierOverrides.$inferInsert;

// ─── Admin: Plan Overrides ───────────────────────────────────────────────────
// Per-plan visibility and commission status flags.
export const planOverrides = mysqlTable("plan_overrides", {
  id: int("id").autoincrement().primaryKey(),
  /** CMS contract-PBP identifier (e.g. "H1234-001") */
  planId: varchar("planId", { length: 64 }).notNull().unique(),
  planName: varchar("planName", { length: 256 }),
  carrierName: varchar("carrierName", { length: 128 }),
  /** When false, this plan is hidden from public results */
  isEnabled: boolean("isEnabled").default(true).notNull(),
  /** True when this plan does not pay agent commission */
  isNonCommissionable: boolean("isNonCommissionable").default(false).notNull(),
  /** Source URL or document name for the non-commissionable designation */
  nonCommSource: text("nonCommSource"),
  /** Date the non-commissionable status took effect */
  nonCommEffectiveDate: varchar("nonCommEffectiveDate", { length: 32 }),
  /** Optional admin note */
  notes: text("notes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: varchar("updatedBy", { length: 128 }),
});

export type PlanOverride = typeof planOverrides.$inferSelect;
export type InsertPlanOverride = typeof planOverrides.$inferInsert;

// ─── CMS Data Sources ────────────────────────────────────────────────────────
// Registry of CMS data files the pipeline monitors.
export const cmsDataSources = mysqlTable("cms_data_sources", {
  id: int("id").autoincrement().primaryKey(),
  /** Human-readable name (e.g. "MA Landscape File CY2026") */
  name: varchar("name", { length: 256 }).notNull(),
  /** CMS URL or file path */
  url: text("url").notNull(),
  /** Category for grouping in the admin UI */
  category: mysqlEnum("category", [
    "landscape",
    "pbp",
    "star_ratings",
    "enrollment",
    "service_area",
  ]).notNull(),
  /** SHA-256 hash of last downloaded file (for change detection) */
  lastFileHash: varchar("lastFileHash", { length: 64 }),
  lastCheckedAt: timestamp("lastCheckedAt"),
  lastUpdatedAt: timestamp("lastUpdatedAt"),
  /** Whether this source is active in the pipeline */
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CmsDataSource = typeof cmsDataSources.$inferSelect;
export type InsertCmsDataSource = typeof cmsDataSources.$inferInsert;

// ─── CMS Sync Log ────────────────────────────────────────────────────────────
// Audit trail for every pipeline run (scheduled or manual).
export const cmsSyncLog = mysqlTable("cms_sync_log", {
  id: int("id").autoincrement().primaryKey(),
  /** "scheduled" | "manual" */
  triggerType: mysqlEnum("triggerType", ["scheduled", "manual"]).notNull(),
  status: mysqlEnum("status", ["running", "success", "partial", "error"]).notNull(),
  /** Number of data sources checked */
  sourcesChecked: int("sourcesChecked").default(0).notNull(),
  /** Number of sources where new data was found and processed */
  sourcesUpdated: int("sourcesUpdated").default(0).notNull(),
  /** Number of plan records inserted/updated */
  plansProcessed: int("plansProcessed").default(0).notNull(),
  /** Error message if status = "error" */
  errorMessage: text("errorMessage"),
  /** Full JSON log of per-source results */
  detailLog: text("detailLog"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type CmsSyncLog = typeof cmsSyncLog.$inferSelect;
export type InsertCmsSyncLog = typeof cmsSyncLog.$inferInsert;

// ─── Quote Session Persistence ───────────────────────────────────────────────
// Encrypted-at-rest quote sessions enabling consumer resume flows.
// All PHI/PII columns in child tables store AES-256-GCM ciphertext only.
// The raw resume token is NEVER stored — only its SHA-256 hash.

export const quoteSessions = mysqlTable("quote_sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),         // UUID v4
  resumeTokenHash: varchar("resumeTokenHash", { length: 64 }).notNull(), // SHA-256 hex
  encryptionKeyVersion: varchar("encryptionKeyVersion", { length: 32 }).notNull(),
  status: mysqlEnum("status", ["active", "completed", "abandoned"]).default("active").notNull(),
  consentStatus: mysqlEnum("consentStatus", ["pending", "granted", "revoked"]).default("pending").notNull(),
  dataMinimizationStatus: mysqlEnum("dataMinimizationStatus", ["full", "minimized", "purged"]).default("full").notNull(),
  /** Public ZIP code — not PHI (5-digit postal code, no finer granularity) */
  zip: varchar("zip", { length: 10 }),
  /** Public county name — not PHI */
  county: varchar("county", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastAccessedAt: timestamp("lastAccessedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  /**
   * Set when dataMinimizationStatus transitions to "purged".
   * Child-table PHI rows are deleted; this timestamp records when erasure occurred.
   * Required for HIPAA right-to-access audit responses.
   */
  purgedAt: timestamp("purgedAt"),
}, (t) => [
  index("idx_quote_sessions_token_hash").on(t.resumeTokenHash),
  index("idx_quote_sessions_expires").on(t.expiresAt),
  index("idx_quote_sessions_status").on(t.status),
]);

export type QuoteSession = typeof quoteSessions.$inferSelect;
export type InsertQuoteSession = typeof quoteSessions.$inferInsert;

/**
 * Contact info (PII) — all value columns store AES-256-GCM ciphertext.
 *
 * Column classification:
 *   firstName, lastName        → PHI/PII  → encrypted
 *   dateOfBirth                → PHI      → encrypted (HIPAA identifier)
 *   email, phone               → PII      → encrypted
 *   emailLookupHash            → semi     → SHA-256 hash, no plaintext index
 *   sessionId                  → non-sensitive (FK to parent)
 *   encryptionKeyVersion       → non-sensitive (needed for key rotation)
 */
export const quoteSessionContact = mysqlTable("quote_session_contact", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 36 }).notNull(),
  encryptionKeyVersion: varchar("encryptionKeyVersion", { length: 32 }).notNull().default(""),
  /** enc(firstName) */
  firstName: text("firstName"),
  /** enc(lastName) */
  lastName: text("lastName"),
  /** enc(dateOfBirth)  YYYY-MM-DD */
  dateOfBirth: text("dateOfBirth"),
  /** enc(email) */
  email: text("email"),
  /** enc(phone) */
  phone: text("phone"),
  /** SHA-256(email) — for indexed lookup without decryption */
  emailLookupHash: varchar("emailLookupHash", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_qsc_session").on(t.sessionId),
  index("idx_qsc_email_hash").on(t.emailLookupHash),
]);

export type QuoteSessionContact = typeof quoteSessionContact.$inferSelect;
export type InsertQuoteSessionContact = typeof quoteSessionContact.$inferInsert;

/**
 * Medicare / eligibility identifiers (PHI).
 *
 * Column classification:
 *   mbi                    → PHI  → encrypted (HIPAA direct identifier)
 *   eligibilityResultJson  → PHI  → encrypted (contains MBI, Part A/B dates,
 *                                    current plan — individually identifying)
 *   currentPlanName        → PHI  → encrypted (plan name can reveal diagnosis,
 *                                    e.g. a CSNP for diabetes)
 *   currentPlanCarrier     → semi → encrypted (carrier alone is low-risk,
 *                                    but combined with session = PHI context)
 *   verifiedAt             → non-sensitive (timestamp, no person data)
 *   encryptionKeyVersion   → non-sensitive
 */
export const quoteSessionEligibility = mysqlTable("quote_session_eligibility", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 36 }).notNull(),
  encryptionKeyVersion: varchar("encryptionKeyVersion", { length: 32 }).notNull().default(""),
  /** enc(MBI — Medicare Beneficiary Identifier) */
  mbi: text("mbi"),
  /** enc(JSON EligibilityResult from pVerify) */
  eligibilityResultJson: text("eligibilityResultJson"),
  /** enc(currentPlanName) */
  currentPlanName: text("currentPlanName"),
  /** enc(currentPlanCarrier) */
  currentPlanCarrier: text("currentPlanCarrier"),
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_qse_session").on(t.sessionId),
]);

export type QuoteSessionEligibility = typeof quoteSessionEligibility.$inferSelect;
export type InsertQuoteSessionEligibility = typeof quoteSessionEligibility.$inferInsert;

/**
 * Medications (PHI) — one row per drug entry.
 *
 * Column classification:
 *   drugName   → PHI → encrypted (medication name reveals health conditions)
 *   dosage     → PHI → encrypted (dosage is part of the medical record)
 *   frequency  → PHI → encrypted (was varchar/plaintext in 0002; migrated
 *                        to text/ciphertext in 0003 — see migration notes)
 *   encryptionKeyVersion → non-sensitive
 */
export const quoteSessionMedications = mysqlTable("quote_session_medications", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 36 }).notNull(),
  encryptionKeyVersion: varchar("encryptionKeyVersion", { length: 32 }).notNull().default(""),
  /** enc(drug name) */
  drugName: text("drugName").notNull(),
  /** enc(dosage string) */
  dosage: text("dosage"),
  /** enc(frequency) — previously plaintext varchar(32); altered to text in migration 0003 */
  frequency: text("frequency"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_qsm_session").on(t.sessionId),
]);

export type QuoteSessionMedication = typeof quoteSessionMedications.$inferSelect;
export type InsertQuoteSessionMedication = typeof quoteSessionMedications.$inferInsert;

/**
 * Providers / doctors (PHI — name+NPI pair is individually identifying).
 *
 * Column classification:
 *   doctorName → PHI  → encrypted (name + session link = identifying)
 *   npi        → semi → encrypted (NPI is public in NPPES, but linking it
 *                         to a specific consumer quote session makes it PHI
 *                         in context — encrypt to prevent correlation attacks)
 *   specialty  → semi → encrypted (specialty alone is low-risk, but combined
 *                         with name/session it narrows health context)
 *   encryptionKeyVersion → non-sensitive
 */
export const quoteSessionProviders = mysqlTable("quote_session_providers", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 36 }).notNull(),
  encryptionKeyVersion: varchar("encryptionKeyVersion", { length: 32 }).notNull().default(""),
  /** enc(doctor name) */
  doctorName: text("doctorName").notNull(),
  /** enc(NPI) — NPI alone is public; linking to session makes it PHI */
  npi: text("npi"),
  /** enc(specialty) */
  specialty: text("specialty"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_qsp_session").on(t.sessionId),
]);

export type QuoteSessionProvider = typeof quoteSessionProviders.$inferSelect;
export type InsertQuoteSessionProvider = typeof quoteSessionProviders.$inferInsert;

// Immutable audit log — one append-only row per event
export const quoteSessionAuditEvents = mysqlTable("quote_session_audit_events", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 36 }).notNull(),
  /** Event type — never contains PHI */
  eventType: varchar("eventType", { length: 64 }).notNull(),
  /** Server-generated description — never contains PHI field values */
  description: varchar("description", { length: 255 }),
  /** IP address (hashed) */
  ipHash: varchar("ipHash", { length: 64 }),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
}, (t) => [
  index("idx_qsae_session").on(t.sessionId),
]);

export type QuoteSessionAuditEvent = typeof quoteSessionAuditEvents.$inferSelect;
export type InsertQuoteSessionAuditEvent = typeof quoteSessionAuditEvents.$inferInsert;
