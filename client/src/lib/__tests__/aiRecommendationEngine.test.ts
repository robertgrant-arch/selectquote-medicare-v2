/**
 * Characterization tests for the AI plan-recommendation scoring engine.
 *
 * Protects the AI-recommend / plan-selection critical flow before any
 * refactor (e.g. Plans.tsx PlanCard memoization, future move of this module
 * into features/plan-scoring/). These tests lock in CURRENT behavior — they
 * are not a spec rewrite. If a later change alters output, that is a signal
 * to review intent, not to silently update the assertion.
 *
 * Pure functions only: scoreAllPlans / MODEL_A / MODEL_B. We never call
 * getActiveModel/setActiveModel here (those touch localStorage, which does
 * not exist in the node test environment).
 */
import { describe, it, expect } from "vitest";
import {
  scoreAllPlans,
  MODEL_A,
  MODEL_B,
  type PlanScore,
} from "../aiRecommendationEngine";
import type { MedicarePlan, Doctor } from "../types";

// ── Fixtures ────────────────────────────────────────────────────────────────

let planCounter = 0;

function makePlan(overrides: Partial<MedicarePlan> = {}): MedicarePlan {
  planCounter += 1;
  const id = overrides.id ?? `plan-${planCounter}`;
  return {
    id,
    carrier: "UnitedHealthcare",
    planName: `Test Plan ${id}`,
    planType: "PPO",
    contractId: `H${1000 + planCounter}`,
    planId: `${id}-001`,
    starRating: { overall: 4, label: "Above Average" },
    premium: 30,
    partBPremiumReduction: 0,
    deductible: 0,
    maxOutOfPocket: 5000,
    copays: {
      primaryCare: "$0 copay",
      specialist: "$40 copay",
      urgentCare: "$40 copay",
      emergency: "$120 copay",
      inpatientHospital: "$295/day",
      outpatientSurgery: "$175 copay",
    },
    rxDrugs: {
      tier1: "$0",
      tier2: "$10",
      tier3: "$47",
      tier4: "$100",
      deductible: "$0",
      gap: true,
      initialCoverageLimit: "$5,030",
    },
    extraBenefits: {
      dental: { covered: false, details: "" },
      vision: { covered: false, details: "" },
      hearing: { covered: false, details: "" },
      otc: { covered: false, details: "" },
      fitness: { covered: false, details: "" },
      transportation: { covered: false, details: "" },
      telehealth: { covered: false, details: "" },
      meals: { covered: false, details: "" },
    },
    networkSize: 4200,
    enrollmentPeriod: "Oct 15 – Dec 7",
    effectiveDate: "Jan 1, 2026",
    serviceArea: "Test County",
    carrierLogoColor: "#1B365D",
    carrierLogoTextColor: "#FFFFFF",
    ...overrides,
  };
}

const ALL_BENEFITS_COVERED: MedicarePlan["extraBenefits"] = {
  dental: { covered: true, details: "Comprehensive", annualLimit: "$2,000" },
  vision: { covered: true, details: "Exam + frames", annualLimit: "$200" },
  hearing: { covered: true, details: "Aids", annualLimit: "$2,000" },
  otc: { covered: true, details: "$100/qtr" },
  fitness: { covered: true, details: "SilverSneakers" },
  transportation: { covered: true, details: "24 trips" },
  telehealth: { covered: true, details: "$0 telehealth" },
  meals: { covered: true, details: "14 meals" },
};

function withDrugCost(plan: MedicarePlan, cost: number): MedicarePlan {
  return { ...plan, estimatedAnnualDrugCost: cost };
}

function withInNetwork(plan: MedicarePlan, inNetworkCount: number): MedicarePlan {
  // The engine reads plan.doctorNetworkStatus?.inNetworkCount as an optional
  // dynamically-attached field. Mirror that shape.
  return {
    ...plan,
    doctorNetworkStatus: { inNetworkCount },
  } as MedicarePlan & { doctorNetworkStatus: { inNetworkCount: number } };
}

const DOCTOR: Doctor = {
  id: "d1",
  name: "Dr. Smith",
  specialty: "Cardiology",
  npi: "1234567890",
  address: "123 Main St",
};

// ── Shape & basic guarantees ──────────────────────────────────────────────────

