# Phase 25 research and implementation map

## Boundary decisions

Phase 25 is a separately enrolled commercial promoter program. It does not create a customer refer-a-friend benefit, consumer wallet credit, downline, promoter recruitment commission, joining fee, mandatory purchase, direct-message delivery, or external tracking pixel. The legacy `PromoterProfile`/`ReferralCode`/`ReferralEvent` structures are not a Phase 25 authority and must not be called by new runtime code; the Phase 25 migration is additive and leaves their historical tables untouched.

Promoter reporting is limited to masked subject references, status, safe dates and aggregates. Raw referral codes, customer PII, payment data, device risk evidence, and confidential fraud evidence are never returned to a promoter.

## Existing authority audit

| Surface | Exact authority | Transaction / lock / idempotency | Phase 25 decision and production behaviour |
| --- | --- | --- | --- |
| Legacy promoter/referral | `PromoterProfile`, `ReferralCode`, `ReferralEvent` in `prisma/schema.prisma` | Legacy mutable records, including a parent relation | Source-locked out of Phase 25. New `PromoterAccount` is independent and has no hierarchy. |
| Authentication and permissions | `lib/auth/*`, `lib/auth/permission-keys.ts`, `app/api/*` guards | Session authentication and exact permission keys | Add dedicated promoter and administrator permissions; deny unauthorised ownership access. |
| Wallet and ledger (Phase 9) | `Wallet`, `LedgerAccount`, `LedgerJournal`, `lib/services/wallet-account.service.ts`, `ledger-posting.service.ts` | Serializable transactions, ordered `FOR UPDATE` account locking, immutable journals | Reuse the `PROMOTER` wallet owner and canonical accounts. No balance table or direct journal/wallet mutation. |
| Withdrawals (Phase 13) | `WithdrawalRequest`, `WithdrawalPolicy`, `lib/services/withdrawal-*.service.ts`, `lib/withdrawals/withdrawal-owner-policy.ts` | Existing operation IDs, review and dual-control lifecycle | Compose only after promoter compliance/readiness is checked. Phase 25 never sends or completes payouts. |
| Commission (Phase 14) | `CommissionPlan`, `CommissionRule`, `CommissionAccrual`, `CommissionAllocation`, `lib/services/commission-accrual.service.ts`, `commission-reversal.service.ts` | Serializable transaction, immutable accrual/reversal journals, request hashes, ordered locks | Freeze an approved Phase 14 plan/rule and use its promoter beneficiary allocation. Phase 25 evidence is not a second calculator. |
| Refunds (Phase 15) | refund services and payment/refund reconciliation models | Canonical refund/reconciliation evidence | A refund only invalidates/reverses through promoter qualification/earning services, then Phase 14 reversal. |
| Store settlement (Phase 16) | store earning and marketplace settlement services | Immutable settlement evidence and reconciliation | Store qualifications require the existing fulfilled, settled marketplace-store-order evidence. |
| Driver earnings (Phase 17) | `DriverEarning` services | Hold/release/reversal pattern with production lock | Reuse the evidence-and-release pattern only; no recruitment or driver-referral behavior. |
| Store/catalog/storefront (Phases 18–19) | `Store`, catalog and storefront services | Store identity and approved catalog authority | Store attribution binds only at a new-store application/creation boundary. |
| Marketplace checkout and orders (Phases 20–21) | `Payment`, `MarketplaceOrder`, `MarketplaceStoreOrder`, checkout/settlement services | Payment, completion, cancellation and refund evidence | Customer/store qualification adapters read this canonical evidence; no duplicate payment state. |
| Subscriptions (Phase 22) | subscription models and operation receipts | Durable lifecycle receipts | Not a Phase 25 qualifying event. |
| Promotions (Phase 23) | promotion/coupon services | Canonical promotion reservation/redemption | No consumer referral reward or wallet credit is introduced. |
| Advertising (Phase 24) | `AdvertisingAttribution`, `lib/advertising/*` | Distinct advertising click attribution and reconciliation | Advertising is never automatically converted into promoter attribution. |
| Registration/identity | `User`, `CustomerProfile`, `Store`, business-account surfaces | User/store creation authority, normalisation utilities where present | Bind only on pre-registration evidence; reject existing subjects and use normalized/hash evidence for self-referral review. |
| Risk/privacy/media | security events, trusted catalog media, consent records | Privacy-minimized safe metadata | Promoter touches use fingerprints only; assets use trusted internal references; no contact-list upload. |
| Receipts/outbox/notifications | phase-specific operation receipt patterns and notification services | Durable receipt/outbox convention; notification delivery is separately owned | Phase 25 records event intents only. It sends no email, SMS, push, WhatsApp, or marketing delivery. |

