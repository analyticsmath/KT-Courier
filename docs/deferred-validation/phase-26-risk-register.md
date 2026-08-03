# Phase 26 — Recruitment Risk Register (Deferred Validation Matrix)

## 1. Overview

As mandated by Phase 26 rules, deep database concurrency, browser automation, multi-tier transactional locking, and live deployment validation are deferred to:
`Phase 26.5 — Consolidated Validation and Stabilization`

All production operations remain blocked while `RECRUITMENT_PRODUCTION_VALIDATION_APPROVED = false`.

---

## 2. Risk Register & Deferred Verification Matrix

| Risk ID | Category | Risk Description | Mitigations Implemented in Phase 26 | Deferred Validation (Phase 26.5 Target) |
|---|---|---|---|---|
| R-26-01 | Concurrency | Headcount over-subscription when multiple offers are accepted concurrently | Atomic requisition headcount checks & optimistic version locking on Requisition and Offer records | PostgreSQL isolation level & concurrent load testing under heavy offer acceptance |
| R-26-02 | Security / Privacy | Cross-applicant IDOR access to application answers or document references | Strict `userId` ownership checks, explicit permission guards, and `DENY` overrides on all API routes | Automated security penetration testing and browser IDOR payload sweeps |
| R-26-03 | Compliance | Unintended exposure of segregated Employment Equity declarations to hiring panels | Segregated `RecruitmentEmploymentEquityDeclaration` table, `REPORTING_ONLY` mode, and restricted DTO projections | Schema & API data leakage security audit across all role permutations |
| R-26-04 | Authorization | Bypassing employee or driver onboarding controls via direct recruitment table mutations | Handoff invokes existing `AdminProfile` / `DriverProfile` onboarding services without direct active role assignment | E2E integration verification with full DB state assertions |
| R-26-05 | Integrity | Immutable opening or offer versions modified post-issuance or post-publication | Database-level schema design, version number checks, and application freeze upon submission | Production DB migration & transaction rollback test suite |
| R-26-06 | Compliance | Unlawful credit check execution for non-cash/finance roles | Default policy `EMPLOYMENT_CREDIT_CHECK_NOT_AUTHORIZED_FOR_POSITION` and position family validation | Automated policy matrix test suite across all position categories |
| R-26-07 | Automation | Accidental inclusion of AI CV ranking or automated rejection endpoints | Strict source audits, deterministic screening rules producing flags only, and human reviewer requirement | Source-level AST audit & mock service injection test |
| R-26-08 | Fraud / Operations | Impersonation or document tampering during driver onboarding handoff | Deterministic fraud checks for document hash, licence number, and PrDP expiry mismatch | Live driver document scanner & OCR reconciliation validation |
