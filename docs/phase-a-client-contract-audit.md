# KT Couriers — Phase A Final Normalisation & Engineering Delta Closure

Generated 2026-08-10T18:50:15.207609Z by `scripts/phase-a-normalize-engineering-model.py`. This pass reads the existing source-backed artifacts only; it does not re-ingest documents, repeat repository discovery, modify production code/schema/migrations/database, call providers, or run Git.

## Final Verdict

**PHASE_A_CLIENT_CONTRACT_AUDIT_COMPLETE**

The product contract is understood at engineering level: 1555 Level-1 source atoms are preserved, 77 Level-2 normalized engineering requirements form the applicable denominator, 13 Level-3 product capabilities group them, all implementation-relevant atoms map to at least one requirement, and every P0/P1 requirement has a final proof record. This is Phase A closure, not software implementation completion.

## Normalisation Counts

- Source atoms preserved: **1555**; source links lost: **0**.
- Normalized engineering requirements: **77**; denominator: **77**.
- Product capabilities: **13**; P0 deltas: **19**; P1 deltas/dependencies: **47**.
- Source classification counts: IMPLEMENTATION_REQUIREMENT 150; CONFIGURATION_VALUE 528; LEGAL_CONTENT_ONLY 411; LEGAL_AND_IMPLEMENTATION 200; PRODUCT_DESCRIPTION 108; EXAMPLE 16; FUTURE_OPTION 9; USER_OBLIGATION 96; BUSINESS_POLICY 25; CLIENT_CLARIFICATION 1; LEGAL_REVIEW 11.

Legal-content-only, product-description, example and future-option atoms remain in the evidence layer and are excluded from the engineering denominator. Client values and legal review dependencies remain attached to affected engineering requirements rather than blocking the blueprint.

## Recomputed Readiness

Database **48.7%**; backend/domain **48.7%**; API **48.7%**; functional frontend **78.9%**; required provider code **63.3%**; security/compliance engineering **43.7%**; testing **47.0%**; overall functional **53.2%**.

Formula: overall = database×0.18 + backend/domain×0.22 + API×0.12 + functional frontend×0.14 + required provider code×0.08 + security/compliance engineering×0.14 + testing×0.12. Requirement evidence scores are COMPLETE=1, PARTIAL=0.5, CONFIG_ONLY/PROVIDER_KEY_ONLY/CLIENT_VALUE_REQUIRED/LEGAL_REVIEW_REQUIRED=0.75, MISSING=0; NOT_APPLICABLE is excluded. Credentials and visual polish are excluded.

The previous 36% overall and 0% frontend scores were provisional paragraph-level results. They changed because legal prose, marketing copy, examples, future options and duplicate atoms no longer count as independent software requirements, while interactive frontend workflows are scored as workflows and content pages use content-authority evidence.

## P0/P1 Delta List

