// Medicare Supplement (Medigap) sub-pages — Plan F, Plan G, Plan N, Compare
import InfoPage from "@/components/InfoPage";
import { Link } from "wouter";
import { CheckCircle2, AlertCircle, ArrowRight, Info } from "lucide-react";

const SECTION = "Medicare Supplement";
const SECTION_HREF = "/medicare-supplement";
const ACCENT = "#1D4ED8";

// ── Full benefits comparison table ──────────────────────────────────────────
function BenefitsTable({ highlighted }: { highlighted: string }) {
  const benefits = [
    { benefit: "Part A coinsurance & hospital costs (up to 365 days after Medicare benefits used)", f: "100%", g: "100%", n: "100%" },
    { benefit: "Part B coinsurance or copayment", f: "100%", g: "100%", n: "100%*" },
    { benefit: "Blood (first 3 pints)", f: "100%", g: "100%", n: "100%" },
    { benefit: "Part A hospice care coinsurance or copayment", f: "100%", g: "100%", n: "100%" },
    { benefit: "Skilled nursing facility care coinsurance", f: "100%", g: "100%", n: "100%" },
    { benefit: "Part A deductible ($1,676 in 2025)", f: "100%", g: "100%", n: "100%" },
    { benefit: "Part B deductible ($257 in 2025)", f: "100%", g: "—", n: "—" },
    { benefit: "Part B excess charges", f: "100%", g: "100%", n: "—" },
    { benefit: "Foreign travel emergency (up to plan limits)", f: "80%", g: "80%", n: "80%" },
  ];
  return (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#EEF5F7]">
            <th className="text-left p-2.5 font-semibold text-gray-700 border border-gray-200 w-1/2">Benefit</th>
            <th className={`p-2.5 font-semibold border border-gray-200 text-center ${highlighted === "Plan F" ? "bg-blue-200" : ""}`}>Plan F</th>
            <th className={`p-2.5 font-semibold border border-gray-200 text-center ${highlighted === "Plan G" ? "bg-blue-200" : ""}`}>Plan G</th>
            <th className={`p-2.5 font-semibold border border-gray-200 text-center ${highlighted === "Plan N" ? "bg-blue-200" : ""}`}>Plan N</th>
          </tr>
        </thead>
        <tbody>
          {benefits.map((row) => (
            <tr key={row.benefit} className="border border-gray-200 hover:bg-gray-50">
              <td className="p-2.5 text-gray-700">{row.benefit}</td>
              <td className={`p-2.5 text-center font-medium border border-gray-200 ${row.f === "100%" || row.f === "80%" ? "text-[#1C3A48]" : "text-amber-600"} ${highlighted === "Plan F" ? "bg-[#EEF5F7]" : ""}`}>{row.f}</td>
              <td className={`p-2.5 text-center font-medium border border-gray-200 ${row.g === "100%" || row.g === "80%" ? "text-[#1C3A48]" : "text-amber-600"} ${highlighted === "Plan G" ? "bg-[#EEF5F7]" : ""}`}>{row.g}</td>
              <td className={`p-2.5 text-center font-medium border border-gray-200 ${row.n === "100%" || row.n === "80%" ? "text-[#1C3A48]" : "text-amber-600"} ${highlighted === "Plan N" ? "bg-[#EEF5F7]" : ""}`}>{row.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-500 mt-1">* Plan N pays 100% of Part B coinsurance except for up to $20 copay for office visits and up to $50 for ER visits not resulting in inpatient admission.</p>
    </div>
  );
}

// ── Plan F ───────────────────────────────────────────────────────────────────
export function MedigapPlanF() {
  return (
    <InfoPage section={SECTION} sectionHref={SECTION_HREF} title="Medigap Plan F" accentColor={ACCENT}
      subtitle="The most comprehensive Medigap plan — covers virtually all Medicare-approved out-of-pocket costs, including the Part B deductible.">

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        What Does Medigap Plan F Cover?
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Medigap Plan F is the most comprehensive Medicare Supplement plan available. It covers
        every Medicare-approved gap in Original Medicare coverage — meaning you pay $0 out of pocket
        for any Medicare-covered service, including the annual Part B deductible ($257 in 2025) and
        Part B excess charges.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        With Plan F, your only cost is the monthly premium. There are no copays, no deductibles, and
        no coinsurance for covered services. This makes budgeting for health care extremely
        predictable — you simply pay your monthly premium and Medicare handles the rest.
      </p>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div>
            <strong>Availability restriction:</strong> Plan F is only available to Medicare
            beneficiaries who became eligible for Medicare <em>before January 1, 2020</em>. If you
            turned 65 on or after January 1, 2020, you cannot enroll in Plan F. Plan G is the
            equivalent option for newer enrollees.
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Plan F Coverage Details
      </h2>
      <BenefitsTable highlighted="Plan F" />

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Plan F Costs in 2025
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">
        Because Plan F covers the most benefits, it typically carries the highest monthly premium.
        Premiums vary significantly by age, gender, tobacco use, and location. National averages:
      </p>
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#EEF5F7]">
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Age at Enrollment</th>
              <th className="p-3 font-semibold text-gray-700 border border-gray-200 text-center">Avg Monthly Premium</th>
              <th className="p-3 font-semibold text-gray-700 border border-gray-200 text-center">Annual Premium</th>
            </tr>
          </thead>
          <tbody>
            {[
              { age: "65", monthly: "$150 – $200", annual: "$1,800 – $2,400" },
              { age: "70", monthly: "$180 – $250", annual: "$2,160 – $3,000" },
              { age: "75", monthly: "$220 – $310", annual: "$2,640 – $3,720" },
              { age: "80", monthly: "$280 – $400", annual: "$3,360 – $4,800" },
            ].map((row) => (
              <tr key={row.age} className="border border-gray-200 hover:bg-gray-50">
                <td className="p-3 text-gray-700">Age {row.age}</td>
                <td className="p-3 text-center font-medium text-blue-700">{row.monthly}</td>
                <td className="p-3 text-center text-gray-600">{row.annual}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-gray-500 text-xs mb-4">Premiums are illustrative averages; actual rates vary by insurer, state, and individual factors.</p>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Plan F vs. Plan G: Which Is Better?
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">
        The only difference between Plan F and Plan G is that Plan F covers the Part B deductible
        ($257 in 2025) and Plan G does not. To determine which is better for you, compare the
        premium difference:
      </p>
      <div className="bg-[#EEF5F7] border border-blue-100 rounded-xl p-4 text-sm text-blue-800 mb-6">
        <strong>Simple math:</strong> If Plan F costs more than $257/year more than Plan G, Plan G
        saves you money. In most markets, Plan G premiums are $20–$60/month less than Plan F,
        meaning Plan G is almost always the better financial choice for new enrollees — even if
        Plan F were available to them.
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/medicare-supplement/plan-g" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>
          Compare with Plan G <ArrowRight size={14} />
        </Link>
        <Link href="/medicare-supplement/compare" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border" style={{ color: ACCENT, borderColor: ACCENT }}>
          Full Plan Comparison
        </Link>
      </div>
    </InfoPage>
  );
}

// ── Plan G ───────────────────────────────────────────────────────────────────
export function MedigapPlanG() {
  return (
    <InfoPage section={SECTION} sectionHref={SECTION_HREF} title="Medigap Plan G" accentColor={ACCENT}
      subtitle="The most popular Medigap plan for new enrollees — covers everything Plan F does except the Part B deductible, at a lower monthly premium.">

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Why Plan G Is the Top Choice for New Enrollees
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Medigap Plan G has become the most popular Medicare Supplement plan for new Medicare
        enrollees since Plan F was closed to new beneficiaries in 2020. Plan G covers every Medicare
        gap except the annual Part B deductible ($257 in 2025). After paying that one deductible
        each year, you pay $0 out of pocket for any Medicare-covered service for the rest of the year.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        Because Plan G premiums are typically $20–$60/month lower than Plan F, most beneficiaries
        save money with Plan G even after accounting for the Part B deductible. The math is simple:
        if the premium savings exceed $257/year, Plan G wins.
      </p>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Plan G Coverage Details
      </h2>
      <BenefitsTable highlighted="Plan G" />

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Plan G Costs in 2025
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">
        Plan G premiums vary by insurer, state, age, gender, and tobacco use. National averages for
        a non-tobacco female at enrollment:
      </p>
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#EEF5F7]">
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Age</th>
              <th className="p-3 font-semibold text-gray-700 border border-gray-200 text-center">Avg Monthly Premium</th>
              <th className="p-3 font-semibold text-gray-700 border border-gray-200 text-center">Annual Total (incl. deductible)</th>
            </tr>
          </thead>
          <tbody>
            {[
              { age: "65", monthly: "$120 – $170", annual: "$1,697 – $2,297" },
              { age: "70", monthly: "$150 – $210", annual: "$2,057 – $2,777" },
              { age: "75", monthly: "$190 – $270", annual: "$2,537 – $3,497" },
              { age: "80", monthly: "$240 – $350", annual: "$3,137 – $4,457" },
            ].map((row) => (
              <tr key={row.age} className="border border-gray-200 hover:bg-gray-50">
                <td className="p-3 text-gray-700">Age {row.age}</td>
                <td className="p-3 text-center font-medium text-blue-700">{row.monthly}</td>
                <td className="p-3 text-center text-gray-600">{row.annual}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-gray-500 text-xs mb-4">Includes the $257 Part B deductible. Actual rates vary by insurer, state, and individual factors.</p>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        How Insurers Price Plan G
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">
        Because Plan G benefits are standardized by law, the only difference between plans from
        different insurers is the premium. Insurers use three pricing methods:
      </p>
      <div className="space-y-3 mb-6">
        {[
          { method: "Community-rated (no-age-rated)", desc: "Same premium for everyone regardless of age. Premiums increase only due to inflation, not aging. Best long-term value if you're in a state that offers it." },
          { method: "Issue-age-rated (entry-age-rated)", desc: "Premium is based on your age when you first enroll and doesn't increase as you age. Premiums may still increase due to inflation." },
          { method: "Attained-age-rated", desc: "Premium increases as you get older. Starts lower but becomes more expensive over time. Most common pricing method." },
        ].map((item) => (
          <div key={item.method} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="font-semibold text-gray-800 text-sm mb-1">{item.method}</div>
            <div className="text-gray-600 text-sm leading-relaxed">{item.desc}</div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        When to Enroll in Plan G
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">
        The best time to enroll is during your <strong>Medigap Open Enrollment Period</strong> — the
        6-month window that begins the first month you have Medicare Part B and are age 65 or older.
        During this period, insurers cannot:
      </p>
      <ul className="space-y-2 text-sm text-gray-600 mb-6">
        {[
          "Refuse to sell you a Medigap policy",
          "Charge you more due to pre-existing health conditions",
          "Make you wait for coverage to begin",
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
            After your open enrollment period ends, insurers in most states can use medical
            underwriting — meaning they can charge more or deny coverage based on your health
            history. Enroll during your open enrollment period whenever possible.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/medicare-supplement/compare" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>
          Compare All Medigap Plans <ArrowRight size={14} />
        </Link>
        <Link href="/medicare-supplement/plan-n" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border" style={{ color: ACCENT, borderColor: ACCENT }}>
          Compare with Plan N
        </Link>
      </div>
    </InfoPage>
  );
}

// ── Plan N ───────────────────────────────────────────────────────────────────
export function MedigapPlanN() {
  return (
    <InfoPage section={SECTION} sectionHref={SECTION_HREF} title="Medigap Plan N" accentColor={ACCENT}
      subtitle="A cost-sharing plan with lower premiums — you pay small copays for office and ER visits in exchange for meaningfully reduced monthly costs.">

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        What Is Medigap Plan N?
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Medigap Plan N is a Medicare Supplement plan that offers comprehensive coverage at a lower
        monthly premium than Plan G, in exchange for small cost-sharing when you use services. You
        pay up to $20 for office visits and up to $50 for emergency room visits that don't result in
        inpatient admission. All other Medicare-covered services are covered at 100% after the Part B
        deductible.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        Plan N does not cover Part B excess charges — the amount a doctor can charge above the
        Medicare-approved amount (up to 15% more). To avoid excess charges with Plan N, choose
        doctors who accept Medicare assignment (the vast majority do).
      </p>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Plan N Coverage Details
      </h2>
      <BenefitsTable highlighted="Plan N" />

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Plan N vs. Plan G: The Cost-Sharing Trade-off
      </h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#EEF5F7]">
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Feature</th>
              <th className="p-3 font-semibold text-gray-700 border border-gray-200 text-center">Plan G</th>
              <th className="p-3 font-semibold text-gray-700 border border-gray-200 text-center bg-blue-100">Plan N</th>
            </tr>
          </thead>
          <tbody>
            {[
              { feature: "Monthly premium (avg, age 65)", g: "$120 – $170", n: "$90 – $130" },
              { feature: "Part B deductible ($257/yr)", g: "Not covered (you pay)", n: "Not covered (you pay)" },
              { feature: "Office visit copay", g: "$0", n: "Up to $20" },
              { feature: "ER visit copay (no admission)", g: "$0", n: "Up to $50" },
              { feature: "Part B excess charges", g: "Covered", n: "Not covered" },
              { feature: "Inpatient hospital", g: "$0", n: "$0" },
              { feature: "Foreign travel emergency", g: "80% (up to limits)", n: "80% (up to limits)" },
            ].map((row) => (
              <tr key={row.feature} className="border border-gray-200 hover:bg-gray-50">
                <td className="p-3 text-gray-700">{row.feature}</td>
                <td className="p-3 text-center text-gray-600">{row.g}</td>
                <td className="p-3 text-center font-medium text-blue-700 bg-[#EEF5F7]">{row.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Is Plan N Right for You?
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">
        Plan N makes the most financial sense if:
      </p>
      <ul className="space-y-2 text-sm text-gray-600 mb-4">
        {[
          "You're generally healthy and don't visit doctors frequently",
          "You only see doctors who accept Medicare assignment (avoiding excess charges)",
          "The premium savings ($30–$50/month) outweigh your expected copays",
          "You rarely use the emergency room",
          "You want comprehensive coverage but are willing to accept minor cost-sharing",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-green-600 shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>

      <div className="bg-[#EEF5F7] border border-blue-100 rounded-xl p-4 text-sm text-blue-800 mb-6">
        <div className="flex items-start gap-2">
          <Info size={15} className="shrink-0 mt-0.5" />
          <div>
            <strong>Break-even analysis:</strong> If Plan N saves you $40/month vs. Plan G, that's
            $480/year in savings. To break even, you'd need to pay more than $480 in copays — that's
            24 office visits at $20 each. Most beneficiaries with Plan N come out ahead.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/medicare-supplement/compare" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>
          Compare All Medigap Plans <ArrowRight size={14} />
        </Link>
        <Link href="/medicare-supplement/plan-g" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border" style={{ color: ACCENT, borderColor: ACCENT }}>
          Compare with Plan G
        </Link>
      </div>
    </InfoPage>
  );
}

// ── Compare Supplement Plans ─────────────────────────────────────────────────
export function CompareSupplementPlans() {
  return (
    <InfoPage section={SECTION} sectionHref={SECTION_HREF} title="Compare Supplement Plans" accentColor={ACCENT}
      subtitle="Side-by-side comparison of the most popular Medigap plans — Plan F, G, and N — to help you choose the right coverage for your health and budget.">

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        What Is Medicare Supplement (Medigap) Insurance?
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Original Medicare (Parts A and B) covers most medical costs but leaves significant gaps —
        deductibles, copays, coinsurance, and no out-of-pocket maximum. Medicare Supplement
        (Medigap) plans are sold by private insurers to fill these gaps. You pay a monthly premium
        to the Medigap insurer, and it pays some or all of the costs that Original Medicare doesn't
        cover.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        Medigap plans are standardized by the federal government: every Plan G from every insurer
        offers the exact same benefits. The only difference between insurers is the monthly premium.
        This makes comparison shopping straightforward — you're simply shopping for the lowest
        premium for the plan letter you want.
      </p>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div>
            <strong>Important:</strong> Medigap plans do not include prescription drug coverage.
            If you have Original Medicare + Medigap, you'll need a separate standalone Part D plan
            for drug coverage. Medicare Advantage (Part C) plans, by contrast, typically include
            drug coverage.
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Full Benefits Comparison: Plans F, G, and N
      </h2>
      <BenefitsTable highlighted="" />

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Cost Comparison at a Glance
      </h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#EEF5F7]">
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Factor</th>
              <th className="p-3 font-semibold text-gray-700 border border-gray-200 text-center">Plan F</th>
              <th className="p-3 font-semibold text-gray-700 border border-gray-200 text-center">Plan G</th>
              <th className="p-3 font-semibold text-gray-700 border border-gray-200 text-center">Plan N</th>
            </tr>
          </thead>
          <tbody>
            {[
              { factor: "Avg monthly premium (age 65)", f: "$150–$200", g: "$120–$170", n: "$90–$130" },
              { factor: "Annual deductible you pay", f: "$0", g: "$257 (Part B)", n: "$257 (Part B)" },
              { factor: "Office visit copay", f: "$0", g: "$0", n: "Up to $20" },
              { factor: "ER copay (no admission)", f: "$0", g: "$0", n: "Up to $50" },
              { factor: "Part B excess charges", f: "Covered", g: "Covered", n: "Not covered" },
              { factor: "Available to new enrollees?", f: "No (pre-2020 only)", g: "Yes", n: "Yes" },
              { factor: "Best for", f: "Predictable $0 costs", g: "Best value overall", n: "Healthy, low utilizers" },
            ].map((row) => (
              <tr key={row.factor} className="border border-gray-200 hover:bg-gray-50">
                <td className="p-3 font-medium text-gray-700">{row.factor}</td>
                <td className="p-3 text-center text-gray-600 text-xs">{row.f}</td>
                <td className="p-3 text-center text-blue-700 font-medium text-xs bg-[#EEF5F7]">{row.g}</td>
                <td className="p-3 text-center text-gray-600 text-xs">{row.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Medigap vs. Medicare Advantage: Which Is Right for You?
      </h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#EEF5F7] border border-blue-100 rounded-xl p-4">
          <h3 className="font-bold text-blue-800 text-sm mb-2">Choose Medigap if you:</h3>
          <ul className="space-y-1.5 text-xs text-blue-900">
            {[
              "Want freedom to see any Medicare-accepting doctor nationwide",
              "Travel frequently or split time between states",
              "Have complex health needs and see many specialists",
              "Want predictable, near-zero out-of-pocket costs",
              "Prefer Original Medicare's broad coverage",
            ].map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-600 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <h3 className="font-bold text-green-800 text-sm mb-2">Choose Medicare Advantage if you:</h3>
          <ul className="space-y-1.5 text-xs text-green-900">
            {[
              "Want extra benefits (dental, vision, hearing, OTC)",
              "Prefer a $0 or very low monthly premium",
              "Have a preferred doctor who is in-network",
              "Want drug coverage bundled in",
              "Are comfortable with a provider network",
            ].map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-green-600 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/medicare-supplement/plan-g" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>
          Learn About Plan G <ArrowRight size={14} />
        </Link>
        <Link href="/plans?zip=64106" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border" style={{ color: "#1C3A48", borderColor: "#1C3A48" }}>
          Compare Medicare Advantage Plans
        </Link>
      </div>
    </InfoPage>
  );
}
