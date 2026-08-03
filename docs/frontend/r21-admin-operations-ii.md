# R21 — Administration Operations II: Finance, Programmes, Platform and Governance

## R20 scope-closure preflight

Completed: 2026-07-29

R21 began only after checking the updated R20 documentation, the current
administration route tree, and the actual route source. The result is
`R20_IMPLEMENTED` for every required R20 commerce area.

| R20 area | Disposition | Route evidence | Verified implementation state | Remaining issue |
| --- | --- | --- | --- | --- |
| Catalog administration | `R20_IMPLEMENTED` | `/admin/catalog`, `/admin/catalog/offers`, `/admin/catalog/moderation`, `/admin/catalog/media`, `/admin/catalog/duplicates`, and supporting catalog routes | All catalog routes import the protected-v2 commerce presentation and no longer use the legacy `PageHeader`/`Card` surface. | None in R20. |
| Category administration | `R20_IMPLEMENTED` | `/admin/catalog/categories` | The category route is protected-v2 and uses the existing server-side category authority. | None in R20. |
| Product administration | `R20_IMPLEMENTED` | `/admin/catalog/products`, `/admin/catalog/products/[id]`, `/admin/catalog/product-types` | List and detail routes are protected-v2 while retaining the canonical route authority and actions. | None in R20. |
| Storefront administration | `R20_IMPLEMENTED` | `/admin/storefront/collections`, `/admin/storefront/collections/[id]`, `/admin/storefront/projections`, `/admin/storefront/projections/[id]`, `/admin/storefront/search-synonyms`, `/admin/storefront/search-synonyms/[id]` | All six storefront routes use the protected-v2 commerce surface; the current route tree contains no unconverted storefront administration route. | None in R20. |
| Marketplace checkout | `R20_IMPLEMENTED` | `/admin/marketplace-checkout` | The actual source renders the explicit `marketplaceCheckoutProductionReady` protected-v2 locked state. It does not imply an active checkout implementation or expose actions. There is no separate marketplace-order administration route in the current tree. | None in R20; production enablement remains outside R20. |
| Marketplace fulfilment / store-order oversight | `R20_IMPLEMENTED` | `/admin/store-order-reconciliation` | The source requires `STORE_ORDERS_RECONCILE`, projects only the operational reconciliation case and safe store-order fields, and renders a read-only protected-v2 operational queue. | Financial reconciliation, including payment, ledger, refund, payout and related financial work, remains R21 scope. |

The route scan found 19 R20 commerce routes. Each imports protected-v2
commerce presentation and none retains the legacy `PageHeader`/`Card` page
surface. No R20 discrepancy was found, so R21 implementation may proceed
without modifying R20 again.

## R21 implementation record

The remaining sections of this document record the verified R21 route matrix,
presentation boundaries, accessibility approach, and focused validation as the
work is completed. R21 deliberately excludes backend, schema, financial and
lifecycle logic, permission definitions, production locks, public routes, and
R22 cross-role QA.

## Required documentation and repository review

Reviewed before implementation: the R12 discovery, route inventory, design
brief, roadmap and defect register; the R13 foundation/navigation/component
inventory; R14–R19 role-facing experience and privacy/security records; all R20
administration records; finance ledger/payment/refund/withdrawal/earning/
commission records; subscription, promotion, promoter and recruitment records;
Phase 27 notification records; Phase 28 credential, webhook, rate-limit and
security records; employee permission and security documentation.

There is no Phase 29 report/export implementation or report/export route in the
current source tree. `reports.read` and `reports.export` remain permission
placeholders and are not presented as functional work.

The live tree contains 136 administration routes: 31 closed R20 routes and 105
remaining R21 routes. The full exact-path matrix is in
`r21-admin-route-matrix.md`; current route source remains authoritative when an
older discovery document differs.

## Repository findings and preserved boundaries

- Financial data is canonical fixed-decimal ZAR and append-only ledger evidence.
  Payment, refund, withdrawal, earning and commission services own state,
  concurrency, idempotency, reconciliation and action eligibility.
- Subscription, promotion, advertising, promoter, recruitment, developer and
  notification routes already carry their own services, API contracts and
  production locks. R21 does not replace them.
- The R13 server-filtered grouped navigation remains the only global
  administration navigation. The admin layout resolves its context and
  navigation server-side.
- Administration routes had a mix of legacy page primitives and page-wide
  client surfaces. R21 installs a server `AdministrationWorkspace` protected-v2
  boundary around every route without changing those route contracts. Direct
  protected migration is prioritised for finance and governance evidence views.
