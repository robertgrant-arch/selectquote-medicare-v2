# PHI Test Coverage

This document maps each compliance guarantee to the test(s) that verify it.
All test data is synthetic — no real beneficiary identifiers are used.

---

## Test files

| File | Scope | Tests |
|---|---|---|
| `shared/security/crypto.test.ts` | Crypto primitives | 40 |
| `server/quoteSession/quoteSession.test.ts` | Quote-session repository (existing) | 25 |
| `server/quoteSession/phi-compliance.test.ts` | Quote-session PHI compliance (new) | 22 |
| `server/phi-boundary.test.ts` | Integration payload minimization (new) | 23 |
| `server/phi-logging.test.ts` | Console log hygiene (new) | 6 |
| `server/pverify.test.ts` | pVerify router behavior | 10 |
| `server/healthProfile.test.ts` | Health-profile scoring | 10 |
| `server/compare.test.ts` | AI compare router | 3 |
| `server/auth.logout.test.ts` | Auth session handling | varies |

---

## Compliance guarantee → test location

### PHI encrypted before DB insertion

> "Plaintext PHI never touches a database column."

| Test | File |
|---|---|
| `CRITICAL — PHI is never stored as plaintext in DB (contact fields)` | `quoteSession.test.ts` |
| `CRITICAL — PHI is never stored as plaintext in DB (eligibility fields)` | `quoteSession.test.ts` |
| `CRITICAL — PHI is never stored as plaintext in DB (medications)` | `quoteSession.test.ts` |
| `CRITICAL — PHI is never stored as plaintext in DB (providers)` | `quoteSession.test.ts` |
| `two createSession calls for the same contact produce different ciphertext` | `phi-compliance.test.ts` |
| `ciphertext stored for medication name does not contain the drug name` | `phi-compliance.test.ts` |

---

### Ciphertext does not contain plaintext fragments

> "A ciphertext blob stored in the DB cannot be searched by the plaintext value."

| Test | File |
|---|---|
| `ciphertext does not contain plaintext` | `quoteSession.test.ts` |
| `two encrypt calls for the same MBI produce different ciphertext (GCM random IV)` | `phi-compliance.test.ts` |
| `output is a valid base64url string (no +, /, =)` | `crypto.test.ts` |

---

### Decryption only in authorized paths

> "Ciphertext encrypted for one purpose cannot be decrypted as another."

| Test | File |
|---|---|
| `fails if purpose is different` | `crypto.test.ts` |
| `fails if field is different` | `crypto.test.ts` |
| `purpose binding — wrong field name fails auth` | `quoteSession.test.ts` |
| `wrong-field decryption returns undefined (purpose-binding enforced at repository level)` | `phi-compliance.test.ts` |

---

### Resume token hashing — raw token never persisted

> "The raw resume token is returned to the client once and never stored server-side."

| Test | File |
|---|---|
| `createSession stores resumeTokenHash (not raw token)` | `quoteSession.test.ts` |
| `hash is deterministic` | `quoteSession.test.ts` |
| `different tokens produce different hashes` | `quoteSession.test.ts` |
| `hash is 64-char hex (SHA-256)` | `quoteSession.test.ts` |
| `resume round-trip — loadByTokenHash returns decrypted PHI` | `quoteSession.test.ts` |

---

### Logs do not contain PHI/PII by default

> "Console output never contains raw beneficiary identifiers, even during failures."

| Test | File |
|---|---|
| `createSession emits no console output containing PHI field values` | `phi-compliance.test.ts` |
| `decryption failure emits no PHI in console output` | `phi-compliance.test.ts` |
| `markCompleted and markAbandoned emit no PHI in console output` | `phi-compliance.test.ts` |
| `eligibilityCheck with MBI — console output contains no MBI value` | `phi-logging.test.ts` |
| `eligibilityCheck with SSN — console output contains no SSN value` | `phi-logging.test.ts` |
| `pVerify fetch failure — warning log contains HTTP status code, not MBI` | `phi-logging.test.ts` |
| `validateCryptoEnv failure message contains field names, not key material` | `phi-logging.test.ts` |
| `loadKey error — error names the key ID, not the key value` | `phi-logging.test.ts` |
| `pverify.lookup — ID does not appear in console output` | `phi-logging.test.ts` |

---

### Quote sessions expire and cannot be resumed after expiry

> "Sessions become inaccessible after 30 days; status transitions are irreversible."

| Test | File |
|---|---|
| `expired session returns null` | `quoteSession.test.ts` |
| `loadByTokenHash returns null when expiresAt is in the past` | `phi-compliance.test.ts` |
| `loadByTokenHash returns null for a completed session — status filter enforced` | `phi-compliance.test.ts` |
| `loadByTokenHash returns null for an abandoned session — status filter enforced` | `phi-compliance.test.ts` |

---

### Tampered ciphertext fails decryption with non-leaky errors

> "Auth-tag verification catches tampering; the error message does not contain the plaintext."

