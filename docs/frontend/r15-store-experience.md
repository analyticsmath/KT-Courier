# R15 — Store Operations Experience

## Objective

R15 rebuilds the protected store surface as a fulfilment bench: a compact, server-rendered work surface that prioritises store-owned marketplace preparation, collection readiness, distinct courier delivery requests, canonical catalog records, and source-backed earning projections. It changes presentation only.

## Verified route inventory

The live tree contains 30 store routes. The complete route-by-route record is in [r15-store-route-matrix.md](r15-store-route-matrix.md). `app/(store)/store/layout.tsx` remains the single `STORE` role boundary, resolves registry-filtered navigation on the server, and mounts the R13 Editorial Operations shell. There are no store-local loading, error, or not-found boundaries; root boundaries apply.

## Store information architecture

Desktop navigation remains R13 registry-driven: Workspace (Overview, Orders, New delivery), Commerce (Product catalog), Finance (Earnings), Growth (Advertising), and Account (Notifications, Store settings, Support). The mobile store context retains the top bar and full navigator instead of a misleading fixed bottom bar. Locked subscription and promotion routes remain URL-continuous but are intentionally not promoted as active destinations.

## Overview

`/store` has four or fewer compact, source-backed values: attention, preparation, ready for collection, and—only when its existing service returns it—confirmed payable balance. It queries the existing server services for the owned store, store pickup address, courier request list, marketplace queue, and earning summary. It does not load catalog history, analytics, charts, fabricated notifications, growth comparisons, or customer information.

The marketplace queue is dominant. Its server service determines row ordering inside each stage; R15 only makes section precedence explicit: customer action, review, preparation, accepted, ready for collection, handoff, reconciliation, closed, then collected. Unknown operational states do not receive a fabricated low-priority score.

## Fulfilment queue

`StoreFulfilmentQueue` is server-rendered and contains only store-safe reference, source status, real review deadline, and an explicit next-store action. It has structured list semantics on compact screens and links to the canonical `/store/marketplace-orders/[reference]` detail route. Empty copy states that a record appears only after the marketplace workflow creates an owned operational order.

## Preparation

The detail view retains the canonical `/api/store/orders/[reference]/actions` endpoint. The action island collects preparation minutes and pickup instructions rather than inventing either value. It generates an operation ID, exposes server errors, disables while submitting, and calls `router.refresh()` only after the server responds successfully. Eligibility, ownership, permissions, idempotency, optimistic concurrency, audit history, and production readiness remain in the existing API/service.

## Collection readiness

The Ready for collection action calls the existing `mark-ready` action. No client state advances a record, no courier is assigned by the page, and no collection event is shown before the server writes it. The queue exposes collection only when its server projection reports a ready/handoff stage; no calendar or ETA is invented.

## Exceptions

The marketplace detail shows source status, line availability only when confirmed, source issue type and affected quantity, and a source activity history. It excludes customer identity, payment payload, customer financial allocation, driver location, dispatch-private notes, fraud signals, and raw `safeEvidence`. Reconciliation and customer-action states are labelled explicitly without making every unusual state a danger state.

## Courier orders

Store-created courier delivery requests remain distinct from marketplace store orders on `/store/orders`. They use the existing `listOrders` service and canonical `/store/orders/[id]` detail route. The list uses an accessible desktop table and a real labelled mobile record list. The detail retains existing cancellation authority, but removes route/driver presentation and unnecessary recipient-contact display from the R15 page composition.

## Marketplace orders

There is no dedicated list route in the current store tree; marketplace records are reached from the queue on overview and orders. The detail presents identity, store-facing statuses, item quantities, line fulfilment state, source issues, eligible canonical actions, and an ordered store-safe timeline. It does not claim payment completion, refund settlement, courier assignment, collection completion, or delivery completion without the existing server projection.

## Catalog

The concrete catalog routes stay under `/store/catalog`. R15 uses the existing active-owned-store guard and catalog services. The catalog overview is a compact, source-backed record summary; product, offer, import, media, and inventory pages use `EditorialTable` with `stack` mobile mode rather than compressed horizontal administration tables.

## Products

Product list search and `status` query parameters remain server-read and unchanged. Product detail presents canonical identity, type, category, brand, explicit states, and variants. Product creation keeps the existing `StoreCatalogWizard`; R15 does not alter its product validation, draft save, submission, media association, or publication behavior.

