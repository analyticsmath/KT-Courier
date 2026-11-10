# KT Couriers — Phase 2 Cross-Persona Acceptance

- **Repository**: `analyticsmath/KT-Courier`
- **Branch**: `main`
- **Baseline SHA**: `87c3ff954b75f161236d749bed07a83ae1bf6342`
- **Authority**: Chief architect / technical product specification

## 1. Customer Persona Acceptance

| Journey Step | Required Capability | Acceptance Verification | Status |
|---|---|---|---|
| Customer Authentication & Profile | Active account, role `CUSTOMER`, saved address prefill. | Verified default address prefill on parcel booking and marketplace checkout. | ACCEPTED |
| Parcel Booking Checkout | Book parcel via Card, Wallet, or Split Card + Wallet. | Full wallet settles immediately via internal `MANUAL` payment; split reserves wallet balance and settles remainder via Paystack; failed checkout releases reserved funds. | ACCEPTED |
| Marketplace Cart & Checkout | Purchase items across certified Live stores; receive R50 welcome offer on first purchase within 7 days; spend wallet funds. | Gated on valid store publication readiness; welcome offer applied if eligible; wallet reservation and settlement executed. | ACCEPTED |
| Wallet Management | View available, reserved, and refund-held balances. Cash withdrawal blocked. | UI displays exact breakdown; withdrawal attempt throws `WITHDRAWAL_OWNER_INELIGIBLE`. | ACCEPTED |
| Post-Fulfilment Reviews | Rate completed parcel/marketplace deliveries and assigned drivers. | Review submission rejected while delivery is in-transit or pending; accepted after `DELIVERED` or `COMPLETED`. | ACCEPTED |
| In-Delivery Communication | Chat with assigned delivery driver. | Chat accessible only while driver is actively assigned; auto-closes 48h post-delivery. | ACCEPTED |

## 2. Store Owner & Employee Persona Acceptance

| Journey Step | Required Capability | Acceptance Verification | Status |
|---|---|---|---|
| Live Store Certification | Publish catalog only when approved legal identity, active policy, and pickup match certification. | `isStorePubliclyCheckoutReady` and SQL publication queries require complete South African pickup, effective identity, active policy, and SHA-256 fingerprint equality. | ACCEPTED |
| Store Parcel Delivery | Book outbound deliveries using store referral wallet credit. | Store referral wallet funds (`STORE_REFERRAL_WALLET_AVAILABLE`) spendable on parcel delivery; non-withdrawable. | ACCEPTED |
| Store Employee RBAC | Grant fine-grained permissions (`orders`, `deliveries`, `products`, `marketing`, `finance`, `reviews`, `chat`, `settings`). | Server-side `storeAccess` enforces permissions on every request; employee revocation takes effect immediately in database. | ACCEPTED |
| Reviews & Customer Care | View and reply to delivery reviews. | Store owner/employee can respond to customer delivery reviews; audit logged in `AdminActivityLog`. | ACCEPTED |
| Store Earnings & Withdrawals | Accrue seller earnings and withdraw via dual-control maker-checker. | Earnings accrued to `STORE_SETTLEMENT_AVAILABLE`; withdrawal requires bank proof, reserves funds, and requires separate finance approval. | ACCEPTED |

## 3. Driver Persona Acceptance

| Journey Step | Required Capability | Acceptance Verification | Status |
|---|---|---|---|
| Onboarding & Vehicle Approval | Separate driver identity and vehicle compliance approval. | Driver profile requires valid ID, licence, and at least one approved vehicle with valid registration, licence disc, and insurance. | ACCEPTED |
| Dispatch & Capacity | Receive delivery offers within operating regions and capacity limits. | Ineligible or expired documents block dispatch; active load cannot exceed concurrent capacity. | ACCEPTED |
| COD Custody & Cash Cap | Collect cash on delivery within cash-in-hand limit. | `held + reserved + candidate <= cashLimitAmount`; assignment and collection serialize on driver row. | ACCEPTED |
| Bank Deposit Proof Remittance | Submit bank deposit slip for COD reconciliation. | Driver uploads private deposit slip; prevents duplicate slip reuse; requires admin statement confirmation. | ACCEPTED |
| Driver Earnings & Withdrawals | Receive 70/30 delivery fee split and withdraw earnings. | Earnings snapshot immutable; withdrawal requires maker-checker finance approval. | ACCEPTED |

## 4. Admin & Finance Operations Persona Acceptance

| Journey Step | Required Capability | Acceptance Verification | Status |
|---|---|---|---|
| Store Checkout Blockers | Inspect real-time publication and checkout blockers. | `describeStoreCheckoutBlockers` reports missing legal identity, inactive policy, or pickup fingerprint mismatch. | ACCEPTED |
| Customer Loyalty Points Adjustment | Adjust points with reason and debt recovery. | `adjustCustomerLoyaltyPoints` updates available/debt points and logs `AdminActivityLog`. | ACCEPTED |
| COD Remittance Confirmation | Independently verify driver bank deposit slips against statements. | Self-review blocked (`confirmedByAdminId !== driverUserId`); shortage booked to suspense. | ACCEPTED |
| Withdrawal Dual-Control Processing | Approve and process owner withdrawals under maker-checker rules. | Dual-control enforced (`processingUserId !== requestedByUserId` and `processingUserId !== approvedByUserId`). | ACCEPTED |
| Promotion Release Gate | Safely control promotion activation in production. | Defaults fail-closed (`PROMOTIONS_PRODUCTION_VALIDATION_APPROVED = false`) unless independently certified. | ACCEPTED |
