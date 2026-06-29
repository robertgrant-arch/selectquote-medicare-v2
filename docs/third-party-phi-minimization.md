# Third-Party PHI Minimization — Integration Summary

**Pass completed:** migration `0003_schema_hardening` + this change  
**Principle:** each vertical slice owns its own PHI boundary; no shared "send anything to AI" helper.

---

## 1. pVerify Eligibility API

**File:** `server/pverifyRouter.ts`  
**Endpoint:** `POST https://api.pverify.com/api/EligibilitySummary`

| | Before | After |
|---|---|---|
| Fields sent | `PayerCode`, `Provider` (object cast to string), `SubscriberMemberID` | `PayerCode`, `ProviderNPI`, `SubscriberMemberID` |
| PHI boundary | None — payload built inline with `(payload as any).SubscriberMemberID = ...` | `buildPverifyPayload()` — explicit whitelist, returns typed object |
| Purge effectiveness | Nulled local vars `mbi`/`ssn` but then read `input.mbi`/`input.ssn` again for mock seed | Captures non-PHI seed (last char only) before purge; local vars wiped; `input` not referenced again |

**PHI risk before:** MEDIUM — payload was already minimal but the purge was silently broken; mock seed reconstructed from the raw identifier.  
**PHI risk after:** LOW — payload constructed through explicit boundary function; purge is now correct; mock seed is a single character that cannot reconstruct the MBI/SSN.

**Fields sent (final):**
- `PayerCode: "00007"` — Medicare payer code, public constant, not PHI
- `ProviderNPI: "1234567890"` — static agent credential, not consumer PHI
- `SubscriberMemberID: <mbi or ssn>` — necessary for eligibility lookup; no alternative

---

## 2. AI Plan Compare (compareStream)

**Files:** `server/compareStream.ts`, `server/compareRouter.ts`, `api/compare-stream.ts`  
**Endpoint:** `POST {forgeApiUrl}/v1/chat/completions`

| | Before | After |
|---|---|---|
| Fields in prompt | Plan name, carrier, type, premium, copays, star ratings, benefit flags, network size | Same — confirmed no consumer PHI |
| PHI boundary | None documented | Block comment with explicit confirmation |

**PHI risk before:** NONE (already PHI-free — plan data is public CMS data).  
**PHI risk after:** NONE (documented and confirmed).

**Note:** "CURRENT PLAN" in the prompt refers to a plan record selected for comparison, not to a consumer's personal eligibility record. No connection to pVerify output is made in the compare flow.

---

## 3. AI Plan Recommendation (recommendStream)

**File:** `server/recommendStream.ts`  
**Endpoint:** `POST {forgeApiUrl}/v1/chat/completions`

| | Before | After |
|---|---|---|
| Fields in prompt | All 20 `answers` fields passed directly | `toDeidentifiedProfile()` re-maps fields individually; unexpected keys excluded |
| PHI type | Categorical enums only (no name/DOB/MBI) | Same — gate now explicit |
| PHI boundary | None — answers spread directly into prompt template | `toDeidentifiedProfile()` whitelist function |

**PHI risk before:** LOW — `AnswersSchema` used `z.string()` (not enum), so a malicious client could inject free-text health data into the prompt.  
**PHI risk after:** LOW → explicit gate. `toDeidentifiedProfile()` re-maps each of the 20 expected fields by name; any unexpected key from the client is silently dropped before reaching the prompt string.

**Fields sent (all categorical — no direct identifiers):**
`healthStatus`, `chronicConditions`, `plannedSurgery`, `pcpVisits`, `specialistVisits`, `erVisits`, `urgentCareVisits`, `monthlyRxCount`, `brandNameDrugs`, `specialtyDrugs`, `monthlyDrugSpend`, `dentalImportance`, `visionImportance`, `hearingImportance`, `needsTransportation`, `wantsOTC`, `wantsFitness`, `hasSpecificDoctors`, `planTypePreference`, `topPriority`

---

## 4. Health Profile AI Narrative (healthProfileRouter)

**File:** `server/healthProfileRouter.ts`  
**Endpoint:** `invokeLLM()` → Forge API / Gemini

| | Before | After |
|---|---|---|
| Fields in prompt | 14 profile fields + ZIP code | 14 health-preference fields only (ZIP excluded) |
| PHI boundary | None | `toAIHealthProfile()` whitelist; explicitly omits ZIP, erVisits, urgentCareVisits |
| Schema strictness | All fields are strict enums — free-text not possible | Same |

**PHI risk before:** LOW — enums prevented raw PHI, but ZIP was included unnecessarily.  
**PHI risk after:** LOW → ZIP removed. The AI doesn't need geographic context to generate a generic narrative about plan fit. Removing ZIP follows minimum-necessary principle.