- The explicit `presentR21Status` presentation map has no substring inference;
  unmapped states are neutral until a canonical mapping is reviewed.

## R21 implementation architecture

R21 is a controlled decision system, not an executive dashboard. The protected
finance command centre exposes only source-backed records: four attention tiles,
bounded queues and exact state/amount evidence. Ledger, payment, refund,
withdrawal, employee, permission, settings and activity surfaces use protected
page frames, semantic panels, labelled tables/lists, timelines and explicit
status text.

Server Components retain permission resolution, service retrieval, sensitive
projection, money formatting authority, action eligibility, lock state, sort,
filter and pagination. Existing client islands remain limited to their existing
forms and canonical controls; they receive no raw permissions, secrets, bank
data, raw provider payloads, credentials, tokens, full audit payloads or
client-calculated financial result.

## Accessibility, mobile, performance and privacy

The R13 shell supplies a skip link and one main landmark. R21 adds/uses labelled
protected tables, `aria-sort` only for real sort state, status text in addition
to colour, ordered timelines, visible focus, mobile stacked records and bounded
overflow. No new illustration, chart package, client cache, global admin state,
remote asset, raw JSON debug projection, fake data, score, prediction or export
is introduced.

The detailed breakpoint and illustration decisions are recorded in
`r21-admin-mobile-architecture.md` and `r21-admin-illustrations.md`.

## Verification record

Focused ESLint covers every directly migrated R21 file, the shared workspace,
and status mapping. R21 focused tests cover the R20 preflight record, the 136
live admin routes under the shared protected boundary, the operational/finance
scope split, neutral unknown-state projection, and absence of browser financial
arithmetic/legacy primitives in directly migrated high-risk files.

R21 does not run a full build, whole-repository typecheck, full test suite,
browser automation, Playwright, Lighthouse, Docker, Prisma, migration, live
payment, provider, payout, or production-lock activation check. Those are
intentionally deferred to architect-approved R22 work.

## Objective

Complete administration presentation for the remaining finance, programmes,
platform and governance routes without changing their domain authority.

## Scope boundary

R21 includes only administration presentation and scoped documentation/tests.
It excludes public, applicant, customer, store, driver, promoter-owner,
developer-owner and auth routes, plus backend, database and activation work.

## Permission and dual-control architecture

Every page/action keeps its existing server authorization. R21 renders only
affirmative server-projected capability; it does not calculate review, approval,
completion, reversal, retry or maker/checker eligibility in a client.

## Information architecture

The R13 groups remain Command Centre, Operations, People and network, Commerce,
Finance, Growth programmes, Platform and Governance. R21 adds no global nav.

## Financial command centre

`/admin/finance` now uses four bounded, source-backed attention tiles and
operational evidence queues, rather than an executive chart or derived metric.

## Ledger

Ledger accounts and journals remain read-only, immutable, filtered and paged
through the current query authority. R21 offers no posting or correction control.

## Payments

Payment list/detail present exact amount/currency, provider-neutral state,
attempt metadata and history. Provider success, signatures and raw payloads are
never inferred or exposed.

## Reconciliation

Payment, refund, withdrawal, earning, commission, programme, promoter,
recruitment and notification reconciliation remain canonical recovery workflows.
R21 does not add a force-resolve, manual settlement or status override.

## Refunds

Refund list/detail distinguish request, approval, held reserve, attempts,
reconciliation and completion. Customer contact is minimised and completion is
still production-lock and server-authority controlled.

## Withdrawals and payouts

Withdrawal list/detail retain masked destinations, exact money, payout evidence,
server-projected maker/checker controls and truthful locked/unknown states.

## Earnings

Store, driver and promoter earnings remain separate domains. Accrued, payable,
reserved, refunded, released, reversed and reconciliation values are not merged.

## Commissions

Commission plans, accruals and reconciliation retain their canonical service
authority. No browser calculation, allocation edit or invented finance action is
introduced.

## Subscriptions

Subscription contract, plan, programme and reconciliation routes retain their
provider/activation lock and do not claim a completed renewal or charge.

## Promotions

Promotion routes retain canonical lifecycle/concurrency and settlement locks.
R21 introduces no conversion, budget or performance metric.

## Advertising

Advertising stays an existing authority-led workspace. Rate-card and activation
locks are visible where source-backed; no campaign-performance fiction is added.

