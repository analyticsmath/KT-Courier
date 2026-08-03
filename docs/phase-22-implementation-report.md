# KT Couriers Phase 22 Implementation Report

## 1. Executive Summary

IMPLEMENTATION COMPLETE — DEEP VALIDATION DEFERRED TO PHASE 26.5.

## 2. Research Conversion

The implementation converts the brief into a separated plan, contract, invoice,
Payment and non-cash entitlement model, with acknowledgement/fingerprint,
bounded dunning, privacy minimisation and source-locked legal controls.

## 3. Existing Architecture Audit

Phase 10–12 Payment/PayFast remains payment authority, Phase 15 remains refund
authority, Phase 6 remains delivery-price authority, Phase 14 remains
commission-plan authority and Phase 20 remains commercial-freeze authority.

## 4. Final Architecture

Program → versioned plan → frozen review/contract → cycle/invoice → existing
Payment subject `SUBSCRIPTION_INVOICE` → verified ITN → paid cycle → grant/use.

## 5. Commercial Scope

Customer delivery and store platform memberships are modelled. Recurring goods,
cart creation, stock reservation, wallets, coupons and Phase 23 behaviour are excluded.

## 6. Program and Plan Lifecycle

Draft/review/approve/active/retired and rejection policies are explicit; active
versions are immutable and activation is source-locked.

## 7. Benefits

Only approved delivery, quota, support, analytics, feature and approved
commission-plan eligibility types are modelled. Benefits have no cash value.

## 8. Contract Domain

One customer or store subject is enforced. Customer payer equals subject; a
store payer is owner or explicit exact-store billing authority with DENY support.

## 9. Contract State Machine

All required statuses and a transition policy are supplied with append-only
status history.

## 10. Subscription Review

The review freezes plan price, billing, policies, benefits, supplier, terms and
privacy evidence and produces a commercial fingerprint.

## 11. Acknowledgement

Acknowledgement binds current review version/fingerprint and service-start
consent; stale reviews cannot authorise payment.

## 12. PayFast Authority

The provider-neutral recurring interface uses a recurring-specific PayFast REST
protocol and the Phase 15 API-signature primitive, never the Phase 11 custom
checkout field-order signer. Raw tokens, card data and credentials are not
stored; token evidence is encrypted/fingerprinted or fails closed.

## 13. Payment Subject

Payment now supports only exact `SUBSCRIPTION_INVOICE` evidence for membership
payments; courier and marketplace subjects retain their existing protections.

## 14. Initial Billing

Initial preparation creates contract, authority, cycle, invoice and Payment
evidence before an informational provider action. It is production-locked.

## 15. Billing Cycles and Invoices

Cycles are unique by contract and period; immutable invoice arithmetic is ZAR
subtotal plus tax. No unsupported VAT assertion is made.

## 16. Renewal Scheduling

Canonical renewal jobs have operation IDs, request hashes, bounded attempts and
unknown-outcome reconciliation.

## 17. Dunning and Grace

Versioned dunning policy records maximum attempts, spacing, grace and outcomes;
there is no unlimited retry loop.

## 18. Entitlement Grants

Only verified paid-cycle activation grants period entitlement records.

## 19. Entitlement Usage

Append-only reserve/consume/release/reverse/expire/revoke records enforce
bounded remaining amount and quantity.

## 20. Delivery Benefits

The delivery adapter accepts only an authoritative Phase 6 base fee and returns
a bounded, non-negative final fee plus reservation evidence.

## 21. Store Commission Benefits

The commission adapter returns approved Phase 14 eligibility only; it does not
write commission, earnings or ledger evidence.

## 22. Cancellation

Rolling cancellation is end-of-paid-period and stops future renewal creation;
immediate cancellation requires separate legal/correction authority.

## 23. Fixed-Term Notices

Fixed-term legal/notice fields are represented, but fixed-term activation is
source-locked.

## 24. Contract Changes

Change records are modelled for next-period application with no automatic
proration or retroactive benefit increase.

## 25. Price Changes

New plan versions protect existing contracts; price changes require a separate
acknowledged contract-change path.

## 26. Pause and Resume

Internal/provider pause/resume is represented by change types and production
lock; no provider mutation is enabled.

## 27. Refunds and Rescission

The refund adapter composes Phase 15 and reconciles benefit reversal; it does
not create a second refund aggregate.

## 28. Provider Synchronization

