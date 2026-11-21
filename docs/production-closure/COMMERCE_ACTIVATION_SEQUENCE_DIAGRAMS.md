# KT Couriers — Commerce Activation Sequence Diagrams & Test Invocation Map
Issue Date: 21 November 2026
Baseline Commit: `f06493ffe37c97059eafb0bcc0e9665eec830095`
Authority: Final One-Pass Code-Level Completion Directive (§B.2)

---

## 1. Single Switch Architecture (`KT_COMMERCE_ENABLED`)

```mermaid
flowchart TD
    Env[Environment Config] --> Sw{resolveCommerceSwitch}
    Sw -->|KT_COMMERCE_ENABLED='true'| Enabled[Commerce Enabled]
    Sw -->|KT_COMMERCE_ENABLED='false'| Disabled[Commerce Disabled]
    Sw -->|Unset + legacy CHECKOUT_PUBLIC_ENABLED| Fallback[Deprecated Fallback with Warning]
    Sw -->|Unset & No Legacy| FailClosed[Default: false / Fail Closed]

    Enabled --> Eval{evaluateCommerceActivation}
    Eval --> Provider[Paystack Config Check]
    Eval --> Accounts[Ledger Account Health]
    Eval --> Policy[Operational Policy Valid]

    Provider -->|Valid| Expose[publicCheckoutExposed = true]
    Provider -->|Invalid / Misconfigured| Deny[publicCheckoutExposed = false]
    Accounts -->|Missing| Deny
    Policy -->|Missing| Deny

    Expose --> ParcelQuotes[Parcel Quote Booking Allowed]
    Expose --> StoreCheckout[Marketplace Checkout Allowed]
    Deny --> DiagnosticReasons[Deterministic Reason Codes]
```

### Invariants:
- The switch **never** creates ledger journals, converts CASH to DIGITAL, authorizes withdrawals, or overrides risk policies.
- In-flight operations, refund processing, and liability reconciliations operate even when public commerce is off.

---

## 2. Parcel Delivery Booking & Payment Lifecycles

### 2.1 Digital Payment with Wallet Split Flow

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer / Payer
    participant Web as Web App / Checkout
    participant Route as /api/public/delivery-quotes/[id]/book
    participant OrderSvc as orders.service
    participant Paystack as Paystack API
    participant Ledger as ledger-posting.service
    participant OrderConfirm as courier-order-confirmation.service

    Customer->>Web: Select payment mode (CARD + WALLET_SPLIT)
    Web->>Route: POST { paymentMode: 'CARD', splitWallet: true, walletAmount: 50.00 }
    Route->>OrderSvc: createCourierDeliveryBookingWithPayment()
    Note over OrderSvc: Verify quote, customer wallet reserve, and create PENDING order
    OrderSvc->>Paystack: initializeTransaction({ amount: 100.00, reference })
    Paystack-->>OrderSvc: { authorizationUrl, reference }
    OrderSvc-->>Web: { orderId, authorizationUrl, reference }
    Customer->>Paystack: Complete Card Payment (R100.00)
    Paystack-->>Web: Redirect to return URL
    Web->>Route: Poll / Status refresh (/api/public/delivery-quotes/[id]/payment-status)
    Route->>OrderConfirm: verifyAndApplyPaystackPayment()
    Note over OrderConfirm: In Serializable DB Transaction:
    OrderConfirm->>Ledger: Post Provider Receipt Journal (R100.00 ASSET/LIABILITY)
    OrderConfirm->>Ledger: Consume Reserved Customer Wallet (R50.00)
    OrderConfirm->>OrderConfirm: confirmVerifiedCourierOrderWithinTransaction()
    Note over OrderConfirm: Promotes order PENDING -> CONFIRMED
    OrderConfirm-->>Web: Status CONFIRMED, dispatch offers generated
