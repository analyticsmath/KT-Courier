# KT Courier Production activation — 2026-10-06

The user approved production deployment and requested the full platform. All changes target KT Courier Production (project e9554aaa-1b53-4595-8731-e8c2885ac594, production environment 2226be2a-86f7-4590-a7b4-72aa54dccf52).

## Activated in this release

- Record catalogue production approval in source. Product-type activation, approved price activation, and publication snapshot rebuilding no longer fail solely on the historical release lock.
- Require active, moderated catalogue evidence and the offer's current effective active price for a public snapshot. A newer draft price cannot replace that price. READY primary media and immutable database evidence remain required.
- Set CHECKOUT_PUBLIC_ENABLED=true on the production web service. Paystack live credentials passed a read-only authenticated provider settings request (HTTP 200). This enables checkout access and the live payment adapter; coverage, quote, inventory and seller settlement checks still determine whether an order can proceed.
- Derive Paystack integration readiness from the actual payment configuration resolver. Configured credentials alone no longer advertise live readiness while checkout is disabled or the key/origin/runtime is invalid.
- Update catalogue preflight and invariant commands for the approved release, preserving inventory projection and reservation evidence checks.

## Existing live catalogue

The completed legacy migration has 276 published products, 14 public stores and 341 verified Cloudinary assets. Existing users, orders, payments and history are preserved. The zero-price legacy item remains a draft; missing images or commercial evidence do not receive invented substitutes. Catalogue public delivery uses Cloudinary. The existing upload adapter still writes through S3; direct application uploads to Cloudinary require a write adapter and credentials, which this release does not claim to provide.

## Full-platform blockers observed in production

| Capability | Current blocker |
| --- | --- |
| Courier delivery quotes/bookings | All eight active DeliveryRegion rows have null centerLat, centerLng and coverageRadiusKm. Approved zone geometry is needed; named cities cannot establish the commercial coverage boundary. |
| Marketplace paid ordering | No CommissionPlan or StoreOrderOperationalPolicy rows. Frozen seller settlement evidence must exist before an order can proceed. Marketplace delivery tariff details also remain unresolved in the client launch specification. |
| Express delivery | CLIENT_EXPRESS remains DRAFT. Parcel-size/base-fee versus per-kilometre commercial interpretation is unresolved. |
| COD and driver deposits | No PaymentMethodPolicy rows or deposit banking instruction settings. Eligibility and approved operational limits are required. |
| Transactional email verification | Resend and sender configuration exist. Read-only domain listing returned HTTP 401; a restricted sending key can lack this permission, so this does not prove sending is invalid. No recipient was emailed by this audit. Sender-domain/provider delivery remains unverified. |
| Browser address autocomplete | NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY is absent. Server Maps credentials are configured. |
| Reports and developer webhooks | Their registered background processors remain DISABLED with no central executable handler; those subsystems retain their source release locks. The existing scheduler script has no deployed scheduler service. |
| Notifications | The central deliver-notifications APPLY handler currently returns zero deliveries. Existing security-email request flows have separate delivery code; this is not proof of full notification dispatch or receipts. SMS and external push adapters remain unimplemented. |
| Promotions and subscriptions | Commercial plans are absent; funding/redemption/reversal and external recurring-account authorization work remains incomplete in the client launch status. |
| Settlements, refunds and withdrawals | Production financial release locks remain. Approved commercial plans and completed operational/provider validation are required. Withdrawal payout remains disabled. |

Retired PayFast routes remain retired. Missing keys, bank details, delivery boundaries and commission percentages have not been fabricated. No historical queued messages, payouts or orders were processed by this audit. Seed deletion authorization remains limited to the previously removed demo products and their images.

## Validation

- Full unit/service/source suite: 720 files, 3,115 passing tests before final publication-evidence hardening.
- Publication-evidence, catalogue and integration-readiness regression suite: 42 files, 107 passing tests after hardening.
- Prisma client regenerated from this checkout without modifying the user's separate workspace dependencies.
- Next route types generated before TypeScript validation; lint and typecheck are release checks.
- Live database assessment uses read-only SQL and full-row fingerprints for twelve protected user/order/payment/ledger tables. Deployment and post-release verification are recorded separately in the operational evidence report.
