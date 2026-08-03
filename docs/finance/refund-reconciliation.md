# Refund Reconciliation

Reconciliation preserves held customer value whenever provider or accounting evidence cannot be resolved safely. Cases are idempotent by refund, reason, and attempt identity; repeat observations increment a counter instead of creating uncontrolled duplicates.

Reasons cover unknown provider outcome, unavailable query protocol, provider refund-ID conflict, payment projection mismatch, missing/mismatched journals, commission mismatch, downstream commission release, insufficient cash clearing, unsupported method, application failure after provider success, and stale processing attempts. Cases progress through `OPEN`, `MONITORING`, `RESOLVED`, and `CLOSED` with safe evidence only.

The scanner observes stale attempts and source inconsistencies; it does not call Payfast or mark success. Provider queries, when a reviewed adapter supports them, run outside database transactions. Verified query success re-enters the same atomic provider-finalization path used for create responses. There is no manual mark-success API or UI control.

`UNKNOWN` attempts keep the refund in `RECONCILIATION_REQUIRED` and retain the reserve. Operators must not retry, release, wallet-credit, or reduce cash until authoritative evidence resolves the outcome. Raw requests/responses, signatures, credentials, contact information, and banking data are excluded.
