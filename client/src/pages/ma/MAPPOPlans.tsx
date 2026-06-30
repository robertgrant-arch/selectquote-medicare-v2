import InfoPage from "@/components/InfoPage";
import { Link } from "wouter";
import { CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

export default function MAPPOPlans() {
  return (
    <InfoPage
      section="Medicare Advantage"
      sectionHref="/plans"
      title="Medicare Advantage PPO Plans"
      subtitle="Preferred Provider Organization plans give you the freedom to see any Medicare-approved doctor — in or out of network — without a referral."
    >
      {/* Overview */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        What Is a Medicare Advantage PPO?
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        A Medicare Advantage PPO (Preferred Provider Organization) plan is a type of Medicare Part C
        plan that gives you the flexibility to see any Medicare-approved provider — inside or outside
        the plan's preferred network — without needing a referral. You pay less when you use
        in-network (preferred) providers, but you retain coverage when you go out of network.
      </p>
      <p className="text-gray-600 leading-relaxed mb-6">
        PPO plans account for roughly 44% of Medicare Advantage plan offerings in 2025 and are
        especially popular among beneficiaries who want maximum provider flexibility, travel
        frequently, or have established relationships with specialists they don't want to give up.
      </p>

      {/* HMO vs PPO comparison */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        HMO vs. PPO: Key Differences
      </h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-green-50">
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Feature</th>
              <th className="p-3 font-semibold text-gray-700 border border-gray-200 text-center">HMO</th>
              <th className="p-3 font-semibold text-gray-700 border border-gray-200 text-center bg-[#E8F0FE]">PPO</th>
            </tr>
          </thead>
          <tbody>
            {[
              { feature: "Primary Care Physician required", hmo: "Yes", ppo: "No" },
              { feature: "Referrals for specialists", hmo: "Usually required", ppo: "Not required" },
              { feature: "Out-of-network coverage", hmo: "Emergency only", ppo: "Yes (higher cost)" },
              { feature: "Monthly premium", hmo: "Often $0", ppo: "$0–$100+" },
              { feature: "Copays / cost-sharing", hmo: "Lower", ppo: "Moderate" },
              { feature: "Provider network size", hmo: "Smaller, local", ppo: "Larger, national" },
              { feature: "Best for travelers", hmo: "No", ppo: "Yes" },
              { feature: "Drug coverage included", hmo: "Usually", ppo: "Usually" },
            ].map((row) => (
              <tr key={row.feature} className="border border-gray-200 hover:bg-gray-50">
                <td className="p-3 text-gray-700">{row.feature}</td>
                <td className="p-3 text-center text-gray-600">{row.hmo}</td>
                <td className="p-3 text-center font-medium text-green-800 bg-green-50">{row.ppo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* How PPO works */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        How a PPO Plan Works
      </h2>
      <div className="space-y-3 mb-6">
        {[
          {
            title: "In-Network (Preferred) Care",
            desc: "When you see doctors and hospitals in the plan's preferred network, you pay the lowest cost-sharing — typically $0–$10 for primary care and $25–$45 for specialists. No referral needed.",
          },
          {
            title: "Out-of-Network Care",
            desc: "You can see any Medicare-approved provider outside the network, but you'll pay a higher cost-sharing percentage (often 20–50% of the Medicare-approved amount). Some plans have a separate, higher out-of-pocket maximum for out-of-network care.",
          },
          {
            title: "No Referral Required",
            desc: "You can self-refer directly to any specialist — cardiologist, dermatologist, orthopedist — without first seeing a primary care doctor. This is the defining advantage of a PPO.",
          },
          {
            title: "Nationwide Coverage",
            desc: "Many PPO plans offer nationwide networks, making them ideal for retirees who split time between states or travel frequently. Emergency care is always covered anywhere in the U.S.",
          },
        ].map((item) => (
          <div key={item.title} className="border-l-4 border-green-500 pl-4 py-1">
            <div className="font-semibold text-gray-800 text-sm mb-1">{item.title}</div>
            <div className="text-gray-600 text-sm leading-relaxed">{item.desc}</div>
          </div>
        ))}
      </div>

      {/* Typical costs */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Typical PPO Cost Structure (2025)
      </h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-green-50">
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Cost Item</th>
              <th className="p-3 font-semibold text-gray-700 border border-gray-200 text-center">In-Network</th>
              <th className="p-3 font-semibold text-gray-700 border border-gray-200 text-center">Out-of-Network</th>
            </tr>
          </thead>
          <tbody>
            {[
              { item: "Monthly Premium", in: "$0 – $100+", out: "Same" },
              { item: "Primary Care Visit", in: "$0 – $15", out: "$20 – $50" },
              { item: "Specialist Visit", in: "$25 – $50", out: "$50 – $100" },
              { item: "Emergency Room", in: "$75 – $120", out: "Same (emergency)" },
              { item: "Urgent Care", in: "$25 – $50", out: "$50 – $100" },
              { item: "Inpatient Hospital", in: "$250–$350/day (days 1–5)", out: "20–50% coinsurance" },
              { item: "Annual Out-of-Pocket Max", in: "$3,400 – $8,850", out: "Separate, higher limit" },
            ].map((row) => (
              <tr key={row.item} className="border border-gray-200 hover:bg-gray-50">
                <td className="p-3 font-medium text-gray-800">{row.item}</td>
                <td className="p-3 text-center text-[#00353E] font-medium">{row.in}</td>
                <td className="p-3 text-center text-orange-700">{row.out}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pros and Cons */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Pros and Cons of PPO Plans
      </h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <h3 className="font-bold text-green-800 text-sm mb-2 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Advantages
          </h3>
          <ul className="space-y-1.5 text-sm text-green-900">
            {[
              "No referrals — see any specialist directly",
              "Out-of-network coverage available",
              "Larger, often national provider networks",
              "Ideal for frequent travelers",
              "Keep existing specialist relationships",
              "Drug coverage often included",
              "Extra benefits: dental, vision, hearing",
            ].map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-green-600 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <h3 className="font-bold text-orange-800 text-sm mb-2 flex items-center gap-1.5">
            <AlertCircle size={14} /> Trade-offs
          </h3>
          <ul className="space-y-1.5 text-sm text-orange-900">
            {[
              "Higher monthly premiums than HMO",
              "Higher copays for out-of-network care",
              "Separate out-of-network MOOP can be very high",
              "Less care coordination than HMO",
              "Some plans still require prior authorization",
              "Drug formularies vary by plan",
            ].map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-orange-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Who should choose PPO */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Is a PPO Right for You?
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">
        A PPO plan is likely the better choice if you:
      </p>
      <ul className="space-y-2 text-sm text-gray-600 mb-6">
        {[
          "Have established relationships with specialists you want to keep seeing",
          "Travel frequently between states or spend winters in another state",
          "Want the option to see out-of-network providers without losing all coverage",
          "Prefer not to coordinate care through a primary care gatekeeper",
          "Are willing to pay slightly higher premiums for greater flexibility",
          "Have complex health needs requiring multiple specialists",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-green-600 shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 mb-6">
        <strong>Snowbird tip:</strong> If you split time between two states, look for a PPO plan with
        a national network. Many top carriers (UnitedHealthcare, Humana, Aetna) offer PPO plans with
        nationwide preferred provider networks, so you're covered at preferred rates wherever you are.
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/plans?zip=64106"
          className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white"
          style={{ backgroundColor: "#00353E" }}
        >
          Browse PPO Plans in Your Area <ArrowRight size={14} />
        </Link>
        <Link
          href="/medicare-advantage/hmo"
          className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border"
          style={{ color: "#00353E", borderColor: "#00353E" }}
        >
          Compare with HMO Plans
        </Link>
      </div>
    </InfoPage>
  );
}
