# Finance and provider certification

Hosted and local release-critical tests run with network disabled, `PAYSTACK_ACTIVE=false` and `EMAIL_PROVIDER=console`. The disposable PostgreSQL closure exercises ledger, refund, withdrawal, store earnings, driver earnings and processor concurrency sources. Phase 3 notification payloads require matching wallet owner, reserve/accrual journals, status histories and completion journals where a status claims `PAID`, `RELEASED` or `REVERSED`. A notification never creates a financial journal or transfers money.

No Paystack charge, refund, bank payout, COD settlement or live provider callback was performed. No provider success is inferred from a redirect. Finance, bank and merchant-owner signoff is absent, so production payment/payout activation and all live amounts remain blocked. The engineering gate `commercial_financial_certification` remains `VALIDATION_BLOCKED`.

See [financial invariants](FINANCIAL_INVARIANTS.json), the exact source run [38247409666](https://github.com/analyticsmath/KT-Courier/actions/runs/38247409666) and the [owner signoff register](OPERATOR_SIGNOFF_REGISTER.md). The hosted offline payment, finance and PostgreSQL selections passed; this is not approval for real charges, refunds, transfers, payouts, fees, commissions or bank reconciliation.
