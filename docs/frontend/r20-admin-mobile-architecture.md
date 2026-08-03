# R20 mobile administration architecture

Administration keeps the R13 full-screen navigator below desktop widths. Command-centre queues, courier order list/detail, dispatch context, pickup/delivery exceptions, customer/store/driver records, regions, pricing, catalog records, storefront configuration, and marketplace references remain reachable at 320px through 834px.

Tables use labelled stacked records. Dedicated URLs remain canonical; no narrow split panel, drag dispatch board, map, bulk selection, geometry editor, or dense pricing matrix is forced onto a compact screen. Filters are server-backed and compact controls remain labelled. Order action dialogs retain keyboard focus, Escape, visible error feedback, and server-confirmed refresh.

R20 commerce closure uses `EditorialTable` with `mobileMode="stack"` for categories, product types, products, offers, moderation, media, duplicates, collections, projections, synonyms, and store-order reconciliation. Product, moderation, media, collection, projection, and synonym records keep dedicated URLs; marketplace checkout is a readable protected locked state rather than a squeezed table. Focused forms retain labelled inputs, associated live error feedback, and visible buttons—no action is hover-only or hidden in an unlabeled overflow.

There is no live map fallback because the current authority is `MAP_NOT_REQUIRED` / `LOCATION_DATA_WITHOUT_MAP`. Region pages provide text identity and availability rather than a fabricated graphic. Mobile preserves safe-area padding, works with a software keyboard, uses the shell’s reduced-motion and forced-colours rules, and remains readable in landscape, 200% zoom, and 400% reflow.