| Test | File |
|---|---|
| `fails when ciphertext is modified` | `crypto.test.ts` |
| `fails when auth_tag is modified` | `crypto.test.ts` |
| `fails when iv is modified` | `crypto.test.ts` |
| `tampered ciphertext returns undefined from decOrUndefined — error is swallowed` | `phi-compliance.test.ts` |
| `decOrUndefined returns undefined for tampered payload` | `quoteSession.test.ts` |
| `error message from a failed decrypt contains 'authentication failed', not the plaintext` | `phi-compliance.test.ts` |

---

### Integration payload minimization respected

> "Each external integration receives only the minimum fields it requires."

#### pVerify
| Test | File |
|---|---|
| `payload contains only PayerCode, ProviderNPI, SubscriberMemberID — no name, DOB, address` | `phi-boundary.test.ts` |
| `MBI takes precedence over SSN — SSN never forwarded alongside MBI` | `phi-boundary.test.ts` |
| `returns null when no identifier provided — no partial payload constructed` | `phi-boundary.test.ts` |
| `ProviderNPI is a static credential, not derived from consumer input` | `phi-boundary.test.ts` |
| `consumer name, date-of-birth, and address are never present in payload` | `phi-boundary.test.ts` |
| `COMPLIANCE: rejects input with neither MBI nor SSN` | `pverify.test.ts` |

#### Recommend AI (toDeidentifiedProfile)
| Test | File |
|---|---|
| `unexpected keys injected by a malicious or buggy client are excluded from AI profile` | `phi-boundary.test.ts` |
| `output contains all 20 expected health-preference fields` | `phi-boundary.test.ts` |
| `output has exactly 20 keys — no hidden extras` | `phi-boundary.test.ts` |
| `all 20 field values are passed through unchanged` | `phi-boundary.test.ts` |

#### HealthProfile AI (toAIHealthProfile)
| Test | File |
|---|---|
| `zip is excluded from the AI narrative profile` | `phi-boundary.test.ts` |
| `erVisits is excluded — used only for cost scoring` | `phi-boundary.test.ts` |
| `urgentCareVisits is excluded — used only for cost scoring` | `phi-boundary.test.ts` |
| `exactly 14 health-preference fields are sent to the AI` | `phi-boundary.test.ts` |

#### Chat AI (sanitizeMessagesForAI)
| Test | File |
|---|---|
| `US 10-digit phone numbers are redacted before AI receives messages` | `phi-boundary.test.ts` |
| `phone with area code in parens is redacted` | `phi-boundary.test.ts` |
| `phone with country code prefix is redacted` | `phi-boundary.test.ts` |
| `phone with dot separators is redacted` | `phi-boundary.test.ts` |
| `multiple phone numbers in one message are all redacted` | `phi-boundary.test.ts` |
| `message history is capped at 20 messages — older turns are dropped` | `phi-boundary.test.ts` |
| `phone number in message beyond the window is never sent to AI` | `phi-boundary.test.ts` |
| `non-phone content is preserved exactly — no over-redaction` | `phi-boundary.test.ts` |

#### Voice Webhook (buildPlanQuery / buildDrugQuery)
| Test | File |
|---|---|
| `only zip and planType are forwarded — all other Vapi parameters are discarded` | `phi-boundary.test.ts` |
| `only zip and drugName are forwarded — no consumer identifiers` | `phi-boundary.test.ts` |
| `drugName with special characters is URL-encoded` | `phi-boundary.test.ts` |

---

### HMAC lookup key separation

> "emailLookupHash is stable across encryption key rotations — controlled by HMAC_LOOKUP_KEY only."

| Test | File |
|---|---|
| `emailLookupHash is stored (not the raw email)` | `quoteSession.test.ts` |
| `emailLookupHash does not change when encryption key rotates from k1 to k2` | `phi-compliance.test.ts` |
| `emailLookupHash changes only when HMAC_LOOKUP_KEY changes` | `phi-compliance.test.ts` |
| `emailLookupHash stored is a 64-char hex digest — not the raw email` | `phi-compliance.test.ts` |
| `is controlled by HMAC_LOOKUP_KEY, not by the encryption key` | `crypto.test.ts` |
| `changes when HMAC_LOOKUP_KEY changes` | `crypto.test.ts` |

---

### Key rotation

> "Values encrypted under an old key remain decryptable after rotation to a new key."

| Test | File |
|---|---|
| `values encrypted with k1 are still decryptable after rotating to k2` | `crypto.test.ts` |
| `legacy value cannot decrypt if old key is removed after rotation` | `crypto.test.ts` |
| `key rotation — old session decrypts with old key, new session with new key` | `quoteSession.test.ts` |

---

## Running only PHI-related tests

```bash
# All compliance tests
npx vitest run server/phi-boundary.test.ts \
               server/quoteSession/phi-compliance.test.ts \
               server/phi-logging.test.ts \
               server/quoteSession/quoteSession.test.ts \
               shared/security/crypto.test.ts

# Boundary functions only (fast, no DB mock)
npx vitest run server/phi-boundary.test.ts shared/security/crypto.test.ts
```
