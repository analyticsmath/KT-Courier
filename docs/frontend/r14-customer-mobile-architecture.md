# R14 — Customer mobile architecture

## Navigation

The R13 registry remains the authority. Customer bottom navigation is registry-derived: Overview, Request delivery, My deliveries, Wallet, and Notifications. At compact widths the shell retains four primary destinations plus the labelled More entry; Addresses, Refunds, Profile, and Support are available through More. Current-route semantics and role/permission filtering remain server-resolved.

## Overview and records

At 320–599px the overview orders content as request action, active delivery or truthful empty state, recent deliveries, then account help. The active delivery has no map, ETA, driver coordinates, or percentage. The orders page renders a real list of labelled delivery records on compact widths, not a squeezed table. At 600px and above it presents the semantic desktop table while retaining the same destination route.

## Request flow and address provider state

The canonical request form remains a progressive five-section client island: delivery type, pickup, destination, parcel/schedule, review. The server page owns initial addresses and repeat prefill. It remains one column on compact screens and does not add a second form or a separate client store.

When address suggestions are unavailable, text entry remains accessible. Coordinates are left absent rather than inferred; the review explains that a mapped pickup and destination are required to generate the existing server quote. This is `PROVIDER_UNAVAILABLE` / `TEXT_ENTRY_ONLY`, not a fake map or fake distance. No configuration key is disclosed.

## Details, finance, forms, and keyboard use

Order, refund, and withdrawal details are dedicated routes. Timelines use ordered content and stay one column. Finance tables become labelled stacked records. Wallet and finance actions use labelled controls; account and payout data remain masked.

The existing customer forms retain their canonical APIs. Buttons use practical 44px compact targets. The protected drawer provides the mobile orders filter and keeps focus, Escape, backdrop, and restoration behavior from R13. The protected shell reserves safe-area space for the bottom navigation. No page-level fixed action bar is introduced, so the software keyboard is not covered.

## Responsive review matrix

| Width | Required behavior |
| --- | --- |
| 320, 360, 390, 430 | One column, labelled bottom navigation, record list, no wide table or side rail |
| 600, 768, 834 | Compact desktop/mobile hybrid; readable form sections and order table may appear |
| 1024, 1280 | Persistent protected rail; bounded main workspace; table/list desktop composition |
| 1440, 1920 | Bounded content area; no empty analytics poster or unnecessary context rail |

## Offline and unavailable states

Customer pages state unavailable conditions explicitly. No provider configuration details, fake map screenshot, synthetic delivery data, membership benefits, payment cards, security sessions, recipient records, business members, promotions, or exception status is shown.
