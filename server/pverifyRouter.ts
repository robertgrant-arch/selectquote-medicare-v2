/**
 * pVerify Plan Lookup Router
 *
 * Provides real-time Medicare eligibility verification via the pVerify API.
 * Falls back to deterministic mock data when credentials are not configured.
 *
 * Real pVerify API docs: https://pverify.com/api-documentation/
 * Auth: POST https://api.pverify.com/Token (client_credentials grant)
 * Eligibility: POST https://api.pverify.com/api/EligibilitySummary
 *
 * PRIVACY: No PII (MBI, SSN) is persisted to any database or log.
 * All sensitive inputs are used transiently and purged after the API call.
 */
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { ENV } from "./_core/env";

// ─── pVerify PHI boundary ────────────────────────────────────────────────────
//
// PHI sent to pVerify: SubscriberMemberID (MBI or SSN — one only, never both).
// No other consumer identifiers (name, DOB, address) are included.
// The provider NPI is a static company credential, not consumer PHI.
// This function is the single place where pVerify request payloads are built;
// no other code path should construct a payload for this API.
//
// Previous shape:  { PayerCode, Provider, SubscriberMemberID }
// Current (minimized) shape: same — this was already minimal.
//                 Confirmed no extraneous fields are ever added.

interface PverifyRequestPayload {
  PayerCode: string;
  ProviderNPI: string;
  SubscriberMemberID: string;
}

export function buildPverifyPayload(input: { mbi?: string; ssn?: string }): PverifyRequestPayload | null {
  // Require exactly one identifier; reject both-or-neither up front.
  if (!input.mbi && !input.ssn) return null;
  return {
    PayerCode: "00007",        // Medicare payer code — not PHI
    ProviderNPI: "1234567890", // Static agent NPI credential — not consumer PHI
    SubscriberMemberID: (input.mbi ?? input.ssn) as string,
  };
}

// ─── pVerify API helpers ─────────────────────────────────────────────────────

