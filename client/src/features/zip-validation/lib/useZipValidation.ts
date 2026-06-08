import { useState, useRef, useCallback } from 'react';
import { validateZipFormat, buildInvalidFormatResult, applyCountySelection } from './zipValidator';
import { lookupZip } from './zipLookup';
import {
  trackZipSubmitted, trackZipFormatError, trackZipNotFound,
  trackZipValid, trackCountySelectionShown, trackCountySelected, trackZipNetworkError,
} from './zipAnalytics';
import type { ZipValidationResult, ZipCounty } from './zipValidator';

export interface UseZipValidationReturn {
  result: ZipValidationResult;
  isLoading: boolean;
  validate: (zip: string) => Promise<ZipValidationResult>;
  selectCounty: (county: ZipCounty) => ZipValidationResult;
  reset: () => void;
}

const IDLE: ZipValidationResult = { status:'idle', zip:'', requiresCountySelection:false, errorMessage:'' };

export function useZipValidation(): UseZipValidationReturn {
  const [result, setResult] = useState<ZipValidationResult>(IDLE);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController|null>(null);

  const validate = useCallback(async (zip: string): Promise<ZipValidationResult> => {
    const trimmed = zip.trim();
    trackZipSubmitted(trimmed);

    // 1. Format check (instant, no network)
    const formatErr = validateZipFormat(trimmed);
    if (formatErr !== 'VALID_FORMAT') {
      const r = buildInvalidFormatResult(trimmed, formatErr);
      trackZipFormatError(trimmed, formatErr);
      setResult(r);
      return r;
    }

    // 2. Lookup (network)
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsLoading(true);

    try {
      const r = await lookupZip(trimmed, abortRef.current.signal);
      setResult(r);

      if (r.status === 'invalid_zip') trackZipNotFound(trimmed);
      else if (r.status === 'error') trackZipNetworkError(trimmed);
      else if (r.status === 'needs_county_selection') trackCountySelectionShown(trimmed, r.counties?.length ?? 0);
      else if (r.status === 'valid' && r.county) trackZipValid(trimmed, r.county.name);

      return r;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectCounty = useCallback((county: ZipCounty): ZipValidationResult => {
    const updated = applyCountySelection(result, county);
    setResult(updated);
    trackCountySelected(result.zip, county.name);
    return updated;
  }, [result]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setResult(IDLE);
    setIsLoading(false);
  }, []);

  return { result, isLoading, validate, selectCounty, reset };
}