describe("scoreAllPlans — output shape", () => {
  it("returns one PlanScore per input plan", () => {
    const plans = [makePlan(), makePlan(), makePlan()];
    const result = scoreAllPlans(plans, MODEL_B, []);
    expect(result).toHaveLength(3);
  });

  it("returns an empty array for empty input without throwing", () => {
    expect(scoreAllPlans([], MODEL_B, [])).toEqual([]);
  });

  it("handles a single plan", () => {
    const result = scoreAllPlans([makePlan()], MODEL_B, []);
    expect(result).toHaveLength(1);
    expect(result[0].rank).toBe(1);
    expect(result[0].isTopPick).toBe(true);
  });

  it("each score is within [0, 100]", () => {
    const plans = [
      makePlan({ premium: 0, maxOutOfPocket: 1000 }),
      makePlan({ premium: 200, maxOutOfPocket: 9000 }),
      makePlan({ premium: 80, maxOutOfPocket: 4000 }),
    ];
    for (const s of scoreAllPlans(plans, MODEL_B, [])) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });

  it("assigns ranks 1..n with exactly one top pick", () => {
    const plans = [makePlan(), makePlan(), makePlan(), makePlan()];
    const result = scoreAllPlans(plans, MODEL_B, []);
    const ranks = result.map((r) => r.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([1, 2, 3, 4]);
    expect(result.filter((r) => r.isTopPick)).toHaveLength(1);
    expect(result.find((r) => r.isTopPick)!.rank).toBe(1);
  });

  it("sorts results by descending score", () => {
    const plans = [
      makePlan({ premium: 150 }),
      makePlan({ premium: 0 }),
      makePlan({ premium: 70 }),
    ];
    const scores = scoreAllPlans(plans, MODEL_B, []).map((r) => r.score);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });

  it("populates reasons (max 4) and an 8-factor breakdown", () => {
    const result = scoreAllPlans([makePlan()], MODEL_B, []);
    expect(result[0].reasons.length).toBeGreaterThan(0);
    expect(result[0].reasons.length).toBeLessThanOrEqual(4);
    expect(result[0].breakdown).toHaveLength(8);
  });
});

// ── Determinism & immutability ────────────────────────────────────────────────

describe("scoreAllPlans — determinism & purity", () => {
  it("produces identical scores and order on repeated calls", () => {
    const plans = [
      makePlan({ premium: 10 }),
      makePlan({ premium: 90 }),
      makePlan({ premium: 45 }),
    ];
    const first = scoreAllPlans(plans, MODEL_B, []);
    const second = scoreAllPlans(plans, MODEL_B, []);
    expect(second.map((r) => ({ id: r.planId, score: r.score, rank: r.rank }))).toEqual(
      first.map((r) => ({ id: r.planId, score: r.score, rank: r.rank }))
    );
  });

  it("does not mutate the input plans array (order or contents)", () => {
    const plans = [makePlan({ premium: 100 }), makePlan({ premium: 0 })];
    const idsBefore = plans.map((p) => p.id);
    const premiumsBefore = plans.map((p) => p.premium);
    scoreAllPlans(plans, MODEL_B, []);
    expect(plans.map((p) => p.id)).toEqual(idsBefore);
    expect(plans.map((p) => p.premium)).toEqual(premiumsBefore);
  });
});

// ── Scoring factors actually influence ranking ────────────────────────────────

describe("scoreAllPlans — factor influence", () => {
  it("ranks the lower-premium plan above an otherwise-identical higher-premium plan", () => {
    const cheap = makePlan({ id: "cheap", premium: 0 });
    const pricey = makePlan({ id: "pricey", premium: 200 });
    const result = scoreAllPlans([pricey, cheap], MODEL_B, []);
    const cheapRank = result.find((r) => r.planId === "cheap")!.rank;
    const priceyRank = result.find((r) => r.planId === "pricey")!.rank;
    expect(cheapRank).toBeLessThan(priceyRank);
  });

  it("ranks the lower-drug-cost plan above an otherwise-identical higher-cost plan", () => {
    const low = withDrugCost(makePlan({ id: "low" }), 200);
    const high = withDrugCost(makePlan({ id: "high" }), 6000);
    const result = scoreAllPlans([high, low], MODEL_B, []);
    expect(result.find((r) => r.planId === "low")!.score).toBeGreaterThan(
      result.find((r) => r.planId === "high")!.score
    );
  });

  it("rewards in-network doctors when the user has selected doctors", () => {
    const inNet = withInNetwork(makePlan({ id: "in" }), 1);
    const outNet = withInNetwork(makePlan({ id: "out" }), 0);
    const result = scoreAllPlans([outNet, inNet], MODEL_B, [DOCTOR]);
    expect(result.find((r) => r.planId === "in")!.score).toBeGreaterThan(
      result.find((r) => r.planId === "out")!.score
    );
  });
});

// ── Model differentiation ─────────────────────────────────────────────────────

describe("scoreAllPlans — MODEL_A vs MODEL_B", () => {
  it("MODEL_A ignores extra benefits (weight 0); MODEL_B rewards them", () => {
    const richBenefits = makePlan({ id: "rich", extraBenefits: ALL_BENEFITS_COVERED });

    const scoreA = scoreAllPlans([richBenefits], MODEL_A, [])[0].score;
    const scoreB = scoreAllPlans([richBenefits], MODEL_B, [])[0].score;

    // MODEL_B adds an extra-benefits contribution that MODEL_A omits entirely,
    // so the same benefit-rich plan must score strictly higher under MODEL_B.
    expect(scoreB).toBeGreaterThan(scoreA);
  });

  it("both models expose doctorMatch and drugCost factors in the breakdown", () => {
    const factorsA = scoreAllPlans([makePlan()], MODEL_A, [])[0].breakdown.map((b) => b.factor);
    const factorsB = scoreAllPlans([makePlan()], MODEL_B, [])[0].breakdown.map((b) => b.factor);
    for (const f of [factorsA, factorsB]) {
      expect(f).toContain("Doctor Network");
      expect(f).toContain("Drug Cost");
    }
  });
});

// ── Alternate call signature used by AdminAIModels ────────────────────────────

describe("scoreAllPlans — options-object signature", () => {
  it("accepts (plans, { doctors }, 'A'|'B') and returns scored plans", () => {
    const plans = [makePlan(), makePlan()];
    const result: PlanScore[] = scoreAllPlans(plans, { doctors: [] }, "B");
    expect(result).toHaveLength(2);
    expect(result[0].rank).toBe(1);
  });
});
