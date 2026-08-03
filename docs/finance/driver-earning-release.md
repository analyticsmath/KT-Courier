# Driver earning release

Release is internal and system-driven only. It requires all nineteen policy facts: accrued state; production approval; still-valid completion; assignment/driver match; supplied and mature eligibility time; zero refund reservation; no earning/refund/payment reconciliation; no incident/assignment conflict; coherent commission attribution; positive exact remaining value; financially eligible active driver; active wallet; valid payable and owner-withdrawable accounts; and no release/reversal journal.

The serializable service locks earning, assignment/evidence, allocations and accounts in stable order, rereads every exposure, posts the canonical release journal, records the exact projection and immutable history, and commits atomically. The worker calls this service only and cannot infer maturity or completion. Production approval is intentionally false.
