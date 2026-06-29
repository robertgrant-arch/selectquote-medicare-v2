import InfoPage from "@/components/InfoPage";
import { Link } from "wouter";
import { CheckCircle2, ArrowRight, AlertCircle } from "lucide-react";

export default function MASNPlans() {
  return (
    <InfoPage
      section="Medicare Advantage"
      sectionHref="/plans"
      title="Medicare Advantage Special Needs Plans"
      subtitle="SNPs are tailored Medicare Advantage plans designed for people with specific chronic conditions, dual Medicare-Medicaid eligibility, or institutional care needs."
    >
      {/* Overview */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        What Is a Special Needs Plan (SNP)?
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Special Needs Plans (SNPs) are a specialized category of Medicare Advantage plans authorized
        by Congress to serve beneficiaries with particular health circumstances. Unlike standard MA
        plans, SNPs tailor their benefits, provider networks, drug formularies, and care management
        programs specifically to the needs of their target population.
      </p>
      <p className="text-gray-600 leading-relaxed mb-6">
        SNPs have grown rapidly: in 2025, they account for 21% of all Medicare Advantage enrollees —
        up from just 14% in 2020 — reflecting growing recognition that specialized, coordinated care
        produces better outcomes for high-need populations. The number of SNP plans increased by 8.5%
        from 2024 to 2025 alone.
      </p>

      {/* Three types */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        The Three Types of SNPs
      </h2>
      <div className="space-y-4 mb-6">
        {/* D-SNP */}
        <div className="border border-blue-200 rounded-xl overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-2 font-bold text-sm">
            Dual-Eligible SNP (D-SNP)
          </div>
          <div className="p-4">
            <p className="text-gray-600 text-sm leading-relaxed mb-3">
              D-SNPs serve people who qualify for both Medicare (federal) and Medicaid (state). In
              2025, new integrated care SEPs allow monthly enrollment in select D-SNPs paired with a
              Medicaid plan under the same insurer, enabling truly coordinated coverage across both
              programs.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-1">Eligibility</div>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Enrolled in Medicare Part A and/or B</li>
                  <li>• Receiving full Medicaid benefits from your state</li>
                  <li>• May include QMB, SLMB, QI, or QDWI status</li>
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-1">Key Benefits</div>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• $0 or very low premiums and copays</li>
                  <li>• Medicaid pays most remaining cost-sharing</li>
                  <li>• Enhanced care coordination between Medicare and Medicaid</li>
                  <li>• Monthly enrollment (not just annual)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* C-SNP */}
        <div className="border border-purple-200 rounded-xl overflow-hidden">
          <div className="bg-purple-600 text-white px-4 py-2 font-bold text-sm">
            Chronic Condition SNP (C-SNP)
          </div>
          <div className="p-4">
            <p className="text-gray-600 text-sm leading-relaxed mb-3">
              C-SNPs are designed for people with one or more severe or disabling chronic conditions.
              They offer disease-specific care management, formularies optimized for the condition,
              and networks of specialists experienced in treating it.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-1">Qualifying Conditions (examples)</div>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Chronic heart failure (CHF)</li>
                  <li>• Diabetes mellitus</li>
                  <li>• Chronic obstructive pulmonary disease (COPD)</li>
                  <li>• End-stage renal disease (ESRD)</li>
                  <li>• HIV/AIDS</li>
                  <li>• Dementia / Alzheimer's disease</li>
                  <li>• Autoimmune disorders</li>
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-1">Specialized Features</div>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Disease management programs</li>
                  <li>• Dedicated care coordinators</li>
                  <li>• Formularies with condition-specific drugs at lower tiers</li>
                  <li>• Specialist-heavy networks</li>
                  <li>• Telehealth for chronic condition monitoring</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* I-SNP */}
        <div className="border border-teal-200 rounded-xl overflow-hidden">
          <div className="bg-teal-600 text-white px-4 py-2 font-bold text-sm">
            Institutional SNP (I-SNP)
          </div>
          <div className="p-4">
            <p className="text-gray-600 text-sm leading-relaxed mb-3">
              I-SNPs serve people who live in an institution (such as a nursing home or long-term
              care facility) or who require an equivalent level of care. These plans coordinate
              closely with facility staff to manage all aspects of a resident's health care.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-1">Who Qualifies</div>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Residents of skilled nursing facilities (SNFs)</li>
                  <li>• Long-term care (LTC) facility residents</li>
                  <li>• People who need nursing-level care at home</li>
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-1">Key Benefits</div>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• On-site care coordination with facility</li>
                  <li>• Comprehensive drug coverage</li>
                  <li>• Reduced hospitalizations through proactive management</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SNP vs standard MA */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        How SNPs Differ from Standard MA Plans
      </h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-green-50">
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Feature</th>
              <th className="p-3 font-semibold text-gray-700 border border-gray-200 text-center">Standard MA</th>
              <th className="p-3 font-semibold text-gray-700 border border-gray-200 text-center bg-[#E8F0FE]">SNP</th>
            </tr>
          </thead>
          <tbody>
            {[
              { feature: "Eligibility", std: "Any Medicare beneficiary", snp: "Must meet specific criteria" },
              { feature: "Care management", std: "General wellness programs", snp: "Condition-specific care coordinators" },
              { feature: "Drug formulary", std: "General formulary", snp: "Optimized for target condition" },
              { feature: "Provider network", std: "General network", snp: "Specialists in target condition" },
              { feature: "Cost-sharing (D-SNP)", std: "Standard copays", snp: "Often $0 with Medicaid" },
              { feature: "Enrollment timing", std: "Annual enrollment only", snp: "D-SNPs: monthly enrollment available" },
              { feature: "Extra benefits", std: "Dental, vision, hearing", snp: "Plus condition-specific extras" },
            ].map((row) => (
              <tr key={row.feature} className="border border-gray-200 hover:bg-gray-50">
                <td className="p-3 text-gray-700">{row.feature}</td>
                <td className="p-3 text-center text-gray-600 text-xs">{row.std}</td>
                <td className="p-3 text-center text-green-800 font-medium text-xs bg-green-50">{row.snp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Enrollment */}
      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Enrolling in an SNP
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">
        To enroll in an SNP, you must meet the plan's eligibility requirements and live in the plan's
        service area. Standard enrollment periods apply (Initial Enrollment, Annual Enrollment
        October 15–December 7), with the following exceptions:
      </p>
      <ul className="space-y-2 text-sm text-gray-600 mb-6">
        {[
          "D-SNP enrollees may enroll monthly if the plan is integrated with a Medicaid managed care plan (new in 2025)",
          "C-SNP and I-SNP enrollees may use a Special Enrollment Period when they first qualify",
          "Losing eligibility for an SNP triggers a Special Enrollment Period to switch plans",
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
            <strong>Eligibility verification:</strong> SNP plans are required to verify your
            eligibility at enrollment and periodically thereafter. If you no longer meet the
            eligibility criteria, the plan must disenroll you and help you transition to another plan.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/plans?zip=64106"
          className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white"
          style={{ backgroundColor: "#1C3A48" }}
        >
          Browse SNP Plans in Your Area <ArrowRight size={14} />
        </Link>
        <Link
          href="/dual-eligible"
          className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border"
          style={{ color: "#1C3A48", borderColor: "#1C3A48" }}
        >
          Learn About Dual Eligible Benefits
        </Link>
      </div>
    </InfoPage>
  );
}
