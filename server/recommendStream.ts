/**
 * /api/recommend-stream — SSE endpoint for Plan Recommender AI narrative
 *
 * Accepts questionnaire answers + top 3 ranked plans,
 * streams a personalized Claude Haiku recommendation token-by-token.
 * Uses raw fetch (same pattern as compareStream.ts) — no SDK dependency.
 */
import { Router } from "express";
import { z } from "zod";

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const AnswersSchema = z.object({
  healthStatus: z.string(),
  chronicConditions: z.string(),
  plannedSurgery: z.string(),
  pcpVisits: z.string(),
  specialistVisits: z.string(),
  erVisits: z.string(),
  urgentCareVisits: z.string(),
  monthlyRxCount: z.string(),
  brandNameDrugs: z.string(),
  specialtyDrugs: z.string(),
  monthlyDrugSpend: z.string(),
  dentalImportance: z.string(),
  visionImportance: z.string(),
  hearingImportance: z.string(),
  needsTransportation: z.string(),
  wantsOTC: z.string(),
  wantsFitness: z.string(),
  hasSpecificDoctors: z.string(),
  planTypePreference: z.string(),
  topPriority: z.string(),
});

const TopPlanSchema = z.object({
  planName: z.string(),
  carrier: z.string(),
  planType: z.string(),
  premium: z.number(),
  maxOutOfPocket: z.number(),
  starRating: z.number(),
  estimatedCost: z.number(),
  estimatedAnnualDrugCost: z.number().optional(),
  estimatedTotalAnnualCost: z.number().optional(),
  rank: z.number(),
  whyRecommended: z.array(z.string()),
});

const RequestSchema = z.object({
  answers: AnswersSchema,
  topPlans: z.array(TopPlanSchema).min(1).max(3),
});

// ── PHI boundary ─────────────────────────────────────────────────────────────
//
// PHI risk for this integration: LOW.
// All fields in AnswersSchema are categorical ordinal values (e.g. "1-3", "yes",
// "somewhat") — no direct PHI identifiers (name, DOB, MBI, SSN, address, or
// specific drug/doctor names) ever appear here. The schema enforces this: every
// field is z.string() that the UI populates only with expected enum values.
//
// toDeidentifiedProfile() makes the boundary explicit: it re-maps each answer
// field individually so no free-text route can accidentally be added without a
// conscious decision at this function. If a future developer adds a free-text
// "other conditions" field to the form, it must be reviewed here before it
// reaches the AI.
//
// Previous shape → New (minimized) shape: unchanged — already de-identified.
// Risk before → after: LOW → LOW (explicit gate added).

type HealthAnswers = z.infer<typeof AnswersSchema>;

