// Resources sub-pages: Medicare 101, Enrollment Periods, Star Ratings Guide, FAQ
import InfoPage from "@/components/InfoPage";
import { Link } from "wouter";
import { CheckCircle2, AlertCircle, ArrowRight, Info, Star } from "lucide-react";

const SECTION = "Resources";
const SECTION_HREF = "/resources";
const ACCENT = "#00353E";

// ── Medicare 101 ─────────────────────────────────────────────────────────────
export function Medicare101() {
  return (
    <InfoPage section={SECTION} sectionHref={SECTION_HREF} title="Medicare 101" accentColor={ACCENT}
      subtitle="A complete beginner's guide to Medicare — what it covers, who qualifies, how to enroll, and what it costs.">

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        What Is Medicare?
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Medicare is the federal health insurance program for people age 65 and older, as well as
        certain younger people with disabilities or End-Stage Renal Disease (ESRD). Created in 1965
        as part of the Social Security Act, Medicare now covers more than 67 million Americans and
        is administered by the Centers for Medicare & Medicaid Services (CMS).
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        Medicare is divided into four parts, each covering different types of health care services.
        Understanding how the parts fit together is the foundation of making smart Medicare decisions.
      </p>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        The Four Parts of Medicare
      </h2>
      <div className="space-y-3 mb-6">
        {[
          {
            part: "Part A — Hospital Insurance",
            badge: "Part A",
            covers: ["Inpatient hospital stays", "Skilled nursing facility care (after qualifying hospital stay)", "Hospice care", "Some home health care"],
            cost: "Most people pay $0 premium (if you or spouse worked 40+ quarters). Deductible: $1,676 per benefit period in 2025.",
          },
          {
            part: "Part B — Medical Insurance",
            badge: "Part B",
            covers: ["Doctor visits and outpatient care", "Preventive services (screenings, vaccines)", "Durable medical equipment", "Mental health services", "Some home health care"],
            cost: "Standard premium: $185/month in 2025 (higher for high earners via IRMAA). Annual deductible: $257.",
          },
          {
            part: "Part C — Medicare Advantage",
            badge: "Part C",
            covers: ["All Part A and Part B benefits", "Usually Part D drug coverage", "Often dental, vision, hearing, fitness", "Managed by private insurers"],
            cost: "Premium varies by plan (many are $0). Must still pay Part B premium. Annual out-of-pocket maximum applies.",
          },
          {
            part: "Part D — Prescription Drug Coverage",
            badge: "Part D",
            covers: ["Prescription drugs covered by the plan's formulary", "Insulin capped at $35/month", "Vaccines at $0", "Annual OOP cap of $2,000 in 2025"],
            cost: "Average premium ~$46/month in 2025. Standard deductible up to $590. OOP cap: $2,000.",
          },
        ].map((item) => (
          <div key={item.part} className="rounded-xl p-4 border" style={{ backgroundColor: "#E6F7F9", borderColor: "#E8E8E8" }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-white text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#00353E" }}>{item.badge}</span>
              <div className="font-bold text-gray-800 text-sm">{item.part}</div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">What it covers:</div>
                <ul className="space-y-0.5">
                  {item.covers.map((c) => (
                    <li key={c} className="text-xs text-gray-700 flex items-start gap-1.5">
                      <span className="mt-1 w-1 h-1 rounded-full bg-gray-500 shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">Cost:</div>
                <div className="text-xs text-gray-700 leading-relaxed">{item.cost}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Who Is Eligible for Medicare?
      </h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ backgroundColor: "#E6F7F9" }}>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Eligibility Group</th>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Requirements</th>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Part A Premium</th>
            </tr>
          </thead>
          <tbody>
            {[
              { group: "Age 65+", req: "U.S. citizen or permanent resident for 5+ years", premium: "$0 (if 40+ work quarters)" },
              { group: "Under 65 with disability", req: "Received Social Security Disability Insurance (SSDI) for 24 months", premium: "$0 (if 40+ work quarters)" },
              { group: "End-Stage Renal Disease (ESRD)", req: "Permanent kidney failure requiring dialysis or transplant", premium: "$0 (if 40+ work quarters)" },
              { group: "ALS (Lou Gehrig's disease)", req: "Diagnosed with ALS — Medicare begins the month SSDI starts", premium: "$0 (if 40+ work quarters)" },
              { group: "Fewer than 30 work quarters", req: "Age 65+, U.S. citizen or permanent resident", premium: "$285/month (2025)" },
              { group: "30–39 work quarters", req: "Age 65+, U.S. citizen or permanent resident", premium: "$518/month (2025)" },
            ].map((row) => (
              <tr key={row.group} className="border border-gray-200 hover:bg-gray-50">
                <td className="p-3 font-medium text-gray-800">{row.group}</td>
                <td className="p-3 text-gray-600 text-xs">{row.req}</td>
                <td className="p-3 font-semibold" style={{ color: ACCENT }}>{row.premium}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Original Medicare vs. Medicare Advantage
      </h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl p-4 border" style={{ backgroundColor: "#E6F7F9", borderColor: "#E8E8E8" }}>
          <h3 className="font-bold text-sm mb-2" style={{ color: "#00353E" }}>Original Medicare (Parts A + B)</h3>
          <ul className="space-y-1.5">
            {[
              "Administered directly by the federal government",
              "See any Medicare-accepting doctor nationwide",
              "No referrals required",
              "No annual out-of-pocket maximum (need Medigap for protection)",
              "No extra benefits (dental, vision, hearing)",
              "Add standalone Part D for drug coverage",
              "Add Medigap to fill cost-sharing gaps",
            ].map((item) => (
              <li key={item} className="flex items-start gap-1.5 text-xs" style={{ color: "#303030" }}>
                <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: "#8C8C8C" }} />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl p-4 border" style={{ backgroundColor: "#F9F9F9", borderColor: "#E8E8E8" }}>
          <h3 className="font-bold text-sm mb-2" style={{ color: "#00353E" }}>Medicare Advantage (Part C)</h3>
          <ul className="space-y-1.5">
            {[
              "Managed by private insurers approved by Medicare",
              "Usually requires using a provider network",
              "Often includes drug coverage (MAPD)",
              "Annual out-of-pocket maximum (protection built in)",
              "Extra benefits: dental, vision, hearing, OTC, fitness",
              "Often $0 premium (must still pay Part B premium)",
              "Care coordination through PCP (HMO) or direct access (PPO)",
            ].map((item) => (
              <li key={item} className="flex items-start gap-1.5 text-xs" style={{ color: "#303030" }}>
                <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: "#00859A" }} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Key 2025 Medicare Costs at a Glance
      </h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ backgroundColor: "#E6F7F9" }}>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Cost Item</th>
              <th className="p-3 font-semibold text-gray-700 border border-gray-200 text-center">2025 Amount</th>
            </tr>
          </thead>
          <tbody>
            {[
              { item: "Part A deductible (per benefit period)", amount: "$1,676" },
              { item: "Part A coinsurance (days 1–60)", amount: "$0" },
              { item: "Part A coinsurance (days 61–90)", amount: "$419/day" },
              { item: "Part B standard premium", amount: "$185/month" },
              { item: "Part B deductible", amount: "$257/year" },
              { item: "Part B coinsurance", amount: "20% of Medicare-approved amount" },
              { item: "Part D standard deductible (max)", amount: "$590" },
              { item: "Part D OOP cap (NEW)", amount: "$2,000" },
              { item: "IRMAA surcharge starts (single filer)", amount: "Income > $106,000" },
            ].map((row) => (
              <tr key={row.item} className="border border-gray-200 hover:bg-gray-50">
                <td className="p-3 text-gray-700">{row.item}</td>
                <td className="p-3 text-center font-semibold" style={{ color: ACCENT }}>{row.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/resources/enrollment-periods" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>
          Enrollment Periods Guide <ArrowRight size={14} />
        </Link>
        <Link href="/plans?zip=64106" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border" style={{ color: "#00353E", borderColor: "#00353E" }}>
          Compare Medicare Advantage Plans
        </Link>
      </div>
    </InfoPage>
  );
}

// ── Enrollment Periods ────────────────────────────────────────────────────────
export function EnrollmentPeriods() {
  return (
    <InfoPage section={SECTION} sectionHref={SECTION_HREF} title="Enrollment Periods" accentColor={ACCENT}
      subtitle="Knowing when you can enroll, switch, or drop Medicare coverage is essential to avoiding penalties and coverage gaps.">

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Overview of Medicare Enrollment Periods
      </h2>
      <p className="text-gray-600 leading-relaxed mb-6">
        Medicare has multiple enrollment periods, each with specific rules about what changes you can
        make and when coverage takes effect. Missing the right window can mean paying late enrollment
        penalties for life or going without coverage. Here is a complete guide to every enrollment
        period.
      </p>

      <div className="space-y-4 mb-6">
        {[
          {
            name: "Initial Enrollment Period (IEP)",
            when: "7 months: 3 months before your 65th birthday month, your birthday month, and 3 months after",
            what: "Enroll in Part A, Part B, Part C (Medicare Advantage), and/or Part D for the first time",
            note: "Enrolling in the first 3 months ensures coverage starts on your 65th birthday. Enrolling in months 4–7 delays coverage by 1–3 months.",
          },
          {
            name: "General Enrollment Period (GEP)",
            when: "January 1 – March 31 each year",
            what: "Enroll in Part A and/or Part B if you missed your IEP",
            note: "Coverage begins July 1. You may face a late enrollment penalty for Part B (10% per 12-month period missed). Part D late penalty also applies.",
          },
          {
            name: "Annual Enrollment Period (AEP) / Open Enrollment",
            when: "October 15 – December 7 each year",
            what: "Join, switch, or drop a Medicare Advantage or Part D plan. Changes take effect January 1.",
            note: "This is the most important annual window. Review your plan's Annual Notice of Change (ANOC) each fall to see if costs or coverage changed.",
          },
          {
            name: "Medicare Advantage Open Enrollment Period (MA OEP)",
            when: "January 1 – March 31 each year",
            what: "If enrolled in a Medicare Advantage plan, switch to a different MA plan or return to Original Medicare (and add Part D). One change allowed.",
            note: "You cannot use MA OEP to switch from Original Medicare to Medicare Advantage. That requires AEP.",
          },
          {
            name: "Special Enrollment Period (SEP)",
            when: "Triggered by qualifying life events; varies by event",
            what: "Enroll in or change Medicare coverage outside standard enrollment periods",
            note: "Common triggers: losing employer coverage, moving out of plan service area, qualifying for Extra Help, plan losing Medicare contract, or returning from incarceration.",
          },
          {
            name: "5-Star Enrollment Period",
            when: "December 8 – November 30 (one switch per year)",
            what: "Switch to a Medicare Advantage or Part D plan with a 5-star CMS quality rating",
            note: "This SEP allows one plan switch per year to a 5-star rated plan, regardless of other enrollment periods.",
          },
        ].map((item) => (
          <div key={item.name} className="rounded-xl p-4 border-l-4" style={{ backgroundColor: "#E6F7F9", borderLeftColor: "#00353E", borderTopColor: "#E8E8E8", borderRightColor: "#E8E8E8", borderBottomColor: "#E8E8E8" }}>
            <div className="font-bold text-gray-800 text-sm mb-1">{item.name}</div>
            <div className="text-xs font-semibold text-gray-600 mb-1">When: {item.when}</div>
            <div className="text-sm text-gray-700 mb-2"><strong>What you can do:</strong> {item.what}</div>
            <div className="text-xs text-gray-600 bg-white/60 rounded-lg p-2">
              <strong>Important:</strong> {item.note}
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        Late Enrollment Penalties
      </h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ backgroundColor: "#E6F7F9" }}>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Part</th>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Penalty</th>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Duration</th>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">How to Avoid</th>
            </tr>
          </thead>
          <tbody>
            {[
              { part: "Part A", penalty: "10% of premium for twice the number of years you delayed", duration: "Twice the years delayed", avoid: "Enroll during IEP or when you lose employer coverage" },
              { part: "Part B", penalty: "10% of standard premium for each full 12-month period without coverage", duration: "Permanent (for life)", avoid: "Enroll during IEP or within 8 months of losing employer coverage" },
              { part: "Part D", penalty: "1% × $38.99 × months without creditable coverage", duration: "Permanent (for life)", avoid: "Enroll during IEP or maintain creditable drug coverage" },
            ].map((row) => (
              <tr key={row.part} className="border border-gray-200 hover:bg-gray-50">
                <td className="p-3 font-bold text-gray-800">{row.part}</td>
                <td className="p-3 text-red-700 text-xs">{row.penalty}</td>
                <td className="p-3 text-gray-600 text-xs">{row.duration}</td>
                <td className="p-3 text-[#00353E] text-xs">{row.avoid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800 mb-6">
        <div className="flex items-start gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div>
            <strong>Still working at 65?</strong> If you have employer coverage through your own
            (or spouse's) active employment, you can delay Part B and Part D without penalty.
            You have an 8-month SEP after that coverage ends. Retiree coverage and COBRA do NOT
            count as active employment coverage for this purpose.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/resources/medicare-101" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>
          Medicare 101 Guide <ArrowRight size={14} />
        </Link>
        <Link href="/part-d/enrollment" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border" style={{ color: ACCENT, borderColor: ACCENT }}>
          Part D Enrollment Details
        </Link>
      </div>
    </InfoPage>
  );
}

// ── Star Ratings Guide ────────────────────────────────────────────────────────
export function StarRatingsGuide() {
  return (
    <InfoPage section={SECTION} sectionHref={SECTION_HREF} title="Star Ratings Guide" accentColor={ACCENT}
      subtitle="CMS Star Ratings are the official quality scores for Medicare Advantage and Part D plans — a 5-star plan delivers measurably better care and service.">

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        What Are CMS Star Ratings?
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        The Centers for Medicare & Medicaid Services (CMS) rates every Medicare Advantage and Part D
        plan on a scale of 1 to 5 stars, where 5 stars represents excellent quality. These ratings
        are published annually (typically in October) and are based on data from the previous year.
        They are the most objective, standardized measure of plan quality available to consumers.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        In 2025, approximately 40% of Medicare Advantage plans earned 4 stars or higher. Plans with
        5 stars receive a quality bonus payment from CMS, which they can use to offer richer benefits
        or lower premiums. Enrollees in 5-star plans can switch to that plan at any time during the
        year using the 5-Star Special Enrollment Period.
      </p>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        What the Stars Mean
      </h2>
      <div className="space-y-2 mb-6">
        {[
          { stars: 5, label: "Excellent", desc: "Top-performing plan. Exceptional quality of care, member experience, and administrative performance." },
          { stars: 4, label: "Above Average", desc: "Above-average quality. Strong performance across most measures. A good choice for most beneficiaries." },
          { stars: 3, label: "Average", desc: "Average quality. Meets basic standards but has room for improvement in some areas." },
          { stars: 2, label: "Below Average", desc: "Below-average quality. CMS may impose corrective action plans on these plans." },
          { stars: 1, label: "Poor", desc: "Poor quality. CMS may terminate contracts with plans that remain at 1 star for multiple years." },
        ].map((item) => (
          <div key={item.stars} className="rounded-xl p-3 border flex items-start gap-3" style={{ backgroundColor: item.stars >= 4 ? "#E6F7F9" : item.stars === 3 ? "#F9F9F9" : "#F9F9F9", borderColor: "#E8E8E8", color: "#303030" }}>
            <div className="flex shrink-0">
              {Array.from({ length: item.stars }).map((_, i) => (
                <Star key={i} size={14} fill="currentColor" />
              ))}
              {Array.from({ length: 5 - item.stars }).map((_, i) => (
                <Star key={i} size={14} className="opacity-30" />
              ))}
            </div>
            <div>
              <span className="font-bold text-sm">{item.label}</span>
              <span className="text-xs ml-2">{item.desc}</span>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        How Star Ratings Are Calculated
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">
        CMS uses three primary data sources to calculate star ratings, covering 40+ individual
        measures grouped into five domains:
      </p>
      <div className="space-y-3 mb-6">
        {[
          {
            domain: "Staying Healthy: Screenings, Tests, and Vaccines",
            measures: "Breast cancer screening, colorectal cancer screening, flu vaccine, pneumonia vaccine, diabetes care (A1C, eye exams, kidney disease monitoring)",
            weight: "~20%",
          },
          {
            domain: "Managing Chronic (Long-Term) Conditions",
            measures: "Blood pressure control, cholesterol management, diabetes management, medication adherence (statins, RAS antagonists, diabetes medications)",
            weight: "~30%",
          },
          {
            domain: "Member Experience with Health Plan",
            measures: "CAHPS survey results: getting needed care, getting care quickly, how well doctors communicate, customer service, overall plan rating",
            weight: "~25%",
          },
          {
            domain: "Member Complaints and Changes in the Health Plan's Performance",
            measures: "Complaints to Medicare, appeals and grievances, plan audit results, disenrollment rates",
            weight: "~15%",
          },
          {
            domain: "Health Plan Customer Service",
            measures: "Call center responsiveness, accuracy of plan information, timely processing of coverage decisions",
            weight: "~10%",
          },
        ].map((item) => (
          <div key={item.domain} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="font-semibold text-gray-800 text-sm">{item.domain}</div>
              <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "#E6F7F9", color: "#00353E" }}>{item.weight}</span>
            </div>
            <div className="text-gray-600 text-xs leading-relaxed">{item.measures}</div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Inter', serif" }}>
        How to Use Star Ratings When Choosing a Plan
      </h2>
      <ul className="space-y-2 text-sm text-gray-600 mb-4">
        {[
          "Look for plans with 4 or 5 stars — they deliver measurably better care and service",
          "A 5-star plan allows you to switch at any time during the year (5-Star SEP)",
          "Don't choose a plan solely on star rating — also verify your doctors are in-network and your drugs are covered",
          "Star ratings are updated annually in October — check for changes during the Annual Enrollment Period",
          "New plans don't have star ratings in their first year; they receive an 'N/A' rating",
          "Plans with 5 stars may offer richer benefits due to quality bonus payments from CMS",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: "#00859A" }} />
            {item}
          </li>
        ))}
      </ul>

      <div className="rounded-xl p-4 text-sm mb-6 border" style={{ backgroundColor: "#E6F7F9", borderColor: "#E8E8E8", color: "#303030" }}>
        <div className="flex items-start gap-2">
          <Info size={15} className="shrink-0 mt-0.5" />
          <div>
            <strong>2025 update:</strong> CMS proposed removing 12 measures from the Star Ratings
            beginning with the 2027 measurement year (impacting 2029 ratings), streamlining the
            program to focus on the most impactful quality measures.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/plans?zip=64106" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>
          Compare Plans with Star Ratings <ArrowRight size={14} />
        </Link>
        <Link href="/resources/medicare-101" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border" style={{ color: ACCENT, borderColor: ACCENT }}>
          Medicare 101
        </Link>
      </div>
    </InfoPage>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
export function FAQ() {
  const faqs = [
    {
      q: "When should I sign up for Medicare?",
      a: "Most people should enroll during their Initial Enrollment Period (IEP) — the 7-month window around their 65th birthday. If you're still working and have employer coverage, you can delay without penalty. Contact Social Security 3 months before turning 65 to start the process.",
    },
    {
      q: "What's the difference between Medicare Advantage and Original Medicare?",
      a: "Original Medicare (Parts A + B) is run by the federal government and lets you see any Medicare-accepting doctor nationwide. Medicare Advantage (Part C) is offered by private insurers, usually has a provider network, but often includes extra benefits (dental, vision, hearing) and drug coverage — often at $0 premium.",
    },
    {
      q: "Do I need a Medigap plan if I have Medicare Advantage?",
      a: "No. Medigap (Medicare Supplement) plans only work with Original Medicare. If you have Medicare Advantage, you cannot use a Medigap plan. Medicare Advantage plans have their own built-in out-of-pocket maximum that protects you from catastrophic costs.",
    },
    {
      q: "What is the Medicare Part B IRMAA surcharge?",
      a: "IRMAA (Income-Related Monthly Adjustment Amount) is an extra charge added to your Part B and Part D premiums if your income exceeds certain thresholds. In 2025, IRMAA applies to individuals with income above $106,000 (or $212,000 for married couples filing jointly). The surcharge ranges from $74/month to $443/month for Part B.",
    },
    {
      q: "Can I have both Medicare and Medicaid?",
      a: "Yes. People who qualify for both Medicare and Medicaid are called 'dual eligible.' Medicaid can help pay for Medicare premiums, deductibles, and copays. Dual-Eligible Special Needs Plans (D-SNPs) are designed specifically to coordinate benefits for dual-eligible individuals.",
    },
    {
      q: "What is the Medicare coverage gap ('donut hole')?",
      a: "The coverage gap was a phase in Part D where you paid a higher share of drug costs. Starting in 2025, the coverage gap has been eliminated. There is now a $2,000 annual out-of-pocket cap on Part D drug costs — once you hit $2,000, you pay $0 for covered drugs for the rest of the year.",
    },
    {
      q: "Can I switch Medicare plans at any time?",
      a: "Generally, no. You can switch plans during the Annual Enrollment Period (October 15–December 7) or the Medicare Advantage Open Enrollment Period (January 1–March 31). However, if you're enrolled in a 5-star plan, you can switch to it at any time. Qualifying life events also trigger Special Enrollment Periods.",
    },
    {
      q: "Does Medicare cover dental, vision, and hearing?",
      a: "Original Medicare does not cover routine dental, vision, or hearing care. Medicare Advantage plans often include these benefits. In 2025, approximately 97% of individual Medicare Advantage plans offer some form of dental, vision, or hearing coverage.",
    },
    {
      q: "What is a Medicare Beneficiary Identifier (MBI)?",
      a: "The MBI is your unique Medicare ID number, replacing the old Social Security-based Medicare number. It's an 11-character alphanumeric code printed on your red, white, and blue Medicare card. You'll need it to enroll in plans and access Medicare services.",
    },
    {
      q: "How do I appeal a Medicare coverage denial?",
      a: "You have the right to appeal any Medicare coverage decision. For Medicare Advantage and Part D, you must first request a redetermination from your plan within 60 days of the denial. If denied again, you can escalate to a Qualified Independent Contractor (QIC), then to the Office of Medicare Hearings and Appeals (OMHA), and ultimately to federal court.",
    },
  ];

  return (
    <InfoPage section={SECTION} sectionHref={SECTION_HREF} title="Frequently Asked Questions" accentColor={ACCENT}
      subtitle="Answers to the most common questions about Medicare enrollment, coverage, and costs.">

      <div className="space-y-4 mb-6">
        {faqs.map((faq, i) => (
          <details key={i} className="group bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
            <summary className="flex items-center justify-between p-4 cursor-pointer list-none font-semibold text-gray-800 text-sm hover:bg-gray-100 transition-colors">
              <span>{faq.q}</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform shrink-0 ml-2">▼</span>
            </summary>
            <div className="px-4 pb-4 text-gray-600 text-sm leading-relaxed border-t border-gray-200 pt-3">
              {faq.a}
            </div>
          </details>
        ))}
      </div>

      <div className="rounded-xl p-4 text-sm mb-6 border" style={{ backgroundColor: "#E6F7F9", borderColor: "#E8E8E8", color: "#303030" }}>
        <div className="flex items-start gap-2">
          <Info size={15} className="shrink-0 mt-0.5" />
          <div>
            <strong>Still have questions?</strong> Call 1-800-MEDICARE (1-800-633-4227), available
            24/7. TTY users call 1-877-486-2048. You can also visit Medicare.gov or contact your
            State Health Insurance Assistance Program (SHIP) for free, unbiased counseling.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/resources/medicare-101" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>
          Medicare 101 Guide <ArrowRight size={14} />
        </Link>
        <Link href="/plans?zip=64106" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border" style={{ color: "#00353E", borderColor: "#00353E" }}>
          Compare Plans in Your Area
        </Link>
      </div>
    </InfoPage>
  );
}
