// Company pages: About Us, Licensed Agents, Contact Us, Privacy Policy, Dual Eligible
import InfoPage from "@/components/InfoPage";
import { Link } from "wouter";
import { CheckCircle2, ArrowRight, Phone, Mail, MapPin, Shield, Users, Award, Clock } from "lucide-react";

const ACCENT = "#1C3A48";

// ── About Us ─────────────────────────────────────────────────────────────────
export function AboutUs() {
  return (
    <InfoPage section="Company" sectionHref="/#" title="About SelectQuote Medicare" accentColor={ACCENT}
      subtitle="Helping Americans navigate Medicare since 2010. SelectQuote is an independent, licensed insurance agency committed to unbiased plan comparison.">

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
        Our Mission
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Medicare is complicated. With dozens of plans available in most counties — each with
        different premiums, networks, drug formularies, and extra benefits — choosing the right plan
        can feel overwhelming. Our mission is to make that decision simple, transparent, and free.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        SelectQuote is an independent insurance agency licensed in all 50 states. We
        represent all major Medicare carriers — UnitedHealthcare, Humana, Aetna, Cigna, WellCare,
        Blue Cross Blue Shield, and more — so we can show you every plan available in your area
        without bias toward any single carrier.
      </p>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
        Why We're Different
      </h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {[
          { icon: Shield, title: "100% Free Service", desc: "We are paid by insurance carriers when you enroll — never by you. There is no cost to compare plans or speak with an agent." },
          { icon: Users, title: "Independent & Unbiased", desc: "We represent all major carriers and have no incentive to steer you toward any particular plan. Our only goal is finding the right fit for you." },
          { icon: Award, title: "Licensed in All 50 States", desc: "Our agents hold active insurance licenses in every state and complete annual Medicare certification training required by CMS." },
          { icon: Clock, title: "Year-Round Support", desc: "Our licensed agents are available year-round — not just during Open Enrollment. We're here when you need to make changes or have questions." },
        ].map((item) => (
          <div key={item.title} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: "#EEF5F7" }}>
              <item.icon size={18} style={{ color: ACCENT }} />
            </div>
            <div className="font-bold text-gray-800 text-sm mb-1">{item.title}</div>
            <div className="text-gray-600 text-xs leading-relaxed">{item.desc}</div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
        Our Numbers
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { value: "15+", label: "Years in Business" },
          { value: "50", label: "States Licensed" },
          { value: "200+", label: "Licensed Agents" },
          { value: "500K+", label: "Beneficiaries Helped" },
        ].map((stat) => (
          <div key={stat.label} className="text-center rounded-xl p-4 border" style={{ backgroundColor: "#EEF5F7", borderColor: "#C6DAE0" }}>
            <div className="text-2xl font-bold mb-1" style={{ color: ACCENT, fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>{stat.value}</div>
            <div className="text-xs text-gray-600 font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
        Disclaimer
      </h2>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 leading-relaxed mb-6">
        SelectQuote is not affiliated with or endorsed by the U.S. government or the
        federal Medicare program. We are a licensed insurance agency. Plan data shown on this
        website is for illustrative purposes. Actual plan availability, benefits, and costs vary
        by location and are subject to change. Always verify plan details directly with the
        insurance carrier before enrolling. This is a demonstration application.
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/contact" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>
          Contact Us <ArrowRight size={14} />
        </Link>
        <Link href="/agents" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border" style={{ color: ACCENT, borderColor: ACCENT }}>
          Meet Our Agents
        </Link>
      </div>
    </InfoPage>
  );
}

// ── Licensed Agents ───────────────────────────────────────────────────────────
export function LicensedAgents() {
  return (
    <InfoPage section="Company" sectionHref="/#" title="Licensed Agents" accentColor={ACCENT}
      subtitle="Our licensed insurance agents are Medicare specialists — certified annually by CMS and trained to help you find the right plan for your health needs and budget.">

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
        Why Work with a Licensed Medicare Agent?
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Medicare has hundreds of plan options in most markets, and the rules around enrollment
        periods, late penalties, and plan types are complex. A licensed Medicare agent can walk you
        through your options, verify that your doctors and drugs are covered, and help you enroll —
        all at no cost to you. Agents are paid by insurance carriers, not by beneficiaries.
      </p>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
        What Our Agents Are Certified to Do
      </h2>
      <ul className="space-y-2 text-sm text-gray-600 mb-6">
        {[
          "Compare all Medicare Advantage, Medicare Supplement, and Part D plans available in your ZIP code",
          "Verify that your current doctors and specialists are in-network for each plan",
          "Check your prescription drug list against each plan's formulary and estimate annual drug costs",
          "Explain the differences between HMO, PPO, and Special Needs Plans",
          "Help you understand your enrollment period and avoid late enrollment penalties",
          "Assist with enrollment paperwork and follow up with the carrier on your behalf",
          "Provide year-round support for billing questions, coverage issues, and plan changes",
          "Explain Extra Help, Medicare Savings Programs, and other assistance programs",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-green-600 shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
        Agent Credentials & Compliance
      </h2>
      <div className="space-y-3 mb-6">
        {[
          { title: "State Insurance License", desc: "All agents hold an active health insurance license in the states where they sell. Licenses are renewed every 2 years and require continuing education." },
          { title: "Annual Medicare Certification (AHIP)", desc: "CMS requires all agents who sell Medicare plans to complete the America's Health Insurance Plans (AHIP) Medicare certification each year. This covers Medicare rules, plan types, and ethical sales practices." },
          { title: "Carrier Certifications", desc: "Agents must complete carrier-specific certification for each insurance company they represent. This ensures they understand each carrier's specific plan offerings, benefits, and enrollment processes." },
          { title: "CMS Compliance", desc: "All agent activities are governed by CMS marketing guidelines. Agents cannot pressure you, make unsolicited calls, or offer gifts to influence enrollment. All calls may be recorded for compliance." },
        ].map((item) => (
          <div key={item.title} className="border-l-4 border-green-400 pl-4 py-1">
            <div className="font-semibold text-gray-800 text-sm mb-1">{item.title}</div>
            <div className="text-gray-600 text-sm leading-relaxed">{item.desc}</div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
        Speak with an Agent Today
      </h2>
      <div className="rounded-xl p-5 mb-6 border" style={{ backgroundColor: "#EEF5F7", borderColor: "#C6DAE0" }}>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <Phone size={18} style={{ color: ACCENT }} className="shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-gray-800 text-sm">Call Us</div>
              <a href="tel:1-800-777-8002" className="text-sm font-semibold" style={{ color: ACCENT }}>1-800-777-8002</a>
              <div className="text-xs text-gray-500">Mon–Fri 8am–8pm, Sat 9am–5pm ET</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail size={18} style={{ color: ACCENT }} className="shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-gray-800 text-sm">Email Us</div>
              <a href="mailto:medicare@selectquote.com" className="text-sm font-semibold" style={{ color: ACCENT }}>medicare@selectquote.com</a>
              <div className="text-xs text-gray-500">Response within 1 business day</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/contact" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>
          Schedule a Consultation <ArrowRight size={14} />
        </Link>
        <Link href="/plans?zip=64106" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border" style={{ color: ACCENT, borderColor: ACCENT }}>
          Compare Plans Online
        </Link>
      </div>
    </InfoPage>
  );
}

// ── Contact Us ────────────────────────────────────────────────────────────────
export function ContactUs() {
  return (
    <InfoPage section="Company" sectionHref="/#" title="Contact Us" accentColor={ACCENT}
      subtitle="Our licensed agents are available to answer your Medicare questions and help you find the right plan — at no cost to you.">

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {[
          { icon: Phone, title: "Call Us", primary: "1-800-777-8002", secondary: "Mon–Fri 8am–8pm ET\nSat 9am–5pm ET\nTTY: 711", href: "tel:1-800-777-8002" },
          { icon: Mail, title: "Email Us", primary: "medicare@selectquote.com", secondary: "Response within 1 business day\nFor non-urgent questions", href: "mailto:medicare@selectquote.com" },
          { icon: MapPin, title: "Main Office", primary: "11919 Roe Ave.", secondary: "Overland Park, KS 66209\nLicensed in all 50 states", href: "#" },
        ].map((item) => (
          <div key={item.title} className="bg-gray-50 rounded-xl p-5 border border-gray-100 text-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: "#EEF5F7" }}>
              <item.icon size={20} style={{ color: ACCENT }} />
            </div>
            <div className="font-bold text-gray-800 text-sm mb-1">{item.title}</div>
            <a href={item.href} className="text-sm font-semibold block mb-1" style={{ color: ACCENT }}>{item.primary}</a>
            <div className="text-xs text-gray-500 whitespace-pre-line">{item.secondary}</div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
        What to Expect When You Call
      </h2>
      <ol className="space-y-3 mb-6">
        {[
          { step: "Speak with a licensed Medicare agent", detail: "You'll be connected directly with a licensed agent — no automated menus or sales scripts. Our agents are trained Medicare specialists." },
          { step: "Share your health needs and preferences", detail: "Tell us about your doctors, medications, and what matters most to you (premium, network, extra benefits). The more we know, the better we can help." },
          { step: "Receive a personalized plan comparison", detail: "We'll show you every plan available in your ZIP code that meets your criteria, with side-by-side cost and benefit comparisons." },
          { step: "Enroll if you're ready (or take your time)", detail: "There's never any pressure. You can enroll on the call, request a callback, or take the information home to review. We're here when you're ready." },
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

      <div className="rounded-xl p-4 text-sm mb-6 border" style={{ backgroundColor: "#EEF5F7", borderColor: "#C6DAE0", color: "#3E5560" }}>
        <strong>Our service is 100% free.</strong> We are paid by insurance carriers when you
        enroll in a plan. You will never be charged for speaking with an agent, comparing plans,
        or enrolling. There is no obligation to enroll after speaking with us.
      </div>

      <div className="flex flex-wrap gap-3">
        <a href="tel:1-800-777-8002" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>
          <Phone size={14} /> Call 1-800-777-8002
        </a>
        <Link href="/plans?zip=64106" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border" style={{ color: ACCENT, borderColor: ACCENT }}>
          Compare Plans Online
        </Link>
      </div>
    </InfoPage>
  );
}

// ── Privacy Policy ────────────────────────────────────────────────────────────
export function PrivacyPolicy() {
  return (
    <InfoPage section="Company" sectionHref="/#" title="Privacy Policy" accentColor={ACCENT}
      subtitle="Last updated: January 1, 2025. This policy explains how SelectQuote Medicare collects, uses, and protects your personal information.">

      <div className="rounded-xl p-4 text-sm mb-6 border" style={{ backgroundColor: "#FAF9F5", borderColor: "#E2EAED", color: "#3E5560" }}>
        <strong>Disclaimer:</strong> This is a demonstration application. This privacy policy is
        provided for illustrative purposes only and does not constitute a legally binding document.
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
        Information We Collect
      </h2>
      <div className="space-y-3 mb-6">
        {[
          { type: "Information you provide directly", items: ["Name, address, phone number, email address", "Date of birth and Medicare Beneficiary Identifier (MBI)", "Health information relevant to plan selection (doctors, medications)", "Insurance enrollment applications and related documents"] },
          { type: "Information collected automatically", items: ["IP address and browser type", "Pages visited and time spent on site", "ZIP code entered for plan searches", "Referring website or search query"] },
          { type: "Information from third parties", items: ["Insurance carrier plan data and pricing", "CMS Medicare plan information (public data)", "Address verification services"] },
        ].map((section) => (
          <div key={section.type} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="font-bold text-gray-800 text-sm mb-2">{section.type}</div>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <span className="mt-1 w-1 h-1 rounded-full bg-gray-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
        How We Use Your Information
      </h2>
      <ul className="space-y-2 text-sm text-gray-600 mb-6">
        {[
          "To provide plan comparison services and enrollment assistance",
          "To connect you with licensed insurance agents",
          "To process insurance enrollment applications",
          "To send you information about Medicare plans and enrollment periods (with your consent)",
          "To improve our website and services",
          "To comply with legal and regulatory requirements",
          "To prevent fraud and ensure security",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-green-600 shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
        Information Sharing
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">
        We do not sell your personal information. We may share your information with:
      </p>
      <ul className="space-y-2 text-sm text-gray-600 mb-6">
        {[
          "Insurance carriers when you request a quote or enrollment",
          "Licensed insurance agents who assist with your enrollment",
          "Service providers who help operate our website (hosting, analytics)",
          "Government authorities when required by law",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
            {item}
          </li>
        ))}
      </ul>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
        Your Rights
      </h2>
      <div className="space-y-2 mb-6">
        {[
          { right: "Access", desc: "You may request a copy of the personal information we hold about you." },
          { right: "Correction", desc: "You may request correction of inaccurate or incomplete information." },
          { right: "Deletion", desc: "You may request deletion of your personal information, subject to legal retention requirements." },
          { right: "Opt-out of marketing", desc: "You may opt out of marketing communications at any time by clicking 'unsubscribe' or contacting us." },
        ].map((item) => (
          <div key={item.right} className="flex gap-3 text-sm">
            <span className="font-semibold text-gray-800 shrink-0 w-28">{item.right}:</span>
            <span className="text-gray-600">{item.desc}</span>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
        Contact for Privacy Matters
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-6">
        For privacy-related questions or requests, contact our Privacy Officer at{" "}
        <a href="mailto:privacy@selectquote.com" style={{ color: ACCENT }} className="font-semibold">
          privacy@selectquote.com
        </a>{" "}
        or write to: Privacy Officer, SelectQuote Insurance Services, Inc., 11919 Roe Ave., Overland Park, KS 66209.
      </p>
    </InfoPage>
  );
}

// ── Dual Eligible ─────────────────────────────────────────────────────────────
export function DualEligible() {
  return (
    <InfoPage section="Plans" sectionHref="/#" title="Dual Eligible Plans" accentColor={ACCENT}
      subtitle="If you qualify for both Medicare and Medicaid, you may be eligible for Dual Eligible Special Needs Plans (D-SNPs) that coordinate both programs into a single, simplified benefit.">

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
        What Does "Dual Eligible" Mean?
      </h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        A "dual eligible" beneficiary is someone who qualifies for both Medicare and Medicaid.
        Medicare is the federal health insurance program for people 65+ and certain people with
        disabilities. Medicaid is the joint federal-state program for people with limited income
        and resources. Approximately 12.5 million Americans are dual eligible, making up about
        19% of all Medicare beneficiaries.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        Dual eligible individuals often have complex health needs and face significant cost burdens.
        Specialized plan types — including Dual Eligible Special Needs Plans (D-SNPs) — are designed
        to coordinate Medicare and Medicaid benefits, reduce paperwork, and lower out-of-pocket costs.
      </p>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
        Types of Dual Eligibility
      </h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ backgroundColor: "#EEF5F7" }}>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Category</th>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Income Limit (2025)</th>
              <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">What Medicaid Pays</th>
            </tr>
          </thead>
          <tbody>
            {[
              { cat: "Full Dual Eligible (QMB+)", income: "≤ 100% FPL (~$15,060/yr individual)", pays: "Part A & B premiums, deductibles, copays, coinsurance + full Medicaid benefits" },
              { cat: "Qualified Medicare Beneficiary (QMB)", income: "≤ 100% FPL", pays: "Part A & B premiums, deductibles, and cost-sharing" },
              { cat: "Specified Low-Income Medicare Beneficiary (SLMB)", income: "100%–120% FPL", pays: "Part B premium only" },
              { cat: "Qualifying Individual (QI)", income: "120%–135% FPL", pays: "Part B premium only (limited slots)" },
              { cat: "Qualified Disabled Working Individual (QDWI)", income: "≤ 200% FPL (working disabled)", pays: "Part A premium only" },
            ].map((row) => (
              <tr key={row.cat} className="border border-gray-200 hover:bg-gray-50">
                <td className="p-3 font-medium text-gray-800 text-xs">{row.cat}</td>
                <td className="p-3 text-gray-600 text-xs">{row.income}</td>
                <td className="p-3 text-[#1C3A48] text-xs">{row.pays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
        Dual Eligible Special Needs Plans (D-SNPs)
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">
        D-SNPs are Medicare Advantage plans specifically designed for people who qualify for both
        Medicare and Medicaid. They coordinate benefits from both programs and often provide
        additional services not available in standard Medicare Advantage plans.
      </p>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl p-4 border" style={{ backgroundColor: "#EEF5F7", borderColor: "#C6DAE0" }}>
          <h3 className="font-bold text-green-800 text-sm mb-2">D-SNP Benefits</h3>
          <ul className="space-y-1.5 text-xs text-green-900">
            {[
              "$0 or very low premium",
              "$0 deductible and very low copays",
              "Coordinated Medicare + Medicaid benefits",
              "Care coordinator assigned to each member",
              "Transportation to medical appointments",
              "Meal delivery after hospital discharge",
              "Over-the-counter (OTC) allowance",
              "Dental, vision, and hearing benefits",
              "Behavioral health integration",
            ].map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <CheckCircle2 size={12} className="text-green-600 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl p-4 border" style={{ backgroundColor: "#FAF9F5", borderColor: "#E2EAED" }}>
          <h3 className="font-bold text-blue-800 text-sm mb-2">D-SNP Eligibility</h3>
          <ul className="space-y-1.5 text-xs text-blue-900">
            {[
              "Must be enrolled in Medicare Part A and Part B",
              "Must be enrolled in Medicaid (any level)",
              "Must live in the plan's service area",
              "Can enroll at any time during the year (SEP)",
              "No lock-in period — can switch plans monthly",
              "Automatic enrollment in Extra Help (LIS)",
              "Medicaid pays most or all cost-sharing",
            ].map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <CheckCircle2 size={12} className="text-blue-600 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
        How to Find a D-SNP in Your Area
      </h2>
      <ol className="space-y-3 mb-6">
        {[
          { step: "Confirm your Medicaid enrollment", detail: "Contact your state Medicaid office to verify your current Medicaid status and category of eligibility." },
          { step: "Search for D-SNPs on Medicare.gov", detail: "Go to Medicare.gov/plan-compare, enter your ZIP code, and filter by 'Special Needs Plans' > 'Dual Eligible SNP'." },
          { step: "Compare D-SNP benefits", detail: "Look at the OTC allowance, transportation benefit, dental/vision coverage, and care coordination services — these vary significantly between plans." },
          { step: "Verify your doctors are in-network", detail: "D-SNPs have provider networks. Confirm your primary care doctor and specialists accept the plan before enrolling." },
          { step: "Enroll — you can do this any month", detail: "Dual eligible individuals have a continuous Special Enrollment Period and can switch plans monthly. Contact the plan directly or call 1-800-MEDICARE." },
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
        <Link href="/plans?zip=64106" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>
          Find D-SNP Plans Near You <ArrowRight size={14} />
        </Link>
        <Link href="/part-d/extra-help" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border" style={{ color: ACCENT, borderColor: ACCENT }}>
          Extra Help Programs
        </Link>
      </div>
    </InfoPage>
  );
}
