# KT Couriers — Asset-First Public Redesign: Phase 0 Audit and Phase 1 Direction

> Historical source audit. The media inventory remains useful, but the creative direction was rejected by the client on 18 October 2026. See [the replacement creative reset proposal](./kt-creative-reset-2026-10-18.md). Do not preserve the old story or visual treatment based on this document.

**Date:** 2026-10-18  
**Target repository/branch:** `analyticsmath/KT-Courier` / `main`  
**Source baseline inspected:** `07ef7d05013193a5caee9bcfd122518c48eb6a24`  
**Status:** Research/creative contract in progress. No runtime change in this commit.  
**Studio:** Valtum Studio

## 1. Client instruction, scope, and protected areas

The brief is a bespoke, award-level public-website refinement with a strict quality target of at least 9/10 on Valtum's internal creative rubric. It is NOT a greenfield application replacement and is NOT an instruction to apply the same effects to every page.

**In scope:** homepage cinematic world; public header/menu/footer; services index and 11 service pages; send-parcel/quote; public tracking; cart, the complete real checkout flow, its auxiliary reference/status/payment-return pages, and order-confirmation visual presentation.

**Protected from redesign:** `app/(public)/shop/**` including shop index, categories, stores, collections, search, products and their nested routes; all dashboards/account, admin, store and driver consoles and operational backend contracts. Shared code used by protected surfaces may be changed only with documented regression proof, preferably by using scoped wrappers or route-specific new components.

**Technical invariants:** no payment/accounting/settlement/tax/price logic changes; no invented rate, route coverage, delivery guarantee, product or order data; no destructive production checkout tests; no production DB migration required for aesthetic work; correct reference authorization preserved; route privacy/noindex policy preserved.

**Asset-first instruction:** use the repository media inventory before seeking new photographs. External media is allowed ONLY after a scene-specific gap is documented, rights/source checked, downloaded into the repo, converted into appropriately sized WebP derivatives, and registered with the same provenance/responsive-media conventions. Never hotlink external imagery at runtime. No new imagery was added in this audit.

## 2. Verified media inventory and source ownership

Git tree includes approximately **815 public image/vector assets / 144.9 MB**, including derived resolutions/alternate formats, NOT 815 distinct photographs. Snapshot counts:

| Family | Count | Notes |
|---|---:|---|
| `public/media/public/derived` | 418 | Responsive source photography; often multiple WebP widths |
| `public/media/public/protagonists` | 166 | Fleet, courier/recipient cutouts and hero-van yaw family |
| `KT_Courier_White_Van_Courier_Performance_Pack` | 72 | 36 named poses each committed in PNG and WebP |
| `public/media/public/home-cinematic` | 42 | 13 composed actor variants + route and freight variants |
| `KT_COURIER_HANDOFF_12_PNGS` | 24 | 12 states each in PNG/WebP |
| `KT_BOX_SEQUENCE_8_FRAMES` | 16 | 8 states each in PNG/WebP |
| `public/media/public/home` | 15 | Market, retail, package, road, destination photo assets |

The hero-van family includes **19 desktop + 19 mobile yaw variants**. The white-van performance pack includes **17 pickup poses, 12 delivery poses, 7 return poses**, each in PNG/WebP. The 7-state overhead route van and red freight truck have generated WebP derivatives. The existing generated manifests supply natural dimensions, visible alpha bounds and variant URLs.

**Verified actual public image inspection (all URLs rendered; observations were visual, not merely filename inference):**

| Asset (served under `/media/public/`) | Visual | Proposed role / caution |
|---|---|---|
| `protagonists/hero-van/yaw-045-desktop.webp` | Transparent white van, three-quarter front angle, extensive top air | Opening protagonist; environmental ground and shadow must be authored |
| `home-cinematic/freight/red-truck-top-red-truck-top-desktop.webp` | Transparent shallow top/angle red truck, cab right | Freight route transition; does not directly align with side-profile perspective |
| `protagonists/protagonist-truck-red-centered-hero.webp` | Transparent near-full-width side-profile tractor-trailer, cab left | Freight hero / moment of scale, avoid text overlay on full subject |
| `home/kt-home-11-route-city.webp` | Opaque street view with busy vertical city geometry | Urban network backdrop; no dense text directly over busy edges |
| `home/kt-home-09-package-detail.webp` | Opaque pink package/product still, graphic copy baked into image | Possible selected e-commerce beat; color/tonal mismatch with industrial fleet |
| `KT_BOX_SEQUENCE_8_FRAMES/box_00_open_master.webp` | Transparent square padded open box | Packing scene start |
| `KT_BOX_SEQUENCE_8_FRAMES/box_07_closed.webp` | Transparent square padded closed box | Packing scene finish |
| `KT_COURIER_HANDOFF_12_PNGS/handoff_06_weight_transfer.webp` | Transparent red-clad courier + recipient transferring box | Delivery climax; subject needs legibility, not text overlay |
| `protagonists/protagonist-courier-carry-one-parcel.webp` | Full-body red-uniform courier facing left | Parcel/service subpage or physical handoff |
| `home/kt-home-01-world-market.webp` | Opaque crowded indoor market with signage | Local-commerce context with adjacent typography |

