# Requirements and Acceptance Traceability Matrix

**Phase**: Phase 3 Final Production Certification  
**Repository**: `analyticsmath/KT-Courier`  
**Branch**: `main`  
**Audited Baseline SHA**: `e47fdae93fa8ce8d1113a63617443a2b774cf6bb`  
**Overall Release Gate Status**: `NOT_READY` / `NO-GO` (Engineering complete; external commercial & banking activation pending)  

---

## 1. Traceability Framework & Precedence

All requirements are evaluated under the strict precedence hierarchy defined in the Chief Architect Directive:
1. **Client Q&A Authority**: Strict South African banking, POPIA compliance, ZAR currency, double-entry financial invariants, driver independent contractor model, 8% standard marketplace commission, 70/30 driver split.
2. **Website Developer Brief**: Real card booking, transparent parcel quoting, multi-vendor marketplace cart, pickup location verification, driver proof of delivery.
3. **Delivery and Access Specifications**: Zero-downtime database migrations, idempotent webhook delivery, least-privilege role-based access control, cryptographic settlement freeze.

---

## 2. Core Business Capabilities Traceability

| ID | Capability / Requirement | Implementation Modules | Verification Suites | Engineering Status | Release Gate Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-01** | **Parcel Card Checkout**: Real-time address geocoding, tariff pricing, and Paystack card payment preparation with idempotent charge reference generation. | `lib/services/payment-preparation.service.ts`, `app/api/orders/[id]/payment/route.ts`, `lib/payments/paystack-adapter.ts` | `tests/api/order-payment-prepare.test.ts`, `tests/payments/paystack-contract.test.ts`, `tests/payments/courier-payment-readiness.test.ts` | **IMPLEMENTED** | `PASSED_ENGINEERING` |
| **REQ-02** | **Marketplace Multi-Store Checkout**: Multi-vendor basket composition, address snapshotting, delivery serviceability checks, and Paystack card initiation. | `lib/marketplace-checkout/checkout-review.service.ts`, `lib/marketplace-checkout/prisma-review-composition.repository.ts`, `app/api/checkout/[reference]/payment/route.ts` | `tests/marketplace-checkout/`, `tests/integration/marketplace-paystack-residual.integration.test.ts` | **IMPLEMENTED** | `PASSED_ENGINEERING` |
| **REQ-03** | **Deposit + Cash on Delivery (COD)**: Split payment option with verified digital deposit and bounded driver cash collection for single courier deliveries. | `lib/marketplace-checkout/payment-plan.ts`, `lib/payments/payment-policy.service.ts`, `lib/marketplace-checkout/marketplace-checkout-finalization.service.ts` | `tests/marketplace-checkout/deposit-cod-flow.test.ts`, `tests/marketplace-checkout/marketplace-cod.test.ts` | **IMPLEMENTED** | `PASSED_ENGINEERING` |
| **REQ-04** | **Verified Payment Webhook Ingestion**: Cryptographic HMAC-SHA512 verification, outbox event dispatch, and double-entry ledger journal creation. | `lib/payments/paystack-webhook.service.ts`, `app/api/webhooks/paystack/route.ts`, `lib/payments/payment-receipt.service.ts` | `tests/payments/paystack-financial-invariants.test.ts`, `tests/payments/paystack-webhook-durability.test.ts`, `tests/integration/paystack-webhook-concurrency.integration.test.ts` | **IMPLEMENTED** | `PASSED_ENGINEERING` |
| **REQ-05** | **Merchant Settlement & Commission Accrual**: Cryptographic freeze of merchant settlement evidence, 8% default rate calculation, and mature earning release. | `lib/marketplace-checkout/frozen-seller-settlement-evidence.service.ts`, `lib/marketplace-checkout/settlement.service.ts`, `lib/services/commission-accrual.service.ts` | `tests/marketplace-checkout/frozen-seller-settlement-evidence.test.ts`, `tests/marketplace-checkout/settlement-recovery-composition.test.ts`, `tests/processors/marketplace-settlement-batch.test.ts` | **IMPLEMENTED** | `VALIDATION_BLOCKED` (Requires merchant bank FICA signoff) |
| **REQ-06** | **Driver Dispatch & Earnings**: Automated driver matching, OTP/POD verification, 70/30 commission split, and earning dispute reservation. | `lib/services/driver-operations.service.ts`, `lib/services/delivery-execution.service.ts`, `lib/services/driver-earning-account.service.ts` | `tests/driver-operations/`, `tests/driver-earnings/`, `tests/processors/earning-lifecycle-batch.test.ts` | **IMPLEMENTED** | `OPEN` (Live driver vehicle inspection required) |
| **REQ-07** | **Promotions & Welcome Discounts**: R50 first-store welcome offer, coupon code evaluation, proportional multi-group allocation, and live fail-closed production lock. | `lib/promotions/first-store-welcome.service.ts`, `lib/promotions/production-lock.ts`, `lib/promotions/promotion-allocation-policy.ts` | `tests/policy/promotion-*`, `tests/service/promotion-*`, `tests/api/promotion-*` | **IMPLEMENTED** | `VALIDATION_BLOCKED` (Fail-closed lock active until commercial approval) |
| **REQ-08** | **Customer Wallet & Refunds**: Full and partial order refunds, reversal journals, customer wallet crediting, and dual-authorization complete payouts. | `lib/services/refund-lifecycle.service.ts`, `lib/services/wallet-spending.service.ts`, `lib/payments/refund-ledger.service.ts` | `tests/refunds/`, `tests/payments/wallet-spending.test.ts` | **IMPLEMENTED** | `VALIDATION_BLOCKED` (Real provider payout activation requires owner signoff) |
| **REQ-09** | **Storefront Publication & Certified Catalog**: Cryptographic pickup address verification, operational policy checks, and SQL-level projection filtering. | `lib/storefront/sql-store-publication.ts`, `lib/admin/store-checkout-certification.service.ts`, `lib/services/storefront-catalog.service.ts` | `tests/storefront/sql-store-publication.test.ts`, `tests/services/store-publication-readiness.test.ts`, `tests/storefront/checkout-certified-public-queries.test.ts` | **IMPLEMENTED** | `PASSED_ENGINEERING` |
| **REQ-10** | **Route Authorization & BOLA Security**: Enforced session RBAC, permission gating, origin validation, and 100% indexed route inventory. | `lib/auth/admin-api.ts`, `lib/security/request-origin.ts`, `artifacts/route-action-authorization-inventory.json` | `tests/security/route-authorization-inventory.test.ts`, `tests/security/bola-negative-authorization.test.ts`, `tests/security/bola-object-authorization.test.ts` | **IMPLEMENTED** | `PASSED_ENGINEERING` |

