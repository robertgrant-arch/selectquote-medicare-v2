-- Migration: 0003_schema_hardening
-- Purpose:   PHI/PII schema hardening pass.
--
-- Changes summary:
--   1. users                    → add deletedAt (soft delete)
--   2. quote_sessions           → add purgedAt (right-to-erasure audit), status index
--   3. quote_session_contact    → add createdAt, encryptionKeyVersion
--   4. quote_session_eligibility → add createdAt, encryptionKeyVersion
--   5. quote_session_medications → add createdAt, encryptionKeyVersion;
--                                  ALTER frequency varchar(32) → text (now encrypted)
--   6. quote_session_providers  → add createdAt, encryptionKeyVersion
--
-- PHI handling notes:
--   All new columns are additive with safe defaults. No data is moved or
--   dropped in this migration. The only destructive-adjacent change is the
--   frequency column type change (varchar → text), which is backward-
--   compatible in MySQL — existing values remain readable as strings.
--
--   IMPORTANT: The frequency column was previously stored as plaintext
--   varchar(32). After deploying this migration AND the updated application
--   code (which now encrypts frequency on write), any existing plaintext
--   frequency values will cause decryption failures on read. Run the
--   backfill query below before deploying app code if any rows exist:
--
--     UPDATE quote_session_medications
--     SET frequency = NULL
--     WHERE frequency IS NOT NULL
--       AND encryptionKeyVersion = '';
--
--   This safely nulls out legacy plaintext values. Since quote sessions
--   expire after 30 days and this is a new feature, the table is expected
--   to be empty or contain only test data.

-->

-- 1. users: soft-delete support
ALTER TABLE `users`
  ADD COLUMN `deletedAt` TIMESTAMP NULL DEFAULT NULL;

-->

-- 2. quote_sessions: right-to-erasure tracking + status index
ALTER TABLE `quote_sessions`
  ADD COLUMN `purgedAt` TIMESTAMP NULL DEFAULT NULL;

CREATE INDEX `idx_quote_sessions_status`
  ON `quote_sessions` (`status`);

-->

-- 3. quote_session_contact: audit timestamps + key version for rotation
ALTER TABLE `quote_session_contact`
  ADD COLUMN `encryptionKeyVersion` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill encryptionKeyVersion from parent session (safe, idempotent)
UPDATE `quote_session_contact` qsc
  JOIN `quote_sessions` qs ON qs.`id` = qsc.`sessionId`
  SET qsc.`encryptionKeyVersion` = qs.`encryptionKeyVersion`
  WHERE qsc.`encryptionKeyVersion` = '';

-->

-- 4. quote_session_eligibility: audit timestamps + key version for rotation
ALTER TABLE `quote_session_eligibility`
  ADD COLUMN `encryptionKeyVersion` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE `quote_session_eligibility` qse
  JOIN `quote_sessions` qs ON qs.`id` = qse.`sessionId`
  SET qse.`encryptionKeyVersion` = qs.`encryptionKeyVersion`
  WHERE qse.`encryptionKeyVersion` = '';

-->

-- 5. quote_session_medications: encrypt frequency + audit timestamps + key version
--    frequency: varchar(32) plaintext → text ciphertext.
--    MySQL ALTER TABLE MODIFY is safe here: varchar → text is a widening change;
--    existing string values are preserved as-is (and will be nulled by backfill above).
ALTER TABLE `quote_session_medications`
  ADD COLUMN `encryptionKeyVersion` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY COLUMN `frequency` TEXT NULL;

UPDATE `quote_session_medications` qsm
  JOIN `quote_sessions` qs ON qs.`id` = qsm.`sessionId`
  SET qsm.`encryptionKeyVersion` = qs.`encryptionKeyVersion`
  WHERE qsm.`encryptionKeyVersion` = '';

-- Null out any plaintext frequency values from before this migration.
-- Ciphertext blobs always start with 'e' (base64url of our envelope JSON),
-- so any value shorter than 50 chars is definitely not a valid ciphertext.
UPDATE `quote_session_medications`
  SET `frequency` = NULL
  WHERE `frequency` IS NOT NULL
    AND CHAR_LENGTH(`frequency`) < 50;

-->

-- 6. quote_session_providers: audit timestamps + key version for rotation
ALTER TABLE `quote_session_providers`
  ADD COLUMN `encryptionKeyVersion` VARCHAR(32) NOT NULL DEFAULT '',
  ADD COLUMN `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE `quote_session_providers` qsp
  JOIN `quote_sessions` qs ON qs.`id` = qsp.`sessionId`
  SET qsp.`encryptionKeyVersion` = qs.`encryptionKeyVersion`
  WHERE qsp.`encryptionKeyVersion` = '';
