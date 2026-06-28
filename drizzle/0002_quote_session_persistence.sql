-- Quote Session Persistence — Migration 0002
-- Encrypted-at-rest quote sessions enabling consumer resume flows.
-- All PHI/PII columns store AES-256-GCM ciphertext; raw resume tokens never stored.

CREATE TABLE `quote_sessions` (
  `id` varchar(36) NOT NULL,
  `resumeTokenHash` varchar(64) NOT NULL,
  `encryptionKeyVersion` varchar(32) NOT NULL,
  `status` enum('active','completed','abandoned') NOT NULL DEFAULT 'active',
  `consentStatus` enum('pending','granted','revoked') NOT NULL DEFAULT 'pending',
  `dataMinimizationStatus` enum('full','minimized','purged') NOT NULL DEFAULT 'full',
  `zip` varchar(10),
  `county` varchar(128),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `lastAccessedAt` timestamp NOT NULL DEFAULT (now()),
  `expiresAt` timestamp NOT NULL,
  CONSTRAINT `quote_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_quote_sessions_token_hash` ON `quote_sessions` (`resumeTokenHash`);
--> statement-breakpoint
CREATE INDEX `idx_quote_sessions_expires` ON `quote_sessions` (`expiresAt`);

--> statement-breakpoint
CREATE TABLE `quote_session_contact` (
  `id` int AUTO_INCREMENT NOT NULL,
  `sessionId` varchar(36) NOT NULL,
  `firstName` text,
  `lastName` text,
  `dateOfBirth` text,
  `email` text,
  `phone` text,
  `emailLookupHash` varchar(64),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `quote_session_contact_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_qsc_session` ON `quote_session_contact` (`sessionId`);
--> statement-breakpoint
CREATE INDEX `idx_qsc_email_hash` ON `quote_session_contact` (`emailLookupHash`);

--> statement-breakpoint
CREATE TABLE `quote_session_eligibility` (
  `id` int AUTO_INCREMENT NOT NULL,
  `sessionId` varchar(36) NOT NULL,
  `mbi` text,
  `eligibilityResultJson` text,
  `currentPlanName` text,
  `currentPlanCarrier` text,
  `verifiedAt` timestamp,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `quote_session_eligibility_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_qse_session` ON `quote_session_eligibility` (`sessionId`);

--> statement-breakpoint
CREATE TABLE `quote_session_medications` (
  `id` int AUTO_INCREMENT NOT NULL,
  `sessionId` varchar(36) NOT NULL,
  `drugName` text NOT NULL,
  `dosage` text,
  `frequency` varchar(32),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `quote_session_medications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_qsm_session` ON `quote_session_medications` (`sessionId`);

--> statement-breakpoint
CREATE TABLE `quote_session_providers` (
  `id` int AUTO_INCREMENT NOT NULL,
  `sessionId` varchar(36) NOT NULL,
  `doctorName` text NOT NULL,
  `npi` text,
  `specialty` text,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `quote_session_providers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_qsp_session` ON `quote_session_providers` (`sessionId`);

--> statement-breakpoint
CREATE TABLE `quote_session_audit_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `sessionId` varchar(36) NOT NULL,
  `eventType` varchar(64) NOT NULL,
  `description` varchar(255),
  `ipHash` varchar(64),
  `occurredAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `quote_session_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_qsae_session` ON `quote_session_audit_events` (`sessionId`);
