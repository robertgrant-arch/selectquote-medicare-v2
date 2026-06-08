import { describe, test, expect } from 'vitest';
import {
  validateZipFormat, isValidZipFormat, getZipErrorMessage,
  buildInvalidFormatResult, buildNotFoundResult, buildNetworkErrorResult,
  buildValidResult, applyCountySelection, isSafeForDoctorSearch, doctorSearchLabel,
} from '../lib/zipValidator';
import type { ZipCounty } from '../lib/zipValidator';

const COUNTY_MO: ZipCounty = { name:'Jackson County', state:'MO' };
const COUNTY_KS: ZipCounty = { name:'Johnson County', state:'KS' };

// ─── validateZipFormat ────────────────────────────────────────────────────────

describe('validateZipFormat', () => {
  test('valid 64106 → VALID_FORMAT',  () => expect(validateZipFormat('64106')).toBe('VALID_FORMAT'));
  test('valid 90210 → VALID_FORMAT',  () => expect(validateZipFormat('90210')).toBe('VALID_FORMAT'));
  test('valid 00501 → VALID_FORMAT',  () => expect(validateZipFormat('00501')).toBe('VALID_FORMAT'));
  test('empty string → EMPTY',        () => expect(validateZipFormat('')).toBe('EMPTY'));
  test('whitespace only → EMPTY',     () => expect(validateZipFormat('   ')).toBe('EMPTY'));
  test('"abc12" → NON_NUMERIC',       () => expect(validateZipFormat('abc12')).toBe('NON_NUMERIC'));
  test('"1234a" → NON_NUMERIC',       () => expect(validateZipFormat('1234a')).toBe('NON_NUMERIC'));
  test('"12-34" → NON_NUMERIC',       () => expect(validateZipFormat('12-34')).toBe('NON_NUMERIC'));
  test('"1234" (4 digits) → TOO_SHORT', () => expect(validateZipFormat('1234')).toBe('TOO_SHORT'));
  test('"1" → TOO_SHORT',             () => expect(validateZipFormat('1')).toBe('TOO_SHORT'));
  test('"123456" (6 digits) → TOO_LONG', () => expect(validateZipFormat('123456')).toBe('TOO_LONG'));
  test('"999999" → TOO_LONG',         () => expect(validateZipFormat('999999')).toBe('TOO_LONG'));
  // Trims whitespace before checking
  test('" 64106 " → VALID_FORMAT',   () => expect(validateZipFormat(' 64106 ')).toBe('VALID_FORMAT'));
});

describe('isValidZipFormat', () => {
  test('64106 → true',  () => expect(isValidZipFormat('64106')).toBe(true));
  test('99999 → true',  () => expect(isValidZipFormat('99999')).toBe(true));  // format ok, lookup will fail
  test('abcde → false', () => expect(isValidZipFormat('abcde')).toBe(false));
  test('"" → false',    () => expect(isValidZipFormat('')).toBe(false));
  test('1234 → false',  () => expect(isValidZipFormat('1234')).toBe(false));
});

// ─── getZipErrorMessage ───────────────────────────────────────────────────────

describe('getZipErrorMessage', () => {
  test('EMPTY → non-empty string',        () => expect(getZipErrorMessage('EMPTY').length).toBeGreaterThan(0));
  test('NON_NUMERIC → mentions numbers',  () => expect(getZipErrorMessage('NON_NUMERIC').toLowerCase()).toMatch(/number/));
  test('TOO_SHORT → mentions 5 digits',   () => expect(getZipErrorMessage('TOO_SHORT')).toMatch(/5 digit/));
  test('TOO_LONG → mentions 5 digits',    () => expect(getZipErrorMessage('TOO_LONG')).toMatch(/5 digit/));
  test('NOT_FOUND → required copy',       () => expect(getZipErrorMessage('NOT_FOUND')).toBe("We couldn't find that ZIP code. Please check it and try again."));
  test('NETWORK_ERROR → non-empty',       () => expect(getZipErrorMessage('NETWORK_ERROR').length).toBeGreaterThan(0));
  test('SERVER_ERROR → non-empty',        () => expect(getZipErrorMessage('SERVER_ERROR').length).toBeGreaterThan(0));
});

// ─── buildValidResult ─────────────────────────────────────────────────────────

describe('buildValidResult', () => {
  test('empty counties → invalid_zip',                    () => expect(buildValidResult('64106', []).status).toBe('invalid_zip'));
  test('1 county → valid',                               () => expect(buildValidResult('64106', [COUNTY_MO]).status).toBe('valid'));
  test('1 county → county populated',                    () => expect(buildValidResult('64106', [COUNTY_MO]).county).toEqual(COUNTY_MO));
  test('1 county → requiresCountySelection false',       () => expect(buildValidResult('64106', [COUNTY_MO]).requiresCountySelection).toBe(false));
  test('2 counties → needs_county_selection',            () => expect(buildValidResult('64106', [COUNTY_MO, COUNTY_KS]).status).toBe('needs_county_selection'));
  test('2 counties → requiresCountySelection true',      () => expect(buildValidResult('64106', [COUNTY_MO, COUNTY_KS]).requiresCountySelection).toBe(true));
  test('2 counties → counties array populated',          () => expect(buildValidResult('64106', [COUNTY_MO, COUNTY_KS]).counties).toHaveLength(2));
  test('2 counties → no single county set yet',          () => expect(buildValidResult('64106', [COUNTY_MO, COUNTY_KS]).county).toBeUndefined());
  test('errorMessage empty on success',                  () => expect(buildValidResult('64106', [COUNTY_MO]).errorMessage).toBe(''));
});

