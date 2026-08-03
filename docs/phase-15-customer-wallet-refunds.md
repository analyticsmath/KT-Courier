# Phase 15 — Customer Wallet and Refunds

## Scope and boundary

Phase 15 adds a read-only customer wallet, full and partial refund reservation, finance review, wallet-credit completion, provider-neutral original-method execution, commission clawback, and reconciliation. It does not add wallet spending, transfers, withdrawals, top-ups, automated order cancellation refunds, payment/order status changes, chargebacks, refund fees, banking-detail capture, or Phase 16/17 behavior.

Customer wallet value is an exact ZAR liability represented by immutable balanced ledger journals. No service directly changes a legacy wallet balance field. `CUSTOMER_WALLET_AVAILABLE` is readable but cannot be spent in this phase; `CUSTOMER_REFUND_HELD` protects reserved refund value until release or completion.

## Eligibility and remaining amount

A request requires an owned `SUCCEEDED` ZAR payment with successful-attempt, verified-webhook, and success-journal evidence. The method and bounded reason must be supported, chargeback/dispute evidence must be absent, funding allocations must be reversible, and the destination evidence must exist. Browser returns, order UI state, and customer assertions are not success evidence.

The canonical calculation under a locked Payment row is:

```text
remaining = payment gross
          - SUCCEEDED refunds
          - REQUESTED/UNDER_REVIEW/APPROVED/PROCESSING/RECONCILIATION_REQUIRED refunds
```

`Payment.totalRefundedAmount` and `Payment.totalRefundReservedAmount` are exact Decimal projections backed by refund records and journals. They never alter `Payment.status`.

## Methods and transactions

`CUSTOMER_WALLET` completes internally by debiting refund-held and crediting wallet-available. `ORIGINAL_PAYMENT_METHOD` uses a provider attempt and completes by debiting refund-held and crediting platform cash clearing. A reserved method is immutable; changing it requires exact release and a new consented request.

Request creation uses a Serializable transaction: resolve the idempotency key, lock Payment, recalculate remaining amount, inspect and lock original commission allocations and funding accounts, create the refund and funding evidence, post the reserve journal, update the reserved projection, append history, and commit atomically. Cancellation and rejection lock the same evidence and post the exact inverse; they never recalculate release components.

Approval moves no money. The requester cannot approve or administratively process their request. The approver cannot be the completion processor, including for `SUPER_ADMIN`.

## Provider and unknown-outcome boundary

Provider create/query calls occur outside database transactions. Short transactions reserve an attempt and later finalize verified results. A definite failure returns the refund to `APPROVED` while funds remain held. A timeout, transport ambiguity, or unreviewed result becomes `UNKNOWN` / `RECONCILIATION_REQUIRED`; funds remain held and there is no blind retry, release, wallet fallback, or duplicate cash reduction.

Payfast is pinned to `https://api.payfast.co.za`, uses a separate API signing implementation, and has no arbitrary endpoint override. Repository-visible official material did not resolve exact amount units or query semantics, so real Payfast refund networking remains inactive and both contracts fail closed.

## Production lock and deferred validation

`REFUND_PRODUCTION_VALIDATION_APPROVED` is a reviewed source constant set to `false`; there is no environment bypass. Customer creation, completion, provider networking, and reconciliation mutation remain blocked until consolidated validation. Deterministic dependency injection supports focused tests without network calls.

Deep migration, PostgreSQL concurrency, Docker, generated-client/typecheck, full-suite, build, browser, CI, and Payfast protocol validation are intentionally deferred. See the [Phase 15 risk register](deferred-validation/phase-15-risk-register.md).
