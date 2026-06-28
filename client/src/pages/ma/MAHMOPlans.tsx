import InfoPage from "@/components/InfoPage";
import { Link } from "wouter";
import { CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";

export default function MAHMOPlans() {
  return (
    <InfoPage
      section="Medicare Advantage"
      sectionHref="/plans"
      title="Medicare Advantage HMO Plans"
      subtitle="Health Maintenance Organization plans deliver coordinated, cost-effective care through a defined provider network — often with $0 premiums and rich extra benefits."
    >
      {/* Overview */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        What Is a Medicare Advantage HMO?
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        A Medicare Advantage HMO (Health Maintenance Organization) plan is a type of Medicare Part C
        plan offered by a private insurer. It replaces Original Medicare (Parts A and B) and typically
        bundles prescription drug coverage (Part D) and extra benefits — dental, vision, hearing,
        fitness, and more — into a single monthly premium, which is often $0.
      </p>
      <p className="text-gray-600 leading-relaxed mb-6">
        In 2025, HMOs account for more than 56% of all Medicare Advantage plans offered nationwide,
        making them the most common plan type. Over 33 million Americans are enrolled in Medicare
        Advantage, and the majority are in HMO-style plans, drawn by their lower out-of-pocket costs
        and coordinated care model.
      </p>

      {/* How it works */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        How an HMO Works
      </h2>
      <div className="space-y-3 mb-6">
        {[
          {
            step: "1. Choose a Primary Care Physician (PCP)",
            desc: "Your PCP is the hub of your care. They manage your health, order tests, and coordinate referrals to specialists within the plan's network.",
          },
          {
            step: "2. Get Referrals for Specialists",
            desc: "To see a specialist (cardiologist, orthopedist, etc.), you typically need a referral from your PCP. Some HMOs offer a 'POS' (Point of Service) option that allows limited out-of-network access.",
          },
          {
            step: "3. Use In-Network Providers",
            desc: "HMO plans require you to use doctors, hospitals, and labs within the plan's network for non-emergency care. Going out of network usually means paying the full cost yourself.",
          },
          {
            step: "4. Pay Predictable Copays",
            desc: "Instead of meeting a large deductible first, most HMO plans charge set copays per visit — e.g., $0 for primary care, $35–$40 for specialists — making costs easy to predict.",
          },
        ].map((item) => (
          <div key={item.step} className="flex gap-3 bg-gray-50 rounded-lg p-4">
            <div className="w-6 h-6 rounded-full bg-[#E8F2F5] text-[#1C3A48] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              {item.step[0]}
            </div>
            <div>
              <div className="font-semibold text-gray-800 text-sm mb-1">{item.step}</div>
              <div className="text-gray-600 text-sm leading-relaxed">{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pros and Cons */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Pros and Cons of HMO Plans
      </h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl p-4 border" style={{ backgroundColor: "#EEF5F7", borderColor: "#C6DAE0" }}>
          <h3 className="font-bold text-sm mb-2 flex items-center gap-1.5" style={{ color: "#1C3A48" }}>
            <CheckCircle2 size={14} /> Advantages
          </h3>
          <ul className="space-y-1.5 text-sm" style={{ color: "#3E5560" }}>
            {[
              "Often $0 monthly premium",
              "Lower copays and out-of-pocket costs",
              "Prescription drug coverage included",
              "Extra benefits: dental, vision, hearing, OTC",
              "Coordinated care reduces duplicate tests",
              "Annual out-of-pocket maximum protects you",
            ].map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: "#237A92" }} />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl p-4 border" style={{ backgroundColor: "#FAF9F5", borderColor: "#E2EAED" }}>
          <h3 className="font-bold text-sm mb-2 flex items-center gap-1.5" style={{ color: "#3E5560" }}>
            <AlertCircle size={14} /> Limitations
          </h3>
          <ul className="space-y-1.5 text-sm" style={{ color: "#3E5560" }}>
            {[
              "Must use in-network providers",
              "Referrals required for specialists",
              "Network may not include all local doctors",
              "Less flexibility when traveling",
              "PCP change requires plan update",
              "Prior authorization may be needed for some services",
            ].map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: "#7A9BA6" }} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Typical costs */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Typical HMO Cost Structure (2025)
      </h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ backgroundColor: "#EEF5F7" }}>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Cost Item</th>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Typical Range</th>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Notes</th>
            </tr>
          </thead>
          <tbody>
            {[
              { item: "Monthly Premium", range: "$0 – $50/mo", note: "Many plans are $0; average is ~$13/mo across all MA plans" },
              { item: "Primary Care Copay", range: "$0 – $10", note: "Many plans offer $0 PCP visits" },
              { item: "Specialist Copay", range: "$25 – $50", note: "Referral usually required" },
              { item: "Emergency Room", range: "$65 – $120", note: "Waived if admitted as inpatient" },
              { item: "Urgent Care", range: "$25 – $50", note: "Lower than ER; no referral needed" },
              { item: "Annual Deductible", range: "$0 – $500", note: "Most HMOs have $0 medical deductible" },
              { item: "Max Out-of-Pocket", range: "$3,400 – $8,850", note: "Average MOOP increased to ~$5,100 in 2025" },
              { item: "Inpatient Hospital (days 1–5)", range: "$250 – $350/day", note: "After day 5, often $0" },
            ].map((row) => (
              <tr key={row.item} className="border border-gray-200 hover:bg-gray-50">
                <td className="p-3 font-medium text-gray-800">{row.item}</td>
                <td className="p-3 text-gray-700 font-semibold">{row.range}</td>
                <td className="p-3 text-gray-500 text-xs">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Extra Benefits */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Extra Benefits in 2025
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-4">
        In 2025, 97% or more of individual Medicare Advantage plans offer some form of dental, vision,
        or hearing benefits — benefits not covered by Original Medicare. Common extras include:
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {[
          { benefit: "Dental", detail: "Routine cleanings, X-rays, fillings; some plans cover dentures and implants" },
          { benefit: "Vision", detail: "Annual eye exams, allowance for glasses or contacts ($100–$300/year)" },
          { benefit: "Hearing", detail: "Hearing exams and hearing aid allowances ($500–$2,000/year)" },
          { benefit: "Over-the-Counter (OTC)", detail: "Quarterly allowance ($25–$150) for vitamins, pain relievers, first aid" },
          { benefit: "Fitness", detail: "SilverSneakers or similar gym membership included" },
          { benefit: "Transportation", detail: "Rides to medical appointments (10–30 trips/year)" },
          { benefit: "Telehealth", detail: "$0 virtual visits with doctors 24/7" },
          { benefit: "Meals", detail: "Post-hospitalization meal delivery (some plans)" },
          { benefit: "Part B Giveback", detail: "Some plans reduce your Part B premium by $10–$100/month" },
        ].map((b) => (
          <div key={b.benefit} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div className="font-semibold text-gray-800 text-sm mb-1">{b.benefit}</div>
            <div className="text-gray-500 text-xs leading-relaxed">{b.detail}</div>
          </div>
        ))}
      </div>

      {/* Who should choose HMO */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Is an HMO Right for You?
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">
        An HMO plan is likely a strong fit if you:
      </p>
      <ul className="space-y-2 text-sm text-gray-600 mb-4">
        {[
          "Have a primary care doctor you trust who is in the plan's network",
          "Prefer lower monthly costs and predictable copays over maximum flexibility",
          "Primarily receive care in one geographic area (not a frequent traveler)",
          "Want dental, vision, hearing, and other extra benefits bundled in",
          "Are comfortable with coordinated care and referral processes",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: "#237A92" }} />
            {item}
          </li>
        ))}
      </ul>

      <div className="rounded-xl p-4 text-sm mb-6 border" style={{ backgroundColor: "#EEF5F7", borderColor: "#C6DAE0", color: "#3E5560" }}>
        <div className="flex items-start gap-2">
          <HelpCircle size={15} className="shrink-0 mt-0.5" style={{ color: "#237A92" }} />
          <div>
            <strong>Before you enroll:</strong> Always verify that your current doctors and preferred
            hospitals are in the plan's network. Use the plan's online provider directory or call
            member services. Network participation can change year to year.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/plans?zip=64106"
          className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white"
          style={{ backgroundColor: "#1C3A48" }}
        >
          Browse HMO Plans in Your Area →
        </Link>
        <Link
          href="/medicare-advantage/ppo"
          className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border"
          style={{ color: "#1C3A48", borderColor: "#1C3A48" }}
        >
          Compare with PPO Plans
        </Link>
      </div>
    </InfoPage>
  );
}
