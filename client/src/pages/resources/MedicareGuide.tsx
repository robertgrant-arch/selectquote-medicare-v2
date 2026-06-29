// Medicare Guide page — /resources/medicare-guide
// Two-section accordion: "Complete Medicare Guide" (open by default) + "Extra Help" (closed by default)
// Each section toggles independently via React state (not native <details>)

import { useState } from "react";
import { Link } from "wouter";
import {
  ChevronDown,
  ChevronRight,
  Shield,
  DollarSign,
  FileText,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Info,
  ArrowRight,
} from "lucide-react";
import Header from "@/components/Header";

const ACCENT = "#1C3A48";

// ── Shared accordion section component ───────────────────────────────────────
interface AccordionSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  badge?: string;
}

function AccordionSection({ title, isOpen, onToggle, children, icon, badge }: AccordionSectionProps) {
  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden mb-4 shadow-sm">
      {/* Header / trigger */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-5 text-left transition-colors focus:outline-none"
        style={{
          backgroundColor: isOpen ? "#EEF5F7" : "#FFFFFF",
          borderBottom: isOpen ? "1px solid #C6DAE0" : "none",
        }}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: isOpen ? "#E8F2F5" : "#EEF5F7" }}
            >
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-base font-bold"
                style={{ color: isOpen ? ACCENT : "#1E293B" }}
              >
                {title}
              </span>
              {badge && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "#E8F2F5", color: ACCENT }}
                >
                  {badge}
                </span>
              )}
            </div>
          </div>
        </div>
        <ChevronDown
          size={20}
          className="shrink-0 transition-transform duration-200"
          style={{
            color: isOpen ? ACCENT : "#94A3B8",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Collapsible body */}
      {isOpen && (
        <div className="px-6 py-6 bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Complete Medicare Guide content ──────────────────────────────────────────
function CompleteMedicareGuideContent() {
  return (
    <div className="space-y-8">
      {/* Overview */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
          What Is Medicare?
        </h3>
        <p className="text-gray-600 text-sm leading-relaxed mb-3">
          Medicare is the federal health insurance program for people age 65 and older, as well as
          certain younger people with disabilities or End-Stage Renal Disease (ESRD). Administered
          by the Centers for Medicare &amp; Medicaid Services (CMS), Medicare covers more than
          67 million Americans and is divided into four parts.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { part: "Part A", label: "Hospital Insurance", desc: "Inpatient hospital stays, skilled nursing, hospice, some home health care. Most people pay $0 premium." },
            { part: "Part B", label: "Medical Insurance", desc: "Doctor visits, outpatient care, preventive services, durable medical equipment. $185/month premium in 2025." },
            { part: "Part C", label: "Medicare Advantage", desc: "Private plans that bundle Parts A, B, and usually D. Often include dental, vision, hearing. Many $0 premium options." },
            { part: "Part D", label: "Prescription Drugs", desc: "Prescription drug coverage offered by private insurers. New $2,000 annual out-of-pocket cap in 2025." },
          ].map((item) => (
            <div key={item.part} className="rounded-xl p-4 border" style={{ backgroundColor: "#EEF5F7", borderColor: "#C6DAE0" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-white text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#1C3A48" }}>{item.part}</span>
                <span className="text-sm font-semibold" style={{ color: "#1C3A48" }}>{item.label}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "#3E5560" }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Eligibility */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
          Who Is Eligible?
        </h3>
        <div className="space-y-2">
          {[
            { group: "Age 65+", detail: "U.S. citizen or permanent resident for 5+ years. Automatic enrollment if receiving Social Security." },
            { group: "Under 65 with disability", detail: "After receiving Social Security Disability Insurance (SSDI) for 24 consecutive months." },
            { group: "End-Stage Renal Disease (ESRD)", detail: "Permanent kidney failure requiring dialysis or a transplant, at any age." },
            { group: "ALS (Lou Gehrig's disease)", detail: "Medicare begins the same month SSDI starts — no 24-month waiting period." },
          ].map((item) => (
            <div key={item.group} className="flex gap-3 p-3 rounded-xl border" style={{ backgroundColor: "#FAF9F5", borderColor: "#E2EAED" }}>
              <CheckCircle2 size={15} className="shrink-0 mt-0.5" style={{ color: "#1C3A48" }} />
              <div>
                <div className="text-sm font-semibold text-gray-800">{item.group}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2025 Key Costs */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
          Key 2025 Medicare Costs
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: "#EEF5F7" }}>
                <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Cost Item</th>
                <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">2025 Amount</th>
              </tr>
            </thead>
            <tbody>
              {[
                { item: "Part A deductible (per benefit period)", amount: "$1,676" },
                { item: "Part B standard monthly premium", amount: "$185/month" },
                { item: "Part B annual deductible", amount: "$257" },
                { item: "Part B coinsurance (after deductible)", amount: "20% of approved amount" },
                { item: "Part D standard deductible (max)", amount: "$590" },
                { item: "Part D out-of-pocket cap (NEW in 2025)", amount: "$2,000" },
                { item: "IRMAA surcharge starts (single filer)", amount: "Income > $106,000" },
              ].map((row, i) => (
                <tr key={row.item} className={`border border-gray-200 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                  <td className="p-3 text-gray-700">{row.item}</td>
                  <td className="p-3 font-semibold text-gray-900">{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enrollment Periods */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
          Key Enrollment Periods
        </h3>
        <div className="space-y-3">
          {[
            {
              name: "Initial Enrollment Period (IEP)",
              dates: "7-month window around your 65th birthday",
              desc: "The 3 months before, the month of, and 3 months after your 65th birthday. Enroll in the first 3 months for coverage starting on your birthday.",
            },
            {
              name: "Annual Enrollment Period (AEP)",
              dates: "October 15 – December 7",
              desc: "Switch Medicare Advantage or Part D plans. Changes take effect January 1. Review your plan's Annual Notice of Change (ANOC) each fall.",
            },
            {
              name: "Medicare Advantage OEP",
              dates: "January 1 – March 31",
              desc: "If enrolled in a Medicare Advantage plan, switch to a different MA plan or return to Original Medicare. One change allowed.",
            },
            {
              name: "General Enrollment Period (GEP)",
              dates: "January 1 – March 31",
              desc: "Enroll in Part A and/or Part B if you missed your IEP. Coverage begins July 1. Late enrollment penalties may apply.",
            },
          ].map((period) => (
            <div key={period.name} className="rounded-xl p-4 border" style={{ backgroundColor: "#EEF5F7", borderColor: "#C6DAE0" }}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="text-sm font-bold text-gray-800">{period.name}</div>
                <div className="text-xs font-semibold text-gray-500 shrink-0 flex items-center gap-1">
                  <Clock size={11} />
                  {period.dates}
                </div>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{period.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Original Medicare vs MA */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
          Original Medicare vs. Medicare Advantage
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl p-4 border" style={{ backgroundColor: "#EEF5F7", borderColor: "#C6DAE0" }}>
            <div className="text-sm font-bold mb-2" style={{ color: "#1C3A48" }}>Original Medicare (Parts A + B)</div>
            <ul className="space-y-1.5">
              {[
                "Administered by the federal government",
                "See any Medicare-accepting doctor nationwide",
                "No referrals required",
                "No annual out-of-pocket maximum",
                "No extra benefits (dental, vision, hearing)",
                "Add Medigap to limit cost-sharing",
                "Add standalone Part D for drugs",
              ].map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-xs" style={{ color: "#3E5560" }}>
                  <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: "#7A9BA6" }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl p-4 border" style={{ backgroundColor: "#FAF9F5", borderColor: "#E2EAED" }}>
            <div className="text-sm font-bold mb-2" style={{ color: "#1C3A48" }}>Medicare Advantage (Part C)</div>
            <ul className="space-y-1.5">
              {[
                "Managed by private insurers approved by CMS",
                "Usually requires using a provider network",
                "Often includes drug coverage (MAPD)",
                "Annual out-of-pocket maximum built in",
                "Extra benefits: dental, vision, hearing, OTC",
                "Often $0 premium (still pay Part B)",
                "Care coordination through PCP (HMO) or direct (PPO)",
              ].map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-xs" style={{ color: "#3E5560" }}>
                  <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: "#237A92" }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Late Enrollment Penalties */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
          Late Enrollment Penalties
        </h3>
        <div className="rounded-xl p-4 mb-3 flex gap-2 border" style={{ backgroundColor: "#EEF5F7", borderColor: "#C6DAE0" }}>
          <AlertCircle size={15} className="shrink-0 mt-0.5" style={{ color: "#1C3A48" }} />
          <p className="text-xs leading-relaxed" style={{ color: "#3E5560" }}>
            Late enrollment penalties are <strong>permanent</strong> for Part B and Part D — they stay
            with you for life. Avoid them by enrolling during your IEP or maintaining creditable coverage.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: "#EEF5F7" }}>
                <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Part</th>
                <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">Penalty</th>
                <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">How to Avoid</th>
              </tr>
            </thead>
            <tbody>
              {[
                { part: "Part A", penalty: "10% of premium for 2× the years delayed", avoid: "Enroll during IEP or when you lose employer coverage" },
                { part: "Part B", penalty: "10% per 12-month period without coverage (permanent)", avoid: "Enroll during IEP or within 8 months of losing employer coverage" },
                { part: "Part D", penalty: "1% × $38.99 × months without creditable coverage", avoid: "Enroll during IEP or maintain creditable drug coverage" },
              ].map((row, i) => (
                <tr key={row.part} className={`border border-gray-200 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                  <td className="p-3 font-semibold text-gray-800">{row.part}</td>
                  <td className="p-3 text-gray-700">{row.penalty}</td>
                  <td className="p-3 text-gray-600">{row.avoid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA links */}
      <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
        <Link href="/resources/enrollment-periods" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>
          Enrollment Periods Guide <ArrowRight size={14} />
        </Link>
        <Link href="/plans?zip=64106" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border" style={{ color: "#1C3A48", borderColor: "#1C3A48" }}>
          Compare Plans Near You
        </Link>
      </div>
    </div>
  );
}

// ── Extra Help content ────────────────────────────────────────────────────────
function ExtraHelpContent() {
  return (
    <div className="space-y-8">
      {/* What is Extra Help */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
          What Is Extra Help?
        </h3>
        <p className="text-gray-600 text-sm leading-relaxed mb-3">
          Extra Help — also known as the <strong>Low Income Subsidy (LIS)</strong> — is a federal
          program that helps people with Medicare who have limited income and resources pay for their
          Part D prescription drug costs. In 2025, approximately 14 million Medicare beneficiaries
          receive Extra Help, but millions more are eligible and not enrolled.
        </p>
        <div className="rounded-xl p-4 flex gap-2 border" style={{ backgroundColor: "#EEF5F7", borderColor: "#C6DAE0" }}>
          <DollarSign size={15} className="shrink-0 mt-0.5" style={{ color: "#1C3A48" }} />
          <p className="text-sm leading-relaxed" style={{ color: "#3E5560" }}>
            If you qualify, Extra Help can save you <strong>$5,000 or more per year</strong> on
            prescription drug costs — covering premiums, deductibles, copays, and coinsurance.
          </p>
        </div>
      </div>

      {/* 2025 Eligibility */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
          2025 Eligibility Requirements
        </h3>
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: "#EEF5F7" }}>
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
              ].map((row, i) => (
                <tr key={row.req} className={`border border-gray-200 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                  <td className="p-3 text-gray-700">{row.req}</td>
                  <td className="p-3 font-semibold text-[#1C3A48]">{row.full}</td>
                  <td className="p-3 font-semibold" style={{ color: "#237A92" }}>{row.partial}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl p-3 flex gap-2 border" style={{ backgroundColor: "#EEF5F7", borderColor: "#C6DAE0" }}>
          <Info size={14} className="shrink-0 mt-0.5" style={{ color: "#7A9BA6" }} />
          <p className="text-xs leading-relaxed" style={{ color: "#3E5560" }}>
            Resources include bank accounts, stocks, and bonds — but <strong>NOT</strong> your home,
            car, personal belongings, or life insurance. Income limits are adjusted annually.
          </p>
        </div>
      </div>

      {/* What Extra Help Pays For */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
          What Extra Help Pays For
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl p-4 border" style={{ backgroundColor: "#EEF5F7", borderColor: "#C6DAE0" }}>
            <div className="text-sm font-bold mb-2" style={{ color: "#1C3A48" }}>Full Extra Help (Level 1)</div>
            <ul className="space-y-1.5">
              {[
                "$0 Part D premium (benchmark plan)",
                "$0 deductible",
                "$4.50 copay for generic drugs",
                "$11.20 copay for brand-name drugs",
                "$0 copay at catastrophic coverage",
                "No coverage gap",
              ].map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-xs" style={{ color: "#3E5560" }}>
                  <CheckCircle2 size={11} className="shrink-0 mt-0.5" style={{ color: "#237A92" }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl p-4 border" style={{ backgroundColor: "#FAF9F5", borderColor: "#E2EAED" }}>
            <div className="text-sm font-bold mb-2" style={{ color: "#1C3A48" }}>Partial Extra Help (Level 2)</div>
            <ul className="space-y-1.5">
              {[
                "Reduced Part D premium (sliding scale)",
                "Reduced deductible",
                "Reduced copays based on income",
                "Protection from coverage gap",
                "Reduced catastrophic coverage copays",
                "Special Enrollment Period monthly",
              ].map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-xs" style={{ color: "#3E5560" }}>
                  <CheckCircle2 size={11} className="shrink-0 mt-0.5" style={{ color: "#7A9BA6" }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Automatic Enrollment */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
          Automatic Enrollment — Who Qualifies Without Applying
        </h3>
        <p className="text-gray-600 text-sm leading-relaxed mb-3">
          You may be automatically enrolled in Full Extra Help if you receive any of the following:
        </p>
        <div className="space-y-2">
          {[
            { label: "Medicaid (full benefits from your state)", icon: Shield },
            { label: "Supplemental Security Income (SSI)", icon: DollarSign },
            { label: "Medicare Savings Program (QMB, SLMB, QI, or QDWI)", icon: FileText },
          ].map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 p-3 rounded-xl border" style={{ backgroundColor: "#FAF9F5", borderColor: "#E2EAED" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#E8F2F5] shrink-0">
                <Icon size={13} className="text-[#1C3A48]" />
              </div>
              <span className="text-sm text-gray-700">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* How to Apply */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
          How to Apply for Extra Help
        </h3>
        <ol className="space-y-3">
          {[
            { step: "Apply online at SSA.gov", detail: "The online application takes about 15 minutes. You'll need your Medicare number, income information, and resource details. Visit SSA.gov/medicare/part-d-extra-help." },
            { step: "Call Social Security at 1-800-772-1213", detail: "Representatives can take your application over the phone (TTY: 1-800-325-0778). Available Monday–Friday, 8 AM–7 PM." },
            { step: "Visit your local Social Security office", detail: "Bring documentation of income, resources, and Medicare enrollment. Find your local office at SSA.gov/locator." },
            { step: "Apply through your State Medicaid office", detail: "Your state may have additional assistance programs. Applying for Medicaid may automatically qualify you for Extra Help." },
          ].map((item, i) => (
            <li key={item.step} className="flex gap-3 list-none">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
                style={{ backgroundColor: ACCENT }}
              >
                {i + 1}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-800 mb-0.5">{item.step}</div>
                <div className="text-xs text-gray-600 leading-relaxed">{item.detail}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Apply every year:</strong> Extra Help eligibility is re-evaluated annually. If your
            income or resources change, you may gain or lose eligibility. SSA will send a renewal notice
            each year — respond promptly to avoid a gap in benefits.
          </p>
        </div>
      </div>

      {/* Medicare Savings Programs */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "'Lora', Georgia, 'Times New Roman', serif" }}>
          Medicare Savings Programs (MSPs)
        </h3>
        <p className="text-gray-600 text-sm leading-relaxed mb-3">
          Medicare Savings Programs are state-run programs that help pay Medicare costs for people with
          limited income. There are four types:
        </p>
        <div className="space-y-2">
          {[
            { name: "Qualified Medicare Beneficiary (QMB)", covers: "Part A and Part B premiums, deductibles, coinsurance, and copays" },
            { name: "Specified Low-Income Medicare Beneficiary (SLMB)", covers: "Part B premium only" },
            { name: "Qualifying Individual (QI)", covers: "Part B premium only (limited slots, first-come first-served)" },
            { name: "Qualified Disabled & Working Individuals (QDWI)", covers: "Part A premium only (for working disabled individuals)" },
          ].map((prog) => (
            <div key={prog.name} className="p-3 rounded-xl border" style={{ backgroundColor: "#FAF9F5", borderColor: "#E2EAED" }}>
              <div className="text-sm font-semibold text-gray-800 mb-0.5">{prog.name}</div>
              <div className="text-xs text-gray-500">Covers: {prog.covers}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3 leading-relaxed">
          Apply for MSPs through your state Medicaid office. Eligibility varies by state. Contact your
          State Health Insurance Assistance Program (SHIP) for free counseling.
        </p>
      </div>

      {/* CTA links */}
      <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
        <a
          href="https://www.ssa.gov/medicare/part-d-extra-help"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg text-white"
          style={{ backgroundColor: ACCENT }}
        >
          Apply at SSA.gov <ArrowRight size={14} />
        </a>
        <Link href="/part-d/extra-help" className="inline-flex items-center gap-2 text-sm font-semibold no-underline px-4 py-2 rounded-lg border" style={{ color: "#1C3A48", borderColor: "#1C3A48" }}>
          Full Extra Help Guide
        </Link>
      </div>
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────
export default function MedicareGuide() {
  // Each section has independent open/close state
  const [guideOpen, setGuideOpen] = useState(true);   // expanded by default
  const [extraHelpOpen, setExtraHelpOpen] = useState(false); // collapsed by default

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAF9F5" }}>
      <Header />

      {/* Hero — dark navy, matches AI Compare */}
      <section
        className="text-white"
        style={{ backgroundColor: "#1C3A48", position: "relative", overflow: "hidden" }}
      >
        {/* Subtle dot pattern overlay */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute", inset: 0, opacity: 0.05,
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="container" style={{ position: "relative", paddingTop: "44px", paddingBottom: "52px" }}>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs font-medium mb-8" style={{ color: "rgba(255,255,255,0.55)" }}>
            <Link href="/" className="hover:text-white transition-colors no-underline" style={{ color: "rgba(255,255,255,0.55)" }}>Home</Link>
            <ChevronRight size={11} style={{ color: "rgba(255,255,255,0.28)" }} />
            <Link href="/resources" className="hover:text-white transition-colors no-underline" style={{ color: "rgba(255,255,255,0.55)" }}>Resources</Link>
            <ChevronRight size={11} style={{ color: "rgba(255,255,255,0.28)" }} />
            <span style={{ color: "rgba(255,255,255,0.88)", fontWeight: 500 }}>Medicare Guide</span>
          </nav>
          <h1
            className="text-3xl lg:text-4xl font-bold mb-3"
            style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.02em", color: "#fff" }}
          >
            Medicare Guide
          </h1>
          <p className="text-lg max-w-2xl" style={{ color: "rgba(255,255,255,0.75)" }}>
            Everything you need to know about Medicare coverage, costs, enrollment, and financial
            assistance programs — in one place.
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border" style={{ backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.85)" }}>
              <FileText size={12} />
              Complete Medicare Guide
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border" style={{ backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.85)" }}>
              <DollarSign size={12} />
              Extra Help / LIS Programs
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border" style={{ backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.85)" }}>
              <Users size={12} />
              Updated for 2025
            </div>
          </div>
        </div>
      </section>

      {/* Accordion content */}
      <div className="container py-10">
        <div className="max-w-3xl">
          {/* Usage hint */}
          <p className="text-sm text-gray-500 mb-5 flex items-center gap-1.5">
            <Info size={13} />
            Click a section header to expand or collapse it.
          </p>

          {/* Section 1: Complete Medicare Guide */}
          <AccordionSection
            title="Complete Medicare Guide"
            isOpen={guideOpen}
            onToggle={() => setGuideOpen((prev) => !prev)}
            icon={<FileText size={16} style={{ color: ACCENT }} />}
            badge="2025"
          >
            <CompleteMedicareGuideContent />
          </AccordionSection>

          {/* Section 2: Extra Help */}
          <AccordionSection
            title="Extra Help (Low Income Subsidy)"
            isOpen={extraHelpOpen}
            onToggle={() => setExtraHelpOpen((prev) => !prev)}
            icon={<DollarSign size={16} style={{ color: "#1C3A48" }} />}
            badge="Free Program"
          >
            <ExtraHelpContent />
          </AccordionSection>

          {/* Bottom CTA */}
          <div
            className="mt-6 rounded-2xl p-8 text-white text-center"
            style={{ backgroundColor: "#0A1820" }}
          >
            <h2
              className="text-2xl font-bold mb-2"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Ready to Compare Plans?
            </h2>
            <p className="mb-5" style={{ color: "rgba(235,245,248,0.55)" }}>
              Enter your ZIP code to see all available plans in your area — free, with no obligation.
            </p>
            <Link
              href="/plans?zip=64106"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-bold no-underline"
              style={{ backgroundColor: "#F26522", color: "white" }}
            >
              See Plans Near You
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      {/* Minimal footer */}
      <footer
        className="py-6 text-center text-xs"
        style={{ backgroundColor: "#060E14", color: "rgba(255,255,255,0.25)", lineHeight: 1.72 }}
      >
        <p>
          We are not affiliated with or endorsed by the U.S. government or the federal Medicare
          program. This is a demonstration application for educational purposes only.
        </p>
        <p className="mt-1">© 2026 SelectQuote Insurance Services, Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
