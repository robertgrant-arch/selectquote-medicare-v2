/**
 * Quote-session tRPC router.
 *
 * All procedures use publicProcedure — the session is identified by the
 * resume token (a secret the consumer holds), not by auth. Authenticated
 * users can call these too; the token acts as the session credential.
 *
 * Security invariants enforced here:
 *   - Raw resume token is generated server-side, returned once, never re-stored.
 *   - DB stores only hash(resumeToken).
 *   - PHI is encrypted by the repository before any DB write.
 *   - Session expiry is validated on every resume.
 */

import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import {
  SaveQuoteInput,
  ResumeQuoteInput,
} from "./schemas";
import {
  createSession,
  updateSession,
  loadByTokenHash,
  markCompleted,
  markAbandoned,
} from "./repository";
import { generateResumeToken, hashResumeToken } from "./tokens";

function clientIp(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string | undefined {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0].trim();
  return req.ip;
}

function activeKeyVersion(): string {
  const id = process.env.ACTIVE_KEY_ID;
  if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Encryption key not configured" });
  return id;
}

export const quoteSessionRouter = router({

  /**
   * save — create a new session or update an existing one.
   *
   * If resumeToken is omitted, a new session is created and the raw token
   * is returned exactly once. The client must persist it (e.g., display it
   * or store in memory) — it is never re-retrievable.
   *
   * If resumeToken is provided, the session is updated in place.
   */
  save: publicProcedure
    .input(SaveQuoteInput)
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp(ctx.req as any);

      if (input.resumeToken) {
        // Update existing session.
        const tokenHash = hashResumeToken(input.resumeToken);
        const existing = await loadByTokenHash(tokenHash);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Quote session not found or expired" });
        }
        await updateSession(existing.sessionId, input, ip);
        return { sessionId: existing.sessionId, created: false };
      }

      // Create new session.
      const rawToken = generateResumeToken();
      const tokenHash = hashResumeToken(rawToken);
      const keyVersion = activeKeyVersion();
      const { sessionId } = await createSession(tokenHash, input, keyVersion, ip);

      return {
        sessionId,
        resumeToken: rawToken, // returned once — client must hold this
        created: true,
      };
    }),

  /**
   * resume — retrieve and decrypt a session by raw resume token.
   * Returns the full decrypted session data so the client can re-populate forms.
   */
  resume: publicProcedure
    .input(ResumeQuoteInput)
    .query(async ({ input, ctx }) => {
      const ip = clientIp(ctx.req as any);
      const tokenHash = hashResumeToken(input.resumeToken);
      const session = await loadByTokenHash(tokenHash, ip);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quote session not found or expired" });
      }

      return session;
    }),

  /**
   * complete — mark a session as completed (consumer enrolled / called agent).
   */
  complete: publicProcedure
    .input(ResumeQuoteInput)
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp(ctx.req as any);
      const tokenHash = hashResumeToken(input.resumeToken);
      const session = await loadByTokenHash(tokenHash);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quote session not found or expired" });
      }
      await markCompleted(session.sessionId, ip);
      return { ok: true };
    }),

  /**
   * abandon — consumer explicitly opts out of resuming.
   */
  abandon: publicProcedure
    .input(ResumeQuoteInput)
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp(ctx.req as any);
      const tokenHash = hashResumeToken(input.resumeToken);
      const session = await loadByTokenHash(tokenHash);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quote session not found or expired" });
      }
      await markAbandoned(session.sessionId, ip);
      return { ok: true };
    }),
});