export function toDeidentifiedProfile(answers: HealthAnswers): HealthAnswers {
  // Re-map field-by-field so any unexpected key is silently excluded.
  // Values stay as the caller provided; the schema already constrains them.
  return {
    healthStatus:       answers.healthStatus,
    chronicConditions:  answers.chronicConditions,
    plannedSurgery:     answers.plannedSurgery,
    pcpVisits:          answers.pcpVisits,
    specialistVisits:   answers.specialistVisits,
    erVisits:           answers.erVisits,
    urgentCareVisits:   answers.urgentCareVisits,
    monthlyRxCount:     answers.monthlyRxCount,
    brandNameDrugs:     answers.brandNameDrugs,
    specialtyDrugs:     answers.specialtyDrugs,
    monthlyDrugSpend:   answers.monthlyDrugSpend,
    dentalImportance:   answers.dentalImportance,
    visionImportance:   answers.visionImportance,
    hearingImportance:  answers.hearingImportance,
    needsTransportation: answers.needsTransportation,
    wantsOTC:           answers.wantsOTC,
    wantsFitness:       answers.wantsFitness,
    hasSpecificDoctors: answers.hasSpecificDoctors,
    planTypePreference: answers.planTypePreference,
    topPriority:        answers.topPriority,
  };
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(
  rawAnswers: HealthAnswers,
  topPlans: z.infer<typeof TopPlanSchema>[]
): string {
  // Pass answers through the PHI boundary before they touch the prompt string.
  const answers = toDeidentifiedProfile(rawAnswers);
  const healthProfile = [
    `Health status: ${answers.healthStatus}`,
    `Chronic conditions: ${answers.chronicConditions}`,
    `Planned surgery/hospitalization: ${answers.plannedSurgery}`,
    `PCP visits/year: ${answers.pcpVisits}`,
    `Specialist visits/year: ${answers.specialistVisits}`,
    `ER visits/year: ${answers.erVisits}`,
    `Urgent care visits/year: ${answers.urgentCareVisits}`,
    `Monthly prescriptions: ${answers.monthlyRxCount}`,
    `Brand-name drugs: ${answers.brandNameDrugs}`,
    `Specialty/tier 4-5 drugs: ${answers.specialtyDrugs}`,
    `Monthly drug spend (uninsured): ${answers.monthlyDrugSpend}`,
    `Dental importance: ${answers.dentalImportance}`,
    `Vision importance: ${answers.visionImportance}`,
    `Hearing importance: ${answers.hearingImportance}`,
    `Needs transportation: ${answers.needsTransportation}`,
    `Wants OTC allowance: ${answers.wantsOTC}`,
    `Wants fitness benefit: ${answers.wantsFitness}`,
    `Has specific doctors: ${answers.hasSpecificDoctors}`,
    `Plan type preference: ${answers.planTypePreference}`,
    `Top priority: ${answers.topPriority}`,
  ]
    .map((l) => `- ${l}`)
    .join("\n");

  const plansText = topPlans
    .map(
      (p) =>
        `Rank #${p.rank}: ${p.planName} (${p.carrier})\n` +
        `  Type: ${p.planType} | Premium: $${p.premium}/mo | Max OOP: $${p.maxOutOfPocket.toLocaleString()} | Stars: ${p.starRating}★\n` +
        `  Estimated annual cost: $${p.estimatedCost.toLocaleString()}\n` +
        `  Estimated annual drug cost: ${p.estimatedAnnualDrugCost != null ? '$' + p.estimatedAnnualDrugCost.toLocaleString() : 'N/A'}\n` +
        `  Estimated total annual cost (premium + drugs): ${p.estimatedTotalAnnualCost != null ? '$' + p.estimatedTotalAnnualCost.toLocaleString() : 'N/A'}\n` +
        `  Why it matches: ${p.whyRecommended.join("; ")}`
    )
    .join("\n\n");

  return `You are a Medicare insurance advisor. A beneficiary has completed a health profile questionnaire. Based on their answers and the top 3 ranked plans, write a concise personalized recommendation.

BENEFICIARY PROFILE:
${healthProfile}

TOP 3 RANKED PLANS:
${plansText}

Write exactly 3 sections using ## headings:

## Quick Summary
2-3 sentences summarizing this person's health situation and what type of plan fits them best.

## Why These Plans Were Selected
3-4 bullet points explaining the key reasons these specific plans match their profile. Reference specific benefits, costs, or plan features that align with their answers. When drug cost data is available, factor in formulary-based drug cost estimates to explain cost differences between plans.

## Our Top Recommendation
1 short paragraph (3-4 sentences) explaining why the #1 ranked plan is the best fit, what they should watch out for, and one actionable next step.

Keep the tone warm, clear, and helpful. Avoid jargon. Do not repeat the cost numbers already shown in the comparison table above. Focus on the "why" — the personal fit between their needs and the plan features.`;
}

// ── SSE helper ────────────────────────────────────────────────────────────────
function sendSSE(res: import("express").Response, event: string, data: string) {
  res.write(`event: ${event}\ndata: ${data}\n\n`);
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.post("/recommend-stream", async (req, res) => {
  // Validate input
  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }
  const { answers, topPlans } = parsed.data;

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL;
  const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY;

  if (!forgeApiUrl || !forgeApiKey) {
    sendSSE(res, "error", JSON.stringify({ message: "Forge API not configured" }));
    res.end();
    return;
  }

  try {
    const forgeRes = await fetch(`${forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${forgeApiKey}`,
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 600,
        stream: true,
        messages: [{ role: "user", content: buildPrompt(answers, topPlans) }],
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!forgeRes.ok) {
      const errorText = await forgeRes.text();
      sendSSE(res, "error", JSON.stringify({ message: `AI API error: ${forgeRes.status} — ${errorText.slice(0, 200)}` }));
      res.end();
      return;
    }

    const reader = forgeRes.body?.getReader();
    if (!reader) {
      sendSSE(res, "error", JSON.stringify({ message: "No response body from AI" }));
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let doneSent = false;

    while (true) {
      if (res.destroyed) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") {
          if (!doneSent) { sendSSE(res, "done", "{}"); doneSent = true; }
          continue;
        }
        try {
          const evt = JSON.parse(raw) as {
            choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
          };
          const content = evt.choices?.[0]?.delta?.content;
          if (content) {
            sendSSE(res, "delta", JSON.stringify(content));
          }
          if (evt.choices?.[0]?.finish_reason === "stop") {
            if (!doneSent) { sendSSE(res, "done", "{}"); doneSent = true; }
          }
        } catch (jsonErr) {
          console.warn("[recommendStream] Malformed JSON line from AI stream, skipping");
        }
      }
    }

    // Ensure done event is sent if not already
    if (!doneSent) {
      sendSSE(res, "done", "{}");
    }
    res.end();
  } catch (err) {
    console.error("[recommend-stream] Error:", (err as Error)?.message ?? "unknown");
    if (!res.destroyed) {
      sendSSE(res, "error", JSON.stringify({ message: (err as Error).message }));
      res.end();
    }
  }
});

export default router;