Already authored media registries: `components/public-v3/media/kt-media-v3.ts`, `home-cinematic-assets.generated.ts`, `home-composed-actors.generated.ts`, `hero-van-sequence.generated.ts`. Preserve these metadata/asset paths unless verified replacement is better. Existing documentation at `docs/design/kt-couriers-image-sources.md` and `docs/frontend-redesign/media-authority.md` documents prior locally optimized Pexels image provenance and media policy.

**Pipeline caveat:** generation scripts read source masters from `public/media/public/images/`, while the committed runtime derivatives are elsewhere. `docs/home-cinematic-implementation-report.md` says the source masters were placed in that ignored path. Confirm that source masters are available in the execution environment before attempting regeneration; do not overwrite committed outputs based on missing masters.

**No source asset paths literally named "books" or "basket" were identified in the committed public media path list.** This does NOT establish that no such subjects exist: marketplace product photographs are served dynamically via `/api/catalog/media/[reference]` and may include them. Inventory actual published catalog imagery separately. The homepage already selects real products through `home-storefront-presentation.ts` and carries selected media into packaging.

## 3. Source-based architectural diagnosis

**Active public homepage:** `app/(public)/page.tsx` renders `components/public-v3/home/PublicHomeExperience.tsx`. It mounts an intro curtain, `PersistentActorLayer`, `PersistentHomeCinematicLayer`, `PersistentProductCarryLayer`, eight story chapters and `useHomeCinematicDirector`. Director owns multiple optical/physical actors, performance sequence indices and decoded asset preloads. There are also retired/alternative v2 and v3 scenes; prove usage before removal.

**Current chapter order:** hero → commerce → parcelization → pickup → network → freight → last-mile → finale. Keep the semantic causality while revisiting scroll length; existing desktop chapter budgets add up to 2,205 svh and mobile budgets to 2,115 svh before other content. Long scrolling is not itself creative quality.

**Global public shell:** `app/(public)/layout.tsx` wraps a fixed v3 header, `<main>`, v2 transition router, v3 footer, mobile bottom nav and add-to-cart portal. Header is 66px high, `<main>` currently has scroll margin but no ordinary top padding. This is a plausible (NOT yet runtime-proven) factor in overlay/clipping. Public motion provider excludes cart/checkout and auth routes from Lenis.

**Known live observations:** mobile hero wordmark visibly clipped at 390px; scroll-driven hero van not apparent until scrolling; live cart empty and checkout in unavailable/no-cart state, so populated checkout clipping is user-reported but not browser-verified. Direct and return-to-home horizontal behavior requires controlled reproduction.

**Service routes:** `/services` uses a v3 overview, while details are mediated through the older `ServiceDetailPage` shell with v3 authored inner views. A unified, reliable visual/motion contract is required without generic identical template cards.

## 4. Checkout and cart diagnosis (source verified)

- `components/public-v2/commerce/CheckoutExperience.tsx` is ~54K characters with **104 inline JSX style declarations**. `CartExperience.tsx` is ~21K characters and **22 inline style declarations**.
- The active checkout is a **single five-step flow**: 1 Contact, 2 Delivery address, 3 Delivery options, 4 Review order, 5 Payment. Preserve existing backend endpoints, security and pricing contracts and model the visual stepper on those states.
- `/checkout/[reference]/contact|delivery|review|payment|status|return|cancel` are current auxiliary informational/return-to-checkout pages via `CheckoutReferenceState` — NOT separate complete step implementations.
- The CSS shared by cart/checkout/shop is `components/public-v2/commerce/commerce.module.css` (~118K characters). It contains responsive selectors and shop-specific layout rules. To preserve `/shop/**`, develop scoped cart/checkout components and classes rather than broad changes to shared commerce selectors.
- Desktop cart uses product + summary columns and sticky summary; mobile cart stacks merchandise and uses a fixed CTA strip above fixed bottom nav. Checkout uses sticky desktop summary and one-column mobile layouts. Test these under actual populated data, 320/360/390/430px and keyboard viewport changes.
- `CheckoutReferenceState` emits a `<main>` inside the layout's already rendered `<main>`; correct the nested landmark when implementing the redesigned auxiliary states.
- Real return/status flows include `MarketplacePaymentReturnStatus`, `/checkout/paystack/return`, and `/order-confirmation/[publicReference]`. All must be designed with authorization and payment-state truth intact.
- Guard all monetary summaries, per-store delivery fees, estimate versus confirmed total, cash-on-delivery splits, guest verification and failed/pending payments. Do not replace real values with mock labels.

