/**
 * Health Profile Recommendation Router
 *
 * Accepts a structured health profile questionnaire and returns AI-scored
 * plan recommendations using Claude via invokeLLM.
 *
 * Flow:
 * 1. Validate health profile input (5 sections, 20 questions)
 * 2. Score each plan against the profile using rule-based heuristics
 * 3. Pass top candidates + profile to Claude for personalized narrative
 * 4. Return ranked plans with match scores + AI narrative
 *
 * PRIVACY: No health data is persisted. All processing is in-memory.
 */

import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";

// ── Input schema ──────────────────────────────────────────────────────────────

const HealthProfileSchema = z.object({
  // Section 1: Health Status
  healthStatus: z.enum(["excellent", "good", "fair", "poor"]),
  chronicConditions: z.enum(["none", "1-2", "3+"]),
  plannedSurgery: z.enum(["yes", "no"]),

  // Section 2: Healthcare Utilization
  pcpVisits: z.enum(["0-2", "3-6", "7-12", "12+"]),
  specialistVisits: z.enum(["0", "1-3", "4-8", "9+"]),
  erVisits: z.enum(["0", "1-2", "3+"]),
  urgentCareVisits: z.enum(["0", "1-3", "4+"]),

  // Section 3: Prescription Drugs
  monthlyRxCount: z.enum(["0", "1-3", "4-7", "8+"]),
  brandNameDrugs: z.enum(["yes", "no"]),
  specialtyDrugs: z.enum(["yes", "no"]),
  monthlyDrugSpend: z.enum(["$0", "under-100", "100-500", "500+"]),

  // Section 4: Extra Benefits Priorities
  dentalImportance: z.enum(["not", "somewhat", "very"]),
  visionImportance: z.enum(["not", "somewhat", "very"]),
  hearingImportance: z.enum(["not", "somewhat", "very"]),
  needsTransportation: z.enum(["yes", "no"]),
  wantsOTC: z.enum(["yes", "no"]),
  wantsFitness: z.enum(["yes", "no"]),

  // Section 5: Provider & Plan Preferences
  hasSpecificDoctors: z.enum(["yes", "no"]),
  planTypePreference: z.enum(["hmo", "ppo", "no-preference"]),
  topPriority: z.enum(["lowest-premium", "lowest-oop", "best-benefits", "largest-network"]),

  // Context
  zip: z.string().regex(/^\d{5}$/),
});

const PlanInputSchema = z.object({
  id: z.string(),
  planName: z.string(),
  carrier: z.string(),
  planType: z.string(),
  premium: z.number(),
  deductible: z.number(),
  maxOutOfPocket: z.number(),
  starRating: z.number(),
  pcpCopay: z.number(),
  specialistCopay: z.number(),
  urgentCareCopay: z.number(),
  erCopay: z.number(),
  drugTier1Copay: z.number(),
  drugTier2Copay: z.number(),
  drugTier3Copay: z.number(),
  hasDental: z.boolean(),
  hasVision: z.boolean(),
  hasHearing: z.boolean(),
  hasTransportation: z.boolean(),
  hasOTC: z.boolean(),
  hasFitness: z.boolean(),
  isBestMatch: z.boolean().optional(),
  isMostPopular: z.boolean().optional(),
});

// ── Scoring engine ────────────────────────────────────────────────────────────

interface ScoredPlan {
  id: string;
  planName: string;
  carrier: string;
  planType: string;
  premium: number;
  maxOutOfPocket: number;
  starRating: number;
  estimatedAnnualCost: number;
  matchScore: number; // 0–100
  matchReasons: string[];
  watchOuts: string[];
}

