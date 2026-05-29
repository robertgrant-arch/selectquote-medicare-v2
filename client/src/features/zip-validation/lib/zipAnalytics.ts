function sid(): string {
  try { let id = sessionStorage.getItem('zv_sid'); if (!id) { id = crypto.randomUUID?.() ?? `${Date.now()}`; sessionStorage.setItem('zv_sid', id); } return id; } catch { return 'unknown'; }
}
function emit(ev: string, zip: string, extra?: object) {
  if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function')
    (window as any).gtag('event', `zip_${ev}`, { zip_entered: zip, session_id: sid(), ...extra });
}
export const trackZipSubmitted       = (zip: string) => emit('submitted', zip);
export const trackZipFormatError     = (zip: string, code: string) => emit('format_error', zip, { error_code: code });
export const trackZipNotFound        = (zip: string) => emit('not_found', zip);
export const trackZipValid           = (zip: string, county: string) => emit('valid', zip, { county });
export const trackCountySelectionShown = (zip: string, count: number) => emit('county_selection_shown', zip, { county_count: count });
export const trackCountySelected     = (zip: string, county: string) => emit('county_selected', zip, { county });
export const trackZipNetworkError    = (zip: string) => emit('network_error', zip);