```

### 2.2 Cash On Delivery (COD) with Partial Deposit

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer / Payer
    participant Web as Web App / Booking
    participant QuoteSvc as delivery-quote.service
    participant CodSvc as cash-on-delivery.service
    participant OrderConfirm as courier-order-confirmation.service

    Customer->>Web: Select COD (Deposit + Cash Due on Delivery)
    Web->>QuoteSvc: Evaluate COD eligibility & deposit percentage
    QuoteSvc-->>Web: { depositRequiredZar: 30.00, cashDueZar: 120.00 }
    Customer->>Web: Pay deposit via Card / Wallet
    Web->>CodSvc: activateDepositCashOnDeliveryWithinTransaction()
    Note over CodSvc: Post deposit journal & record pending cash obligation
    CodSvc->>OrderConfirm: confirmVerifiedCourierOrderWithinTransaction()
    Note over OrderConfirm: Status promotes to CONFIRMED (DEPOSIT_PAID_CASH_DUE)
    OrderConfirm-->>Web: Booking confirmed, collection scheduled
```

---

## 3. Webhook vs Verify API Race & Concurrency Resolution

```mermaid
sequenceDiagram
    autonumber
    participant Provider as Paystack Gateway
    participant Webhook as Webhook Ingest Worker
    participant VerifyRecovery as Customer Poll / Verify Recovery
    participant DB as Serializable PostgreSQL TX

    par Webhook arrives from Paystack
        Provider->>Webhook: POST /api/webhooks/paystack (HMAC signed)
        Webhook->>DB: Ingest PaymentWebhookEvent (signatureVerified: true)
        Webhook->>DB: applyPaystackWebhookEventsBatch()
    and Customer Return triggers Verify
        Provider->>VerifyRecovery: Customer redirected to callback URL
        VerifyRecovery->>DB: recoverPaystackAttemptViaVerify()
    end

    alt Webhook acquires lock first
        Webhook->>DB: SELECT FOR UPDATE on Payment & Attempt
        Webhook->>DB: Post canonical receipt & confirm order
        Webhook->>DB: Commit TX (Attempt=SUCCEEDED, Payment=SUCCEEDED)
        VerifyRecovery->>DB: Check attempt: ALREADY_SETTLED
        VerifyRecovery-->>VerifyRecovery: Idempotent return (no double ledger entry)
    else Verify acquires lock first
        VerifyRecovery->>DB: Check for pending signed webhook
        alt Found pending signed webhook
            VerifyRecovery->>DB: Replays signed webhook within lock
        else No pending webhook
            VerifyRecovery->>Provider: GET /transaction/verify/:reference
            Provider-->>VerifyRecovery: { status: 'success', amount, currency: 'ZAR' }
            VerifyRecovery->>DB: Post canonical receipt & confirm order
            VerifyRecovery->>DB: Commit TX
        end
        Webhook->>DB: Tries to apply -> recognizes DUPLICATE / ALREADY_SETTLED
        Webhook-->>Webhook: Acknowledges webhook safely
    end
```

---

## 4. 24-Hour Unpaid Order Expiry & Late Settlement Reconciliation

```mermaid
sequenceDiagram
    autonumber
    participant Loop as Processor Loop (expire-unpaid-courier-orders)
    participant DB as Database
    participant Provider as Paystack Gateway
    participant VerifySvc as paystack-verify-recovery.service
    participant Recon as payment-reconciliation.service

    Note over Loop: Order remains unpaid for 24 hours
    Loop->>DB: Find PENDING orders with createdAt < NOW - 24h
    Loop->>DB: transitionOrderStatusInTx(PENDING -> CANCELLED, '24h unpaid expiry')
    Loop->>DB: Cancel dispatch offers & uncollected COD obligations

    Note over Provider,VerifySvc: Customer delayed payment arrives AFTER cancellation
    Provider->>VerifySvc: Webhook or Verify reports success (R150.00 ZAR)
    VerifySvc->>DB: Begin Serializable TX (FOR UPDATE)
    VerifySvc->>DB: Post receipt journal (CASH_CLEARING -> CUSTOMER_FUNDS_HELD)
    Note over VerifySvc: Inspect Order status: CANCELLED
    Note over VerifySvc: NEVER promote CANCELLED -> CONFIRMED
    VerifySvc->>DB: revokePendingDispatchOffersInTx()
    VerifySvc->>DB: settlePaidOrderCancellationInTx()
    Note over VerifySvc: Initiates full wallet credit or payment refund for customer
    VerifySvc->>DB: upsertParcelCancellationResolutionInTx(COMPLETED_LATE_PAYMENT_REFUND_INITIATED)
    VerifySvc->>Recon: openPaymentReconciliationCaseWithinTransaction('OUT_OF_ORDER_EVENT')
    VerifySvc->>DB: Commit TX (Funds safe in ledger, order remains cancelled, refund queued)
```

