import InfoPage from "@/components/InfoPage";
import { Link } from "wouter";
import { CheckCircle2, ArrowRight, AlertCircle } from "lucide-react";

export default function MADrugCoverage() {
  return (
    <InfoPage
      section="Medicare Advantage"
      sectionHref="/plans"
      title="Medicare Advantage with Drug Coverage"
      subtitle="MAPD plans bundle Medicare Parts A, B, and D into one plan — simplifying your coverage and often reducing total annual drug costs."
    >
      {/* Overview */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        What Is an MAPD Plan?
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        A Medicare Advantage Prescription Drug plan (MAPD) combines your Medicare Part A (hospital
        insurance), Part B (medical insurance), and Part D (prescription drug coverage) into a single
        plan offered by a private insurer. Instead of managing separate coverage for medical care and
        drugs, you have one plan, one premium, one ID card, and one out-of-pocket maximum.
      </p>
      <p className="text-gray-600 leading-relaxed mb-6">
        The vast majority of Medicare Advantage plans — roughly 90% — include prescription drug
        coverage. If you enroll in an MA plan without drug coverage (MA-only), you generally cannot
        also enroll in a standalone Part D plan, so it's important to choose an MAPD plan if you
        take prescription medications.
      </p>

      {/* 2025 Part D changes */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Major Part D Changes in 2025
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">
        The Inflation Reduction Act brought significant changes to Part D drug coverage in 2025 that
        benefit all MAPD enrollees:
      </p>
      <div className="space-y-3 mb-6">
        {[
          {
            title: "$2,000 Annual Out-of-Pocket Cap on Drugs",
            desc: "Starting in 2025, your total out-of-pocket spending on Part D drugs is capped at $2,000 per year. This is a landmark change — previously there was no cap, and some beneficiaries paid tens of thousands for specialty drugs.",
            highlight: true,
          },
          {
            title: "Medicare Prescription Payment Plan",
            desc: "You can now spread your drug costs across monthly payments throughout the year rather than paying large lump sums when you fill prescriptions. This smooths cash flow for people on fixed incomes.",
            highlight: false,
          },
          {
            title: "Insulin Capped at $35/Month",
            desc: "All covered insulin products are capped at $35 per month per prescription, regardless of the drug tier. This applies to all MAPD and standalone Part D plans.",
            highlight: false,
          },
          {
            title: "Vaccines at $0",
            desc: "All ACIP-recommended vaccines (including shingles, flu, pneumonia, COVID-19) are covered at $0 cost-sharing under Part D.",
            highlight: false,
          },
        ].map((item) => (
          <div
            key={item.title}
            className={`rounded-xl p-4 border ${item.highlight ? "bg-green-50 border-[#C8D8F5]" : "bg-gray-50 border-gray-200"}`}
          >
            <div className={`font-semibold text-sm mb-1 ${item.highlight ? "text-green-800" : "text-gray-800"}`}>
              {item.highlight && "★ "}{item.title}
            </div>
            <div className="text-gray-600 text-sm leading-relaxed">{item.desc}</div>
          </div>
        ))}
      </div>

      {/* Drug Tiers */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Understanding Drug Tiers
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">
        Every MAPD plan organizes covered drugs into tiers. Lower tiers have lower cost-sharing.
        The specific drugs in each tier vary by plan — always check the plan's formulary for your
        medications.
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-green-50">
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Tier</th>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Drug Type</th>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Typical Copay (30-day supply)</th>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Examples</th>
            </tr>
          </thead>
          <tbody>
            {[
              { tier: "Tier 1", type: "Preferred Generic", copay: "$0 – $5", examples: "Metformin, lisinopril, atorvastatin" },
              { tier: "Tier 2", type: "Generic", copay: "$5 – $15", examples: "Amlodipine, omeprazole, sertraline" },
              { tier: "Tier 3", type: "Preferred Brand-Name", copay: "$35 – $50", examples: "Eliquis, Jardiance, Xarelto" },
              { tier: "Tier 4", type: "Non-Preferred Brand-Name", copay: "$80 – $100", examples: "Brand drugs with generic alternatives" },
              { tier: "Tier 5", type: "Specialty Drugs", copay: "25–33% coinsurance (max $2,000/yr)", examples: "Biologics, cancer drugs, MS treatments" },
            ].map((row, i) => (
              <tr key={row.tier} className={`border border-gray-200 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                <td className="p-3 font-bold text-gray-800">{row.tier}</td>
                <td className="p-3 text-gray-700">{row.type}</td>
                <td className="p-3 text-[#1C3A48] font-medium">{row.copay}</td>
                <td className="p-3 text-gray-500 text-xs">{row.examples}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Coverage Phases */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Part D Coverage Phases in 2025
      </h2>
      <div className="space-y-3 mb-6">
        {[
          {
            phase: "Deductible Phase",
            desc: "You pay 100% of drug costs until you meet your plan's deductible (maximum $590 in 2025 for standard plans; many MAPD plans have $0 deductible for Tier 1–2 drugs).",
            color: "border-gray-300 bg-gray-50",
          },
          {
            phase: "Initial Coverage Phase",
            desc: "After meeting the deductible, you pay your plan's copays or coinsurance for covered drugs. This phase continues until your total drug costs (what you and the plan pay) reach $2,000.",
            color: "border-blue-200 bg-blue-50",
          },
          {
            phase: "Catastrophic Coverage Phase (NEW in 2025)",
            desc: "Once you've paid $2,000 out of pocket, you pay $0 for the rest of the year. The coverage gap ('donut hole') has been eliminated. This is the most significant Part D improvement in decades.",
            color: "border-[#C8D8F5] bg-green-50",
          },
        ].map((item) => (
          <div key={item.phase} className={`rounded-xl p-4 border ${item.color}`}>
            <div className="font-semibold text-gray-800 text-sm mb-1">{item.phase}</div>
            <div className="text-gray-600 text-sm leading-relaxed">{item.desc}</div>
          </div>
        ))}
      </div>

      {/* Formulary tips */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        How to Evaluate Drug Coverage Before Enrolling
      </h2>
      <ul className="space-y-2 text-sm text-gray-600 mb-6">
        {[
          "List every medication you take, including dosage and frequency",
          "Look up each drug in the plan's formulary (available on the plan's website or Medicare.gov)",
          "Note the tier placement — lower tier = lower cost",
          "Check if your preferred pharmacy is in the plan's network (preferred pharmacies offer lower copays)",
          "Ask about mail-order pharmacy options (often 90-day supply at 2x the 30-day copay)",
          "Look for step therapy or prior authorization requirements on your medications",
          "Use Medicare.gov's Plan Finder to enter all your drugs and get a personalized annual cost estimate",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-green-600 shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800 mb-6">
        <div className="flex items-start gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div>
            <strong>Formulary changes:</strong> Plans can change their formularies during the year
            (with notice). If your drug is removed or moved to a higher tier, you have the right to
            request an exception or use a Special Enrollment Period to switch plans.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/plans?zip=64106"
          className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white"
          style={{ backgroundColor: "#1C3A48" }}
        >
          Compare Plans with Drug Coverage <ArrowRight size={14} />
        </Link>
        <Link
          href="/part-d/formulary"
          className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border"
          style={{ color: "#1C3A48", borderColor: "#1C3A48" }}
        >
          Drug Formulary Search
        </Link>
      </div>
    </InfoPage>
  );
}