The provider interface exposes bounded status retrieval; provider data cannot
invent invoices, payments or entitlements.

## 29. Reconciliation

Subscription reconciliation cases link canonical domain evidence and prohibit
manual mark-paid or entitlement override.

## 30. Customer APIs

Customer plan discovery, review, acknowledgement, initial payment preparation,
membership listing and rolling cancellation routes are present and authenticated.

## 31. Store APIs

Store plan, review, acknowledgement, payment preparation and current-membership
routes use exact store ownership/billing authority and explicit deny handling.

## 32. Admin APIs

Program/plan draft and lifecycle, contract listing and reconciliation listing
routes use the new narrow permissions. No prohibited manual financial endpoint exists.

## 33. Customer UI

Membership comparison, checkout, account membership, invoices and benefits
server-rendered scaffolds disclose recurring and cancellation behaviour.

## 34. Store UI

Store subscription, plans, billing and benefits scaffolds omit credentials and tokens.

## 35. Admin UI

Program, plan, contract and reconciliation scaffolds document immutable and
no-manual-override constraints.

## 36. Security

Exact subject/payer checks, operation identifiers, transaction evidence,
same-origin/rate policy, Payment subject guards and provider-only activation are present.

## 37. Privacy

Public routes return safe membership data; raw cards, provider tokens,
credentials, unrelated addresses and marketing data are excluded.

## 38. Prisma Schema

Phase 22 adds programs, plan versions/benefits, contracts/reviews/acknowledgements,
authorities, cycles/invoices, jobs, grants/usage, changes, notices, events,
reconciliation, exact-store billing authority, histories and all required enums.

## 39. Migration

`20260717140000_phase22_subscriptions` is a non-destructive compatibility
migration: it renames and preserves legacy Phase 4 tables/enum before creating
the new domain, extends Payment safely, and changes no Phase 21-or-earlier
migration.

## 40. Seed

Only system permissions are seeded. No active plans, prices, contracts, cycles,
invoices, authorities, entitlements, usage or resolutions are seeded.

## 41. Scripts

Preflight, renewal, dunning, cancellation, notice, provider sync, expiry,
reconciliation, verification and integration scripts are dry-run by default,
bounded by `--limit`, and source-locked for `--apply`.

## 42. Tests

Focused executable policy, recurring-protocol, payment-subject, settlement,
revenue, entitlement, renewal/dunning, review, source-audit and API-contract
tests pass. PostgreSQL and Playwright scaffolds are intentionally skipped.

## 43. Files Changed

Key paths: `prisma/schema.prisma`, `prisma/migrations/20260717140000_phase22_subscriptions/migration.sql`, `lib/subscriptions/*`, `lib/payments/payment-subject-policy.ts`, `app/api/payments/payfast/itn/route.ts`, membership APIs/pages, permissions, seed, scripts, tests and Phase 22 documentation.

## 44. Lightweight Checks Actually Run

`npx prisma format`, `npx prisma validate`, focused Vitest suites, file-scoped
ESLint, `node --check` for subscription scripts and `git diff --check` passed.

## 45. Validation Deferred

No installation, Prisma generation, migration deployment, seed, PostgreSQL,
Docker, full suite, full typecheck, build, browser, CI or real provider call ran.

## 46. Deferred Risks

See `docs/deferred-validation/phase-22-risk-register.md`; PayFast recurring API
compatibility, migration trigger proof, concurrency, integration and UI proof
remain Phase 26.5 work.

## 47. Bugs Found and Fixed

The legacy `SubscriptionInvoiceStatus` name collided with the Phase 22 invoice
enum. The legacy enum/table are now explicitly retained under legacy names,
allowing the new immutable invoice model without destructive history loss.

## 48. Architect Review Items

Validate the deployed legacy-table rename and PayFast token/subscription API
contract before removing the production source lock.

## 49. Progression Readiness

READY FOR ARCHITECT IMPLEMENTATION REVIEW.

## 50. Final Confirmation

Plans and contracts are separate; contracts freeze terms; only customer/store
subjects exist; guests cannot subscribe; Payment uses `SUBSCRIPTION_INVOICE`;
no fake order or browser activation exists; paid cycles grant bounded
entitlements; delivery uses Phase 6; commission uses Phase 14; Phase 20 is the
benefit-freeze target; cancellation stops future billing; fixed term remains
locked; refunds reuse Phase 15; no recurring product order or Phase 23 feature
exists; no earlier migration changed; provider secrets are not exposed.