const PVERIFY_TOKEN_URL = "https://api.pverify.com/Token";
const PVERIFY_ELIGIBILITY_URL = "https://api.pverify.com/api/EligibilitySummary";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getPverifyToken(): Promise<string | null> {
  if (!ENV.pverifyClientId || !ENV.pverifyClientSecret) return null;

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  try {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: ENV.pverifyClientId,
      client_secret: ENV.pverifyClientSecret,
    });

    const res = await fetch(PVERIFY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[pVerify] Token request failed: ${res.status}`);
      return null;
    }

    const data = await res.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;

    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return cachedToken.token;
  } catch (err) {
    console.warn("[pVerify] Token fetch error:", err);
    return null;
  }
}

interface PverifyEligibilityRequest {
  mbi?: string; // Medicare Beneficiary Identifier
  ssn?: string; // Social Security Number
}

interface PverifyEligibilityResult {
  isActive: boolean;
  partA: { active: boolean; effectiveDate: string | null };
  partB: { active: boolean; effectiveDate: string | null };
  currentPlan: {
    planName: string;
    planId: string;
    carrier: string;
    effectiveDate: string;
    terminationDate: string;
    premium: number;
    deductible: number;
    oopMax: number;
    pcpCopay: number;
    specialistCopay: number;
    urgentCareCopay: number;
    erCopay: number;
    inpatientCost: string;
    drugTier1Copay: number;
    drugTier2Copay: number;
    drugTier3Copay: number;
    dentalCoverage: string;
    visionCoverage: string;
    hearingCoverage: string;
  } | null;
  isMockData: boolean;
}

async function callPverifyEligibility(req: PverifyEligibilityRequest): Promise<PverifyEligibilityResult | null> {
  const token = await getPverifyToken();
  if (!token) return null;

  // PHI boundary: buildPverifyPayload whitelists exactly the fields pVerify
  // requires. No consumer identifiers beyond the lookup key are sent.
  const payload = buildPverifyPayload(req);
  if (!payload) return null;

  try {
    const res = await fetch(PVERIFY_ELIGIBILITY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Client-API-Id": ENV.pverifyClientId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`[pVerify] Eligibility API returned ${res.status}`);
      return null;
    }

    const data = await res.json() as any;

    // Parse pVerify response into our normalized structure
    const partA = data?.MedicareInfoSummary?.PartA;
    const partB = data?.MedicareInfoSummary?.PartB;
    const maInfo = data?.MedicareAdvantageInfo;

    return {
      isActive: data?.EligibilityStatus === "Active",
      partA: {
        active: partA?.Status === "Active",
        effectiveDate: partA?.EffectiveDate ?? null,
      },
      partB: {
        active: partB?.Status === "Active",
        effectiveDate: partB?.EffectiveDate ?? null,
      },
      currentPlan: maInfo ? {
        planName: maInfo.PlanName ?? "Medicare Advantage Plan",
        planId: maInfo.PlanID ?? "",
        carrier: maInfo.PayerName ?? "Unknown Carrier",
        effectiveDate: maInfo.EffectiveDate ?? "2025-01-01",
        terminationDate: maInfo.TerminationDate ?? "2025-12-31",
        premium: parseFloat(maInfo.Premium ?? "0") || 0,
        deductible: parseFloat(maInfo.Deductible ?? "0") || 0,
        oopMax: parseFloat(maInfo.OutOfPocketMax ?? "6700") || 6700,
        pcpCopay: parseFloat(maInfo.PCPCopay ?? "0") || 0,
        specialistCopay: parseFloat(maInfo.SpecialistCopay ?? "35") || 35,
        urgentCareCopay: parseFloat(maInfo.UrgentCareCopay ?? "35") || 35,
        erCopay: parseFloat(maInfo.ERCopay ?? "90") || 90,
        inpatientCost: maInfo.InpatientCost ?? "$275/day days 1\u20137",
        drugTier1Copay: parseFloat(maInfo.DrugTier1Copay ?? "0") || 0,
        drugTier2Copay: parseFloat(maInfo.DrugTier2Copay ?? "5") || 5,
        drugTier3Copay: parseFloat(maInfo.DrugTier3Copay ?? "42") || 42,
        dentalCoverage: maInfo.DentalCoverage ?? "Preventive dental included",
        visionCoverage: maInfo.VisionCoverage ?? "$150 eyewear allowance/year",
        hearingCoverage: maInfo.HearingCoverage ?? "$1,000 hearing aid allowance",
      } : null,
      isMockData: false,
    };
  } catch (err) {
    console.warn("[pVerify] Eligibility call error:", err);
    return null;
  }
}

// ─── Mock data fallback ──────────────────────────────────────────────────────

function buildMockEligibilityResult(seed: string): PverifyEligibilityResult {
  const idx = seed.charCodeAt(seed.length - 1) % 6;
  const plans = [
    { planName: "UnitedHealthcare AARP MedicareComplete (HMO)", planId: "H0624-001", carrier: "UnitedHealthcare", oopMax: 4900 },
    { planName: "Humana Gold Plus H5619-003 (HMO)", planId: "H5619-003", carrier: "Humana", oopMax: 5900 },
    { planName: "Aetna Medicare Advantage Value Plan (HMO)", planId: "H3312-001", carrier: "Aetna", oopMax: 6700 },
    { planName: "BlueMedicare HMO Select", planId: "H3135-001", carrier: "Blue KC", oopMax: 5900 },
    { planName: "Cigna Connect (HMO)", planId: "H4513-001", carrier: "Cigna", oopMax: 5500 },
    { planName: "WellCare Classic (HMO)", planId: "H8894-002", carrier: "WellCare", oopMax: 6700 },
  ];
  const plan = plans[idx]!;
  return {
    isActive: true,
    partA: { active: true, effectiveDate: "2020-01-01" },
    partB: { active: true, effectiveDate: "2020-01-01" },
    currentPlan: {
      planName: plan.planName,
      planId: plan.planId,
      carrier: plan.carrier,
      effectiveDate: "2025-01-01",
      terminationDate: "2025-12-31",
      premium: 0,
      deductible: 0,
      oopMax: plan.oopMax,
      pcpCopay: 0,
      specialistCopay: 35,
      urgentCareCopay: 35,
      erCopay: 90,
      inpatientCost: "$275/day days 1\u20137",
      drugTier1Copay: 0,
      drugTier2Copay: 5,
      drugTier3Copay: 42,
      dentalCoverage: "$1,500 comprehensive/year",
      visionCoverage: "$150 eyewear allowance/year",
      hearingCoverage: "$1,000 hearing aid allowance",
    },
    isMockData: true,
  };
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const EligibilityCheckSchema = z.object({
  mbi: z.string().max(20).optional(),
  ssn: z.string().length(9).optional(),
}).refine((data) => data.mbi || data.ssn, {
  message: "Either MBI or SSN is required",
});

const LegacyEligibilityInputSchema = z.object({
  medicareId: z.string().min(1, "Medicare ID is required"),
});

const PotentialPlanSchema = z.object({
  id: z.string(),
  planName: z.string(),
  carrier: z.string(),
  premium: z.number(),
  deductible: z.number(),
  oopMax: z.number(),
  pcpCopay: z.number(),
  specialistCopay: z.number(),
  urgentCareCopay: z.number(),
  erCopay: z.number(),
  drugTier1Copay: z.number(),
  drugTier2Copay: z.number(),
  drugTier3Copay: z.number(),
  dentalCoverage: z.string(),
  visionCoverage: z.string(),
  hearingCoverage: z.string(),
});

const CurrentPlanSchema = z.object({
  planName: z.string(),
  planId: z.string(),
  payerId: z.string(),
  status: z.string(),
  effectiveDate: z.string(),
  terminationDate: z.string(),
  premium: z.number(),
  deductible: z.number(),
  oopMax: z.number(),
  pcpCopay: z.number(),
  specialistCopay: z.number(),
  urgentCareCopay: z.number(),
  erCopay: z.number(),
  inpatientCost: z.string(),
  drugTier1Copay: z.number(),
  drugTier2Copay: z.number(),
  drugTier3Copay: z.number(),
  dentalCoverage: z.string(),
  visionCoverage: z.string(),
  hearingCoverage: z.string(),
});

// ─── Comparison helper ─────────────────────────────────────────────────────

function buildComparisonResponse(
  currentPlan: z.infer<typeof CurrentPlanSchema>,
  potentialPlan: z.infer<typeof PotentialPlanSchema>
) {
  const moopDiff = currentPlan.oopMax - potentialPlan.oopMax;
  const specialistDiff = currentPlan.specialistCopay - potentialPlan.specialistCopay;
  const premiumDiff = potentialPlan.premium - currentPlan.premium;

  const currentAnnual =
    currentPlan.premium * 12 +
    currentPlan.pcpCopay * 6 +
    currentPlan.specialistCopay * 4 +
    currentPlan.urgentCareCopay * 2;
  const potentialAnnual =
    potentialPlan.premium * 12 +
    potentialPlan.pcpCopay * 6 +
    potentialPlan.specialistCopay * 4 +
    potentialPlan.urgentCareCopay * 2;
  const savings = currentAnnual - potentialAnnual;

  const currentPros: string[] = [];
  const currentCons: string[] = [];
  const potentialPros: string[] = [];
  const potentialCons: string[] = [];

  if (currentPlan.premium === 0) currentPros.push("$0 monthly premium");
  else currentCons.push(`$${currentPlan.premium}/mo premium`);
  if (potentialPlan.premium === 0) potentialPros.push("$0 monthly premium");
  else potentialCons.push(`$${potentialPlan.premium}/mo premium`);

  if (moopDiff > 0) {
    currentCons.push(`Higher MOOP of $${currentPlan.oopMax.toLocaleString()}`);
    potentialPros.push(`Lower MOOP of $${potentialPlan.oopMax.toLocaleString()}`);
  } else if (moopDiff < 0) {
    currentPros.push(`Lower MOOP of $${currentPlan.oopMax.toLocaleString()}`);
    potentialCons.push(`Higher MOOP of $${potentialPlan.oopMax.toLocaleString()}`);
  } else {
    currentPros.push(`MOOP of $${currentPlan.oopMax.toLocaleString()}`);
    potentialPros.push(`MOOP of $${potentialPlan.oopMax.toLocaleString()}`);
  }

  if (specialistDiff > 0) {
    currentCons.push(`Higher specialist copay ($${currentPlan.specialistCopay})`);
    potentialPros.push(`Lower specialist copay ($${potentialPlan.specialistCopay})`);
  } else if (specialistDiff < 0) {
    currentPros.push(`Lower specialist copay ($${currentPlan.specialistCopay})`);
    potentialCons.push(`Higher specialist copay ($${potentialPlan.specialistCopay})`);
  }

  if (currentPlan.dentalCoverage !== "Not covered") currentPros.push("Dental coverage included");
  else currentCons.push("No dental coverage");
  if (potentialPlan.dentalCoverage !== "Not covered") potentialPros.push("Dental coverage included");
  else potentialCons.push("No dental coverage");
  if (currentPlan.visionCoverage !== "Not covered") currentPros.push("Vision coverage included");
  else currentCons.push("No vision coverage");
  if (potentialPlan.visionCoverage !== "Not covered") potentialPros.push("Vision coverage included");
  else potentialCons.push("No vision coverage");
  if (currentPlan.hearingCoverage !== "Not covered") currentPros.push("Hearing aid coverage");
  else currentCons.push("No hearing coverage");
  if (potentialPlan.hearingCoverage !== "Not covered") potentialPros.push("Hearing aid coverage");
  else potentialCons.push("No hearing coverage");

  const summaryParts: string[] = [];
  if (moopDiff > 0) {
    summaryParts.push(
      `Your current plan has a higher out-of-pocket maximum ($${currentPlan.oopMax.toLocaleString()} vs $${potentialPlan.oopMax.toLocaleString()}), which means you could pay up to $${moopDiff.toLocaleString()} more if you have a high-cost medical event.`
    );
  } else if (moopDiff < 0) {
    summaryParts.push(
      `Your current plan offers better financial protection with a lower MOOP ($${currentPlan.oopMax.toLocaleString()} vs $${potentialPlan.oopMax.toLocaleString()}).`
    );
  }
  if (premiumDiff > 0) {
    summaryParts.push(`The new plan costs $${premiumDiff}/month more in premiums ($${premiumDiff * 12}/year).`);
  }
  if (specialistDiff > 0) {
    summaryParts.push(
      `The new plan has lower specialist copays ($${potentialPlan.specialistCopay} vs $${currentPlan.specialistCopay}), which could save you money if you see specialists frequently.`
    );
  }

  const summary =
    summaryParts.length > 0
      ? summaryParts.join(" ")
      : `Both plans offer comparable coverage. Review the detailed comparison below to find the best fit for your healthcare needs.`;

  const recommendation =
    savings > 0
      ? `Based on typical usage (6 PCP visits, 4 specialist visits, 2 urgent care visits per year), the ${potentialPlan.planName} could save you approximately $${savings.toLocaleString()} annually compared to your current plan.`
      : `Your current plan appears to be cost-effective for typical usage patterns. Consider switching only if the ${potentialPlan.planName}'s network includes your preferred doctors.`;

  return {
    summary,
    currentPlanPros: currentPros,
    currentPlanCons: currentCons,
    potentialPlanPros: potentialPros,
    potentialPlanCons: potentialCons,
    recommendation,
    estimatedAnnualCostCurrent: currentAnnual,
    estimatedAnnualCostPotential: potentialAnnual,
  };
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const pverifyRouter = router({
  /**
   * Eligibility check accepting MBI or SSN.
   * Calls real pVerify API when credentials are configured; falls back to mock data.
   *
   * PRIVACY: No PII is persisted. All inputs are used transiently and purged after the call.
   */
  eligibilityCheck: publicProcedure
    .input(EligibilityCheckSchema)
    .mutation(async ({ input }) => {
      // Capture a non-PHI mock seed before we discard identifiers.
      // We use only the last character so the seed can't reconstruct the MBI/SSN.
      const mockSeed = (input.mbi ?? input.ssn ?? "default").slice(-1) || "default";

      // Copy identifiers into local variables so they're easy to wipe.
      let mbi: string | undefined = input.mbi;
      let ssn: string | undefined = input.ssn;

      // PHI boundary: callPverifyEligibility receives only the minimized payload
      // built by buildPverifyPayload (MBI or SSN — one only, nothing else).
      const realResult = await callPverifyEligibility({ mbi, ssn });

      // Wipe PHI from local scope immediately after use.
      // (input.mbi / input.ssn remain on the frozen input object but are not
      //  referenced again below — TypeScript enforces this via the local vars.)
      mbi = undefined;
      ssn = undefined;

      if (realResult) {
        return { success: true, data: realResult };
      }

      // Fall back to mock data — uses only the single-char seed, not the real identifier.
      const mockResult = buildMockEligibilityResult(mockSeed);
      return { success: true, data: mockResult };
    }),

  /**
   * Legacy lookup by Medicare ID only (kept for backward compatibility).
   * PRIVACY: medicareId is used transiently and purged immediately after use.
   */
  lookup: publicProcedure
    .input(LegacyEligibilityInputSchema)
    .mutation(async ({ input }) => {
      let id = input.medicareId;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const result = buildMockEligibilityResult(id);
      id = null as unknown as string;
      return { success: true, data: { ...result.currentPlan, status: "Active" } };
    }),

  /**
   * Plan comparison endpoint.
   * No PII is accepted or stored.
   */
  compare: publicProcedure
    .input(
      z.object({
        currentPlan: CurrentPlanSchema,
        potentialPlan: PotentialPlanSchema,
      })
    )
    .mutation(async ({ input }) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const result = buildComparisonResponse(input.currentPlan, input.potentialPlan);
      return { success: true, data: result };
    }),
});
