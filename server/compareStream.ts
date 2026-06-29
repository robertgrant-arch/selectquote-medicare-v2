/**
 * Streaming AI Plan Comparison — Express SSE endpoint
 * POST /api/compare-stream
 *
 * Accepts two or three plan objects, calls Claude claude-haiku-4-5 with streaming,
 * and forwards each text delta as a Server-Sent Events (SSE) stream.
 *
 * The client-side comparison TABLE is built instantly from plan data (no API wait).
 * This endpoint only provides the AI narrative that streams in progressively.
 */

import { Router, Request, Response, type Express } from "express";
import { z } from "zod";

// ── Shared plan schema ────────────────────────────────────────────────────────

const BenefitDetailSchema = z.object({
  covered: z.boolean(),
  details: z.string(),
  annualLimit: z.string().optional(),
});

const PlanInputSchema = z.object({
  id: z.string(),
  carrier: z.string(),
  planName: z.string(),
  planType: z.string(),
  snpType: z.string().optional(),
  premium: z.number(),
  deductible: z.number(),
  maxOutOfPocket: z.number(),
  partBPremiumReduction: z.number(),
  starRating: z.object({
    overall: z.number(),
    customerService: z.number().optional(),
    drugPlan: z.number().optional(),
    memberComplaints: z.number().optional(),
  }),
  copays: z.object({
    primaryCare: z.string(),
    specialist: z.string(),
    urgentCare: z.string(),
    emergency: z.string(),
    inpatientHospital: z.string(),
    outpatientSurgery: z.string(),
  }),
  rxDrugs: z.object({
    tier1: z.string(),
    tier2: z.string(),
    tier3: z.string(),
    tier4: z.string(),
    deductible: z.string(),
    gap: z.boolean(),
  }),
  extraBenefits: z.object({
    dental: BenefitDetailSchema,
    vision: BenefitDetailSchema,
    hearing: BenefitDetailSchema,
    otc: BenefitDetailSchema,
    fitness: BenefitDetailSchema,
    transportation: BenefitDetailSchema,
    telehealth: BenefitDetailSchema,
    meals: BenefitDetailSchema,
  }),
  networkSize: z.number(),
  enrollmentPeriod: z.string(),
  effectiveDate: z.string(),
  isBestMatch: z.boolean().optional(),
  isMostPopular: z.boolean().optional(),
  isNewPlan: z.boolean().optional(),
  contractId: z.string().optional(),
  planId: z.string().optional(),
});

type PlanInput = z.infer<typeof PlanInputSchema>;

// ── PHI boundary ─────────────────────────────────────────────────────────────
//
// PHI risk for this integration: NONE.
// Payloads sent to the AI contain only public plan data: carrier name, plan
// name, plan type, premium, copays, star ratings, benefit flags, and network
// size. No consumer identifiers (name, DOB, MBI, SSN, medications, providers,
// or ZIP) are included in the prompt.
//
// The "CURRENT PLAN" label refers to a plan record the user is comparing,
// not to the user's personal record from pVerify or any other PHI source.
//
// Previous shape → Current (minimized) shape: unchanged — already PHI-free.
// Risk before → after: NONE → NONE (confirmed + documented).

// ── Prompt builders ───────────────────────────────────────────────────────────

function benefitList(p: PlanInput): string {
  const benefits: string[] = [];
  if (p.extraBenefits.dental.covered) benefits.push(`Dental (${p.extraBenefits.dental.details})`);
  if (p.extraBenefits.vision.covered) benefits.push(`Vision (${p.extraBenefits.vision.details})`);
  if (p.extraBenefits.hearing.covered) benefits.push(`Hearing (${p.extraBenefits.hearing.details})`);
  if (p.extraBenefits.otc.covered) benefits.push(`OTC (${p.extraBenefits.otc.details})`);
  if (p.extraBenefits.fitness.covered) benefits.push("Fitness");
  if (p.extraBenefits.transportation.covered) benefits.push("Transportation");
  if (p.extraBenefits.telehealth.covered) benefits.push("Telehealth");
  if (p.extraBenefits.meals.covered) benefits.push("Meals after hospital");
  return benefits.join(", ") || "None";
}

function planSummary(p: PlanInput, label: string): string {
  return `${label}: ${p.planName} (${p.carrier}, ${p.planType})
- Premium: $${p.premium}/mo | Deductible: $${p.deductible} | MOOP: $${p.maxOutOfPocket.toLocaleString()}
- PCP: ${p.copays.primaryCare} | Specialist: ${p.copays.specialist} | ER: ${p.copays.emergency}
- Rx: T1 ${p.rxDrugs.tier1} / T2 ${p.rxDrugs.tier2} / T3 ${p.rxDrugs.tier3} / T4 ${p.rxDrugs.tier4} | Gap: ${p.rxDrugs.gap ? "Yes" : "No"}
- Stars: ${p.starRating.overall}/5 | Network: ${p.networkSize.toLocaleString()}+ providers
- Extra benefits: ${benefitList(p)}`;
}

