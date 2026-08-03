# Phase 2.3 Store Operations

Phase 2.3 makes store accounts more useful for daily delivery operations without adding payments, driver dispatch, live tracking, or recurring jobs.

## Store Workspace

The store dashboard now provides:

- Store name and account status.
- New delivery CTA.
- Operational summary from real order records.
- Active orders grouped by status.
- Default pickup address card.
- Repeat delivery CTA.
- Recent order cards with route distance and create-similar actions.

## Default Pickup Address

Stores manage their default pickup address from `/store/profile`. The saved pickup address:

- Uses Google Places when available.
- Falls back to manual address entry.
- Stores coordinates and `placeId` where available.
- Prefills `/store/new-delivery`.
- Can be overridden per order without mutating the default.

## Repeat Deliveries

Stores can create a similar delivery from a previous store order. This copies pickup, dropoff, parcel count, parcel description, and public note fields into the form for review.

The workflow does not:

- Submit automatically.
- Copy order status.
- Copy status history.
- Copy route or delivery-region snapshots.
- Create scheduled recurring deliveries.
- Touch payment or billing.

## Ownership Rules

- Store users can only repeat orders belonging to their owned store.
- Store users can only manage pickup addresses for their owned store.
- Admin visibility remains separate from store self-service.
