# KT Couriers — Phase 2 Operational Activation Register

- **Repository**: `analyticsmath/KT-Courier`
- **Branch**: `main`
- **Baseline SHA**: `87c3ff954b75f161236d749bed07a83ae1bf6342`
- **Authority**: Chief architect / technical product specification

## Purpose

This register defines the explicit operational readiness, configuration keys, and external approval dependencies required to activate each business capability implemented in Phase 2. No software engineer or AI agent may manufacture an external approval; features requiring external sign-off remain fail-closed until authentic evidence is supplied.

---

## Operational Feature Matrix

| ID | Feature Name | Code Module | Software Implementation | Activation State | Exact Operational / External Prerequisite |
|---|---|---|---|---|---|
| `ACT-01` | Customer Wallet Checkout Spending | `lib/services/wallet-spending.service.ts` | Complete | `INTERNAL_READY` | Fully supported for customer parcel and marketplace checkouts. Wallet top-ups and cash withdrawals remain disabled. |
| `ACT-02` | Store Referral Wallet Parcel Spending | `lib/services/wallet-spending.service.ts` | Complete | `INTERNAL_READY` | Store referral marketing credits can be spent on outbound parcel deliveries. Cash withdrawal is permanently blocked. |
| `ACT-03` | Store Live Public Publication | `lib/storefront/store-publication-readiness.ts` | Complete | `EXTERNAL_APPROVAL_REQUIRED` | Requires owner/operator approval of authentic `StoreSellerLegalIdentity`, active `StoreOrderOperationalPolicy`, and complete physical South African pickup address (`G-08`, `G-09`, `G-10`). |
| `ACT-04` | Customer Loyalty Points Earning & Redemption | `lib/rewards/customer-parcel-loyalty.service.ts` | Complete | `EXTERNAL_APPROVAL_REQUIRED` | Requires finance sign-off on points-to-wallet conversion liability (`CUSTOMER_LOYALTY_REWARDS_FINANCE_SIGNOFF`). |
| `ACT-05` | Automatic Ordinary Referral Rewards | `lib/rewards/ordinary-referral-award.service.ts` | Complete | `EXTERNAL_APPROVAL_REQUIRED` | Setting `referral.reward_issuing_enabled` must be enabled by authorized super-admin after finance policy sign-off (`ORDINARY_REFERRAL_FINANCE_SIGNOFF`). |
| `ACT-06` | First-Store Welcome Offer | `lib/promotions/first-store-welcome.service.ts` | Complete | `EXTERNAL_APPROVAL_REQUIRED` | Requires promotion campaign budget authorization and sign-off on platform-funded discount liability. |
| `ACT-07` | Promotions & Coupon Campaigns | `lib/promotions/production-lock.ts` | Complete | `EXTERNAL_APPROVAL_REQUIRED` | Production gate (`PROMOTIONS_PRODUCTION_VALIDATION_APPROVED`) remains locked until finance approval (`G-05`). |
| `ACT-08` | Cash on Delivery (COD) 50/50 Custody | `lib/services/cash-on-delivery.service.ts` | Complete | `EXTERNAL_APPROVAL_REQUIRED` | Requires operational approval of driver cash-in-hand limits and bank remittance workflow (`G-06`). |
| `ACT-09` | Driver Dispatch & Delivery Assignment | `lib/services/dispatch-assignment.service.ts` | Complete | `EXTERNAL_APPROVAL_REQUIRED` | Requires authentic driver ID, driving licence verification, and vehicle compliance document approval (`G-11`, `G-12`). |
| `ACT-10` | Owner Withdrawals (Store, Driver, Promoter) | `lib/withdrawals/withdrawal-ledger-policy.ts` | Complete | `EXTERNAL_APPROVAL_REQUIRED` | Production gate (`WITHDRAWAL_PRODUCTION_VALIDATION_APPROVED`) remains locked until independent banking payout integration is certified (`G-07`). |
| `ACT-11` | Transactional Notifications (Resend Email) | `lib/notifications/operational-domain-payload.ts` | Complete | `EXTERNAL_APPROVAL_REQUIRED` | Requires verified production domain and live API credentials in Resend (`G-13`). |
| `ACT-12` | Post-Fulfilment Reviews | `lib/client-platform/reviews.service.ts` | Complete | `INTERNAL_READY` | Active immediately upon delivery completion (`DELIVERED` or `COMPLETED`). |
| `ACT-13` | Store Employee RBAC | `lib/client-platform/store-access.ts` | Complete | `INTERNAL_READY` | Store owners can invite and manage employees with immediate database-level revocation. |
| `ACT-14` | Gauteng Delivery Coverage Boundary | `lib/commercial/owner-approved-gauteng-coverage.ts` | Complete | `INTERNAL_READY` | Active throughout Gauteng province for all parcel and store deliveries. |

---

## Gate Integrity Statement

In compliance with Phase 2 specifications and repository invariants:
1. `docs/production-closure/engineering-gates.json` continues to reflect `NOT_READY` (19 implemented, 6 open, 3 validation-blocked).
2. The Phase 3 independent launch veto remains active (`fail closed` until authentic operational evidence is provided).
3. No simulated or synthetic credentials were substituted for genuine regulatory, banking, or merchant approvals.