**Transaction design direction:** premium operational clarity rather than cinematic scrolling. Desktop: legible merchandise hierarchy, step content and stable summary; mobile: deliberately recomposed compact header, one-column actions, transparent delivery/cost summary, safe-area-aware primary action and resilient input keyboard behavior. State variants required: loading, empty, failed fetch, validation error, inventory change, delivery quote unavailable, payment pending/cancelled/confirmed, guest sign-in and confirmation.

## 5. Preliminary direction for visual approval — 'One shipment, changing worlds'

A product/parcel remains semantically alive from commerce through packing, pickup, road movement and handoff. The white van is the dominant physical transportation actor; freight red truck is an intentional scale shift, not a second competing hero. The existing photographs create environmental and human context. Use one high-quality static frame per chapter, and only then define motion.

A) **Arrival:** van shares believable ground and depth with environment and masthead. Preserve first-viewport primary CTAs. Remove mobile clipping.

B) **Commerce:** real catalog/category media, intentionally selected (not invented), form a product gallery; a selected photo/parcel has a credible carry into packing.

C) **Packing:** selected merchandise yields to actual 8-frame packaging sequence. Keep box and scale consistent; no floating unrelated props.

D) **Collection:** existing 17-frame van-door and parcel-load performance pack. Physically plausible occlusion and handoff, reverse-scroll reconstruction.

E) **Route:** existing aerial route photography and 7-state overhead van; represent actual process without inventing live tracking.

F) **Freight / services:** red tractor-trailer enters through an authored foreground/geometry event, with service differences expressed through real media and scale rather than arbitrary animated cards.

G) **Last mile:** existing 12-state van delivery + 12-frame human handoff, with clear transfer of the parcel and a real reading window.

H) **Resolution:** evidence of a finished delivery, then clear ways to book, track, use the marketplace and find company information; subdued Valtum Studio credit with client approval.

**Animation discipline:** GSAP ScrollTrigger for cinematic timelines; Lenis only if it improves desktop marketing navigation; Motion for local layout/control state. One motion owner per actor. Avoid unrelated hover-scale, page-transition placeholders, forced preloader replay, excessive scroll length and accidental horizontal overflow. Mobile is a distinct authored composition and reduced motion is a complete readable alternative. No Playwright-based visual acceptance per Valtum master brain.

## 6. Required next implementation sequence

1. **Asset selection board:** choose the exact existing production files per chapter and service, verify desktop/mobile crop, visible bounds, image licensing and missing source-master constraints. No new downloads by default.
2. **Checkout state/UX contract:** itemized route/API graph and exact screenshots using non-production/authorized test data. Baseline each step, complete/error/empty states and mobile keyboard focus.
3. **Viewport storyboard:** freeze source asset, typography, narrative actors and CTA composition at each chapter start/hold/handoff/end for desktop and portrait mobile. No merely textual storyboard.
4. **Motion choreography and lifecycle:** define scene ownership, next/previous route navigation, fast/reverse scroll, 30–60fps asset decoding budget and graceful fallback.
5. **Code in actual production routes on main:** first layout motion/shell isolation with protected shop regression proof, then homepage, services, tracking/quote, finally cart/checkout.
6. **Independent acceptance:** build/lint/typecheck/relevant business tests, manual desktop/mobile and reduced-motion QA, protected route regression, browser navigation, authorized sample checkout confirmation. Never self-certify 9/10 based on code or build alone.

**Status note:** This document records completed code/media reconnaissance and the next creative decisions. Populated checkout, book/basket catalog content, exact return-to-home defect and frame-by-frame mobile animation remain outstanding verification tasks; no claim is made that they were fully reproduced.
