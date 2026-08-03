# KT Couriers Phase 12 Architect Correction Report

## 1. Status

CORRECTION COMPLETE — DEEP VALIDATION DEFERRED

## 2. Payfast Validation-Body Correction

Previous behavior passed exact received ITN bytes to the Payfast validation client. Exact raw bytes now serve only bounded intake, UTF-8/form parsing, and the event fingerprint; they are never persisted or sent to Payfast.

The immutable received-order field model is the semantic source for field validation, safe snapshots, signature reconstruction, and provider confirmation. `buildPayfastItnParameterString` reconstructs both canonical strings with the existing PHP-compatible encoder, no sorting, no checkout order, and no `URLSearchParams` authority. Signature input excludes `signature`, omits empty values, preserves order, and appends the encoded active passphrase. Provider confirmation uses the exact same selected range without `signature` or passphrase.

## 3. Signature-Position Policy

`signature` must be the final non-empty protocol field. The builder rejects a non-empty field after it; the boolean signature verifier treats that malformed structure as an invalid signature. Empty fields remain omitted consistently. Parameter-string and signature tests cover the position rule, duplicate/malformed parser rejection, unknown fields, special characters, Unicode, normalization, and no trailing ampersand.

## 4. Validation Client

`confirmPayfastItnData` accepts `{ environment, canonicalBody, timeoutMs?, fetchImpl? }`. It posts that exact prebuilt string once to a pinned sandbox or production `/eng/query/validate` endpoint; it neither parses fields nor adds a passphrase/signature. Redirect mode is `error`, timeout remains five seconds by default, responses are bounded to 64 bytes and must be HTTP 200 `VALID`, and the call remains outside any transaction.

## 5. Migration Correction

The Phase 12 migration no longer drops any old `PaymentWebhookEvent` columns, deletes/truncates rows, renames legacy columns, or rewrites evidence. It retains the Phase 4 columns, relaxes only their former required constraints, and maps them in Prisma as ignored compatibility fields. New Phase 12 state is stored separately as physical `itnProcessingStatus`, avoiding a destructive name collision with legacy `processingStatus`.

The migration constrains Phase 12 receipts to leave every legacy field null, while the existing placeholder-row preflight remains fail closed. Runtime and database invariant scripts check the compatibility boundary. Prior migrations remain unchanged.

## 6. Compatibility-Field Boundary

There is no runtime writer, verification reader, or DTO exposure for the ignored legacy fields. The event application writes only structured Phase 12 fields and the safe snapshot. Exact raw bytes, canonical bodies, signatures, signature bases, and passphrases are not persisted. Physical removal of the Phase 4 compatibility fields is deferred to the consolidated cleanup gate.

## 7. Tests Written or Updated

| Test file | Coverage | Executed |
|---|---|---:|
| `tests/payments/payfast/payfast-itn-parameter-string.test.ts` | Hardcoded canonical confirmation body; signature/passphrase exclusion; ordering; empty/unknown values; special/Unicode encoding; normalization; signature-position rejection | Yes |
| `tests/payments/payfast/payfast-itn-signature.test.ts` | Shared canonical signature base and malformed/reordered input handling | Yes |
| `tests/payments/payfast/payfast-itn-validation-client.test.ts` | Exact canonical POST, endpoint pinning, redirect mode/status rejection, timeout, and oversized responses | Yes |
| `tests/payments/payfast/payfast-itn-parser.test.ts` | Ordered parsing, duplicates, malformed percent encoding, and bounds | Yes |
| `tests/services/payfast-itn-verification.service.test.ts` | Verification service submits the expected canonical confirmation body | No — deferred by focused-test scope |
| `tests/integration/payfast-itn-verification.integration.test.ts` | Fixture construction remains compatible with the final-signature policy | No — database integration deferred |

## 8. Files Changed

- `lib/payments/providers/payfast/payfast-itn-parameter-string.ts` — shared ordered canonical builder.
- `lib/payments/providers/payfast/payfast-itn-signature.ts`, `payfast-itn-validation-client.ts`, and `lib/services/payfast-itn-verification.service.ts` — signature/confirmation separation.
- Focused Payfast tests plus verification and integration fixtures — canonical-body and final-signature coverage.
- `prisma/schema.prisma` and `prisma/migrations/20260717040000_phase12_payfast_itn_reconciliation/migration.sql` — additive compatibility mapping and column separation.
- `scripts/phase12-payfast-itn-preflight.mjs`, `scripts/verify-payment-confirmation-invariants.mjs`, and `scripts/check-migrations-safety.mjs` — physical-column and compatibility boundary checks.
- `docs/phase-12-implementation-map.md`, `docs/phase-12-payfast-itn-reconciliation.md`, `docs/deferred-validation/phase-12-risk-register.md`, `docs/phase-12-implementation-report.md`, and this report — corrected protocol and migration records.

## 9. Lightweight Checks

- `npx prisma format` — passed.
- `npx vitest run tests/payments/payfast/payfast-itn-parameter-string.test.ts tests/payments/payfast/payfast-itn-signature.test.ts tests/payments/payfast/payfast-itn-validation-client.test.ts tests/payments/payfast/payfast-itn-parser.test.ts` — passed: 4 files, 33 tests.
- File-scoped ESLint over changed TypeScript, test, and script files — passed.
- `git diff --check` — passed (the repository currently has the Phase 12 files untracked, so Git reported no tracked-diff whitespace errors).

## 10. Validation Deferred

No migration execution, Docker, PostgreSQL/database integration, full test suite, coverage, typecheck, build, real Payfast request, browser, or CI run occurred.

## 11. Final Confirmation

- Raw request bytes are not sent directly to Payfast validation.
- Signature and passphrase are excluded from the validation body.
- Passphrase remains included only in signature generation.
- Signature and confirmation field order share the same canonical selected range.
- No destructive Phase 12 column removal remains and no prior migration changed.
- No secret or raw body is persisted.
- Production remains locked; no order status changed; no duplicate ledger path was introduced.