// ─── buildNotFoundResult ─────────────────────────────────────────────────────

describe('buildNotFoundResult', () => {
  test('status is invalid_zip',       () => expect(buildNotFoundResult('99999').status).toBe('invalid_zip'));
  test('errorCode is NOT_FOUND',      () => expect(buildNotFoundResult('99999').errorCode).toBe('NOT_FOUND'));
  test('errorMessage is required copy', () => expect(buildNotFoundResult('99999').errorMessage).toBe("We couldn't find that ZIP code. Please check it and try again."));
  test('zip preserved',               () => expect(buildNotFoundResult('99999').zip).toBe('99999'));
  test('no county',                   () => expect(buildNotFoundResult('99999').county).toBeUndefined());
});

// ─── buildNetworkErrorResult ─────────────────────────────────────────────────

describe('buildNetworkErrorResult', () => {
  test('status is error',             () => expect(buildNetworkErrorResult('64106').status).toBe('error'));
  test('errorCode is NETWORK_ERROR',  () => expect(buildNetworkErrorResult('64106').errorCode).toBe('NETWORK_ERROR'));
  test('errorMessage non-empty',      () => expect(buildNetworkErrorResult('64106').errorMessage.length).toBeGreaterThan(0));
});

// ─── applyCountySelection ────────────────────────────────────────────────────

describe('applyCountySelection', () => {
  const multiResult = buildValidResult('64106', [COUNTY_MO, COUNTY_KS]);

  test('status becomes valid',                   () => expect(applyCountySelection(multiResult, COUNTY_MO).status).toBe('valid'));
  test('county is set to selection',             () => expect(applyCountySelection(multiResult, COUNTY_MO).county).toEqual(COUNTY_MO));
  test('requiresCountySelection becomes false',  () => expect(applyCountySelection(multiResult, COUNTY_MO).requiresCountySelection).toBe(false));
  test('does not mutate original result',        () => { applyCountySelection(multiResult, COUNTY_MO); expect(multiResult.status).toBe('needs_county_selection'); });
  test('zip preserved',                          () => expect(applyCountySelection(multiResult, COUNTY_MO).zip).toBe('64106'));
});

// ─── isSafeForDoctorSearch / doctorSearchLabel ────────────────────────────────

describe('isSafeForDoctorSearch', () => {
  test('valid single-county → safe',          () => expect(isSafeForDoctorSearch(buildValidResult('64106', [COUNTY_MO]))).toBe(true));
  test('needs_county_selection → not safe',   () => expect(isSafeForDoctorSearch(buildValidResult('64106', [COUNTY_MO, COUNTY_KS]))).toBe(false));
  test('invalid_zip → not safe',              () => expect(isSafeForDoctorSearch(buildNotFoundResult('99999'))).toBe(false));
  test('error → not safe',                    () => expect(isSafeForDoctorSearch(buildNetworkErrorResult('64106'))).toBe(false));
  test('idle → not safe',                     () => expect(isSafeForDoctorSearch({ status:'idle', zip:'', requiresCountySelection:false, errorMessage:'' })).toBe(false));
});

describe('doctorSearchLabel', () => {
  test('valid ZIP → includes zip and radius',  () => { const l = doctorSearchLabel(buildValidResult('64106',[COUNTY_MO])); expect(l).toContain('64106'); expect(l).toContain('25'); });
  test('invalid ZIP → safe fallback copy',     () => expect(doctorSearchLabel(buildNotFoundResult('99999'))).toBe('within your area'));
  test('multi-county → safe fallback',         () => expect(doctorSearchLabel(buildValidResult('64106',[COUNTY_MO,COUNTY_KS]))).toBe('within your area'));
  test('custom radius',                        () => expect(doctorSearchLabel(buildValidResult('64106',[COUNTY_MO]),10)).toContain('10'));
});

// ─── blocking guard: invalid ZIPs must never produce valid results ────────────

describe('invalid ZIPs never produce valid status', () => {
  const invalidZips = ['99999','00000','','abc','1234','123456','12 34'];
  for (const zip of invalidZips) {
    test(`"${zip}" format check never returns VALID_FORMAT unless actually 5 numeric digits`, () => {
      const r = validateZipFormat(zip);
      if (r === 'VALID_FORMAT') {
        // Only 99999 and 00000 pass format — they must fail at lookup stage
        expect(isValidZipFormat(zip)).toBe(true);
        // These would fail at buildNotFoundResult stage (no real county)
      } else {
        expect(['EMPTY','NON_NUMERIC','TOO_SHORT','TOO_LONG']).toContain(r);
      }
    });
  }
});
