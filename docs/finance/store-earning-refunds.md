# Store Earning Refund Coordination

Payment-level refund evidence is insufficient to infer which store should fund a refund. If a payment has any remaining store earning and the caller has not supplied an authoritative store refund allocation snapshot, refund creation fails closed with `STORE_EARNING_REFUND_EVIDENCE_REQUIRED`.

The snapshot binds store earning, refund, authoritative store refundable basis, cumulative store refund amount, prior reserved/completed adjustment, desired cumulative adjustment, current adjustment, settlement version, and refund allocation version. `RefundFundingSourceType.STORE_EARNINGS_PAYABLE` requires a `storeEarningId` and is unique per refund/earning.

The current adjustment is based on the cumulative ratio using Decimal HALF_UP cents. On the final cumulative refund, desired adjustment is set to the original earning exactly, so no residual cent remains.

Reservation locks the earning, validates it has not been released, checks remaining entitlement, and increments `refundReservedAmount`. Cancellation/rejection decrements the same grouped allocation. Completion decrements reserved and increments refunded; exact exhaustion transitions to `FULLY_REFUNDED`. The projection changes occur inside the refund lifecycle transaction.

Released earnings never fund an automatic refund and are never clawed back from owner-withdrawable. Such a request is blocked for finance reconciliation. Phase 20/21 must eventually provide store/item-level refund allocation evidence; Phase 16 supplies only the safe runtime boundary and projections.
