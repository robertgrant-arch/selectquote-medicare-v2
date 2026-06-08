// Pure functions — zero side-effects, fully testable in node.

export type ZipFormatError = 'EMPTY'|'NON_NUMERIC'|'TOO_SHORT'|'TOO_LONG'|'VALID_FORMAT';
export type ZipLookupError = 'NOT_FOUND'|'NETWORK_ERROR'|'SERVER_ERROR';
export interface ZipCounty { name: string; state: string; fips?: string; }
export type ZipValidationStatus = 'idle'|'checking_format'|'checking_lookup'|'needs_county_selection'|'valid'|'invalid_format'|'invalid_zip'|'error';
export interface ZipValidationResult { status: ZipValidationStatus; zip: string; county?: ZipCounty; counties?: ZipCounty[]; requiresCountySelection: boolean; errorCode?: ZipFormatError|ZipLookupError; errorMessage: string; }

export function validateZipFormat(zip: string): ZipFormatError {
  if (!zip || zip.trim().length === 0) return 'EMPTY';
  const t = zip.trim();
  if (!/^\d+$/.test(t)) return 'NON_NUMERIC';
  if (t.length < 5) return 'TOO_SHORT';
  if (t.length > 5) return 'TOO_LONG';
  return 'VALID_FORMAT';
}
export function isValidZipFormat(zip: string): boolean { return validateZipFormat(zip) === 'VALID_FORMAT'; }

const FORMAT_MESSAGES: Record<ZipFormatError, string> = {
  EMPTY:        'Please enter your 5-digit ZIP code.',
  NON_NUMERIC:  'ZIP codes contain only numbers. Please check and try again.',
  TOO_SHORT:    'ZIP codes are 5 digits. You entered fewer — please check and try again.',
  TOO_LONG:     'ZIP codes are 5 digits. You entered more — please check and try again.',
  VALID_FORMAT: '',
};
const LOOKUP_MESSAGES: Record<ZipLookupError, string> = {
  NOT_FOUND:    "We couldn't find that ZIP code. Please check it and try again.",
  NETWORK_ERROR:"We couldn't validate your ZIP code right now. Please try again.",
  SERVER_ERROR: "We couldn't validate your ZIP code. Please try again.",
};
export function getZipErrorMessage(code: ZipFormatError|ZipLookupError): string {
  if (code in FORMAT_MESSAGES) return FORMAT_MESSAGES[code as ZipFormatError];
  return LOOKUP_MESSAGES[code as ZipLookupError] ?? "We couldn't find that ZIP code. Please check it and try again.";
}

export function buildInvalidFormatResult(zip: string, code: ZipFormatError): ZipValidationResult {
  return { status:'invalid_format', zip, requiresCountySelection:false, errorCode:code, errorMessage:getZipErrorMessage(code) };
}
export function buildNotFoundResult(zip: string): ZipValidationResult {
  return { status:'invalid_zip', zip, requiresCountySelection:false, errorCode:'NOT_FOUND', errorMessage:getZipErrorMessage('NOT_FOUND') };
}
export function buildNetworkErrorResult(zip: string): ZipValidationResult {
  return { status:'error', zip, requiresCountySelection:false, errorCode:'NETWORK_ERROR', errorMessage:getZipErrorMessage('NETWORK_ERROR') };
}
export function buildValidResult(zip: string, counties: ZipCounty[]): ZipValidationResult {
  if (counties.length === 0) return buildNotFoundResult(zip);
  if (counties.length === 1) return { status:'valid', zip, county:counties[0], counties, requiresCountySelection:false, errorMessage:'' };
  return { status:'needs_county_selection', zip, counties, requiresCountySelection:true, errorMessage:'' };
}
export function applyCountySelection(result: ZipValidationResult, county: ZipCounty): ZipValidationResult {
  return { ...result, status:'valid', county, requiresCountySelection:false, errorMessage:'' };
}
export function isSafeForDoctorSearch(result: ZipValidationResult): boolean {
  return result.status === 'valid' && !result.requiresCountySelection;
}
export function doctorSearchLabel(result: ZipValidationResult, radiusMiles = 25): string {
  if (!isSafeForDoctorSearch(result)) return 'within your area';
  return `within ${radiusMiles} miles of ${result.zip}`;
}
