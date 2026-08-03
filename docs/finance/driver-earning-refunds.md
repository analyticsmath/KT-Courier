# Driver earning refunds

Driver responsibility is an authoritative service-allocation decision, never a payment-wide proportion or an inference from cancellation, reason, amount, assignment UI or delivery display state. A cumulative driver refund snapshot identifies the earning, assignment, settlement, refund and allocation version.

For partial refunds, desired cumulative adjustment is original earning multiplied by cumulative driver refund divided by the authoritative driver basis, rounded half-up to two decimals. Full basis consumption assigns the exact original earning so the final cent is deterministic. Current adjustment is desired cumulative less prior reserved/completed adjustment.

Reservation debits driver payable through the Phase 15 reserve journal and records an immutable driver funding allocation/projection in the same transaction. Cancellation restores the stored source exactly. Success moves reserved to refunded without another driver journal; exact full consumption transitions `FULLY_REFUNDED`. A released earning opens refund and driver reconciliation and never debits payable or owner-withdrawable.
