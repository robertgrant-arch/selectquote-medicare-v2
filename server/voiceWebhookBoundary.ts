/**
 * PHI boundary functions for the Vapi voice webhook.
 *
 * Extracted from api/voice-webhook.ts so this logic is independently testable
 * without requiring @vercel/node runtime types.
 *
 * PHI guarantee: Only the two whitelisted fields per function are forwarded
 * to internal APIs. Any extra parameters Vapi adds in the future are silently
 * discarded at this boundary.
 */

/** Builds the query string for plan lookups. Only zip and planType are forwarded. */
export function buildPlanQuery(params: Record<string, unknown>): string {
  const zip = typeof params.zip === "string" ? params.zip.trim() : "";
  const planType =
    typeof params.planType === "string" ? params.planType.trim() : "";
  // Whitelist: zip (not PHI), planType (not PHI). All other params discarded.
  return `zip=${encodeURIComponent(zip)}&type=${encodeURIComponent(planType)}`;
}

/** Builds the query string for drug coverage lookups. Only zip and drugName are forwarded. */
export function buildDrugQuery(params: Record<string, unknown>): string {
  const zip = typeof params.zip === "string" ? params.zip.trim() : "";
  const drugName =
    typeof params.drugName === "string" ? params.drugName.trim() : "";
  // drugName is health-adjacent but is the minimum required for formulary lookup.
  // No consumer identifier (name, DOB, session ID) is included.
  return `zip=${encodeURIComponent(zip)}&drugs=${encodeURIComponent(drugName)}`;
}