## Inventory

Inventory remains a location-aware projection of existing stock movements. R15 adds no threshold, low-stock warning, bulk reorder, client adjustment, reservation, or overwrite behavior. Availability is only displayed for tracked records using the existing inventory projection.

## Product media

Media pages show the existing store-owned media reference, inspection state, inspected metadata, and association count. They do not expose storage keys. Upload and association behavior remains inside the canonical product workflow; the page makes no public-media or storefront claim.

## Storefront lock

Catalog pages state that drafting/review is distinct from public storefront publication. The UI deliberately does not expose internal lock evidence, activate products/offers/prices, imply public visibility, or activate marketplace checkout.

## Store profile and addresses

`/store/profile` retains the existing profile and pickup-address client islands inside protected server panels. Server ownership, validation, address-provider behavior, and mutation endpoints are unchanged. The pickup panel remains the canonical source for new-delivery prefill.

## Earnings

Earnings use existing store-owner summary and list services. Monetary output uses service-issued decimal text with explicit `ZAR`; the browser performs no earnings, balance, commission, or availability calculation. The detail hides journal references and shows only store-safe financial amounts, state, and safe history.

## Commissions and withdrawals

No concrete store-owned commission or withdrawal route exists in the live store tree. R15 adds neither a route nor fictional balance, commission, payout destination, withdrawal, maker-checker, or payout status UI.

## Subscription

The concrete subscription, plans, billing, and benefits routes remain present but render an honest protected locked state. They do not display an invented plan, price, invoice, payment, entitlement, or benefit quota.

## Promotions and advertising

The existing promotion route family and advertising route remain present but render source-honest unavailable states. R15 removes the old fixture-like advertising campaign UI and does not submit, fund, pause, end, or report a campaign. No promotion discount, audience, budget, redemption, customer, or settlement record is fabricated.

## Staff, permissions, notifications, developer access

No concrete store staff/permission-management or store-scoped developer route exists; none is added. Notifications use a minimal server-selected owned inbox projection (title, body, state, timestamp). The page does not pass a raw notification model to a client island.

## Server/client boundaries

Pages, lists, tables, metrics, financial text, catalog state, queue ordering, and notification selection are Server Components. Existing forms remain their existing client islands. The only R15 action island is `StoreFulfilmentActions`, which receives reference and source statuses only, calls the canonical action API, and retains no page-wide/global state or private record cache.

## Mobile architecture

See [r15-store-mobile-architecture.md](r15-store-mobile-architecture.md). Compact routes use one-column records, canonical detail URLs, server-backed filters, and form controls with practical touch targets. No desktop side rail, data-grid compression, decorative analytics, or fixed action bar is added on small screens.

## Accessibility

Each rebuilt route has one `ProtectedPageHeader` H1. R13’s skip link, main landmark, focus behavior, reduced-motion, forced-colors, and safe-area behavior remain intact. Tables have captions and become labelled stacked records; queues are ordered/semantic lists; timelines are ordered; action controls use labels, required fields, loading state, live status text, and a confirmation checkbox for rejection.

## Performance

The overview is bounded to five courier requests and the existing queue query; it does not load catalog, complete earnings history, or order details for each row. There are no charts, calendar packages, maps, image packages, persistent browser cache, or page-wide client component. Existing service pagination remains the authority for catalog and financial list routes.

## Security

Role guard, ownership queries, API action checks, permissions, store scope, production locks, idempotency, and concurrency remain server-side. R15 excludes exact driver location, raw permission sets, session data, storage keys, provider data, ledger/journal IDs, private customer identity unless already needed by the canonical delivery form, fraud/review evidence, and raw Prisma objects from client props.

## Production locks

Subscriptions, promotions, advertising, storefront publication, marketplace checkout, catalog media lifecycle, and financial execution retain their existing production controls. R15 presents no internal lock token, toggle, or bypass.

## Known backend limitations

- Store staff/permission, commissions, withdrawals, storefront configuration, category/collection management, and store-scoped developer routes have no concrete store page in the current route tree.
- Marketplace order listing exists as an owned queue projection rather than a dedicated `/store/marketplace-orders` page.
- Store earning services expose safe financial records but no store withdrawal projection; R15 intentionally does not infer one.
- The existing catalog media and product wizard remain the canonical media mutation surface; R15 adds no standalone upload control.

## R16 boundary

R16 — Driver Operations Experience
