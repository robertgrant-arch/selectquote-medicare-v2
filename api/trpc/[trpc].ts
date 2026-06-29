import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../../server/routers';
import { sdk } from '../../server/_core/sdk';
import type { User } from '../../drizzle/schema';

export const config = { maxDuration: 30 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Reconstruct a full URL for the fetch adapter
  const url = new URL(
    req.url ?? '/',
    `https://${req.headers.host ?? 'localhost'}`
  );

  const fetchRequest = new Request(url.toString(), {
    method: req.method ?? 'GET',
    headers: req.headers as Record<string, string>,
    body: req.method !== 'GET' && req.method !== 'HEAD'
      ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
      : undefined,
  });

  const fetchResponse = await fetchRequestHandler({
    endpoint: '/api/trpc',
    req: fetchRequest,
    router: appRouter,
    createContext: async () => {
      let user: User | null = null;
      try {
        // sdk.authenticateRequest expects an Express-like req with headers/cookies.
        // Pass a minimal shim that satisfies the cookie/header lookup.
        user = await sdk.authenticateRequest(req as any);
      } catch {
        user = null;
      }
      return { req, res, user };
    },
    onError({ path, error }) {
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        console.error(`[tRPC] ${path ?? 'unknown'}:`, error.message);
      }
    },
  });

  res.status(fetchResponse.status);
  fetchResponse.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const body = await fetchResponse.text();
  res.send(body);
}