function scorePlan(
  plan: z.infer<typeof PlanInputSchema>,
  profile: z.infer<typeof HealthProfileSchema>
): ScoredPlan {
  let score = 50; // baseline
  const reasons: string[] = [];
  const watchOuts: string[] = [];

  // ── Plan type preference ──────────────────────────────────────────────────
  if (profile.planTypePreference === "ppo" && plan.planType === "PPO") {
    score += 10;
    reasons.push("Matches your PPO preference (out-of-network flexibility)");
  } else if (profile.planTypePreference === "hmo" && plan.planType === "HMO") {
    score += 8;
    reasons.push("Matches your HMO preference (lower costs, coordinated care)");
  } else if (profile.planTypePreference === "ppo" && plan.planType === "HMO") {
    score -= 8;
    watchOuts.push("HMO plan — requires referrals and in-network care");
  }

  // ── Doctor network concern ────────────────────────────────────────────────
  if (profile.hasSpecificDoctors === "yes" && plan.planType === "PPO") {
    score += 6;
    reasons.push("PPO gives flexibility to keep your current doctors");
  } else if (profile.hasSpecificDoctors === "yes" && plan.planType === "HMO") {
    watchOuts.push("Verify your doctors are in this HMO network before enrolling");
  }

  // ── Premium sensitivity ───────────────────────────────────────────────────
  if (profile.topPriority === "lowest-premium") {
    if (plan.premium === 0) {
      score += 15;
      reasons.push("$0 monthly premium — matches your cost priority");
    } else if (plan.premium <= 30) {
      score += 8;
      reasons.push(`Low $${plan.premium}/mo premium`);
    } else if (plan.premium > 80) {
      score -= 10;
      watchOuts.push(`$${plan.premium}/mo premium is above average`);
    }
  }

  // ── OOP sensitivity ───────────────────────────────────────────────────────
  if (profile.topPriority === "lowest-oop") {
    if (plan.maxOutOfPocket <= 4000) {
      score += 15;
      reasons.push(`Low $${plan.maxOutOfPocket.toLocaleString()} max out-of-pocket`);
    } else if (plan.maxOutOfPocket >= 7000) {
      score -= 10;
      watchOuts.push(`High $${plan.maxOutOfPocket.toLocaleString()} max out-of-pocket`);
    }
  }

  // ── Health status / utilization ───────────────────────────────────────────
  if (profile.healthStatus === "poor" || profile.chronicConditions === "3+") {
    // High utilization — lower OOP matters more
    if (plan.maxOutOfPocket <= 4500) {
      score += 12;
      reasons.push("Low max OOP protects against high medical costs");
    }
    if (plan.specialistCopay <= 20) {
      score += 6;
      reasons.push("Low specialist copay for frequent visits");
    }
    if (plan.specialistCopay >= 50) {
      score -= 6;
      watchOuts.push("Higher specialist copay may add up with frequent visits");
    }
  }

  if (profile.plannedSurgery === "yes") {
    if (plan.deductible === 0) {
      score += 8;
      reasons.push("$0 deductible helps with planned procedures");
    }
    if (plan.maxOutOfPocket <= 4000) {
      score += 6;
      reasons.push("Low OOP cap limits your surgical cost exposure");
    }
  }

  // ── Specialist visits ─────────────────────────────────────────────────────
  const specialistVisitMap: Record<string, number> = { "0": 0, "1-3": 2, "4-8": 6, "9+": 10 };
  const specialistCount = specialistVisitMap[profile.specialistVisits] ?? 2;
  if (specialistCount >= 4 && plan.specialistCopay <= 25) {
    score += 8;
    reasons.push(`Low $${plan.specialistCopay} specialist copay for your ${profile.specialistVisits} visits/year`);
  }

  // ── ER visits ─────────────────────────────────────────────────────────────
  if (profile.erVisits === "3+" && plan.erCopay <= 90) {
    score += 5;
    reasons.push("Reasonable ER copay for your usage pattern");
  }

  // ── Drug coverage ─────────────────────────────────────────────────────────
  if (profile.monthlyRxCount !== "0") {
    if (plan.drugTier1Copay === 0) {
      score += 6;
      reasons.push("$0 Tier 1 drug copay for generic medications");
    }
    if (profile.specialtyDrugs === "yes" && plan.drugTier3Copay <= 40) {
      score += 8;
      reasons.push("Lower Tier 3 copay helps with specialty medications");
    }
    if (profile.specialtyDrugs === "yes" && plan.drugTier3Copay >= 80) {
      score -= 8;
      watchOuts.push("High Tier 3 copay may be costly for specialty drugs");
    }
  }

  // ── Extra benefits ────────────────────────────────────────────────────────
  if (profile.dentalImportance === "very") {
    if (plan.hasDental) {
      score += 8;
      reasons.push("Includes dental coverage — important to you");
    } else {
      score -= 6;
      watchOuts.push("No dental coverage included");
    }
  } else if (profile.dentalImportance === "somewhat" && plan.hasDental) {
    score += 4;
    reasons.push("Dental coverage included");
  }

  if (profile.visionImportance === "very") {
    if (plan.hasVision) {
      score += 6;
      reasons.push("Includes vision coverage");
    } else {
      score -= 4;
      watchOuts.push("No vision coverage");
    }
  }

  if (profile.hearingImportance === "very") {
    if (plan.hasHearing) {
      score += 6;
      reasons.push("Includes hearing coverage");
    } else {
      score -= 4;
      watchOuts.push("No hearing coverage");
    }
  }

  if (profile.needsTransportation === "yes" && plan.hasTransportation) {
    score += 5;
    reasons.push("Transportation benefit included");
  }

  if (profile.wantsOTC === "yes" && plan.hasOTC) {
    score += 4;
    reasons.push("OTC allowance included");
  }

  if (profile.wantsFitness === "yes" && plan.hasFitness) {
    score += 3;
    reasons.push("Fitness benefit included");
  }

  // ── Star rating bonus ─────────────────────────────────────────────────────
  if (plan.starRating >= 4.5) {
    score += 8;
    reasons.push(`Excellent ${plan.starRating}★ CMS quality rating`);
  } else if (plan.starRating >= 4.0) {
    score += 4;
    reasons.push(`Strong ${plan.starRating}★ CMS quality rating`);
  } else if (plan.starRating < 3.0) {
    score -= 5;
    watchOuts.push(`Below-average ${plan.starRating}★ CMS quality rating`);
  }

  // ── Best match / popular bonus ────────────────────────────────────────────
  if (plan.isBestMatch) score += 5;
  if (plan.isMostPopular) score += 3;

  // ── Benefits priority bonus ───────────────────────────────────────────────
  if (profile.topPriority === "best-benefits") {
    const benefitCount = [plan.hasDental, plan.hasVision, plan.hasHearing, plan.hasTransportation, plan.hasOTC, plan.hasFitness].filter(Boolean).length;
    score += benefitCount * 2;
    if (benefitCount >= 4) reasons.push(`Comprehensive benefits package (${benefitCount}/6 extras)`);
  }

  // Clamp to 0–100
  score = Math.max(0, Math.min(100, score));

  // ── Estimated annual cost ─────────────────────────────────────────────────
  const pcpVisitMap: Record<string, number> = { "0-2": 1, "3-6": 4, "7-12": 9, "12+": 14 };
  const urgentVisitMap: Record<string, number> = { "0": 0, "1-3": 2, "4+": 5 };
  const pcpCount = pcpVisitMap[profile.pcpVisits] ?? 4;
  const urgentCount = urgentVisitMap[profile.urgentCareVisits] ?? 2;
  const rxMonthly = profile.monthlyRxCount === "0" ? 0 : profile.monthlyRxCount === "1-3" ? 1 : profile.monthlyRxCount === "4-7" ? 3 : 5;

  const estimatedAnnualCost = Math.round(
    plan.premium * 12 +
    pcpCount * plan.pcpCopay +
    specialistCount * plan.specialistCopay +
    urgentCount * plan.urgentCareCopay +
    rxMonthly * 12 * plan.drugTier1Copay
  );

  return {
    id: plan.id,
    planName: plan.planName,
    carrier: plan.carrier,
    planType: plan.planType,
    premium: plan.premium,
    maxOutOfPocket: plan.maxOutOfPocket,
    starRating: plan.starRating,
    estimatedAnnualCost,
    matchScore: score,
    matchReasons: reasons.slice(0, 4), // top 4 reasons
    watchOuts: watchOuts.slice(0, 2),  // top 2 watch-outs
  };
}

