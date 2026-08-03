# Phase 25 — Promoters and referrals

Phase 25 defines a separately enrolled commercial promoter programme. It is not consumer refer-a-friend selling: customers receive no referral reward, wallet credit, rebate, discount, cashback, loyalty value, or benefit conditional on another consumer's transaction.

The lifecycle is `APPLIED → UNDER_REVIEW → APPROVED → ACTIVE`, with changes-required, suspension, termination and rejection states. Activation requires identity, tax, payout and accepted-agreement readiness. Suspension prevents new touches and attribution while preserving historical evidence.

The acquisition chain is `promoter account → agreement → programme version → enrolment → channel/code → touch → immutable attribution → qualification hold → Phase 14 commission → Phase 9 wallet → Phase 13 withdrawal`. The programme records no downline, recruitment reward, entry fee, purchase requirement, direct marketing delivery, or external affiliate network.

Referral codes use canonical uppercase normalisation, keyed HMAC lookup and a SHA-256 evidence fingerprint. Links resolve only to internal registration destinations and issue a short-lived HMAC signed token. Raw codes are not intended for logs, analytics, operation IDs, or later retrieval.

Attribution is first-valid-acquisition-touch, with explicit registration code evidence taking precedence over a signed link token and a pre-registration touch. An existing subject, later touch, or administrator cannot replace an immutable binding. Customer identity, address, phone, payment data, order contents and fraud evidence are never projected to promoters.

Qualification requires canonical completed/settled courier or marketplace evidence, then a programme hold. Promoter earning records are evidence only; Phase 14 remains the commission authority, Phase 9 remains the wallet/ledger authority, Phase 13 remains the withdrawal authority, and canonical refund/fraud reversal paths preserve withdrawal history.

Production activation, attribution, qualification, accrual, release, reversal and withdrawal composition are source-locked behind `PROMOTERS_PRODUCTION_VALIDATION_APPROVED = false` until Phase 26.5.

## Phase 25 administration closure

Administrator program, promoter, agreement and marketing-asset operations are guarded by exact permissions, explicit deny checks, same-origin validation, strict request schemas, rate limits and durable operation identities. Program commercial terms and approved agreement versions are immutable; an approved asset is retired rather than overwritten. Marketing assets allow only trusted internal references and required disclosure. No asset can carry custom HTML, JavaScript, tracking pixels or arbitrary external URLs, and Phase 25 sends no promotional communication.

Fraud controls are deterministic and explainable. They compare authoritative identity, contact, payment, store-control, device/network, velocity, transaction, refund, chargeback, code-stuffing, hijacking, ring and employee-abuse evidence, then return only `PASS`, `REVIEW`, `BLOCK_ATTRIBUTION`, `BLOCK_QUALIFICATION` or `BLOCK_RELEASE`. Fraud cases retain privacy-safe evidence and reviewer actions. Confirmation follows attribution invalidation, qualification invalidation, Phase 14 reversal, Phase 9 adjustment composition, earning-evidence update and reconciliation escalation; no fraud, dispute or admin UI route edits an earning, wallet, journal or withdrawal directly.

Reconciliation compares every accepted hand-off from touch through withdrawal and reversal. It creates safe cases for the documented Phase 25 reason codes. The only recovery actions are canonical rescan and named attribution, qualification, accrual, release and reversal retries. A case resolves only when a fresh canonical scan converges; no manual resolve, force-resolve or financial adjustment endpoint exists. Admin screens project only safe canonical DTOs, including agreement acceptance, audit event history and financial references rather than secrets or customer PII.