- **P0 ENG-COMMERCIAL-005 — Payment method configuration** (PARTIAL; client value)
- **P0 ENG-DRIVER-002 — Driver compliance documents** (PARTIAL)
- **P0 ENG-DRIVER-003 — Independent driver verification** (PARTIAL)
- **P0 ENG-VEHICLE-001 — First-class vehicle profile** (MISSING)
- **P0 ENG-VEHICLE-002 — Vehicle documents and media** (MISSING)
- **P0 ENG-VEHICLE-003 — Independent vehicle approval** (MISSING)
- **P0 ENG-MEDIA-002 — Private durable object storage** (MISSING)
- **P0 ENG-MEDIA-003 — Owner-scoped signed access** (MISSING)
- **P0 ENG-PAY-002 — Payment method policy by context** (PARTIAL; client value)
- **P0 ENG-COD-001 — COD and partial-payment state** (MISSING; client value)
- **P0 ENG-COD-002 — Cash custody and collection** (MISSING)
- **P0 ENG-COD-003 — Cash reconciliation and liability** (MISSING)
- **P0 ENG-CLAIM-001 — Claim creation and reason taxonomy** (MISSING)
- **P0 ENG-CLAIM-002 — Claim evidence** (PARTIAL)
- **P0 ENG-CLAIM-003 — Investigation and responsibility** (MISSING)
- **P0 ENG-CLAIM-004 — Claim decision and audit** (MISSING; legal review)
- **P0 ENG-CLAIM-005 — Operational remedies** (MISSING; legal review)
- **P0 ENG-PROM-007 — Earnings, withdrawals and reversals** (PARTIAL)
- **P0 ENG-PRIV-010 — Sensitive data-class controls** (PARTIAL; legal review)
- **P1 ENG-COMPANY-001 — Canonical company settings** (PARTIAL; client value, legal review)
- **P1 ENG-COMPANY-002 — Immutable issuer snapshots** (MISSING; legal review)
- **P1 ENG-COMPANY-003 — Company settings permissions and audit** (PARTIAL; legal review)
- **P1 ENG-COMMERCIAL-001 — Versioned delivery service and rate model** (CLIENT_VALUE_REQUIRED; client value, legal review)
- **P1 ENG-COMMERCIAL-003 — Store commercial policy and commissions** (PARTIAL; client value)
- **P1 ENG-COMMERCIAL-006 — Immutable commercial evidence** (MISSING)
- **P1 ENG-MODULE-001 — Canonical business modules** (MISSING; client value)
- **P1 ENG-MODULE-002 — Governed category hierarchy** (PARTIAL)
- **P1 ENG-MODULE-004 — Store onboarding governance** (PARTIAL)
- **P1 ENG-GEO-001 — Nationwide discovery and selling territory** (PARTIAL)
- **P1 ENG-GEO-002 — Coverage and serviceability authority** (PARTIAL; client value)
- **P1 ENG-GEO-003 — Route-distance evidence** (PARTIAL)
- **P1 ENG-DRIVER-001 — Driver identity and profile** (PARTIAL)
- **P1 ENG-DRIVER-004 — Dispatch eligibility and location evidence** (PARTIAL)
- **P1 ENG-MEDIA-004 — Retention and deletion for media** (PARTIAL; legal review)
- **P1 ENG-PAY-003 — Refund and payment evidence integration** (PARTIAL)
- **P1 ENG-CLAIM-006 — Claim-to-refund integration** (PARTIAL; legal review)
- **P1 ENG-CLAIM-007 — Claim customer/store/admin surfaces** (MISSING)
- **P1 ENG-CLAIM-008 — Fraud and abusive-claim controls** (PARTIAL)
- **P1 ENG-PROM-001 — Promoter programme configuration** (PARTIAL; client value)
- **P1 ENG-PROM-002 — Rank definitions** (CLIENT_VALUE_REQUIRED; client value)
- **P1 ENG-PROM-004 — Team graph** (PARTIAL)
- **P1 ENG-PROM-005 — Qualification and monthly evaluation** (PARTIAL)
- **P1 ENG-PROM-006 — Commission rules** (CLIENT_VALUE_REQUIRED; client value)
- **P1 ENG-PROM-008 — Promoter and admin surfaces** (PARTIAL)
- **P1 ENG-ADS-002 — Advertising packages and rate cards** (CONFIG_ONLY; client value)
- **P1 ENG-ADS-004 — Business advertising requests and media** (PARTIAL)
- **P1 ENG-ADS-008 — Managed external marketing boundary** (CLIENT_VALUE_REQUIRED; client value)
- **P1 ENG-PRIV-001 — Privacy notice and versioning** (PARTIAL; legal review)
- **P1 ENG-PRIV-002 — Terms acceptance evidence** (PARTIAL; legal review)
- **P1 ENG-PRIV-003 — Marketing preferences and opt-out** (PARTIAL; legal review)
- **P1 ENG-PRIV-004 — Cookie preference** (PARTIAL; legal review)
- **P1 ENG-PRIV-005 — Data-subject requests** (PARTIAL; legal review)
- **P1 ENG-PRIV-006 — Retention and deletion execution** (PARTIAL; legal review)
- **P1 ENG-PRIV-007 — Location processing control** (PARTIAL; legal review)
- **P1 ENG-PRIV-008 — Security incident and safeguards** (PARTIAL; legal review)
- **P1 ENG-PRIV-009 — Provider and data-processor governance** (LEGAL_REVIEW_REQUIRED; legal review)
- **P1 ENG-SHIP-001 — Service catalogue and launch scope** (CLIENT_VALUE_REQUIRED; client value)
- **P1 ENG-SHIP-002 — Booking and fulfilment lifecycle** (PARTIAL)
- **P1 ENG-SHIP-003 — SLA and service timing policy** (CLIENT_VALUE_REQUIRED; client value, legal review)
- **P1 ENG-SHIP-004 — Tracking, ETA and proof of delivery** (PARTIAL)
- **P1 ENG-SHIP-005 — Failed delivery and redelivery** (PARTIAL; legal review)
- **P1 ENG-SHIP-006 — Package and insurance policy controls** (CLIENT_VALUE_REQUIRED; client value, legal review)
- **P1 ENG-SHIP-007 — Vendor preparation obligations** (PARTIAL)
- **P1 ENG-SHIP-008 — Driver delivery responsibilities** (PARTIAL)
- **P1 ENG-POLICY-001 — Legal document publication and versioning** (PARTIAL; legal review)
- **P1 ENG-POLICY-002 — Policy-to-behavior reconciliation** (LEGAL_REVIEW_REQUIRED; legal review)

## Revised Ledgers

- Phase B: 12 whole-domain implementation clusters in [phase-b-implementation-ledger.json](../artifacts/phase-b-implementation-ledger.json); paragraph-level tasks removed.
- Phase C: 12 functional workflows in [phase-c-functional-frontend-ledger.json](../artifacts/phase-c-functional-frontend-ledger.json); visual beautification excluded.
- Phase D: 74 P0/P1 requirement proofs in [phase-d-proof-ledger.json](../artifacts/phase-d-proof-ledger.json); coverage complete.

## Preserved Evidence

The original source corpus remains in [phase-a-client-source-traceability.json](../artifacts/phase-a-client-source-traceability.json) and [client-authority-document-manifest.json](../artifacts/client-authority-document-manifest.json). Normalized outputs are [phase-a-normalized-capability-map.json](../artifacts/phase-a-normalized-capability-map.json), [phase-a-normalized-engineering-requirements.json](../artifacts/phase-a-normalized-engineering-requirements.json), and [phase-a-normalization-coverage.json](../artifacts/phase-a-normalization-coverage.json).

Phase B was not started. No production code, Prisma schema, migration, database, seed, provider or Git state was changed.
