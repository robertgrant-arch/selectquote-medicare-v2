/**
 * Zod schemas and TypeScript types for the quote-session vertical slice.
 * These define the API surface — the shapes that callers send and receive.
 * No PHI ever appears in plaintext in any object that crosses the wire;
 * the repository layer encrypts before write and decrypts after read.
 */

import { z } from "zod";

// ── Input: saving / updating a quote ────────────────────────────────────────

export const ContactInput = z.object({
  firstName:   z.string().min(1).max(100).optional(),
  lastName:    z.string().min(1).max(100).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
  email:       z.string().email().max(320).optional(),
  phone:       z.string().max(20).optional(),
});

export const MedicationInput = z.object({
  name:      z.string().min(1).max(200),
  dosage:    z.string().max(100).optional(),
  frequency: z.string().max(32).optional(),
});

export const ProviderInput = z.object({
  name:      z.string().min(1).max(200),
  npi:       z.string().max(20).optional(),
  specialty: z.string().max(100).optional(),
});

export const EligibilityInput = z.object({
  mbi:                  z.string().max(20).optional(),
  eligibilityResultJson: z.string().optional(), // pre-serialised JSON from pVerify
  currentPlanName:      z.string().max(256).optional(),
  currentPlanCarrier:   z.string().max(128).optional(),
  verifiedAt:           z.string().datetime().optional(),
});

export const SaveQuoteInput = z.object({
  /** Omit on first save; include to update an existing session */
  resumeToken: z.string().max(128).optional(),
  zip:         z.string().regex(/^\d{5}$/).optional(),
  county:      z.string().max(128).optional(),
  contact:     ContactInput.optional(),
  eligibility: EligibilityInput.optional(),
  medications: z.array(MedicationInput).max(50).optional(),
  providers:   z.array(ProviderInput).max(20).optional(),
  consentGranted: z.boolean().optional(),
});

export const ResumeQuoteInput = z.object({
  resumeToken: z.string().min(1).max(128),
});

// ── Output: what the client receives ────────────────────────────────────────

export const ContactOutput = z.object({
  firstName:   z.string().optional(),
  lastName:    z.string().optional(),
  dateOfBirth: z.string().optional(),
  email:       z.string().optional(),
  phone:       z.string().optional(),
});

export const MedicationOutput = z.object({
  id:        z.number(),
  name:      z.string(),
  dosage:    z.string().optional(),
  frequency: z.string().optional(),
});

export const ProviderOutput = z.object({
  id:        z.number(),
  name:      z.string(),
  npi:       z.string().optional(),
  specialty: z.string().optional(),
});

export const EligibilityOutput = z.object({
  mbi:                  z.string().optional(),
  eligibilityResultJson: z.string().optional(),
  currentPlanName:      z.string().optional(),
  currentPlanCarrier:   z.string().optional(),
  verifiedAt:           z.date().optional(),
});

export const QuoteSessionOutput = z.object({
  sessionId:   z.string(),
  /** Returned only on creation — never stored on server in plaintext */
  resumeToken: z.string().optional(),
  status:      z.enum(["active", "completed", "abandoned"]),
  zip:         z.string().optional(),
  county:      z.string().optional(),
  expiresAt:   z.date(),
  contact:     ContactOutput.optional(),
  eligibility: EligibilityOutput.optional(),
  medications: z.array(MedicationOutput).optional(),
  providers:   z.array(ProviderOutput).optional(),
});

export type SaveQuoteInputType    = z.infer<typeof SaveQuoteInput>;
export type ResumeQuoteInputType  = z.infer<typeof ResumeQuoteInput>;
export type QuoteSessionOutputType = z.infer<typeof QuoteSessionOutput>;