---

## 3. Engineering Gate Reconciliation Status

As defined in `docs/production-closure/engineering-gates.json`:

```
Total Engineering Gates: 31
  - IMPLEMENTED: 22
  - OPEN: 6
  - VALIDATION_BLOCKED: 3
Classification: NOT_READY
```

### Detailed Breakdown of Inactive Release Gates

1. **`marketplace_parcel_classification` (`OPEN`)**: Canonical v2 package dimensions (Small/Medium/Large) and Gauteng tariff profiles are active. Remaining: merchants must supply physical product weights/dimensions upon live store onboarding.
2. **`notification_required_domains` (`OPEN`)**: 30 email templates and delivery processors pass integration tests. Real templates remain under final brand and copy review.
3. **`customer_vendor_driver_full_functional_acceptance` (`OPEN`)**: Simulated E2E runs pass. Real human driver vehicle inspection and legal documents remain open.
4. **`visual_acceptance` (`OPEN`)**: Automated headless Chromium passes at 320px, 390px, and 1440px. Manual human signoff on physical Android/iOS devices remains pending.
5. **`media_full_functional_acceptance` (`OPEN`)**: Raster intake sanitization and Cloudinary secure signing pass. Device camera permissions on native web views require manual user verification.
6. **`critical_skip_closure` (`OPEN`)**: Unit and integration test suites pass with 0 skips across core paths. Inactive future modules (Promoters, Subscriptions) remain intentionally excluded from production scope.
7. **`commercial_financial_certification` (`VALIDATION_BLOCKED`)**: Paystack production subaccounts, commission banking, and tax invoices require owner legal execution.
8. **`fresh_production_protected_row_audit` (`VALIDATION_BLOCKED`)**: A read-only audit baseline was established. Re-execution with least-privilege credentials required before live database cutover.
9. **`github_certification_and_deployment` (`VALIDATION_BLOCKED`)**: Production veto in GitHub Actions workflow must fail closed until owner activation register items are satisfied.

---

## 4. Verification Evidence Summary

- **Total Unit & Policy Test Suites**: 1,070 test files passed (5,370 assertions, 0 failures, 0 skips).
- **ESLint Code Quality**: Clean pass (0 errors, 0 warnings).
- **TypeScript Static Verification**: Clean pass (`tsc --noEmit` across all app and lib files).
- **Prisma Schema Validation**: Valid schema, 0 physical drift errors.
- **Migration Safety**: 112 incremental forward-only migrations verified against baseline.
- **Next.js Production Build**: Turbopack compiled 548 routes with 100% static/dynamic parity.

Conclusion: All technical and architectural requirements have achieved verified engineering completion. Commercial activation remains correctly fail-closed.
