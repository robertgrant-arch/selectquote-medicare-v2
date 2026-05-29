// Async ZIP-to-county lookup via our own /api/validate-zip proxy.
// The slice never calls the CMS API directly (API key stays server-side).

import type { ZipCounty, ZipValidationResult } from './zipValidator';
import { buildValidResult, buildNotFoundResult, buildNetworkErrorResult } from './zipValidator';

export interface ValidateZipApiResponse {
  valid: boolean;
  counties?: ZipCounty[];
  error?: 'NOT_FOUND'|'INVALID_FORMAT'|'SERVER_ERROR';
}

export async function lookupZip(
  zip: string,
  signal?: AbortSignal,
): Promise<ZipValidationResult> {
  try {
    const res = await fetch(`/api/validate-zip?zip=${encodeURIComponent(zip)}`, {
      signal,
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      if (res.status === 404) return buildNotFoundResult(zip);
      return buildNetworkErrorResult(zip);
    }

    const data: ValidateZipApiResponse = await res.json();
    if (!data.valid || !data.counties || data.counties.length === 0) {
      return buildNotFoundResult(zip);
    }
    return buildValidResult(zip, data.counties);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      // Caller aborted — return neutral result
      return { status:'idle', zip, requiresCountySelection:false, errorMessage:'' };
    }
    return buildNetworkErrorResult(zip);
  }
}