**Omitted from AI (with justification):**
- `zip` — used for plan scoring and filtering only; AI narrative doesn't need location
- `erVisits`, `urgentCareVisits` — used in cost estimation algorithm only; AI narrative focuses on qualitative fit, not visit-count arithmetic

---

## 5. Chat AI Assistant

**File:** `api/chat.ts`  
**Endpoints:** `POST https://api.anthropic.com/v1/messages` / `POST https://api.openai.com/v1/chat/completions`

| | Before | After |
|---|---|---|
| Message history sent | Full unbounded conversation history | Last 20 messages only |
| Phone number handling | Raw digits sent to AI in every subsequent turn | Stripped by `sanitizeMessagesForAI()` before every AI call |
| PHI boundary | None — raw `messages` array forwarded directly | `sanitizeMessagesForAI()`: phone redaction + window cap |

**PHI risk before:** MEDIUM — the system prompt deliberately collects user name and phone number (Steps 6–7 for lead generation). Those values accumulated in the conversation history and were re-sent to Anthropic/OpenAI on every subsequent message turn, indefinitely.  
**PHI risk after:** LOW:
- Phone numbers matching North-American patterns are replaced with `[phone redacted]` before the message array reaches any AI provider.
- History is capped at 20 messages, limiting how far back PII from early turns travels.
- First name is not redacted (no reliable pattern; AI needs it for warm tone; risk is low since first names alone are not HIPAA identifiers).

---

## 6. Voice Webhook (Vapi)

**File:** `api/voice-webhook.ts`  
**Internal endpoints:** `/api/plans`, `/api/formularyCalculator`

| Function | Before | After |
|---|---|---|
| `get_plan_recommendations` | `parameters.zip`, `parameters.planType` forwarded inline | `buildPlanQuery()` whitelist: only `zip` + `planType` |
| `check_drug_coverage` | `parameters.drugName`, `parameters.zip` forwarded inline | `buildDrugQuery()` whitelist: only `zip` + `drugName` |

**PHI risk before:** LOW — parameters came from Vapi function-call schema which was already constrained. No consumer identifiers were included. Risk: Vapi could in principle add new parameters that would be forwarded unexpectedly.  
**PHI risk after:** LOW → explicit. Boundary functions discard any unexpected keys from Vapi's `parameters` object; only the two expected fields per function are forwarded.

**Note:** `drugName` is health-adjacent information (it reveals what medication the consumer is asking about). It is forwarded to the internal formulary API because it is the minimum required for that lookup. No consumer name, session ID, or other identifier accompanies it.

---

## 7. Admin Masked View (quoteSession)

**File:** `server/quoteSession/router.ts` — new `quoteSession.adminGet` procedure

| | Before | After |
|---|---|---|
| Admin access to PHI | No admin endpoint; only consumer `resume` (requires token) | `adminGet` procedure using `adminProcedure` middleware |
| PHI exposure | N/A | Masked: first name `"J*****"`, email `"jo***@***.***"`, phone last 3 digits visible, DOB `"****-**-**"`, MBI first 3 chars visible |
| Full decryption | Via `resume` (requires consumer's token) | Via `resume` only — admins cannot decrypt |

**Design decision:** Admins can see masked values sufficient to identify a record (status, ZIP, partial contact info) but cannot decrypt PHI. Full decryption requires the consumer's resume token — a credential only the consumer holds. This prevents insider access to raw beneficiary records without consumer involvement.

---

## 8. Blue Button 2.0 (CMS OAuth)

**File:** `api/bluebutton-callback.ts`  
**Status:** No change — consumer-consented PHI access.

This integration accesses beneficiary claims data (drug names, NDC codes, patient name) only after the consumer explicitly authorizes via CMS OAuth. The PHI accessed is the minimum required by the OAuth scope granted. No changes made.

---

## 9. NPI Registry

**File:** `api/doctors.ts`  
**Status:** No change — no consumer PHI.

Search queries contain doctor names (the provider's name, not the consumer's). NPI registry data is public. No consumer identifiers are sent or received. No changes made.

---

## Invariants enforced

1. **No generic AI helper.** Each AI call site has its own boundary function or documented whitelist. There is no `sendToAI(anything)` path.
2. **Vertical slice ownership.** Each slice's boundary function lives in or adjacent to that slice's router/handler file.
3. **No PHI in URL params.** Voice webhook and NPI lookups use encoded query strings; MBI/SSN never appear in URLs.
4. **Admin ≠ consumer.** Admin procedures return masked values only. The consumer's resume token is required for full decryption — admins cannot bypass this.
