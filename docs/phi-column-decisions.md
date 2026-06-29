# PHI/PII Column Classification & Encryption Decisions

**As of:** migration `0003_schema_hardening`  
**Encryption scheme:** AES-256-GCM with AAD-bound envelopes (`shared/security/crypto.ts`)  
**Key management:** `ACTIVE_KEY_ID` + `KEY_<id>` env vars (64-char hex); key version stored per-row

---

## Column inventory

### `users` (internal admin accounts only)

| Column | Classification | Treatment | Justification |
|--------|---------------|-----------|---------------|
| `id` | Non-sensitive | Plaintext | Internal PK |
| `openId` | Semi-sensitive | Plaintext | OAuth token from IdP — not PHI; needed as indexed lookup key for login |
| `name` | PII | **Plaintext** | Internal staff only. Encrypting would break admin UI without meaningful security gain (attackers with DB access already have admin context). **If scope expands to consumer accounts, encrypt and add hash column before go-live.** |
| `email` | PII | **Plaintext** | Same rationale as `name`. Login keyed on `openId`, not email, so a hash column is not needed for auth. |
| `loginMethod` | Non-sensitive | Plaintext | OAuth provider name |
| `role` | Non-sensitive | Plaintext | Access control enum |
| `createdAt`, `updatedAt`, `lastSignedIn` | Non-sensitive | Plaintext | Operational timestamps |
| `deletedAt` | Non-sensitive | Plaintext | Soft-delete marker (added 0003) |

---

### `carrier_overrides`, `plan_overrides`, `cms_data_sources`, `cms_sync_log`

All columns are **non-sensitive** business/operational data — no consumer identifiers. Plaintext is appropriate.

> **`cms_sync_log.errorMessage` and `detailLog`**: Application code must never log consumer PHI in sync errors. These columns contain pipeline operational data (plan counts, file hashes, CMS error responses). Reviewed — no consumer data paths reach these columns.

---

### `quote_sessions` (parent session record)

| Column | Classification | Treatment | Justification |
|--------|---------------|-----------|---------------|
| `id` | Non-sensitive | Plaintext UUID | Internal FK, no person data |
| `resumeTokenHash` | Semi-sensitive | SHA-256 hash | Never store raw token; hash is a lookup credential, not PHI |
| `encryptionKeyVersion` | Non-sensitive | Plaintext | Needed to locate decryption key |
| `status`, `consentStatus`, `dataMinimizationStatus` | Non-sensitive | Plaintext | State machine values |
| `zip` | Semi-sensitive | **Plaintext** | 5-digit postal code. Below HIPAA's "small geographic unit" threshold (ZIP ≥ 20k population). Acceptable as plaintext; enables geographic analytics without decryption. |
| `county` | Semi-sensitive | **Plaintext** | County name — same rationale as `zip`. |
| `createdAt`, `updatedAt`, `lastAccessedAt`, `expiresAt` | Non-sensitive | Plaintext | Operational timestamps |
| `purgedAt` | Non-sensitive | Plaintext | Erasure audit timestamp (added 0003) |

---

### `quote_session_contact`

| Column | Classification | Treatment | Justification |
|--------|---------------|-----------|---------------|
| `firstName`, `lastName` | PII | **Encrypted** | HIPAA direct identifier |
| `dateOfBirth` | PHI | **Encrypted** | HIPAA direct identifier |
| `email` | PII | **Encrypted** | HIPAA direct identifier |
| `phone` | PII | **Encrypted** | HIPAA direct identifier |
| `emailLookupHash` | Semi-sensitive | SHA-256 hash | Enables email deduplication without decrypting; no plaintext index on email |
| `encryptionKeyVersion` | Non-sensitive | Plaintext | Key rotation support (added 0003) |
| `createdAt`, `updatedAt` | Non-sensitive | Plaintext | Audit timestamps (createdAt added 0003) |

---

### `quote_session_eligibility`

