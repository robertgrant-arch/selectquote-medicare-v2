/**
 * PHI Boundary Tests — Integration Payload Minimization
 *
 * Each test verifies a compliance guarantee:
 *   "Only the minimum fields required for this integration are sent."
 *
 * Coverage map:
 *   pVerify         → buildPverifyPayload (server/pverifyRouter.ts)
 *   Recommend AI    → toDeidentifiedProfile (server/recommendStream.ts)
 *   HealthProfile AI→ toAIHealthProfile (server/healthProfileRouter.ts)
 *   Chat AI         → sanitizeMessagesForAI (server/chatBoundary.ts)
 *   Voice Webhook   → buildPlanQuery, buildDrugQuery (server/voiceWebhookBoundary.ts)
 *
 * Test data: all synthetic — no real beneficiary identifiers.
 *
 * Run: npm test -- server/phi-boundary.test.ts
 */

import { describe, it, expect } from "vitest";

// ── pVerify boundary ──────────────────────────────────────────────────────────
import { buildPverifyPayload } from "./pverifyRouter";

describe("pVerify PHI boundary — buildPverifyPayload", () => {
  it("COMPLIANCE: payload contains only PayerCode, ProviderNPI, SubscriberMemberID — no name, DOB, address, or other identifiers", () => {
    const payload = buildPverifyPayload({ mbi: "1EG4-A22-AA11" });
    expect(payload).not.toBeNull();
    const keys = Object.keys(payload!);
    expect(keys).toEqual(
      expect.arrayContaining(["PayerCode", "ProviderNPI", "SubscriberMemberID"])
    );
    // Exactly three fields — nothing else
    expect(keys).toHaveLength(3);
  });

  it("COMPLIANCE: MBI is forwarded as SubscriberMemberID — no transformation", () => {
    const mbi = "1EG4-A22-AA11";
    const payload = buildPverifyPayload({ mbi });
    expect(payload!.SubscriberMemberID).toBe(mbi);
  });

  it("COMPLIANCE: SSN is forwarded when MBI is absent", () => {
    const ssn = "123456789";
    const payload = buildPverifyPayload({ ssn });
    expect(payload!.SubscriberMemberID).toBe(ssn);
  });

  it("COMPLIANCE: MBI takes precedence over SSN when both are supplied — SSN never forwarded alongside MBI", () => {
    const syntheticSsn = "987654321"; // use a value not present in any static constant
    const payload = buildPverifyPayload({ mbi: "1EG4-A22-AA11", ssn: syntheticSsn });
    // Only MBI should appear — SSN must not be forwarded in the same request
    expect(payload!.SubscriberMemberID).toBe("1EG4-A22-AA11");
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(syntheticSsn);
  });

  it("COMPLIANCE: returns null when no identifier is provided — no partial payload constructed", () => {
    // A call with no identifier must not construct a payload at all, preventing
    // accidental API calls with empty SubscriberMemberID.
    expect(buildPverifyPayload({})).toBeNull();
    expect(buildPverifyPayload({ mbi: undefined, ssn: undefined })).toBeNull();
  });

  it("COMPLIANCE: ProviderNPI is a static credential, not derived from consumer input", () => {
    // The NPI is the organization's credential, not the consumer's identifier.
    // It must never vary based on mbi/ssn input.
    const p1 = buildPverifyPayload({ mbi: "AAAA-B11-CC22" });
    const p2 = buildPverifyPayload({ ssn: "987654321" });
    expect(p1!.ProviderNPI).toBe(p2!.ProviderNPI);
  });

  it("COMPLIANCE: consumer name, date-of-birth, and address are never present in payload", () => {
    const payload = buildPverifyPayload({ mbi: "1EG4-A22-AA11" });
    const serialized = JSON.stringify(payload).toLowerCase();
    // None of these PHI field names should appear
    expect(serialized).not.toContain("name");
    expect(serialized).not.toContain("birth");
    expect(serialized).not.toContain("dob");
    expect(serialized).not.toContain("address");
    expect(serialized).not.toContain("phone");
    expect(serialized).not.toContain("email");
  });
});

// ── Recommend AI boundary ─────────────────────────────────────────────────────
import { toDeidentifiedProfile } from "./recommendStream";

