import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================
// voice-webhook.ts — Vapi server-side webhook for function calls
// Handles: get_plan_recommendations, check_drug_coverage,
//          transfer_to_agent
//
// PHI boundary summary
// --------------------
// get_plan_recommendations: sends only zip (not PHI) and planType preference.
//   No consumer identifiers. Risk: NONE.
//
// check_drug_coverage: sends zip + drugName. The drug name is health-adjacent
//   information, but it arrives here from Vapi (the voice AI) which already
//   processed it. At this layer we forward only the minimum needed (drug name +
//   zip) to our internal formulary API — no consumer name, DOB, or session ID
//   is included. Risk: LOW (drug name only, no individual linking).
//
// transfer_to_agent: no external call. Returns a static phone number. Risk: NONE.
//
// The boundary functions below make these constraints explicit and prevent
// accidental PHI addition if new Vapi function parameters are introduced.
// ============================================================

const PLANS_API_BASE = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:5000';

// ── PHI boundary functions ────────────────────────────────────────────────────
// Implemented in server/voiceWebhookBoundary.ts (extracted for testability).

import { buildPlanQuery, buildDrugQuery } from "../server/voiceWebhookBoundary";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;

    // Vapi sends different message types
    if (message?.type === 'function-call') {
      const { functionCall } = message;
      const { name, parameters } = functionCall;

      if (name === 'get_plan_recommendations') {
        // PHI boundary: buildPlanQuery whitelists zip + planType only.
        const plansRes = await fetch(
          `${PLANS_API_BASE}/api/plans?${buildPlanQuery(parameters)}`
        );
        const plans = await plansRes.json();

        // Return top 3 as structured response
        const topPlans = (plans.plans || plans || []).slice(0, 3).map((p: any) => ({
          name: p.planName || p.plan_name,
          carrier: p.organization || p.carrier,
          premium: p.premium ?? p.monthlyPremium ?? '$0',
          maxOutOfPocket: p.maxOutOfPocket || p.moop,
          starRating: p.overallRating || p.starRating,
          planType: p.planType || p.type,
          extras: p.benefits || [],
        }));

        return res.status(200).json({
          results: [{
            toolCallId: functionCall.id,
            result: JSON.stringify({
              plans: topPlans,
              total: plans.total || topPlans.length,
              message: topPlans.length > 0
                ? `Found ${topPlans.length} plans in ZIP ${zip}`
                : `No plans found for ZIP ${zip}`,
            }),
          }],
        });
      }

      if (name === 'check_drug_coverage') {
        // PHI boundary: buildDrugQuery whitelists zip + drugName only.
        const drugRes = await fetch(
          `${PLANS_API_BASE}/api/formularyCalculator?${buildDrugQuery(parameters)}`
        );
        const drugData = await drugRes.json();
        const drugName = typeof parameters.drugName === "string" ? parameters.drugName : "";
        const zip      = typeof parameters.zip      === "string" ? parameters.zip      : "";

        return res.status(200).json({
          results: [{
            toolCallId: functionCall.id,
            result: JSON.stringify({
              drug: drugName,
              coverage: drugData,
              message: `Coverage details for ${drugName} in ZIP ${zip}`,
            }),
          }],
        });
      }

      if (name === 'transfer_to_agent') {
        return res.status(200).json({
          results: [{
            toolCallId: functionCall.id,
            result: JSON.stringify({
              transferred: true,
              message: 'Transferring to a licensed Medicare advisor now.',
              phone: '1-800-555-0100',
            }),
          }],
        });
      }

      // Unknown function
      return res.status(200).json({
        results: [{
          toolCallId: functionCall.id,
          result: JSON.stringify({ error: `Unknown function: ${name}` }),
        }],
      });
    }

    // For non-function-call messages (status updates, etc), acknowledge
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Voice webhook error:', (err as Error)?.message ?? 'unknown');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
