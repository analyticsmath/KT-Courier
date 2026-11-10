# Financial and Payment Systems Production Certification

**Phase**: Phase 3 Final Production Certification  
**Repository**: `analyticsmath/KT-Courier`  
**Branch**: `main`  
**Audited Baseline SHA**: `e47fdae93fa8ce8d1113a63617443a2b774cf6bb`  
**Currency Standard**: ZAR (South African Rand, 2 decimal places / cents integer representation)  

---

## 1. Payment Infrastructure Architecture

KT Couriers uses an enterprise multi-rail payment and settlement architecture grounded in cryptographic proofs, idempotent transaction state machines, and double-entry general ledger integrity.

```
       Customer Checkout
              │
              ▼
   [Payment Preparation] ─── Server-authoritative ZAR pricing & quote check
              │
              ├──────────────────────────────┬──────────────────────────────┐
              ▼                              ▼                              ▼
     [Paystack Gateway]             [Customer Wallet]             [Deposit + COD]
   Card, Instant EFT, SnapScan     Pre-funded balance credit     Digital split + Driver Cash
              │                              │                              │
              └──────────────────────────────┴──────────────────────────────┘
                                             │
                                             ▼
                             [Verified Webhook Ingestion]
                             HMAC-SHA512 Signature Check
                             Idempotent Outbox Dispatch
                                             │
                                             ▼
                               [Double-Entry Ledger]
                             Balanced Debit / Credit Post
                                             │
                                             ▼
                               [Final Order Execution]
```

---

## 2. Payment Method Certification

### A. Digital Card & Instant EFT (Paystack)
- **Initiation**: `prepareOrderPayment` (`app/api/orders/[id]/payment/route.ts`) and `prepareMarketplaceCheckoutPayment` (`app/api/checkout/[reference]/payment/route.ts`) enforce server-owned monetary amounts. Client payloads cannot specify amount, currency, or fee overrides.
- **Provider Payload Safety**: Payment initiation constructs a bounded reference (`pay_...`), records attempt state `INITIALIZED`, and requests an authentic Paystack authorization URL.
- **Webhook Integrity**: `app/api/webhooks/paystack/route.ts` verifies incoming raw request bodies using `crypto.createHmac("sha512", secret)`. Unsigned or tampered payloads receive HTTP 401.
- **Idempotency**: Webhook receipts are stored in `PaymentWebhookReceipt`. Replay attempts return HTTP 200 without duplicate state transition or ledger journal duplication.

### B. Customer Wallet
- **Spending Policy**: Wallets may cover all or part of an order total (`walletAmount <= order.grandTotal`).
- **Hold & Capture**: Funds are debited atomically from customer balance into platform escrow inside a Prisma serializable transaction.
- **Negative Balance Prevention**: Enforced at the PostgreSQL level via unsigned non-negative constraints.

### C. Deposit Plus Cash on Delivery (COD)
- **Policy Restrictions**: COD is strictly limited to single-store marketplace courier deliveries with no promotional discounts applied (`groupCount === 1 && fulfilmentMode === "COURIER_DELIVERY" && promotionDiscount === "0.00"`).
- **Split Invariants**: Enforced by check constraint `MarketplaceCheckout_payment_split`:
  $$\text{digitalRequired} \ge 0 \quad \text{AND} \quad \text{cashRequired} \ge 0 \quad \text{AND} \quad \text{digitalRequired} + \text{cashRequired} = \text{grandTotal}$$
- **Driver Cash Custody**: Cash collected by drivers is registered in a distinct custody log and offset against mature driver earnings or deposited into platform collection accounts.

---

## 3. Double-Entry General Ledger Invariants

Every financial movement in KT Couriers produces an immutable balanced ledger journal (`LedgerJournal`) composed of at least two balanced entries (`LedgerEntry`):

$$\sum \text{Debits} = \sum \text{Credits}$$

### Standard Chart of Accounts (ZAR)

| Account Code | Purpose | Classification | Normal Balance |
| :--- | :--- | :--- | :--- |
| `PLATFORM-CASH-CLEARING-ZAR` | Clearing account for Paystack incoming settlements | Asset | Debit |
| `PLATFORM-CUSTOMER-FUNDS-HELD-ZAR` | Customer escrow pending delivery completion | Liability | Credit |
| `PLATFORM-MERCHANT-FUNDS-HELD-ZAR` | Merchant escrow pending earning maturity | Liability | Credit |
| `PLATFORM-DRIVER-FUNDS-HELD-ZAR` | Driver escrow pending delivery POD signoff | Liability | Credit |
| `PLATFORM-COMMISSION-REVENUE-ZAR` | Realized marketplace (8%) and courier (30%) margin | Revenue | Credit |
| `PLATFORM-PROMOTION-EXPENSE-ZAR` | Subsidies for first-order welcome discounts | Expense | Debit |
| `PLATFORM-REFUND-CLEARING-ZAR` | Reversal clearing for customer return disbursements | Asset | Debit |

### Verification Evidence
- `tests/payments/paystack-financial-invariants.test.ts`: 23/23 tests passed.
- `tests/ledger/immutability-source-audit.test.ts`: Verified 0 runtime `UPDATE` or `DELETE` statements target ledger journals or entries. Historical ledgers remain strictly append-only.

---

## 4. Refund Lifecycle and Dual Control

1. **Eligibility Check**: Orders in progress or completed within the 14-day Consumer Protection Act (CPA) dispute window are eligible for full or partial refund.
2. **Proportional Reversals**: A partial refund scales merchandise basis, modifier basis, platform commission, and store liability proportionally using exact integer cent arithmetic.
3. **Dual Control**: Refunds exceeding R500.00 or initiated by non-system actors require secondary administrative authorization (`REFUNDS_APPROVE`) before payout dispatch.
4. **Disbursement Channels**:
   - Customer Wallet credit (immediate, zero provider transaction fee).
   - Card refund via Paystack Refund API (subject to secondary approval and provider confirmation).

---

## 5. Fail-Closed Production Locking

To guarantee that unqualified features or test shortcuts can never impact live customer funds:
- **`PROMOTIONS_PRODUCTION_VALIDATION_APPROVED = false`**: Promotions engine fails closed in production.
- **Independent Veto**: The CI workflow job `Phase 3 live launch veto` rejects live deployment until explicit commercial signoff artifacts are committed.
- **Provider Secrets Zero-Leakage**: Secret keys are never logged, exposed in client responses, or committed to source control.

Financial and payment subsystems are certified fully functional and compliant with engineering invariants.