## Implementation map

1. Add Phase 25 domain tables, enum lifecycle constraints, append-only triggers and relation links in an additive `20260717170000_phase25_promoters_referrals` migration.
2. Introduce production-locked services for accounts, programs, codes/tokens, touches, attribution, qualification, earnings/reversal, fraud, reconciliation and disputes.
3. Expose guarded promoter, referral-landing and admin routes, then add semantic UI scaffolds and Figma contract documentation.
4. Provide dry-run operational scripts, focused tests, integration/E2E scaffolds, source audits, and a Phase 26.5 risk register.

## Current-source audit — 2026-07-21 closure

| Phase 25 surface | Classification | Source evidence / remaining closure |
| --- | --- | --- |
| Prisma models, enums and relations | CONCRETE | `prisma/schema.prisma`; additive migration is `20260717170000_phase25_promoters_referrals`. |
| Admin program lifecycle | CONCRETE | Strict guarded collection/detail/action routes compose `PromoterLifecycleService`; approved commercial terms are draft-only and `BUSINESS_CUSTOMER` fails closed. |
| Admin promoter lifecycle | CONCRETE | Review, changes-requested, activate, suspend and terminate routes use exact permissions and canonical lifecycle transitions. |
| Agreement administration | CONCRETE | Append-only version service and guarded routes provide create, submit, approve, activate and retire; acceptance remains immutable. |
| Marketing-asset administration | CONCRETE | Trusted-reference-only asset service rejects HTML, JavaScript, pixels and arbitrary external URLs; approved assets cannot be edited. |
| Fraud evaluation and cases | CONCRETE | Deterministic attribution, qualification and release decisions use safe evidence and stable reasons; case APIs invoke canonical transitions only. |
| Reconciliation scanner and retries | CONCRETE | All required comparison reasons are represented; cases close only after a canonical rescan and routes expose only named recovery actions. |
| Dispute administration | CONCRETE | Privacy-safe disputes are read and handled through canonical review/response/close services; no financial mutation route exists. |
| Admin projections and UI | CONCRETE | The complete `/admin/promoter-*` route set uses source-backed safe DTOs with loading, empty, denied, locked and error states. |
| Permissions and operation receipts | CONCRETE | Exact promoter permissions and explicit deny checks are present; durable event intents carry stable operation identities. |
| Operational processors | CONCRETE | All nine processors construct the composition root, select bounded canonical candidates and invoke services; no fabricated candidate arrays remain. |
| Focused tests and source audits | CONCRETE | DB-free policy/permission/source-audit suites are executable with no focused skips; integration and E2E remain meaningful deferred scaffolds. |
| Business qualification | UNSUPPORTED | No `BusinessAccount` is fabricated. Every business acquisition request returns `BUSINESS_CUSTOMER_ACQUISITION_NOT_AVAILABLE`. |
| Runtime production validation | PRODUCTION LOCKED | The non-bypassable lock remains false pending Phase 26.5 database, transaction, processor and browser validation. |

## Privacy and operational classification

Referral code HMACs and evidence fingerprints are restricted security data. Touch/device/network fingerprints, fraud evidence, payment evidence, tax evidence and identity comparisons are confidential internal data. Promoter-facing endpoints receive only derived, masked data. Tax/legal-form fields collect administrative evidence only and do not make legal, employment, contractor, withholding, or tax conclusions.
