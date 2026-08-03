# Payment Reconciliation

Reconciliation records uncertainty; it does not grant payment-success authority.

Cases cover unknown outcomes, credential mismatch, provider confirmation unavailability, conflicting or out-of-order status, amount/merchant mismatch, provider-reference conflict, unrecognized status, post-verification application failure, and stale processing attempts. Statuses are `OPEN`, `MONITORING`, `RESOLVED`, and `CLOSED`; priority is derived from the reason.

The case key is deterministic over Payfast, payment, attempt (or payment scope), and reason. A repeated observation updates `lastObservedAt`, observation count, and safe summary without replacing the original webhook link or safe evidence. A resolved case can be reopened by later evidence. Immutable payment history records case open, reopen, and resolution references.

Cases may be resolved automatically only by verified complete/failure evidence or deterministic replay. A future operator resolution workflow requires explicit architect approval. Phase 12 provides no mark-paid, mark-success, override, ledger-posting, refund, or event-deletion API/UI.

The intentionally run scanner checks stale `UNKNOWN`, `PROCESSING` without verified evidence, expired `REQUIRES_ACTION`, active credential mismatch, verified-but-unapplied events, repeated temporary failures, successful payments missing evidence, orphan receipt journals, and conflicting provider references. It upserts cases idempotently and sets the payment reconciliation state; it never marks success or posts a journal.

Admin list/detail pages expose public references, reason/status/priority, observations/times, safe evidence, and linked event/payment/attempt. They exclude event fingerprint, source address, signature, body, credentials, request hash, payer identity, and full headers.