---

## 5. COD Physical Delivery Exception & Balanced Shortage Accounting

```mermaid
sequenceDiagram
    autonumber
    actor Driver as Driver / Courier
    actor Admin as Finance Admin
    participant ExceptionSvc as cod-physical-delivery-exception.service
    participant Ledger as ledger-posting.service
    participant DB as Database

    Driver->>ExceptionSvc: Report parcel delivered with partial or zero cash collected
    ExceptionSvc->>DB: Record physical delivery exception (status: OUTSTANDING)
    Note over ExceptionSvc: Order is NOT marked PAID; no seller earnings or driver fee released

    Admin->>ExceptionSvc: Review exception (decision: VERIFY)
    Note over ExceptionSvc: Dual-control verification with cash shortage
    ExceptionSvc->>DB: ensureShortageReceivableAccounts(tx)
    ExceptionSvc->>Ledger: Post balanced shortage journal:
    Note over Ledger: DEBIT: PLATFORM-COD-UNCOLLECTED-RECEIVABLE-ZAR (ASSET)<br/>CREDIT: PLATFORM-COD-UNCOLLECTED-SHORTAGE-SUSPENSE-ZAR (LIABILITY)
    ExceptionSvc->>DB: Update exception: VERIFIED_CASH_OUTSTANDING
    Note over ExceptionSvc: No revenue recognized, no fake money minted

    Admin->>ExceptionSvc: Resolve shortage (RECOVERED with bank evidence, or WRITTEN_OFF)
    ExceptionSvc->>Ledger: Post balanced clearing journal:
    Note over Ledger: DEBIT: PLATFORM-COD-UNCOLLECTED-SHORTAGE-SUSPENSE-ZAR<br/>CREDIT: PLATFORM-COD-UNCOLLECTED-RECEIVABLE-ZAR (or Cash Clearing)
    ExceptionSvc->>DB: Mark exception RESOLVED
```

---

## 6. Earned Payouts vs Customer Wallet Bank Withdrawal Ban

```mermaid
flowchart TD
    Req[Payout / Withdrawal Request] --> CheckRole{Owner Account Type}
    
    CheckRole -->|CUSTOMER| Denied[assertCustomerWalletBankWithdrawalForbidden]
    Denied --> PermLocked[HTTP 403 / Ineligible: Customer wallet balances can only be spent on services]

    CheckRole -->|DRIVER or STORE| CheckSwitch{WITHDRAWAL_PAYOUT_ENABLED === 'true'?}
    CheckSwitch -->|No| Gated[BLOCKED: Withdrawal payouts disabled by runtime policy]
    CheckSwitch -->|Yes| CheckCreds{Live Paystack Transfer Credentials Configured?}
    
    CheckCreds -->|No / Sandbox| ManualOnly[Allowed via Manual Dual-Control Bank Payout only]
    CheckCreds -->|Yes| AutoReady[Automated Paystack Transfer Ready]
    
    AutoReady --> MakerChecker{Two-Person Dual Control Approved?}
    ManualOnly --> MakerChecker
    
    MakerChecker -->|Approved| PostPayoutLedger[Post WITHDRAWAL_PAYOUT Balanced Ledger Journal]
    PostPayoutLedger --> ExecuteTransfer[Execute Bank Settlement]
```

---

## 7. Test Invocation Matrix

