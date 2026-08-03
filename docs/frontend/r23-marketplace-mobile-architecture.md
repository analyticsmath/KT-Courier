# R23 — Marketplace mobile architecture

## Navigation and discovery

- The public mobile sheet exposes **Shop** once, at `/shop`, with current-route semantics.
- Homepage hero order is quote, marketplace, then tracking utility.
- Marketplace search appears in the landing masthead and all result contexts with a native `type=search` input to support the software keyboard.
- Category cards use a semantic, scroll-snapped native rail with a visible next card; results and stores never make the document horizontally scroll.

## Listings and controls

- Store records are one-column image-first cards below compact search; there is no logo-only grid.
- Product grids are two columns with readable image, title, price and availability. Long names wrap inside a minimum-zero grid cell.
- Filter content uses a native `details` disclosure, preserving URL-backed links and keyboard operation instead of a client drawer that could trap focus.
- Sort choices, applied filter removal and cursor pagination are text links with 44px-or-better surrounding controls.

## Product, cart and checkout

- Product detail uses near-edge stable primary media, a truthful one-image/missing-media label, followed by title, price, availability, variants, details and rails.
- The desktop-only sticky product information column is disabled below 900px.
- Variant controls are regular links and cannot form a client-invented combination.
- Cart and checkout remain explicit locked states. No sticky payment action can be hidden by the software keyboard.

## Environment resilience

- Safe-area padding is inherited from public shell spacing; no fixed bottom marketplace control is introduced.
- 320–430px remains two product columns only because content has a minimum-zero card grid; test long names, ZAR prices and encoded URLs.
- On landscape, normal page scrolling remains available. Reduced motion removes scroll behavior dependence; forced colours preserves focus outlines.
- Images use dimensions and `sizes`; product card images stay lazy outside the initial viewport.
