// Part D sub-pages: Compare Drug Plans, Drug Formulary Search, Extra Help, Part D Enrollment
import InfoPage from "@/components/InfoPage";
import { Link } from "wouter";
import { CheckCircle2, AlertCircle, ArrowRight, Info, DollarSign, FileText, HelpCircle } from "lucide-react";

const SECTION = "Part D Drug Plans";
const SECTION_HREF = "/part-d";
const ACCENT = "#7C3AED";

// ── Compare Drug Plans ────────────────────────────────────────────────────────
export function CompareDrugPlans() {
  return (
    <InfoPage section={SECTION} sectionHref={SECTION_HREF} title="Compare Drug Plans" accentColor={ACCENT}
      subtitle="Understanding how to compare Medicare Part D plans can save you hundreds or thousands of dollars per year. Here's what to look for.">

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        What Is Medicare Part D?
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Medicare Part D is the federal prescription drug benefit administered through private
        insurance companies approved by Medicare. You can get Part D coverage two ways: as a
        standalone Prescription Drug Plan (PDP) added to Original Medicare, or bundled into a
        Medicare Advantage Prescription Drug plan (MAPD). In 2025, approximately 50 million
        Medicare beneficiaries have some form of Part D coverage.
      </p>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Key Factors When Comparing Part D Plans
      </h2>
      <div className="space-y-3 mb-6">
        {[
          {
            icon: DollarSign,
            title: "Total Annual Cost (Not Just Premium)",
            desc: "The plan with the lowest premium is rarely the cheapest overall. Always calculate your total annual cost: premium + deductible + copays for your specific drugs. Medicare.gov's Plan Finder does this automatically when you enter your drug list.",
          },
          {
            icon: FileText,
            title: "Formulary Coverage for Your Drugs",
            desc: "Each plan has a formulary (drug list). Verify that every medication you take is covered, and note the tier placement. A drug on Tier 1 might cost $5; the same drug on Tier 3 might cost $45. Some plans exclude certain drugs entirely.",
          },
          {
            icon: HelpCircle,
            title: "Pharmacy Network",
            desc: "Plans have preferred pharmacy networks where you pay lower copays. Using a non-preferred pharmacy can cost significantly more. Check if your preferred pharmacy (local or mail-order) is in-network and preferred.",
          },
          {
            icon: Info,
            title: "Coverage Rules (Prior Authorization, Step Therapy)",
            desc: "Some plans require prior authorization before covering certain drugs, or require you to try a cheaper drug first (step therapy). These rules can delay access to medications you need.",
          },
        ].map((item) => (
          <div key={item.title} className="flex gap-3 bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#EDE9FE" }}>
              <item.icon size={16} style={{ color: ACCENT }} />
            </div>
            <div>
              <div className="font-semibold text-gray-800 text-sm mb-1">{item.title}</div>
              <div className="text-gray-600 text-sm leading-relaxed">{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        2025 Part D Cost Structure
      </h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ backgroundColor: "#EDE9FE" }}>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Cost Component</th>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">2025 Amount</th>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Notes</th>
            </tr>
          </thead>
          <tbody>
            {[
              { item: "Standard deductible (maximum)", amount: "$590", note: "Many plans have $0 deductible for Tier 1–2 drugs" },
              { item: "Annual out-of-pocket cap (NEW)", amount: "$2,000", note: "Once you hit $2,000 OOP, you pay $0 for the rest of the year" },
              { item: "Insulin cap", amount: "$35/month per prescription", note: "Applies to all covered insulin products" },
              { item: "Vaccine cost-sharing", amount: "$0", note: "All ACIP-recommended vaccines covered at $0" },
              { item: "National base beneficiary premium", amount: "$38.99/month", note: "Used to calculate late enrollment penalty" },
              { item: "Late enrollment penalty", amount: "1% per month uncovered", note: "Permanent; added to your premium for life" },
            ].map((row) => (
              <tr key={row.item} className="border border-gray-200 hover:bg-gray-50">
                <td className="p-3 font-medium text-gray-800">{row.item}</td>
                <td className="p-3 font-semibold" style={{ color: ACCENT }}>{row.amount}</td>
                <td className="p-3 text-gray-500 text-xs">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Step-by-Step: How to Compare Plans
      </h2>
      <ol className="space-y-3 mb-6">
        {[
          "Make a complete list of all your medications with dosages and frequency",
          "Go to Medicare.gov/plan-compare and enter your ZIP code and drug list",
          "Filter results to show plans that cover all your drugs",
          "Sort by 'Estimated Annual Drug Cost' — this includes premium + deductible + copays",
          "Compare the top 3–5 plans and verify pharmacy network",
          "Check each plan's star rating (4+ stars is preferred)",
          "Enroll during October 15–December 7 Annual Enrollment Period (effective January 1)",
        ].map((step, i) => (
          <li key={step} className="flex gap-3 list-none">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5" style={{ backgroundColor: ACCENT }}>
              {i + 1}
            </div>
            <div className="text-gray-600 text-sm leading-relaxed">{step}</div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        <Link href="/part-d/enrollment" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>
          Part D Enrollment Guide <ArrowRight size={14} />
        </Link>
        <Link href="/part-d/extra-help" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border" style={{ color: ACCENT, borderColor: ACCENT }}>
          See If You Qualify for Extra Help
        </Link>
      </div>
    </InfoPage>
  );
}

// ── Drug Formulary Search ────────────────────────────────────────────────────
export function DrugFormularySearch() {
  return (
    <InfoPage section={SECTION} sectionHref={SECTION_HREF} title="Drug Formulary Search" accentColor={ACCENT}
      subtitle="A formulary is a plan's list of covered drugs. Understanding how formularies work helps you find plans that cover your medications at the lowest cost.">

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        What Is a Drug Formulary?
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        A formulary is the official list of prescription drugs covered by a Medicare Part D plan.
        Every Part D plan must cover at least two drugs in each drug category, but the specific
        drugs covered, their tier placement, and any coverage restrictions vary significantly
        between plans. A drug covered at Tier 1 ($5 copay) in one plan might be Tier 3 ($45 copay)
        or not covered at all in another.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        Plans must publish their formularies and update them at least quarterly. If a drug is
        removed from the formulary mid-year, the plan must notify you at least 60 days in advance
        (or at the time of your next refill), and you have the right to request an exception.
      </p>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        The 5-Tier Drug Formulary System
      </h2>
      <div className="space-y-2 mb-6">
        {[
          { tier: "Tier 1 — Preferred Generics", copay: "$0 – $5", color: "bg-[#E6F7F9] border-[#C8D8F5]", textColor: "text-green-800", examples: "Metformin, lisinopril, atorvastatin, amlodipine, omeprazole, sertraline, levothyroxine" },
          { tier: "Tier 2 — Non-Preferred Generics", copay: "$5 – $15", color: "bg-teal-50 border-teal-200", textColor: "text-teal-800", examples: "Higher-cost generics without a preferred generic equivalent" },
          { tier: "Tier 3 — Preferred Brand-Name", copay: "$35 – $50", color: "bg-blue-50 border-blue-200", textColor: "text-blue-800", examples: "Eliquis, Jardiance, Xarelto, Ozempic, Trulicity, Entresto" },
          { tier: "Tier 4 — Non-Preferred Brand-Name", copay: "$80 – $100", color: "bg-orange-50 border-orange-200", textColor: "text-orange-800", examples: "Brand drugs with available generic alternatives; newer brand drugs" },
          { tier: "Tier 5 — Specialty Drugs", copay: "25–33% coinsurance (max $2,000/yr)", color: "bg-red-50 border-red-200", textColor: "text-red-800", examples: "Biologics, cancer drugs, MS treatments, HIV medications, rare disease drugs" },
        ].map((item) => (
          <div key={item.tier} className={`rounded-xl p-3 border ${item.color}`}>
            <div className={`font-bold text-sm mb-1 ${item.textColor}`}>{item.tier}</div>
            <div className="flex flex-wrap gap-4 text-xs">
              <div><span className="text-gray-500">Typical copay: </span><span className="font-semibold text-gray-800">{item.copay}</span></div>
              <div><span className="text-gray-500">Examples: </span><span className="text-gray-700">{item.examples}</span></div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Coverage Rules That Can Affect Your Drugs
      </h2>
      <div className="space-y-3 mb-6">
        {[
          {
            rule: "Prior Authorization (PA)",
            desc: "The plan requires your doctor to get approval before covering the drug. Common for expensive brand-name drugs, opioids, and drugs with abuse potential. Your doctor submits a PA request; approval is usually required before you can fill the prescription.",
          },
          {
            rule: "Step Therapy",
            desc: "The plan requires you to try a less expensive drug first. For example, you may need to try a generic ACE inhibitor before the plan covers a brand-name ARB. Your doctor can request an exception if step therapy is medically inappropriate for you.",
          },
          {
            rule: "Quantity Limits",
            desc: "The plan limits the quantity of a drug dispensed per fill or per time period. For example, a plan might cover only 30 tablets of a pain medication per 30 days. Quantity limits are common for controlled substances.",
          },
          {
            rule: "Non-Formulary Drug Exceptions",
            desc: "If your drug isn't on the formulary, you can request a formulary exception. Your doctor must provide a statement explaining why the formulary drug is not appropriate for your condition. Plans must respond within 72 hours (24 hours for expedited requests).",
          },
        ].map((item) => (
          <div key={item.rule} className="border-l-4 border-purple-400 pl-4 py-1">
            <div className="font-semibold text-gray-800 text-sm mb-1">{item.rule}</div>
            <div className="text-gray-600 text-sm leading-relaxed">{item.desc}</div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        How to Search for Your Drugs
      </h2>
      <ul className="space-y-2 text-sm text-gray-600 mb-4">
        {[
          "Visit Medicare.gov/plan-compare — the official Medicare Plan Finder",
          "Enter your ZIP code and click 'Find plans'",
          "Select 'Drug plans' and add each of your medications",
          "The tool shows which plans cover your drugs and at what tier",
          "Filter by 'Covers all my drugs' to eliminate plans that don't cover your medications",
          "Compare estimated annual drug costs, including premium + deductible + copays",
          "Check each plan's preferred pharmacy to ensure your pharmacy is in-network",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-purple-600 shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>

      <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm text-purple-800 mb-6">
        <div className="flex items-start gap-2">
          <Info size={15} className="shrink-0 mt-0.5" />
          <div>
            <strong>Mail-order pharmacies:</strong> Most Part D plans offer mail-order pharmacy
            options where you can get a 90-day supply for roughly 2× the 30-day copay — effectively
            a 33% discount. If you take maintenance medications, mail order can save $100–$500/year.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <a href="https://www.medicare.gov/plan-compare" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white"
          style={{ backgroundColor: ACCENT }}>
          Search Plans on Medicare.gov <ArrowRight size={14} />
        </a>
        <Link href="/part-d/compare" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border" style={{ color: ACCENT, borderColor: ACCENT }}>
          How to Compare Drug Plans
        </Link>
      </div>
    </InfoPage>
  );
}

// ── Extra Help Programs ──────────────────────────────────────────────────────
export function ExtraHelpPrograms() {
  return (
    <InfoPage section={SECTION} sectionHref={SECTION_HREF} title="Extra Help Programs" accentColor={ACCENT}
      subtitle="The Extra Help program (Low Income Subsidy) can eliminate most or all of your Part D drug costs if you have limited income and resources.">

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        What Is Extra Help?
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Extra Help — also known as the Low Income Subsidy (LIS) — is a federal program that helps
        people with Medicare who have limited income and resources pay for their Part D prescription
        drug costs. Extra Help can pay for some or all of your Part D premiums, deductibles,
        copayments, and coinsurance.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        In 2025, approximately 14 million Medicare beneficiaries receive Extra Help, but the Social
        Security Administration estimates that millions more are eligible and not enrolled. If you
        qualify, you could save $5,000 or more per year on prescription drug costs.
      </p>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        2025 Eligibility Requirements
      </h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ backgroundColor: "#EDE9FE" }}>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Requirement</th>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Full Extra Help</th>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Partial Extra Help</th>
            </tr>
          </thead>
          <tbody>
            {[
              { req: "Medicare enrollment", full: "Part A and/or Part B", partial: "Part A and/or Part B" },
              { req: "Annual income (individual)", full: "≤ $22,590", partial: "$22,590 – $33,885" },
              { req: "Annual income (married couple)", full: "≤ $30,660", partial: "$30,660 – $45,990" },
              { req: "Resources (individual)", full: "≤ $17,220", partial: "$17,220 – $34,360" },
              { req: "Resources (married couple)", full: "≤ $34,360", partial: "$34,360 – $68,720" },
              { req: "Residence", full: "U.S. or D.C.", partial: "U.S. or D.C." },
            ].map((row) => (
              <tr key={row.req} className="border border-gray-200 hover:bg-gray-50">
                <td className="p-3 font-medium text-gray-800">{row.req}</td>
                <td className="p-3 text-[#00353E] font-medium">{row.full}</td>
                <td className="p-3 text-blue-700">{row.partial}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-gray-500 text-xs mb-4">
        Resources include bank accounts, stocks, and bonds — but NOT your home, car, personal belongings, or life insurance.
        Income limits are approximate and adjusted annually. Verify current limits at SSA.gov or Medicare.gov.
      </p>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        What Extra Help Pays For
      </h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <h3 className="font-bold text-green-800 text-sm mb-2">Full Extra Help (Level 1)</h3>
          <ul className="space-y-1.5 text-xs text-green-900">
            {[
              "$0 Part D premium (benchmark plan)",
              "$0 deductible",
              "$4.50 copay for generic drugs",
              "$11.20 copay for brand-name drugs",
              "$0 copay once you reach catastrophic coverage",
              "No coverage gap (donut hole)",
            ].map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <CheckCircle2 size={12} className="text-green-600 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <h3 className="font-bold text-blue-800 text-sm mb-2">Partial Extra Help (Level 2)</h3>
          <ul className="space-y-1.5 text-xs text-blue-900">
            {[
              "Reduced Part D premium (sliding scale)",
              "Reduced deductible",
              "Reduced copays based on income",
              "Protection from coverage gap",
              "Reduced catastrophic coverage copays",
              "Special Enrollment Period to change plans monthly",
            ].map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <CheckCircle2 size={12} className="text-blue-600 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Automatic Enrollment — Who Qualifies Without Applying
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">
        You may be automatically enrolled in Extra Help (Full) if you receive:
      </p>
      <ul className="space-y-2 text-sm text-gray-600 mb-4">
        {[
          "Medicaid (full benefits from your state)",
          "Supplemental Security Income (SSI)",
          "Medicare Savings Program (QMB, SLMB, QI, or QDWI)",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-purple-600 shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        How to Apply for Extra Help
      </h2>
      <ol className="space-y-3 mb-6">
        {[
          { step: "Apply online at SSA.gov/medicare/part-d-extra-help", detail: "The online application takes about 15 minutes. You'll need your Medicare number, income information, and resource details." },
          { step: "Call Social Security at 1-800-772-1213", detail: "Representatives can take your application over the phone (TTY: 1-800-325-0778). Available Monday–Friday, 8 AM–7 PM." },
          { step: "Visit your local Social Security office", detail: "Bring documentation of income, resources, and Medicare enrollment. Find your local office at SSA.gov/locator." },
          { step: "Apply through your State Medicaid office", detail: "Your state may have additional assistance programs. Applying for Medicaid may automatically qualify you for Extra Help." },
        ].map((item, i) => (
          <li key={item.step} className="flex gap-3 list-none">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5" style={{ backgroundColor: ACCENT }}>
              {i + 1}
            </div>
            <div>
              <div className="font-semibold text-gray-800 text-sm">{item.step}</div>
              <div className="text-gray-600 text-xs mt-0.5">{item.detail}</div>
            </div>
          </li>
        ))}
      </ol>

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800 mb-6">
        <div className="flex items-start gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div>
            <strong>Apply every year:</strong> Extra Help eligibility is re-evaluated annually.
            If your income or resources change, you may gain or lose eligibility. SSA will send
            you a renewal notice each year — respond promptly to avoid a gap in benefits.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <a href="https://www.ssa.gov/medicare/part-d-extra-help" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white"
          style={{ backgroundColor: ACCENT }}>
          Apply for Extra Help at SSA.gov <ArrowRight size={14} />
        </a>
        <Link href="/part-d/compare" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border" style={{ color: ACCENT, borderColor: ACCENT }}>
          Compare Drug Plans
        </Link>
      </div>
    </InfoPage>
  );
}

// ── Part D Enrollment ────────────────────────────────────────────────────────
export function PartDEnrollment() {
  return (
    <InfoPage section={SECTION} sectionHref={SECTION_HREF} title="Part D Enrollment" accentColor={ACCENT}
      subtitle="Enrolling in Part D at the right time is critical — missing your enrollment window can result in a permanent late enrollment penalty added to your premium for life.">

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        When Can You Enroll in Part D?
      </h2>
      <div className="space-y-3 mb-6">
        {[
          {
            period: "Initial Enrollment Period (IEP)",
            when: "7-month window: 3 months before you turn 65, the month of your birthday, and 3 months after",
            detail: "This is your first opportunity to enroll in Part D. Enrolling during the first 3 months of your IEP ensures coverage starts on the 1st of the month you turn 65.",
            color: "border-[#C8D8F5] bg-green-50",
            badge: "Best Time to Enroll",
          },
          {
            period: "Annual Enrollment Period (AEP)",
            when: "October 15 – December 7 each year",
            detail: "During AEP, you can join, switch, or drop a Part D plan. Changes take effect January 1 of the following year. This is the primary window for changing plans each year.",
            color: "border-blue-200 bg-blue-50",
            badge: "Annual Window",
          },
          {
            period: "Medicare Advantage Open Enrollment Period",
            when: "January 1 – March 31 each year",
            detail: "If you're in a Medicare Advantage plan, you can switch to another MA plan or return to Original Medicare (and add a standalone Part D plan) during this period.",
            color: "border-purple-200 bg-purple-50",
            badge: "MA Enrollees",
          },
          {
            period: "Special Enrollment Period (SEP)",
            when: "Varies by qualifying event",
            detail: "You may qualify for an SEP if you lose other creditable drug coverage, move out of your plan's service area, qualify for Extra Help, or experience other qualifying life events.",
            color: "border-orange-200 bg-orange-50",
            badge: "Life Events",
          },
        ].map((item) => (
          <div key={item.period} className={`rounded-xl p-4 border ${item.color}`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="font-bold text-gray-800 text-sm">{item.period}</div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 whitespace-nowrap">{item.badge}</span>
            </div>
            <div className="text-xs font-semibold text-gray-600 mb-1">{item.when}</div>
            <div className="text-gray-600 text-sm leading-relaxed">{item.detail}</div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        The Late Enrollment Penalty — Avoid It at All Costs
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">
        If you don't enroll in Part D when you're first eligible and go 63 or more consecutive days
        without creditable drug coverage, you'll face a <strong>permanent late enrollment penalty</strong>
        added to your monthly Part D premium for as long as you have Part D coverage.
      </p>
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 mb-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div>
            <strong>Penalty calculation (2025):</strong> 1% × $38.99 (national base premium) × number
            of full months without coverage. Example: 24 months uncovered = 24% × $38.99 = $9.36/month
            added permanently to your premium. Over 20 years, that's $2,246 in extra costs.
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        What Counts as Creditable Coverage?
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">
        You can delay Part D enrollment without penalty if you have other "creditable" drug coverage
        — coverage that is at least as good as the standard Part D benefit. Examples include:
      </p>
      <ul className="space-y-2 text-sm text-gray-600 mb-6">
        {[
          "Employer or union group health plan with drug coverage (active or retiree)",
          "TRICARE (military) coverage",
          "Veterans Affairs (VA) drug benefits",
          "FEHB (Federal Employees Health Benefits) plans",
          "COBRA continuation coverage with drug benefits",
          "State Pharmaceutical Assistance Programs (SPAPs)",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-purple-600 shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        How to Enroll in Part D
      </h2>
      <ol className="space-y-3 mb-6">
        {[
          { step: "Compare plans on Medicare.gov/plan-compare", detail: "Enter your ZIP code and drug list to see all available plans and estimated annual costs." },
          { step: "Select your plan and click 'Enroll'", detail: "You'll be redirected to the plan's enrollment page or can call the plan directly." },
          { step: "Provide your Medicare number and personal information", detail: "Have your Medicare card ready. You'll need your Medicare Beneficiary Identifier (MBI)." },
          { step: "Confirm your effective date", detail: "Coverage typically starts January 1 (AEP enrollments) or the 1st of the following month (IEP enrollments)." },
          { step: "Receive your new insurance card", detail: "Your plan will mail your card within 2–3 weeks. Use your Medicare card for services until your new card arrives." },
        ].map((item, i) => (
          <li key={item.step} className="flex gap-3 list-none">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5" style={{ backgroundColor: ACCENT }}>
              {i + 1}
            </div>
            <div>
              <div className="font-semibold text-gray-800 text-sm">{item.step}</div>
              <div className="text-gray-600 text-xs mt-0.5">{item.detail}</div>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        <Link href="/part-d/compare" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>
          Compare Drug Plans <ArrowRight size={14} />
        </Link>
        <Link href="/resources/enrollment-periods" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border" style={{ color: ACCENT, borderColor: ACCENT }}>
          All Enrollment Periods
        </Link>
      </div>
    </InfoPage>
  );
}
