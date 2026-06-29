-- Migration: 0004_quote_session_user_identity
-- Purpose:   Link quote sessions to authenticated users.
--
-- Changes:
--   1. quote_sessions → add userId (Manus OAuth openId, nullable, indexed)
--
-- Design notes:
--   userId stores the OAuth openId string, NOT a foreign key to the users table.
--   This keeps the quote-session slice independent of the user-account slice and
--   avoids cross-slice FK constraints that would block independent purges.
--
--   Authenticated saves set userId automatically from ctx.user.openId.
--   Anonymous sessions remain userId=NULL — these expire after 30 days (expiresAt).
--   The claim procedure upgrades an anonymous session to authenticated after login.
--
--   SAFE TO APPLY: additive-only change (nullable column + index).
--   No data is moved, modified, or deleted. All existing rows remain valid with
--   userId=NULL (anonymous).

ALTER TABLE `quote_sessions`
  ADD COLUMN `userId` VARCHAR(64) NULL DEFAULT NULL
    COMMENT 'Manus OAuth openId; null for anonymous sessions'
    AFTER `county`,
  ADD INDEX `idx_quote_sessions_user_id` (`userId`);