| Column | Classification | Treatment | Justification |
|--------|---------------|-----------|---------------|
| `mbi` | PHI | **Encrypted** | Medicare Beneficiary Identifier — HIPAA direct identifier |
| `eligibilityResultJson` | PHI | **Encrypted** | Contains MBI, Part A/B dates, current plan data — multiple HIPAA identifiers combined |
| `currentPlanName` | PHI | **Encrypted** | Plan names can reveal diagnosis (e.g., CSNP plans name the chronic condition) |
| `currentPlanCarrier` | Semi → PHI | **Encrypted** | Carrier alone is low-risk, but combined with session link it creates a PHI context; encrypt to prevent correlation |
| `verifiedAt` | Non-sensitive | Plaintext | Timestamp only |
| `encryptionKeyVersion` | Non-sensitive | Plaintext | Key rotation support (added 0003) |
| `createdAt`, `updatedAt` | Non-sensitive | Plaintext | Audit timestamps (createdAt added 0003) |

---

### `quote_session_medications`

| Column | Classification | Treatment | Justification |
|--------|---------------|-----------|---------------|
| `drugName` | PHI | **Encrypted** | Medication names directly reveal health conditions |
| `dosage` | PHI | **Encrypted** | Dosage is part of the medical record |
| `frequency` | PHI | **Encrypted** | Previously plaintext `varchar(32)` — migrated to encrypted `text` in 0003. Dosing frequency (e.g., "twice daily for pain") is part of the medical record. |
| `encryptionKeyVersion` | Non-sensitive | Plaintext | Key rotation support (added 0003) |
| `createdAt`, `updatedAt` | Non-sensitive | Plaintext | Audit timestamps (createdAt added 0003) |

---

### `quote_session_providers`

| Column | Classification | Treatment | Justification |
|--------|---------------|-----------|---------------|
| `doctorName` | PHI | **Encrypted** | Name + session link = individually identifying |
| `npi` | Semi → PHI | **Encrypted** | NPI is public in NPPES, but linking it to a specific consumer session is PHI in context. Encrypted to prevent correlation attacks against the NPPES registry. |
| `specialty` | Semi | **Encrypted** | Specialty alone is low-risk, but combined with name/session it narrows health context. Encrypt conservatively. |
| `encryptionKeyVersion` | Non-sensitive | Plaintext | Key rotation support (added 0003) |
| `createdAt`, `updatedAt` | Non-sensitive | Plaintext | Audit timestamps (createdAt added 0003) |

---

### `quote_session_audit_events`

| Column | Classification | Treatment | Justification |
|--------|---------------|-----------|---------------|
| `eventType`, `description` | Non-sensitive | Plaintext | Server-generated labels only — application code enforces no PHI in these fields |
| `ipHash` | Semi-sensitive | SHA-256 hash | Hashed for audit breadcrumbs without storing raw addresses |
| `sessionId` | Non-sensitive | Plaintext | FK, no person data |
| `occurredAt` | Non-sensitive | Plaintext | Timestamp |

---

## Key rotation procedure

Each encrypted row stores `encryptionKeyVersion` (the `ACTIVE_KEY_ID` at write time). To rotate keys:

1. Add new key: `KEY_<new_id>=<64-char-hex>`, set `ACTIVE_KEY_ID=<new_id>` in env.
2. Old key stays in env (under its original `KEY_<old_id>` var) — existing rows remain decryptable.
3. New writes use the new key automatically.
4. To re-encrypt old rows: query each child table for `encryptionKeyVersion = '<old_id>'`, decrypt with old key, re-encrypt with new key, update row. The `encryptionKeyVersion` column on each child table allows targeted backfills without joining to the parent.
5. Once all rows are migrated, remove the old key from env.

---

## What is NOT stored

Per the vertical-slice constraint and HIPAA minimum-necessary principle:

- **Risk scores** — computed on-the-fly from plan data; never persisted to DB.
- **AI comparison summaries** — streamed to client, never written to a table.
- **Raw resume tokens** — hashed before storage; raw value returned to client once.
- **Raw IP addresses** — SHA-256 hashed before the audit event row is written.
- **SSN** — accepted transiently by the pVerify API call; never stored anywhere.