| Flow / Requirement | Primary Test Files | Execution Command | Invariant Asserted |
| :--- | :--- | :--- | :--- |
| **Commerce Activation Switch** (C01, C02) | `tests/runtime/commerce-activation.test.ts`, `tests/production-readiness/capability-matrix.test.ts` | `npx vitest run tests/runtime/commerce-activation.test.ts` | Single canonical switch, zero direct reads of deprecated flag, fail-closed default. |
| **Risk-Scoped Refunds** (C03) | `tests/refunds/refund-production-readiness.test.ts` | `npx vitest run tests/refunds/refund-production-readiness.test.ts` | Wallet refunds active even when commerce off; provider refunds require live credentials. |
| **Forbidden Customer Cash-Out** (C03) | `tests/withdrawals/withdrawal-production-readiness.test.ts` | `npx vitest run tests/withdrawals/withdrawal-production-readiness.test.ts` | `CUSTOMER_WALLET_BANK_WITHDRAWAL_ALLOWED` permanently false; throws `WITHDRAWAL_OWNER_INELIGIBLE`. |
| **Promotions Release Gate** (C04) | `tests/promotions/production-lock-negative.test.ts`, `tests/policy/promotion-production-readiness.test.ts` | `npx vitest run tests/promotions/production-lock-negative.test.ts` | Advertising and promoter locks remain false; commerce switch gates commercial promotions; cleanup allowed. |
| **Suburb vs Line2 Decoupling** (C05) | `tests/marketplace-checkout/store-pickup-selection.test.ts`, `tests/unit/store-courier-pickup-suburb.test.ts` | `npx vitest run tests/marketplace-checkout/store-pickup-selection.test.ts` | Units/flats on line2 not conflated as suburbs; legacy non-unit line2 suburbs preserved. |
| **Customer Address Retention** (C06) | `tests/marketplace-checkout/customer-checkout-prefill.test.ts`, `tests/marketplace-checkout/address-route.test.ts` | `npx vitest run tests/marketplace-checkout/customer-checkout-prefill.test.ts` | Saved coordinates preserved in trusted account context without silent blanking. |
| **COD Shortage Suspense Accounting** (C07) | `tests/orders/cod-physical-shortage-accounting.test.ts`, `tests/e2e/cod-physical-exception.spec.ts` | `npx vitest run tests/orders/cod-physical-shortage-accounting.test.ts` | Balanced ASSET receivable vs LIABILITY suspense entry; zero seller revenue or driver commission minted on cash loss. |
| **Processor Loop Concurrency** (C08) | `tests/processors/production-loop.test.ts`, `tests/processors/processor-registry-consistency.test.ts` | `npx vitest run tests/processors/production-loop.test.ts` | Multi-worker heartbeat aggregation without clobbering; cadence throttle only triggers on expired work. |
| **Paystack Verify & 24h Expiry Races** (C09) | `tests/payments/paystack-verify-recovery.test.ts`, `tests/payments/courier-verified-order-confirmation.test.ts` | `npx vitest run tests/payments/paystack-verify-recovery.test.ts` | Paid parcel confirms automatically; late payment on cancelled order reconciles via refund without reviving order; wallet split consumed. |
| **Store SQL Publication & Repair Cockpit** (C10) | `tests/storefront/sql-store-publication.test.ts`, `tests/admin/store-repair-cockpit.test.ts`, `tests/admin/store-checkout-blockers.test.ts` | `npx vitest run tests/admin/store-repair-cockpit.test.ts` | Distinguishes SQL enforcement from per-store records; actionable blockers and repair links exposed. |
| **Production Lock Register** (§B.1) | `tests/governance/production-lock-register.test.ts` | `npx vitest run tests/governance/production-lock-register.test.ts` | Complete register of all 10 release locks, scopes, defaults, and unblock criteria. |
| **Environment Redacted Schema** (§B.4) | `scripts/verify-env-schema.mjs` | `npm run env:verify` | Verifies presence of all required variables without echoing secret values. |