// Minimal valid answer set — all 20 categorical fields, no free-text identifiers
const VALID_ANSWERS = {
  healthStatus:        "good",
  chronicConditions:   "1-2",
  plannedSurgery:      "no",
  pcpVisits:           "3-6",
  specialistVisits:    "1-3",
  erVisits:            "0",
  urgentCareVisits:    "1-3",
  monthlyRxCount:      "1-3",
  brandNameDrugs:      "no",
  specialtyDrugs:      "no",
  monthlyDrugSpend:    "under-100",
  dentalImportance:    "somewhat",
  visionImportance:    "somewhat",
  hearingImportance:   "not",
  needsTransportation: "no",
  wantsOTC:            "yes",
  wantsFitness:        "yes",
  hasSpecificDoctors:  "no",
  planTypePreference:  "no-preference",
  topPriority:         "lowest-premium",
};

describe("Recommend AI PHI boundary — toDeidentifiedProfile", () => {
  it("COMPLIANCE: output contains all 20 expected health-preference fields", () => {
    const result = toDeidentifiedProfile(VALID_ANSWERS);
    expect(Object.keys(result)).toHaveLength(20);
    for (const key of Object.keys(VALID_ANSWERS)) {
      expect(result).toHaveProperty(key);
    }
  });

  it("COMPLIANCE: unexpected keys injected by a malicious or buggy client are excluded from AI profile", () => {
    // If a future developer adds a free-text 'otherConditions' field to the form,
    // it must not reach the AI without an explicit decision at this boundary.
    const tampered = {
      ...VALID_ANSWERS,
      firstName:  "Alice",        // PII — must be stripped
      mbi:        "1EG4-A22-AA11", // PHI — must be stripped
      phone:      "555-867-5309", // PII — must be stripped
      ssn:        "123456789",   // PHI — must be stripped
      otherNotes: "I have diabetes type 2 and take Metformin", // free-text PHI
    } as any;

    const result = toDeidentifiedProfile(tampered);

    expect(result).not.toHaveProperty("firstName");
    expect(result).not.toHaveProperty("mbi");
    expect(result).not.toHaveProperty("phone");
    expect(result).not.toHaveProperty("ssn");
    expect(result).not.toHaveProperty("otherNotes");

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Alice");
    expect(serialized).not.toContain("1EG4-A22-AA11");
    expect(serialized).not.toContain("555-867-5309");
    expect(serialized).not.toContain("Metformin");
  });

  it("COMPLIANCE: all 20 field values are passed through unchanged — no value transformation", () => {
    const result = toDeidentifiedProfile(VALID_ANSWERS);
    for (const [key, value] of Object.entries(VALID_ANSWERS)) {
      expect(result[key as keyof typeof result]).toBe(value);
    }
  });

  it("COMPLIANCE: output has exactly 20 keys — no hidden extras from the boundary function itself", () => {
    const result = toDeidentifiedProfile({ ...VALID_ANSWERS, surprise: "x" } as any);
    expect(Object.keys(result)).toHaveLength(20);
  });
});

// ── HealthProfile AI boundary ─────────────────────────────────────────────────
import { toAIHealthProfile } from "./healthProfileRouter";

const FULL_PROFILE = {
  ...VALID_ANSWERS,
  zip:              "66208",   // geographic identifier — must be excluded from AI
  erVisits:         "0",       // used only for cost scoring — must be excluded from AI
  urgentCareVisits: "1-3",     // used only for cost scoring — must be excluded from AI
} as Parameters<typeof toAIHealthProfile>[0];

