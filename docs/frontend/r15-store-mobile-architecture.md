# R15 — Store Mobile Architecture

## Navigation

Store uses the R13 top bar and full-screen navigator at compact widths. It has no fixed bottom-navigation set because the store role has more than a small set of operational destinations. Registry filtering still occurs on the server.

## Urgent queue and collection readiness

At 320–599px, overview shows the fulfilment summary and ordered marketplace queue before courier-request history and setup/finance context. Queue records are semantic list items and open canonical detail routes. Ready-for-collection remains a server-confirmed action within the detail route; there is no modal, fake agenda, courier ETA, or driver map.

## Preparation workflow

The preparation action island is one column. Preparation time and pickup instructions remain editable, labelled fields and the keyboard does not sit below a fixed page action bar. Server errors announce in the local status area. Reject requires an explicit confirmation checkbox.

## Store-order and courier-order records

Marketplace records are compact reference/status/next-action rows. Store-created courier requests use labelled structured records on overview and desktop tables that switch to stack mode on compact screens. Their full detail remains a route, preserving normal browser Back behavior.

## Catalog, products, forms, inventory, and uploads

Catalog navigation scrolls horizontally only within its labelled destination strip. Product, offer, inventory, import, and media desktop tables become labelled records below 600px. Product creation keeps its existing one-column wizard. Media availability remains inside the canonical product workflow; no drag-only upload or new client upload authority is added.

## Finance

Earning figures remain tabular text with `ZAR` and stack into labelled records. No chart, payout control, or client-calculated balance appears. Subscription, promotion, and advertising routes have compact locked states with a normal back link.

## Filters, provider states, and safe areas

Product `search` and `status` remain normal GET parameters and work without a client-only filter store. Address provider behavior stays in the existing delivery/pickup components; R15 adds no location fallback. R13 preserves safe-area spacing, focus-managed navigation, reduced motion, forced colours, and no root horizontal overflow.

## Review widths

320, 360, 390, and 430px: one column, semantic records, no side rail. 600, 768, and 834px: readable form panels and controlled tables. 1024px and above: R13 rail with optional overview context rail. 1440 and 1920px: bounded main workspace and no empty analytics poster.
