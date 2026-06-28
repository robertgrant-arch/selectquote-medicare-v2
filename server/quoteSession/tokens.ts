/**
 * Resume-token helpers.
 *
 * A resume token is a 32-byte cryptographically random value encoded as
 * hex (64 chars). Only its SHA-256 hash is stored in the database.
 * The raw token is returned to the client once and never persisted server-side.
 */

import { randomBytes, createHash } from "node:crypto";

/** Generate a new raw resume token. Return it to the client; never store it. */
export function generateResumeToken(): string {
  return randomBytes(32).toString("hex");
}

/** Hash a raw resume token for DB storage / lookup. */
export function hashResumeToken(raw: string): string {
  return createHash("sha256").update(raw, "hex").digest("hex");
}
