# KT Couriers — Phase 2 Financial Invariants

- **Repository**: `analyticsmath/KT-Courier`
- **Branch**: `main`
- **Baseline SHA**: `87c3ff954b75f161236d749bed07a83ae1bf6342`
- **Authority**: Chief architect / technical product specification

## 1. Double-Entry Accounting Invariants

1. **Strict Balance Equality**: Every `LedgerJournal` entry set satisfies:
   $$\sum \text{Debits} = \sum \text{Credits}$$
   where all amounts are non-negative, non-null, and represented in ZAR cents (`Decimal(18, 2)`).
2. **Deterministic Account Classification**:
   - `ASSET`: Cash clearing (`PLATFORM-CASH-CLEARING-ZAR`, `DRIVER-COD-CASH`), payables receivable.
   - `LIABILITY`: Customer funds held (`PLATFORM-CUSTOMER-FUNDS-HELD-ZAR`), customer wallet available (`CUSTOMER_WALLET_AVAILABLE`), customer wallet reserved (`CUSTOMER_WALLET_RESERVED`), store settlement available (`STORE_SETTLEMENT_AVAILABLE`), store referral wallet (`STORE_REFERRAL_WALLET_AVAILABLE`).
   - `EXPENSE`: Platform promotion expense (`PLATFORM_PROMOTION_EXPENSE`), cash shortage suspense (`PLATFORM-CASH-SHORT-OVER-SUSPENSE-ZAR`).
   - `EQUITY`: Platform retained adjustments (`PLATFORM-ADJUSTMENT-ZAR`).

## 2. Customer & Store Wallet Spending Invariants

1. **Funding Source Separation**:
   - Customer wallet holds refundable and promotional credits in `CUSTOMER_WALLET_AVAILABLE`.
   - Store referral wallet holds marketing referral credits in `STORE_REFERRAL_WALLET_AVAILABLE`.
   - Store settlement wallet holds marketplace seller earnings in `STORE_SETTLEMENT_AVAILABLE`.
2. **Spendability vs Withdrawable Separation**:
   - `CUSTOMER_WALLET_AVAILABLE`: Spendable on parcel delivery and marketplace checkouts; strictly non-withdrawable (`WITHDRAWAL_OWNER_TYPES = ["STORE", "DRIVER", "PROMOTER"]`).
   - `STORE_REFERRAL_WALLET_AVAILABLE`: Spendable on store-owned parcel deliveries; non-withdrawable.
   - `STORE_SETTLEMENT_AVAILABLE`: Withdrawable by verified store owner; non-spendable on personal customer checkout.
3. **Checkout Payment Modes**:
   - **Mode A: Full Wallet (`WALLET_ONLY`)**:
     - `walletAmount = payableAmount`
     - Created `Payment` has `provider = 'MANUAL'`, `status = 'SUCCEEDED'`.
     - Validated by trigger `validate_payment_success_evidence()` requiring an `ACCOUNT_TRANSFER` ledger journal crediting `PLATFORM-CUSTOMER-FUNDS-HELD-ZAR` from the customer or store wallet account.
     - Requires zero external provider API calls.
   - **Mode B: Split Card + Wallet (`SPLIT_PAYSTACK`)**:
     - `0 < walletAmount < payableAmount`
     - Wallet portion is reserved immediately inside the transaction:
       $$\text{Account Transfer: } \text{AVAILABLE} \longrightarrow \text{RESERVED}$$
     - Remaining amount (`payableAmount - walletAmount`) is initialized on Paystack.
     - Enforced by database trigger `protect_payment_identity_and_success()`:
       $$\text{digitalRequired} = \text{Payment.amount} + \text{walletAmount}$$
     - Upon verified Paystack webhook (`charge.success`), the reserved wallet funds are consumed into `PLATFORM-CUSTOMER-FUNDS-HELD-ZAR`.
     - Upon checkout expiry or cancellation, reserved wallet funds are released back to `AVAILABLE`.
   - **Mode C: Provider Only (`PROVIDER_ONLY`)**:
     - Standard full Paystack payment.

## 3. Loyalty, Rewards & Promotion Invariants

1. **Loyalty Earning Basis**:
   - Points are earned only on **net externally captured provider payments** ex-VAT, ex-refunds, and ex-wallet:
     $$\text{Eligible Cents} = \text{ProviderPaidZar} - \text{Proportional VAT} - \text{Refunds}$$
   - Wallet-funded portions earn **0** points (preventing recursive point generation).
   - Reconciled upon order completion (`DELIVERED` / `COMPLETED` for parcels, `CONFIRMED` for marketplace).
2. **Referral Rewards**:
   - One-time R5.00 (`500` cents) credited to referrer's wallet (`CUSTOMER_WALLET_AVAILABLE` or `STORE_REFERRAL_WALLET_AVAILABLE`).
   - Debited from `PLATFORM_PROMOTION_EXPENSE`.
   - Awarded strictly on the first verified paid order of a unique referred person; self-referrals and duplicate awards are rejected.
3. **First-Store Welcome Offer**:
   - Platform-funded discount of R50.00 (`5000` cents) for new customers within 7 days of signup.
   - Restricted to marketplace checkout (rejected on parcel orders).
   - Debited from `PLATFORM_PROMOTION_EXPENSE`.

## 4. Cash on Delivery (COD) Invariants

1. **50/50 Payment Split**:
   - 50% digital upfront deposit + 50% cash collected by driver on delivery.
   - Digital deposit must be verified before cash collection is authorized.
2. **High-Risk Area Exclusion**:
   - COD is suppressed if **either** pickup origin **or** delivery destination is in a high-risk region.
3. **Driver Cash Custody Cap**:
   - Enforced by serializable database row-locking:
     $$\text{Held} + \text{Reserved} + \text{Requested} \le \text{cashLimitAmount}$$
   - Held: active balance in `DRIVER-COD-CASH`.
   - Reserved: uncollected COD obligations on assigned/offered orders.
   - Requested: candidate order obligation.
4. **Independent Admin Remittance Confirmation**:
   - Driver uploads private bank deposit slip.
   - Admin confirmation requires `confirmedByAdminId !== driverUserId` (no self-approval).
   - Shortages are booked to `PLATFORM-CASH-SHORT-OVER-SUSPENSE-ZAR` (expense).

## 5. Owner Withdrawals & Dual Control

1. **Eligible Roles**: Store owners (`STORE`), drivers (`DRIVER`), promoters (`PROMOTER`). Customer role is rejected.
2. **Dual-Control Maker-Checker**:
   - Requester cannot process their own withdrawal (`processingUserId !== requestedByUserId`).
   - Approver cannot process their own approval (`processingUserId !== approvedByUserId`).
3. **Ledger Sequence**:
   - On request: `AVAILABLE` $\longrightarrow$ `RESERVED` liability transfer.
   - On rejection/cancellation: `RESERVED` $\longrightarrow$ `AVAILABLE` release.
   - On paid payout: `RESERVED` $\longrightarrow$ `CASH_CLEARING` settlement.
