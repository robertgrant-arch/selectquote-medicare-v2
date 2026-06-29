# Key Management — PHI Encryption

This document covers how to configure, rotate, and operate the AES-256-GCM encryption keys used for PHI field-level encryption in this application.

---

## Required environment variables

| Variable | Format | Purpose |
|---|---|---|
| `ACTIVE_KEY_ID` | Alphanumeric string, e.g. `k1` | Selects which key to use for **new** encryptions |
| `KEY_<id>` | 64-char lowercase hex (32 bytes) | AES-256 encryption key — one var per key ID |
| `HMAC_LOOKUP_KEY` | 64-char lowercase hex (32 bytes) | Dedicated HMAC key for `hashForLookup()` — separate from encryption keys |

**At minimum:** `ACTIVE_KEY_ID`, one matching `KEY_<ACTIVE_KEY_ID>`, and `HMAC_LOOKUP_KEY` must be present on startup.

The server performs a fail-fast check (`validateCryptoEnv()`) before accepting any connections. If any variable is missing or malformed, the process exits with a descriptive error rather than serving requests in a broken state.

---

## Generating a new key

```bash
# Generate a 32-byte (256-bit) key and print as 64-char hex:
openssl rand -hex 32
```

Run this once per key you need to generate. Store the output in your secrets manager (AWS Secrets Manager, Vercel environment variables, etc.). **Never commit key material to source control.**

Example output:
```
3a7f1c9e2b4d8f0a6e5c3b1d9f7a2e4c8b0d6f1a3e5c7b9d2f4a6e8c0b3d5f
```

---

## Initial setup (first deploy)

```bash
# In your secrets manager / deployment environment:
ACTIVE_KEY_ID=k1
KEY_k1=<output of openssl rand -hex 32>
HMAC_LOOKUP_KEY=<output of openssl rand -hex 32>
```

These three are the minimum required set. Generate each with a separate `openssl rand -hex 32` invocation — they must be different keys.

---

## Key rotation procedure (encryption keys)

Rotating an encryption key does **not** immediately invalidate existing ciphertext — each encrypted envelope embeds the `key_id` used to produce it, so old values remain decryptable as long as the old key stays in the environment.

**Rotation steps (zero-downtime):**

1. **Generate the new key:**
   ```bash
   openssl rand -hex 32
   # → outputs <new-key-hex>
   ```

2. **Add the new key alongside the old one.** In your secrets manager, set:
   ```
   ACTIVE_KEY_ID=k2          # new active ID
   KEY_k1=<old-key-hex>      # keep — needed to decrypt legacy data
   KEY_k2=<new-key-hex>      # new key
   HMAC_LOOKUP_KEY=<unchanged>
   ```

3. **Deploy** the new environment. The server will start using `k2` for all new encryptions. Existing rows encrypted with `k1` continue to decrypt correctly because `k1` is still present.

4. **Backfill (optional, low urgency):** Re-encrypt legacy rows using the new key at your convenience. A migration script should `decryptField(old, ctx)` → `encryptField(plain, ctx)` (which picks up the new `ACTIVE_KEY_ID` automatically). There is no urgency — old rows remain secure.

5. **Remove the old key only after backfill is 100% complete.** Removing `KEY_k1` before backfill means any un-migrated row throws a decryption error.

---

## HMAC_LOOKUP_KEY rotation (rare)

`HMAC_LOOKUP_KEY` controls `hashForLookup()`, which produces the indexed hash stored in `emailLookupHash` and similar columns. It is intentionally **separate** from the encryption keys so that normal encryption key rotations do not affect lookup indexes.

You should rotate `HMAC_LOOKUP_KEY` only if:
- The key is known or suspected to be compromised.
- A regulatory requirement mandates periodic HMAC key rotation.

**Effect of rotating `HMAC_LOOKUP_KEY`:** All existing lookup hash values in the database become stale. Lookups by email (or any other hashed field) will fail to match until the corresponding row is re-hashed.

**Rotation procedure:**

1. Generate a new HMAC key: `openssl rand -hex 32`
2. Run a full re-hash migration: for every row with a `emailLookupHash`, load the decrypted email, recompute `hashForLookup(email)` with the new key, and write back.
3. Deploy new `HMAC_LOOKUP_KEY` atomically with (or after) the migration completes.

This migration requires a maintenance window or a careful blue/green deployment strategy.

---

## Rollback procedure

If a bad key was deployed and you need to roll back:

1. Restore the previous `ACTIVE_KEY_ID` and `KEY_<previous-id>` values in your secrets manager.
2. Redeploy. The old key is still in env — all ciphertext encrypted with it decrypts normally.
3. Remove the new (bad) `KEY_<new-id>` entry if it was never used to encrypt any production data.

If the new key was already used to encrypt some rows before rollback:
- Keep `KEY_<new-id>` in env so those rows remain decryptable.
- Set `ACTIVE_KEY_ID` back to the previous ID.
- Plan a re-encryption migration at next maintenance.

---

## No plaintext fallback mode

There is no configuration flag, environment variable, or code path that causes the module to return plaintext when a key is unavailable. A missing or invalid key always throws an error. This is intentional:

- A configuration mistake surfaces immediately as a startup failure (`validateCryptoEnv()`).
- A missing key during decryption surfaces as a hard error on that specific field, not silently as plaintext.
- There is no `DEBUG_SKIP_ENCRYPTION=true` or equivalent flag in any environment.

---

## What is safe to log during incidents

| Safe to log | Not safe to log |
|---|---|
| Session ID (UUID) | MBI / SSN |
| Key ID (e.g. `k1`) — identifies which key, not the key material | Any `KEY_*` env var value |
| Error type (e.g. `authentication failed`) | Any decrypted field value |
| Encrypted envelope (base64url blob) | Raw resume token |
| ZIP code, county, plan name | Date of birth, first name, last name |
| `encryptionKeyVersion` column value | Email address (use `emailLookupHash` for lookups) |

When logging errors involving PHI fields, log the field name and the error class — not the value. For example:

```
// Good:
console.error("[repo] Failed to decrypt eligibility.mbi — authentication failed");

// Bad:
console.error("[repo] Failed to decrypt mbi:", raw_mbi_value);
```

Resume tokens are opaque credentials. Treat them like passwords: never log them, never store them plaintext anywhere except the client's `localStorage`.
