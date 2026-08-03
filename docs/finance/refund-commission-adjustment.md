# Refund Commission Adjustment

Refund reservation reverses the original Phase 14 economic allocation; it never evaluates the current commission plan.

For each original allocation:

```text
new cumulative refund = prior successful/reserved refund + current refund

if cumulative refund == payment gross:
  desired cumulative adjustment = exact original allocation
else:
  desired cumulative adjustment = ROUND_HALF_UP(
    original allocation × cumulative refund ÷ payment gross,
    2
  )

current delta = desired cumulative adjustment - prior reserved/completed adjustment
```

Calculations use `Prisma.Decimal`, never JavaScript floating point. Negative deltas, deltas above the remaining original allocation, and cumulative refunds above gross fail closed. Zero deltas are omitted. The final cumulative refund consumes the exact original commission cents, eliminating partial-refund rounding drift.

Platform allocations debit `PLATFORM_COMMISSION_REVENUE`; beneficiary allocations debit `BENEFICIARY_COMMISSION_PAYABLE`. Each funding row links the original accrual/allocation and account evidence.

If an allocation is `RELEASED` or has `downstreamReleaseJournalId`, automatic reservation stops and reconciliation is opened. The service does not debit an old payable, create a negative payable, substitute pooled customer funds, or silently recompute policy.
