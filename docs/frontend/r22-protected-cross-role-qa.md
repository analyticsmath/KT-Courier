# R22 — Protected application cross-role QA

## 1. Objective and scope

R22 audited the current protected and candidate-private frontend source as one system: customer, store, driver, promoter, customer/store developer ownership, applicant, administration, payment handoff, and the public/auth boundaries that meet them. It is a presentation-only QA phase; APIs, services, DTOs, permissions, sessions, locks, financial calculation, OpenAPI, Prisma, migrations, dependencies, and generated outputs were not changed.

## 2. Current route inventory

The source tree contains **242 protected/private route modules**: customer 27, store 30, driver 10, promoter 18, developer catch-all 1 (13 verified portal route shapes), applicant 16, administration 136, and payment handoff 4. The boundary review also covers 9 auth pages, public `/developers`, and the 3 public Careers pages. See [the R22 route matrix](r22-route-coverage-matrix.md).

All protected/private page bodies classify as `PROTECTED_V2_DIRECT`, `PROTECTED_V2_COMPOSED`, `TRUTHFUL_LOCKED_STATE`, or `TRUTHFUL_UNAVAILABLE_STATE`; `LEGACY`, `RAW_MARKUP`, and `UNKNOWN` are zero. The formerly raw pickup/delivery exception and payment-handoff bodies now use protected-v2 primitives.

## 3. Shell, authentication, role, ownership, and navigation

- Public Editorial Freight remains the `/developers` and Careers boundary. The required deeper `/developers/[...segments]` route alone receives Editorial Operations.
- Account, store, driver, promoter, administration, and payment routes use role/server guards and one protected shell/main landmark. Applicant uses Candidate Dossier and never inherits account/public navigation.
- Navigation is projected server-side from `getEffectivePermissionKeysForUser`; empty admin groups are omitted. It is convenience only—page/API guards remain authority.
- Applicant application lookup is profile/session scoped; developer projections are owner-user scoped; the role surfaces retain their existing owner-scoped queries. Runtime proof with two accounts remains manual work.

## 4. Status, data, finance, actions, and locks

Source review confirmed explicit status presentation modules across customer, store, promoter, developer, applicant, commerce and R21 administration. R22 adds an explicit payment presentation map with a neutral unknown fallback. No unknown payment state is labelled successful.

Displayed financial values remain canonical decimal strings with explicit ZAR where relevant; no R22 browser arithmetic or totals were added. Locks for marketplace/public storefront exposure, payments/provider readiness, refunds, withdrawals, subscriptions, promotions, advertising, promoter mutation, developer live access, webhooks, notifications, applicant unavailable contracts, reports/exports, and map/location remain unchanged and are represented as locked/unavailable states rather than failing controls.

Forms/actions remain existing server-authoritative flows. R22 normalizes client-visible failures for developer, commerce, store fulfilment, catalog draft, and payment checkout: conflict, rate-limit, server-unavailable, and generic recoverable failures are presented without raw backend error text. Buttons retain pending/disabled states where the existing island owns submission.

## 5. Responsive, accessibility, privacy, performance, and errors

Shared protected-v2 tables use declared mobile modes and status text/markers. Shells provide skip links, one main landmark, labelled navigation, focus handling, safe areas, reduced-motion and forced-colours support. The R22 source audit does not claim browser/assistive-technology completion; the complete manual matrix is in [the responsive and accessibility matrix](r22-responsive-accessibility-matrix.md).

R22 removed browser persistence of the store catalog draft; protected route/page and audited action sources no longer use `localStorage`, `sessionStorage`, or `document.cookie`. The root error presentation no longer logs the raw error object in the browser. Credential and webhook one-time secrets remain transient component state, not URL, metadata, storage, logs, or toasts. See [the security boundary audit](r22-security-boundary-audit.md).

Known performance risk: the established driver assignment-detail action screen remains a large client island because its pre-existing OTP/pickup/delivery action contract is coupled to it. R22 did not split that operational screen without a dedicated interaction regression pass. Its server authority and ownership boundary are unchanged.

## 6. Defects, backend limitations, and validation

Four frontend defects were fixed: protected catalog browser persistence; raw server error presentation in protected action islands; raw admin exception/payment handoff bodies; and raw root-error console diagnostics. Details are in [the defect register](r22-defect-register.md).

Backend/runtime follow-up remains required for multi-account ownership proof, session-expiry/forbidden flows, provider-unavailable states, production-lock operational evidence, actual data volume/pagination behavior, browser network inspection, and all screen-reader/viewport checks. No production, launch, or WCAG certification claim is made.

Focused validation completed: changed-file ESLint, `tests/r13`, `r14`, `r15`, `r19`, `r20`, `r21`, and `r22` Vitest contracts, source scans, and `git diff --check`. Production build, full typecheck, full suite, Playwright, Lighthouse, database/provider operations, and browser automation were intentionally not run.

## 7. Protected frontend readiness decision

**R22 IMPLEMENTATION COMPLETE — MANUAL VALIDATION REQUIRED**

R11 public blockers remain: approved legal/identity material, compact favicon, repository-wide TypeScript baseline, reconciled full release suite, browser/accessibility/performance evidence, and marketplace production approval. Those are not represented as resolved by R22.
