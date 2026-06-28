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
  /** Public ZIP code — not PHI */
  zip: varchar("zip", { length: 10 }),
  /** Public county name — not PHI */
  county: varchar("county", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastAccessedAt: timestamp("lastAccessedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
}, (t) => [
  index("idx_quote_sessions_token_hash").on(t.resumeTokenHash),
  index("idx_quote_sessions_expires").on(t.expiresAt),
]);

export type QuoteSession = typeof quoteSessions.$inferSelect;
export type InsertQuoteSession = typeof quoteSessions.$inferInsert;

// Contact info (PII) — all values are AES-256-GCM ciphertext blobs
export const quoteSessionContact = mysqlTable("quote_session_contact", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 36 }).notNull(),
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
  /** HMAC-SHA-256 of plaintext email — for indexed lookup without decryption */
  emailLookupHash: varchar("emailLookupHash", { length: 64 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_qsc_session").on(t.sessionId),
  index("idx_qsc_email_hash").on(t.emailLookupHash),
]);

export type QuoteSessionContact = typeof quoteSessionContact.$inferSelect;
export type InsertQuoteSessionContact = typeof quoteSessionContact.$inferInsert;

// Medicare / eligibility identifiers (PHI)
export const quoteSessionEligibility = mysqlTable("quote_session_eligibility", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 36 }).notNull(),
  /** enc(MBI — Medicare Beneficiary Identifier) */
  mbi: text("mbi"),
  /** enc(JSON EligibilityResult from pVerify) */
  eligibilityResultJson: text("eligibilityResultJson"),
  /** enc(currentPlanName) */
  currentPlanName: text("currentPlanName"),
  /** enc(currentPlanCarrier) */
  currentPlanCarrier: text("currentPlanCarrier"),
  verifiedAt: timestamp("verifiedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_qse_session").on(t.sessionId),
]);

export type QuoteSessionEligibility = typeof quoteSessionEligibility.$inferSelect;
export type InsertQuoteSessionEligibility = typeof quoteSessionEligibility.$inferInsert;

// Medications (PHI) — one row per drug entry
export const quoteSessionMedications = mysqlTable("quote_session_medications", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 36 }).notNull(),
  /** enc(drug name) */
  drugName: text("drugName").notNull(),
  /** enc(dosage string) */
  dosage: text("dosage"),
  frequency: varchar("frequency", { length: 32 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_qsm_session").on(t.sessionId),
]);

export type QuoteSessionMedication = typeof quoteSessionMedications.$inferSelect;
export type InsertQuoteSessionMedication = typeof quoteSessionMedications.$inferInsert;

// Providers / doctors (PHI — name + NPI combination is identifying)
export const quoteSessionProviders = mysqlTable("quote_session_providers", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 36 }).notNull(),
  /** enc(doctor name) */
  doctorName: text("doctorName").notNull(),
  /** enc(NPI) — NPI alone is public, but combined with session = PHI */
  npi: text("npi"),
  /** enc(specialty) */
  specialty: text("specialty"),
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