// ── AI narrative builder ──────────────────────────────────────────────────────

async function buildAINarrative(
  profile: z.infer<typeof HealthProfileSchema>,
  topPlans: ScoredPlan[]
): Promise<string> {
  const profileText = [
    `Health status: ${profile.healthStatus}`,
    `Chronic conditions: ${profile.chronicConditions}`,
    `Planned surgery: ${profile.plannedSurgery}`,
    `PCP visits/year: ${profile.pcpVisits}`,
    `Specialist visits/year: ${profile.specialistVisits}`,
    `Monthly prescriptions: ${profile.monthlyRxCount}`,
    `Brand-name drugs: ${profile.brandNameDrugs}`,
    `Specialty drugs: ${profile.specialtyDrugs}`,
    `Dental importance: ${profile.dentalImportance}`,
    `Vision importance: ${profile.visionImportance}`,
    `Hearing importance: ${profile.hearingImportance}`,
    `Needs transportation: ${profile.needsTransportation}`,
    `Plan type preference: ${profile.planTypePreference}`,
    `Top priority: ${profile.topPriority}`,
  ].map((l) => `- ${l}`).join("\n");

  const plansText = topPlans.slice(0, 3).map((p, i) =>
    `#${i + 1} (${p.matchScore}% match): ${p.planName} (${p.carrier})\n` +
    `  ${p.planType} | $${p.premium}/mo | Max OOP: $${p.maxOutOfPocket.toLocaleString()} | ${p.starRating}★\n` +
    `  Est. annual cost: $${p.estimatedAnnualCost.toLocaleString()}\n` +
    `  Why it fits: ${p.matchReasons.join("; ")}`
  ).join("\n\n");

  const response = await invokeLLM({
    messages: [
      {
        role: "system" as const,
        content: "You are a friendly, expert Medicare insurance advisor. Write clear, warm, jargon-free advice. Be specific and personal. Keep responses concise.",
      },
      {
        role: "user" as const,
        content: `A Medicare beneficiary completed a health profile questionnaire. Based on their profile and top 3 matched plans, write a brief personalized recommendation.

HEALTH PROFILE:
${profileText}

TOP 3 MATCHED PLANS:
${plansText}

Write exactly 3 short sections using ## headings:

## Your Health Profile Summary
2 sentences describing their health situation and what type of plan fits them best.

## Why These Plans Were Selected
3 bullet points explaining the key reasons these plans match their specific needs.

## Our Top Pick for You
2-3 sentences on why the #1 plan is the best fit and one concrete next step.

Keep it warm, specific, and under 200 words total.`,
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

// ── Router ────────────────────────────────────────────────────────────────────

export const healthProfileRouter = router({
  /**
   * Score plans against a health profile and return ranked recommendations
   * with an AI-generated narrative.
   */
  recommend: publicProcedure
    .input(
      z.object({
        profile: HealthProfileSchema,
        plans: z.array(PlanInputSchema).min(1).max(50),
      })
    )
    .mutation(async ({ input }) => {
      const { profile, plans } = input;

      // Score all plans
      const scored = plans.map((plan) => scorePlan(plan, profile));

      // Sort by match score descending
      scored.sort((a, b) => b.matchScore - a.matchScore);

      const topPlans = scored.slice(0, 10);
      const top3 = scored.slice(0, 3);

      // Generate AI narrative for top 3
      let aiNarrative = "";
      try {
        aiNarrative = await buildAINarrative(profile, top3);
      } catch (err) {
        console.warn("[healthProfile] AI narrative failed:", (err as Error)?.message ?? "unknown");
        aiNarrative = ""; // graceful degradation
      }

      return {
        rankedPlans: topPlans,
        aiNarrative,
        totalPlansScored: plans.length,
      };
    }),
});