describe("HealthProfile AI PHI boundary — toAIHealthProfile", () => {
  it("COMPLIANCE: zip is excluded from the AI narrative profile", () => {
    const result = toAIHealthProfile(FULL_PROFILE);
    expect(result).not.toHaveProperty("zip");
    // Verify the value itself does not appear either
    expect(JSON.stringify(result)).not.toContain("66208");
  });

  it("COMPLIANCE: erVisits is excluded — used only for cost scoring, not needed for AI narrative", () => {
    const result = toAIHealthProfile(FULL_PROFILE);
    expect(result).not.toHaveProperty("erVisits");
  });

  it("COMPLIANCE: urgentCareVisits is excluded — used only for cost scoring, not needed for AI narrative", () => {
    const result = toAIHealthProfile(FULL_PROFILE);
    expect(result).not.toHaveProperty("urgentCareVisits");
  });

  it("COMPLIANCE: exactly 14 health-preference fields are sent to the AI", () => {
    // zip (1) + erVisits (1) + urgentCareVisits (1) = 3 removed from 17 total
    // Actually: HealthProfileSchema has 20 fields; toAIHealthProfile sends 14 of them.
    // The 6 excluded: zip, erVisits, urgentCareVisits, monthlyDrugSpend, wantsOTC, wantsFitness
    // — wait, let me count what IS included per the implementation.
    const result = toAIHealthProfile(FULL_PROFILE);
    const EXPECTED_AI_FIELDS = [
      "healthStatus", "chronicConditions", "plannedSurgery",
      "pcpVisits", "specialistVisits",
      "monthlyRxCount", "brandNameDrugs", "specialtyDrugs",
      "dentalImportance", "visionImportance", "hearingImportance",
      "needsTransportation", "planTypePreference", "topPriority",
    ];
    expect(Object.keys(result).sort()).toEqual(EXPECTED_AI_FIELDS.sort());
  });

  it("COMPLIANCE: no consumer-identifying fields (firstName, lastName, MBI, SSN, phone, email, DOB) present in AI profile", () => {
    const result = toAIHealthProfile(FULL_PROFILE);
    // Check by key presence — these PHI field names must not appear as properties
    expect(result).not.toHaveProperty("firstName");
    expect(result).not.toHaveProperty("lastName");
    expect(result).not.toHaveProperty("mbi");
    expect(result).not.toHaveProperty("ssn");
    expect(result).not.toHaveProperty("phone");
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("dateOfBirth");
    expect(result).not.toHaveProperty("zip");
  });
});

// ── Chat AI boundary ──────────────────────────────────────────────────────────
import {
  sanitizeMessagesForAI,
  MAX_CHAT_CONTEXT_MESSAGES,
  type ChatMessage,
} from "./chatBoundary";

function msg(role: string, content: string): ChatMessage {
  return { role, content };
}

describe("Chat AI PHI boundary — sanitizeMessagesForAI", () => {
  it("COMPLIANCE: US 10-digit phone numbers are redacted before AI receives messages", () => {
    const messages = [msg("user", "My number is 555-867-5309")];
    const result = sanitizeMessagesForAI(messages);
    expect(result[0].content).toBe("My number is [phone redacted]");
    expect(result[0].content).not.toContain("555-867-5309");
  });

  it("COMPLIANCE: phone with area code in parens is redacted", () => {
    const messages = [msg("user", "call me at (913) 555-1234")];
    const result = sanitizeMessagesForAI(messages);
    expect(result[0].content).toContain("[phone redacted]");
    expect(result[0].content).not.toContain("913");
  });

  it("COMPLIANCE: phone with country code prefix is redacted", () => {
    const messages = [msg("user", "reach me at +1 800 555 0100")];
    const result = sanitizeMessagesForAI(messages);
    expect(result[0].content).toContain("[phone redacted]");
  });

  it("COMPLIANCE: phone with dot separators is redacted", () => {
    const messages = [msg("user", "Try 913.555.4567 after 3pm")];
    const result = sanitizeMessagesForAI(messages);
    expect(result[0].content).toContain("[phone redacted]");
    expect(result[0].content).not.toContain("913.555.4567");
  });

  it("COMPLIANCE: multiple phone numbers in one message are all redacted", () => {
    const messages = [
      msg("user", "Home: 555-111-2222, cell: (555) 333-4444"),
    ];
    const result = sanitizeMessagesForAI(messages);
    const content = result[0].content as string;
    expect(content).not.toContain("555-111-2222");
    expect(content).not.toContain("333-4444");
    expect(content.match(/\[phone redacted\]/g)).toHaveLength(2);
  });

  it("COMPLIANCE: non-phone content is preserved exactly — no over-redaction", () => {
    const messages = [msg("user", "I prefer HMO plans with $0 premium")];
    const result = sanitizeMessagesForAI(messages);
    expect(result[0].content).toBe("I prefer HMO plans with $0 premium");
  });

  it("COMPLIANCE: message history is capped at 20 messages — older turns are dropped", () => {
    const messages = Array.from({ length: 30 }, (_, i) =>
      msg("user", `Message ${i + 1}`)
    );
    const result = sanitizeMessagesForAI(messages);
    expect(result).toHaveLength(MAX_CHAT_CONTEXT_MESSAGES);
    // The most recent 20 are kept — older 10 are dropped
    expect((result[0].content as string)).toBe("Message 11");
    expect((result[19].content as string)).toBe("Message 30");
  });

  it("COMPLIANCE: phone number in message beyond the window is never sent to AI", () => {
    // Phone was shared in message #1 (far outside the 20-message window).
    // It should not appear in the sanitized output at all — not just redacted,
    // but entirely absent because the message itself is dropped.
    const messages = [
      msg("user", "My phone is 555-867-5309"),         // #1 — dropped (outside window)
      ...Array.from({ length: 25 }, (_, i) =>
        msg("user", `Follow-up ${i + 1}`)              // #2–26
      ),
    ];
    const result = sanitizeMessagesForAI(messages);
    const allContent = result.map((m) => m.content).join(" ");
    expect(allContent).not.toContain("555-867-5309");
    expect(allContent).not.toContain("[phone redacted]"); // wasn't even in the window
  });

  it("COMPLIANCE: non-string content (structured AI tool calls) is passed through without modification", () => {
    const structured = { type: "tool_use", id: "123", name: "lookup" };
    const messages = [{ role: "assistant", content: structured }];
    const result = sanitizeMessagesForAI(messages);
    expect(result[0].content).toBe(structured);
  });
});

