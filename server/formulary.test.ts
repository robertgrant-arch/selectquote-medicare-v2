/**
 * Regression tests for the formulary drug-cost calculator
 * (shared/formulary/calculator.ts + database.ts).
 *
 * Protects the plan-cost path that drives plan ranking and the plans list flow.
 * These are characterization tests of CURRENT behavior, plus explicit guards for
 * the de-duplicated drug database (the `eliquis` duplicate-key fix in Batch 2).
 *
 * Note on "unknown drug": the calculator does NOT return 0 for an unrecognized
 * drug — it classifies it via a heuristic fallback (classifyUnknownDrug). These
 * tests assert that ACTUAL behavior, not an idealized zero.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  calculateDrugCosts,
  enrichPlansWithDrugCosts,
  type DrugInput,
} from "@shared/formulary/calculator";
import { DRUG_DATABASE } from "@shared/formulary/database";

const PLAN_RX = {
  tier1: "$0",
  tier2: "$10",
  tier3: "$47",
  tier4: "25%",
  deductible: "$0",
  gap: true,
  initialCoverageLimit: "$5,030",
};

const OOP_CAP_2026 = 2100; // mirrors the constant in calculator.ts

function makePlan(id: string, premium = 30, rxOverrides: Partial<typeof PLAN_RX> = {}) {
  return { id, premium, rxDrugs: { ...PLAN_RX, ...rxOverrides } };
}

// ── enrichPlansWithDrugCosts ──────────────────────────────────────────────────

describe("enrichPlansWithDrugCosts", () => {
  const drugs: DrugInput[] = [{ name: "lisinopril", dosage: "10mg" }];

  it("adds a non-negative estimatedAnnualDrugCost to each plan when drugs are provided", () => {
    const out = enrichPlansWithDrugCosts([makePlan("a"), makePlan("b")], drugs);
    expect(out).toHaveLength(2);
    for (const p of out) {
      expect(typeof p.estimatedAnnualDrugCost).toBe("number");
      expect(p.estimatedAnnualDrugCost).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns the plans unchanged when the drug list is empty (current behavior)", () => {
    const plans = [makePlan("a")];
    const out = enrichPlansWithDrugCosts(plans, []);
    expect(out).toBe(plans); // same reference — early return, no enrichment
  });

  it("does not mutate the input plan objects", () => {
    const plans = [makePlan("a"), makePlan("b")];
    enrichPlansWithDrugCosts(plans, drugs);
    for (const p of plans) {
      expect(p).not.toHaveProperty("estimatedAnnualDrugCost");
    }
  });

  it("is deterministic — identical inputs produce identical estimates", () => {
    const a = enrichPlansWithDrugCosts([makePlan("a")], drugs)[0].estimatedAnnualDrugCost;
    const b = enrichPlansWithDrugCosts([makePlan("a")], drugs)[0].estimatedAnnualDrugCost;
    expect(a).toBe(b);
  });

  it("caps member annual drug cost at the 2026 OOP maximum for very expensive regimens", () => {
    const megaDrug: DrugInput[] = [{ name: "zolgensma", dosage: "1" }]; // tier 4, $15k/mo
    const out = enrichPlansWithDrugCosts([makePlan("a")], megaDrug)[0];
    expect(out.estimatedAnnualDrugCost).toBeGreaterThan(0);
    expect(out.estimatedAnnualDrugCost).toBeLessThanOrEqual(OOP_CAP_2026);
  });
});

// ── calculateDrugCosts ────────────────────────────────────────────────────────

describe("calculateDrugCosts", () => {
  it("returns an all-zero result for an empty drug list", () => {
    const r = calculateDrugCosts([], PLAN_RX);
    expect(r.estimatedAnnualDrugCost).toBe(0);
    expect(r.drugBreakdowns).toEqual([]);
  });

  it("produces a single breakdown for a known Tier 1 generic at low cost", () => {
    const r = calculateDrugCosts([{ name: "lisinopril", dosage: "10mg" }], PLAN_RX);
    expect(r.drugBreakdowns).toHaveLength(1);
    expect(r.drugBreakdowns[0].tier).toBe(1);
    expect(r.estimatedAnnualDrugCost).toBeGreaterThanOrEqual(0);
  });

  it("classifies an unknown drug via fallback instead of throwing or zeroing", () => {
    const r = calculateDrugCosts([{ name: "zzqfakedrugxyz", dosage: "5mg" }], PLAN_RX);
    expect(r.drugBreakdowns).toHaveLength(1);
    expect(r.drugBreakdowns[0].annualCost).toBeGreaterThanOrEqual(0);
  });

  it("never returns a negative estimated cost", () => {
    const r = calculateDrugCosts(
      [{ name: "eliquis", dosage: "5mg" }, { name: "humira", dosage: "40mg" }],
      PLAN_RX
    );
    expect(r.estimatedAnnualDrugCost).toBeGreaterThanOrEqual(0);
  });
});

// ── DRUG_DATABASE integrity (guards the eliquis de-dup fix) ───────────────────

describe("DRUG_DATABASE integrity", () => {
  it("contains eliquis exactly once, at Tier 2", () => {
    expect(DRUG_DATABASE.eliquis).toEqual({
      tier: 2,
      avgMonthlyCost: 280,
      isGeneric: false,
    });
  });

  it("has no duplicate keys in the source file (regression guard for TS1117)", () => {
    const src = readFileSync(
      resolve(process.cwd(), "shared/formulary/database.ts"),
      "utf8"
    );
    const keys = (src.match(/^\s*"([a-z0-9-]+)":/gim) ?? []).map((m) =>
      m.trim().replace(/":.*/, "").replace(/"/g, "")
    );
    const seen = new Set<string>();
    const dupes = keys.filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
    expect(dupes).toEqual([]);
  });
});