## Promoter administration

Promoter directory, programmes, agreements, attribution, qualification, assets,
fraud, disputes, earnings and reconciliation remain privacy-safe canonical
records. Financial correction remains outside the UI.

## Recruitment administration

Requisitions, openings, applications, interviews, checks, offers, handoffs,
fraud, reconciliation, privacy, retention and equity surfaces retain their
existing route/API authority. R21 provides no score, rank, AI recommendation,
invented interview slot or invented offer term.

## Developer administration

The developer catch-all remains an admin presentation for existing application,
scope, environment, credential, webhook, delivery and reconciliation paths. It
does not render credential material, signing secret, raw payload or live console.

## Notification administration

Templates, routes, deliveries, providers, suppressions and reconciliation retain
their canonical data and retry authority. Recipient data is minimised and no
delivery statistic or active channel is fabricated.

## Employees and administrative users

Employee records show safe identity/profile data, recorded status and the
server-projected effective permission count. They do not derive permissions in
the browser.

## Permissions

The registry and ADMIN defaults are textual/keyboard-reviewable. Permission
keys, role defaults, overrides and effective-permission evaluation remain
canonical server responsibilities.

## Settings

Settings retain the existing allowlisted manager. Environment values, secrets and
production-control material are excluded from R21 presentation.

## Security

Security/session authority is untouched. R21 does not expose tokens, hashes,
authorization headers, private rules, raw IP evidence, paths or stack traces.

## Audit/activity

Activity is a bounded, chronological, append-only projection. The direct R21
surface uses an ordered protected timeline.

## Reports and exports

There is no concrete route/job/download authority in the current tree. The
existing permission placeholders are documented as placeholders, not features.

## Server/client boundaries

Pages/guards/queries/projections stay server-side. Existing client forms and
controls remain limited islands and wait for canonical server confirmation.

## Mobile architecture

See `r21-admin-mobile-architecture.md`. Financial queues and direct governance
tables become semantic stacked records; detail evidence stays legible at narrow
widths without root horizontal scroll.

## Accessibility

R21 uses one page heading per direct surface, labelled tables, status text,
ordered timelines, focus indicators and keyboard-readable permission review.
Client form error/control verification stays with existing canonical islands.

## Performance

No page loads all queues, full histories, provider payloads or an OpenAPI file.
R21 uses existing bounded list/detail queries and adds no chart/illustration JS.

## Security and privacy

Client presentation receives safe projections only. Financial, recruitment,
promoter, developer, notification and settings fields follow existing sensitive
authority and are not expanded by this work.

## Production locks

Marketplace checkout, storefront exposure, catalogue media, subscriptions,
promotions, advertising, refund/withdrawal/provider readiness and developer live
access locks are unchanged and remain explicit where their source projects them.

## Known backend limitations

No R21 route retains a legacy page body below the shared protected-v2 boundary.
Where a safe record-level projection is unavailable or the existing production
authority is locked, the route renders a truthful protected unavailable or
locked state instead of a raw client surface, fixture, or placeholder form.

## R22 boundary

R22 — Protected Application Cross-Role QA

## R21 route-body closure

The route-body evidence gap identified after the first R21 report is closed. The live R21 tree contains 105 pages: 12 direct protected-v2 pages, 64 composed protected-v2 pages, 27 truthful locked states, and 2 truthful unavailable states. There are zero absent, legacy-body-in-protected-shell, raw-markup-in-protected-shell, and unknown R21 route bodies.

The closure migrated legacy finance/governance primitives through protected route components; replaced notification, recruitment, promoter, developer, subscription, promotion, and advertising wrapper/raw bodies; removed raw JSON evidence output; removed fabricated recruitment and advertising client metrics; and retained only server-authoritative actions. The detailed exact-route audit, page-body evidence, mobile mode, route permission, sensitivity boundary, and lock state is in `r21-admin-route-matrix.md`.

Backend limitations remain explicit: promoter, commercial programme, advertising, and recruitment production authorities keep their existing locks; developer safe server projections are unavailable; employment-equity output is unavailable until a reviewed anonymous projection exists; and reports/exports remain absent because no Phase 29 authority exists. These conditions are represented honestly and do not start R22.

R21 readiness: route-body presentation closure is complete and no R20 route, backend/API contract, schema, migration, authentication/session mechanism, permission definition, financial/lifecycle rule, credential/webhook rule, notification-routing rule, production lock, OpenAPI source, dependency, or generated file was changed by this closure.