// ── Voice webhook boundary ────────────────────────────────────────────────────
import { buildPlanQuery, buildDrugQuery } from "./voiceWebhookBoundary";

describe("Voice webhook PHI boundary — buildPlanQuery", () => {
  it("COMPLIANCE: only zip and planType are forwarded — all other Vapi parameters are discarded", () => {
    const params = {
      zip:        "66208",
      planType:   "HMO",
      // These extras must be discarded:
      memberName: "Alice Smith",
      mbi:        "1EG4-A22-AA11",
      sessionId:  "some-session-uuid",
      timestamp:  "2025-01-15T10:00:00Z",
    };
    const query = buildPlanQuery(params);
    expect(query).toContain("zip=66208");
    expect(query).toContain("type=HMO");
    expect(query).not.toContain("Alice");
    expect(query).not.toContain("1EG4");
    expect(query).not.toContain("sessionId");
    expect(query).not.toContain("timestamp");
  });

  it("COMPLIANCE: non-string zip is not forwarded (empty string instead)", () => {
    const query = buildPlanQuery({ zip: 66208 as any, planType: "PPO" });
    expect(query).toContain("zip=");
    // Numeric zip coerced to empty string — no integer forwarded as-is
    expect(query).not.toContain("zip=66208");
  });
});

describe("Voice webhook PHI boundary — buildDrugQuery", () => {
  it("COMPLIANCE: only zip and drugName are forwarded — no consumer identifiers", () => {
    const params = {
      zip:      "66208",
      drugName: "Metformin",
      // These must be discarded:
      patientId: "some-patient-uuid",
      mbi:       "1EG4-A22-AA11",
      dob:       "1955-04-12",
    };
    const query = buildDrugQuery(params);
    expect(query).toContain("zip=66208");
    expect(query).toContain("drugs=Metformin");
    expect(query).not.toContain("patientId");
    expect(query).not.toContain("1EG4");
    expect(query).not.toContain("1955-04-12");
  });

  it("COMPLIANCE: drugName with special characters is URL-encoded — ampersand cannot split into a second parameter", () => {
    const query = buildDrugQuery({ zip: "66208", drugName: "Humira & Metformin" });
    // The literal ' & ' in the drug name must be percent-encoded (%26), not
    // left as a raw '&' that would be parsed as a second query key=value pair.
    expect(query).toContain("%26");         // ampersand is encoded
    expect(query).not.toContain("& Met");   // raw unencoded ampersand not present
    expect(query).toContain("drugs=Humira");
  });
});