/** 2-plan prompt (backward-compatible) */
function build2PlanPrompt(current: PlanInput, newPlan: PlanInput): string {
  return `You are a Medicare Advantage expert. Compare these two plans concisely. The user already sees a full data table — provide ONLY the narrative analysis below.

${planSummary(current, "CURRENT PLAN")}

${planSummary(newPlan, "NEW PLAN")}

Respond in EXACTLY this markdown format (keep each section brief):

## Quick Summary
2-3 sentences summarizing the key trade-offs in plain language.

## Key Differences
- **Cost:** [1-2 sentences on premium/MOOP/copay differences]
- **Rx Drugs:** [1-2 sentences on drug coverage differences]
- **Extra Benefits:** [what's gained or lost switching plans]
- **Network:** [HMO vs PPO implications if different, or network size note]
- **Quality:** [star rating comparison and what it means]

## Recommendation
1 short paragraph with a clear recommendation. Who should switch? Who should stay? Be specific.`;
}

/** 3-plan prompt */
function build3PlanPrompt(current: PlanInput, plan2: PlanInput, plan3: PlanInput): string {
  return `You are a Medicare Advantage expert. Compare these three plans concisely. The user already sees a full side-by-side data table — provide ONLY the narrative analysis below.

${planSummary(current, "PLAN 1 (Current Plan)")}

${planSummary(plan2, "PLAN 2 (New Plan 1)")}

${planSummary(plan3, "PLAN 3 (New Plan 2)")}

Respond in EXACTLY this markdown format (keep each section brief):

## Quick Summary
2-3 sentences summarizing the overall landscape across all three plans.

## Key Differences
- **Cost:** [Compare premiums, deductibles, and MOOP across all three]
- **Rx Drugs:** [Drug coverage differences across all three]
- **Extra Benefits:** [Notable differences in dental, vision, OTC, fitness, etc.]
- **Network:** [HMO/PPO differences and network size comparison]
- **Quality:** [Star rating comparison across all three plans]

## Recommendation
1 short paragraph naming which plan is best and for whom. Be specific — mention the plan names and the type of beneficiary each suits best.`;
}

// ── SSE streaming helper ──────────────────────────────────────────────────────

function sendSSE(res: Response, event: string, data: string) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerCompareStreamRoute(app: Express) {
  const streamRouter = Router();

  streamRouter.post("/", async (req: Request, res: Response) => {
    // Validate input — thirdPlan is optional for backward compatibility
    const parseResult = z
      .object({
        currentPlan: PlanInputSchema,
        newPlan: PlanInputSchema,
        thirdPlan: PlanInputSchema.optional(),
      })
      .safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({ error: "Invalid plan data", details: parseResult.error.flatten() });
      return;
    }

    const { currentPlan, newPlan, thirdPlan } = parseResult.data;

    if (currentPlan.id === newPlan.id) {
      res.status(400).json({ error: "Please select different plans to compare." });
      return;
    }

    if (thirdPlan && (thirdPlan.id === currentPlan.id || thirdPlan.id === newPlan.id)) {
      res.status(400).json({ error: "Please select three different plans to compare." });
      return;
    }

    const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL;
    const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY;
    if (!forgeApiUrl || !forgeApiKey) {
      res.status(500).json({ error: "Forge API is not configured." });
      return;
    }

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
    res.flushHeaders();

    try {
      const prompt = thirdPlan
        ? build3PlanPrompt(currentPlan, newPlan, thirdPlan)
        : build2PlanPrompt(currentPlan, newPlan);

      // Call Forge API (OpenAI-compatible) with streaming
      // 120s timeout: streaming responses can take up to 2 minutes for complex comparisons
      const forgeRes = await fetch(`${forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "authorization": `Bearer ${forgeApiKey}`,
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: thirdPlan ? 1280 : 1024,
          stream: true,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!forgeRes.ok) {
        const errorText = await forgeRes.text();
        sendSSE(res, "error", `AI API error: ${forgeRes.status} — ${errorText.slice(0, 200)}`);
        res.end();
        return;
      }

      // Stream the response body line by line (OpenAI-compatible SSE format)
      const reader = forgeRes.body?.getReader();
      if (!reader) {
        sendSSE(res, "error", "No response body from AI");
        res.end();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let doneSent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") {
            if (!doneSent) { sendSSE(res, "done", ""); doneSent = true; }
            continue;
          }

          try {
            const event = JSON.parse(dataStr) as {
              choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
            };

            const content = event.choices?.[0]?.delta?.content;
            if (content) {
              sendSSE(res, "delta", content);
            }
            if (event.choices?.[0]?.finish_reason === "stop") {
              if (!doneSent) { sendSSE(res, "done", ""); doneSent = true; }
            }
          } catch (jsonErr) {
            console.warn("[compareStream] Malformed JSON line from AI stream, skipping");
          }
        }
      }

      // Ensure done event is sent if not already
      if (!doneSent) {
        sendSSE(res, "done", "");
      }
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendSSE(res, "error", `Streaming error: ${message}`);
      res.end();
    }
  });

  app.use("/api/compare-stream", streamRouter);
}
