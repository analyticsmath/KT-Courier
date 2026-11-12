# Code-level closure work in progress

Baseline: `f022b5def47d62ff3784633911a39ea09409d398`. The first follow-up on main is `0c327bfaa09121c74dcbd7307095a194a32bd838`. This is a working evidence record, not a production-readiness or full-acceptance declaration.

## Verified changes

- Seller identity: the browser's HTML pattern contained an unescaped hyphen invalid under Unicode-set pattern rules. The server validation remained authoritative; the corrected browser pattern and the existing unregistered-seller/API tests are in `components/store/StoreSellerIdentityForm.tsx` and `tests/client-platform/unregistered-seller-identity-form.test.ts`.
- Paystack ingress: the route decoded bytes before signature verification and read the entire body before enforcing its size limit. It now verifies the original bytes, rejects invalid UTF-8 after signature verification, and limits bytes while streaming. Tests cover altered invalid bytes with legacy and modern signatures, malformed signed UTF-8, oversized streams, inbox durability, and payment invariants. See `tests/payments/paystack-webhook-durability.test.ts`, `tests/payments/paystack-contract.test.ts`, and `tests/payments/paystack-financial-invariants.test.ts`. Provider specification: https://paystack.com/docs/payments/webhooks/.
- Parcel and marketplace delivery: provider credential, quota, network, and server failures previously appeared as address-selection failures. They now return an actionable temporary-unavailability response, while genuinely unresolved addresses remain separate. Marketplace checkout also requires an affirmative coverage result before retaining an address. Tests: `tests/client-platform/quotes.test.ts`, `tests/client-platform/checkout-address-safety.test.ts`, and `tests/maps/geocoding-failure-observability.test.ts`.

## Evidence and limits

- `npx vitest run --maxWorkers=2 --no-file-parallelism`: 1,091 files and 5,528 tests passed. Code was edited during this run, so it is broad regression evidence, not an exact final-tree receipt.
- After the related edits, `npx vitest run tests/payments/paystack-webhook-durability.test.ts tests/payments/paystack-contract.test.ts tests/payments/paystack-financial-invariants.test.ts tests/client-platform/checkout-address-safety.test.ts tests/client-platform/quotes.test.ts tests/maps --maxWorkers=1`: 19 files and 221 tests passed.
- `npm run typecheck` and focused ESLint passed locally. Exact-commit CI, PostgreSQL, and browser results must be checked against the eventual commit independently.
- CI for `0c327bfa` passed. Its Production Certification was still running at the time this record was written; the prior baseline's Phase 3 launch veto listed nine unresolved gates.
- Nine original DOCX files were accessible and extracted for source comparison. The supplied incident register describes the video; the local bundled FFmpeg cannot decode this MP4, so that is not independent video-frame verification.

## Open work and external evidence

Customer, store, driver, administration, financial and operational journeys still require exact-commit end-to-end verification and a complete source-by-source audit. Genuine merchant pickup coordinates and review, authorized driver/vehicle evidence, approved coverage and financial policies, provider credentials, actual notification recipients, physical delivery, and independent legal/commercial approvals cannot be fabricated. Do not infer live settlement from a browser return or a test fixture. Keep the production launch veto in place until the actual evidence is reviewed.
