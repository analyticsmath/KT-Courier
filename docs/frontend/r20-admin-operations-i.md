# R20 — Administration Operations I

## Objective and boundary

R20 rebuilds the present administrative core as an Editorial Operations desk. It preserves every existing route path, server page guard, service, DTO, action endpoint, state machine, audit path, concurrency check, production lock, and API contract. Finance, recruitment, promoter, developer, notification, permissions, settings, global activity, payments, refunds, withdrawals, subscriptions, and growth administration remain R21 work.

The current repository has no dedicated admin customer detail, store detail, region detail, pricing-rule detail, assignment detail, marketplace-order list/detail, or fulfilment-overview route. R20 does not invent those paths. Existing records stay accessible through their actual list or canonical order/driver detail routes.

## Command centre

`/admin` is a triage surface. Its maximum four metrics are source-backed: unassigned dispatch, pickup/delivery exception count, pending stores, and the server-derived total of pending plus failed orders. The dominant attention queue is the existing dashboard attention projection, ordered by stored `createdAt ASC, id ASC`; the exception preview is ordered by stored `occurredAt DESC, id ASC`. Neither view introduces a risk, urgency, health, confidence, SLA, revenue, ETA, or score projection.

The desk loads dashboard, dispatch, and bounded exception projections only. It contains no charts, fake activity, decorative map, contact-message queue, finance, recruitment, developer, or governance workload.

## Operations and information architecture

The R13 grouped navigation remains the only application navigation. R20 uses contextual links inside the following real workspaces:

- Command centre: overview.
- Operations: courier orders, dispatch, pickup exceptions, delivery exceptions.
- People and network: users/customer directory, stores, drivers, service regions.
- Pricing: pricing rules.
- Commerce: catalog and storefront routes already present in the route tree.
- Marketplace/store orders: existing read-only checkout and reconciliation references only; financial mutation is R21.

Courier order list filters and pagination remain server-backed. Assignment creation/reassignment is available only on the dedicated order route and uses the existing region-specific eligible-driver projection. Candidate data is reduced to display name and driver code before entering the client action island. The action island sends the existing request bodies and waits for the canonical endpoint; it does not optimistically mutate order state.

## Permissions and privacy

Pages retain `requireAdminPagePermission`. R20 resolves action visibility on the server with the existing effective permission authority; no permission list is serialized. The order detail only renders status controls for `orders.status.manage`, assignment for `dispatch.assign`, and reassignment for `dispatch.reassign`. Read-only administrators receive source-backed context without controls.

The administrative UI does not expose passwords, sessions, credentials, payment-provider payloads, ledger internals, fraud/security evidence, raw map/provider values, exact driver location, storage keys, or another tenant's record. Lists use only operationally necessary account/store/driver fields. Customer and store detail routes are not created because no canonical route/DTO authority exists.

## Regions, pricing, catalog, storefront, and marketplace

Regions remain textual because the current `DeliveryRegionDto` has centre/radius fields but no boundary/polygon editor, provider-map contract, version/concurrency field, or region detail route. Pricing displays the canonical rule projection and never calculates a quote. Existing pricing and region mutation managers are mounted only after their server-resolved management permission; read-only users see semantic stacked records.

Catalog, media, moderation, product-type, offer, duplicate, collection, projection, and synonym routes retain their existing catalog/storefront authorities. Publication and storefront activation remain locked. Marketplace checkout and store-order reconciliation remain read-only references in this phase; no payout, payment, refund, adjustment, settlement, or delivery override is added.

## Server/client, mobile, accessibility, and performance

Pages, guard checks, data queries, queue ordering, filters, pagination, action eligibility, and sensitive-field selection are Server Components. Client islands are restricted to existing canonical forms and the focused assignment dialog. Action props contain only an affirmative capability and presentation-safe data.

Tables use `EditorialTable` with `mobileMode="stack"`; compact widths become labelled record lists rather than squeezed grids. The R13 shell provides the skip link, one main landmark, grouped navigation, focus treatment, reduced-motion, forced-colours, and safe-area behavior. R20 adds semantic captions, status text plus markers, ordered timelines, and labelled dialogs.

No overview loads full histories or catalog data. The command centre uses bounded dashboard/dispatch/exception projections; detail routes perform dedicated retrieval.

## Production locks and known limitations

No production lock changed. Catalog publication, storefront activation, marketplace checkout, catalog media lifecycle, subscription, promotion, advertising, and finance locks stay authoritative.

Known limitations: no dedicated admin customer/store/region/pricing/assignment/marketplace-order detail routes; no canonical admin fulfilment overview; no live map authority; no region-boundary DTO/editor; no backend bulk-action contract; no admin marketplace-order presentation route despite API endpoints; and the legacy full driver console currently requires all update, status, and region-management permissions together to prevent partial-permission action leakage.

## R21 boundary

R21 — Administration Operations II

## Commerce operations closure

### Original omission

The initial R20 delivery retained legacy visual bodies for the concrete catalog, storefront, marketplace checkout, and store-order reconciliation routes. R21 preflight correctly identified that gap. This closure completes that already-approved R20 presentation scope; it does not start R21.

### Completed routes and preserved authority

All 19 concrete commerce routes now render through the R13 protected-v2 page frame and use protected panels, statuses, tables, locked/empty states, and dedicated record URLs. Catalog list and detail routes retain their existing category, product, moderation, media, offer, product-type, and duplicate services or their existing server-selected read authority. Storefront collections, projections, and synonym versions retain their existing services and endpoints. No route, API, DTO, database schema, service, state machine, or permission definition was changed.

Action visibility is resolved in server pages through the existing permission authority. Client islands receive only affirmative capabilities, IDs/references, versions, and source-state eligibility. Read-only administrators see coherent records without unusable controls. Product moderation and media review retain canonical endpoint concurrency/error behavior. Collection, projection, and synonym forms retain the existing server validation and optimistic version checks.

### Locks and marketplace/store-order boundary

The storefront public-exposure lock remains authoritative. Configuration and review records can exist without any claim of public visibility; locked activation controls are omitted. Marketplace checkout now presents an explicit protected locked state and provides no activation, transaction, provider, payment, or settlement UI.

`/admin/store-order-reconciliation` remains an R20 operational triage surface because its route permission is `store_orders.reconcile` and its canonical model is anchored to a marketplace store order. It renders only the safe case reference, marketplace store-order context, operational state, discrepancy reason, case state, and timestamps. Adjustment, refund, payout, ledger, commission, settlement, and payment reconciliation data/actions remain R21 finance work. Marketplace store orders are explicitly kept distinct from courier orders.

### Validation and R21 readiness

Focused ESLint, filtered TypeScript diagnostics, protected-v2/legacy scans, route-presence checks, and focused R20 Vitest coverage validate the closure. The test contract verifies route presence, protected-v2 imports, truthful locks, explicit neutral fallback status mapping, sensitive-field exclusion, server-authoritative actions, compact table modes, and the operational-versus-financial boundary.

R20 is now complete and ready for the R21 preflight. No R21 page body or documentation was added by this closure.
