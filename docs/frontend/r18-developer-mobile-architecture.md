# R18 — Developer Mobile Architecture

## Navigation and layout

The protected developer tree receives the R13 top app bar and full navigator. It intentionally has no five-item consumer bottom bar. Server-filtered navigation exposes only documented protected destinations; `/developers` stays public and is not a protected navigator target.

At 320, 360, 390, 430 and 600px pages use one column. At 768 and 834px detail views may retain small paired metadata values; at 1024px and wider the shell rail and optional context rail can appear. The portal must also be checked at 1280, 1440 and 1920px, landscape, 200% zoom and 400% reflow.

## Records, forms and actions

Applications, credentials, endpoints, quota records, request metadata and deliveries use the shared table contract with mobile stacked records. This keeps labels adjacent to values without page-level horizontal scroll. Detail pages use definition lists. Forms are single-column and use native labelled controls; canonical server errors remain the source of validation.

Application lifecycle and environment appear before credentials. Credential security attention and failed deliveries receive textual status. Long scope names and masked endpoint values wrap; endpoint values do not become automatic external links.

## Display-once secrets and copy

The reveal panel fits inside the viewport and has its own wrapping/scrolling secret value. Copy is an explicit labelled button, never automatic. Its status message is an aria-live announcement. No secret enters URL state, persistent browser storage, a toast, an example or a delivery record. Reloading the page presents the normal unavailable/replacement path because the transient response cannot be reconstructed.

## Endpoints, deliveries and code blocks

Event selections are semantic labelled checkboxes using only the canonical catalog. Delivery attempts are an ordered list, not a compressed table. No payload or header block is available because the current safe owner projection is metadata-only. The documentation code block has `tabIndex=0`, a label and its own bounded horizontal scroll; it never causes root overflow.

## Keyboard, safe areas and accessibility

All controls are native or use existing protected button/link styles, have visible focus, and avoid hover-only actions or positive tabindex. Destructive revocation uses explicit confirmation. The shell’s safe-area spacing and mobile drawer accommodate the software keyboard; no fixed form action is pinned beneath it. Existing protected forced-colours and reduced-motion handling continues to apply.
