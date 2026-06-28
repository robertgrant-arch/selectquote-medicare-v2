import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================
// voice-webhook.ts — Vapi server-side webhook for function calls
// Handles: get_plan_recommendations, check_drug_coverage,
//          transfer_to_agent
// ============================================================

const PLANS_API_BASE = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:5000';

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
        const { zip, planType, priority } = parameters;
        const plansRes = await fetch(
          `${PLANS_API_BASE}/api/plans?zip=${zip}&type=${planType || ''}`
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
        const { drugName, zip } = parameters;
        const drugRes = await fetch(
          `${PLANS_API_BASE}/api/formularyCalculator?zip=${zip}&drugs=${encodeURIComponent(drugName)}`
        );
        const drugData = await drugRes.json();

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
