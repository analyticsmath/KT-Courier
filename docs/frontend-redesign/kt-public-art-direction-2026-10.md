# KT Couriers — Phase 1 Creative Storyboard & Transactional Art Direction

**18 October 2026 | Main branch | Valtum Studio | Authoritative asset-first direction**

This document operationalizes the client brief and the superseding Valtum Studio creative brain. It describes deliberate viewport compositions rather than generic sections. **Static production-route compositions and live manual visual acceptance are still mandatory before declaring final award-level quality.**

## Creative thesis: ONE PARCEL / MANY WORLDS

The visitor follows a real purchasable product or shipment as it changes custody: discover → select → pack → collect → move → hand over. The white KT van is the mechanical protagonist, the parcel is the continuity object, and the red freight truck appears only as a carefully motivated shift to the scale of freight services. Real catalog and operational source truth takes precedence over invented claims.

**Brand material:** paper/stock white, carbon, authentic urban/retail photography, a disciplined KT-red signal, cargo-material textures, directional linework. Existing `Schibsted Grotesk` public typography. No rotating catalog of unrelated hero photos and no new image downloads by default. Never redraw the official owner-supplied SVG brand mark.

**Forbidden grammar:** generic intro eyebrow, numbered stepper as entire experience, generic floating card grid, repeated scroll-to-zoom trick, indiscriminate glassy panels, decorative sparkles, repetitive gradient, continuous infinite animation without purpose. No typography that is clipped by accident. Useful tracking data is never animated as invented delivery status.

## Desktop viewport composition board (1440 × 900 reference)

### H01 — On the street / entry, reading state

- **Frame silhouette:** masthead 66px; canvas architectural off-white. Giant KT letterforms as a real brand object in upper region, not allowed to clip. Main copy uses 2 lines maximum with functional Shop / Send buttons in a reachable region.
- **Primary actor:** `/media/public/protagonists/hero-van/yaw-000-desktop.webp` through `yaw-090-desktop.webp`; a single van path with baseline preserved by authoritative bounds.
- **Image context:** `/media/public/derived/photo-prep-maboneng-fleet-depot-1440w.webp` or `/media/public/home/kt-home-11-route-city.webp` only after visual angle/lighting review; prefer physically plausible ground over scenic filler. Environmental photograph must not compete with white vehicle or its silhouette.
- **Motion:** opening settled state is fully legible immediately; rotation/approach driven by deterministic scroll; long read hold at middle; source and current actor never occupy conflicting transform owners. Reverse input reconstructs poses; return from another route does not replay an obstructive curtain.

### H02 — Commerce as real objects, not a grid

- **Frame silhouette:** an editorial landscape of featured published category media, with one active product dominant and other products arranged on identifiable physical planes. Photography controls crop and type placement.
- **Assets:** real `/api/catalog/media/{reference}` data using `home-storefront-presentation.ts`, with fallback route to /shop if no published products; `/media/public/home/kt-home-01-world-market.webp` establishes local-market context.
- **Motion:** native horizontal touch browsing on mobile; on desktop one controlled media field traversal, then selected object is carried into packing. Product click/keyboard selection must work outside animation assumptions.
- **Truth:** no invented products, book images or basket mockups; verify catalog assets by actual references before selection.

### H03 — The box and custody transfer

- **Frame silhouette:** selected product image moves into a packaging stage with a single foreground box occupying the center-right; caption and process context occupy quieter left.
- **Assets:** exact `KT_BOX_SEQUENCE_8_FRAMES/box_00...box_07` WebPs; authored source dimensions and alpha. `photo-prep-artisan-box-assembly-960w.webp` documentary context, visually separate from the transparent box.
- **Motion:** selected product is occluded *by* the box; flaps then close using correct sequence; label transforms into a route object. Preserve a clear reading hold. No teleport and no transient transparent/undecoded frames.

### H04 — Collection, pickup and transport

- **Frame silhouette:** van and courier at shared road baseline with true foreground/occlusion and readable empty space. Loading is physically credible; the parcel is not simultaneously visible in courier hand and inside vehicle.
- **Assets:** 17-step pickup, seven route-van views, real ground/road context from `photo-route-gauteng-transit-corridor-1920w.webp` and authored SVG directional network geometry.
- **Motion:** vehicle stops before door opens; courier loads box; door closes before vehicle departure; camera moves to overhead route perspective only under a real occlusion/takeover event.

### H05 — One network, different scale

- **Frame silhouette:** street corridor shifts to map/route panorama, then a freight-scale interlude. No redundant photographic gallery.
- **Assets:** red truck side `protagonist-truck-red-centered-hero.webp`, generated top-down red truck `red-truck-top-red-truck-top-desktop.webp`, and local freight staging photograph.
- **Motion:** trailer/vehicle mass performs the transition. Perspective changes only under a deliberate camera cut, not seamless fictional morph from opposite-facing profiles.
- **Copy:** service descriptions and location statements must be sourced from `lib/public-services/service-page-registry`.

### H06 — Last mile / the delivery payoff

- **Frame silhouette:** a human-scale parcel handoff takes most of the viewport. The parcel is the focal element between courier and recipient, against quiet backdrop.
- **Assets:** 12 delivery frames, 12 handoff frames, seven return frames, plus existing full-body composed actors as needed.
- **Motion:** approach → door → courier → person → first contact → weight transfer → release → withdrawal → departure. Freeze on shared weight transfer for comprehension; reverse is deterministic.
- **Resolution:** no misleading 'Delivered' status sourced from real user data; this is explicitly an editorial process illustration. Clear booking and tracking paths become available when the scene ends.

### H07 — Editorial service threshold / finale

- **Frame silhouette:** route re-enters abstract quiet carbon/white surfaces, resolves on KT mark and a considered network of useful links. The homepage ends only once.
- **Visual function:** make people ready to act after story. Author's credit `Made by Valtum Studio` is secondary and client-approved.

## Mobile viewport composition (390 × 844 reference, recompose for 320–430px)

- **M01 Hero:** masthead + brand title safely contained (max text area ~362px). Van visible without waiting for a 260svh scroll; actionable text and Shop/Send controls above the 5-link bottom nav. Visual intent cannot depend on hover. Dynamic viewport height and safe area respected. No horizontal document overflow.
- **M02 Commerce:** one hero-like product, next/previous edge peek; touch-native rail with readable real product text. Never force-scroll the user against a giant pinned gallery.
- **M03 Packing:** box fully visible at mobile scale, handoff readable with short, finite scroll; caption outside crowded imaging.
- **M04 Movement:** simplified 2D route plus selected vehicle poses, native scroll. No hover/cursor mechanics.
- **M05 Delivery:** both full figures fit portrait without cutting heads/hands/parcel; transfer frame includes separate copy.
- **M06 Finale:** concise CTA and links clear fixed bottom navigation; no excessive pinned footer.

### Motion timing / ownership contract

1. Only one controller writes to each physical actor and backdrop in a chapter.
2. Every chapter defines enter/establish/hold/exit windows. Handoffs share an overlapping ownership window, never two simultaneous independent transforms.
3. Reverse scroll reconstruction yields valid same-world states. Fast scrolling may skip microstates but cannot expose missing texture or mismatched asset stage.
4. Preload only near-term responsive WebPs and retain last decoded frame; respect reduced motion, tablet/touch and unmount cleanup.
5. Page transitions must be real geometry or modest motion—no invented fly-across references. Protected shop is transition-quiet.

## Checkout UX master composition — first-class mobile art direction

Cart and checkout are not cinematic scroll chapters; they are trust/utility workspaces. Use confident KT brand materials, quiet purposeful separators and generous typography. Animated content must never compete with price, input focus or Paystack redirect.

**Desktop cart:** compact count/header; grouped store merchandise in wide column; stable sticky summary, supporting costs and primary Checkout action. Product thumbnails dominate more than cards.

**Mobile cart (390 × 844):** 66px header clearance, restrained 'Shopping bag' title, grouped store identity, 88–104px product thumbnails, product names/prices readable in two-line rhythm, quantity controls and remove actions with 44px+ targets. A single bottom Checkout total bar above KT's existing mobile navigation, not overlapping it. Cart scroll/content must leave room for both bars.

**Checkout real state machine:** contact → delivery address → delivery choice → review → Paystack. At every step, the layout must expose current progress, real order reference, focusable current heading, one primary action, clear errors and stable running costs. Completed steps are editable; inaccessible future steps are not fictitiously interactive.

**Desktop checkout:** 2-column composition: spacious left form stages, narrow sticky order summary with real store groups, delivery/tax and payment splits. Distinguish estimated quote from confirmed charges.

**Mobile checkout:** 66px fixed masthead clearance, compact ordered progress bar, one active step with no horizontal overflow, 44px+ fields, 16px+ text inputs (avoid iOS autozoom), full-width primary action, and naturally flowing order summary. Bottom app navigation is excluded from checkout. Keyboard opening must not obscure Save/Continue or create trapped scroll. No sticky transactional CTA if the keyboard/viewport geometry makes it unsafe.

**States to design and test:** empty cart, loading, multi-store populated, quantity update, invalid address/phone/email, delivery changes and fee recalculation, out-of-stock/rate errors, estimated vs committed total, split digital/COD, pending/failed/confirmed Paystack, guest confirmation/authorization, order-confirmation and return/cancel/status routes.

**Privacy and logic contract:** preserve exact checkout APIs, token verification and permission checks, statuses, ZAR formatting, totals and financial invariants. The existing `/checkout/[reference]/contact` etc are informational return helpers, *not* separate transactional form steps. No fictional checkout success state.

## Accept/reject gates

- **Creative:** independent live visual assessment; premium without ordinary card/eyebrow grammar; typography/human/vehicle subjects legible at intermediate scroll states.
- **Behavioral:** robust homepage return, direct links, fast/reverse scroll, menu open/close/keyboard and preservation of protected shop and dashboard routes.
- **Transactional:** typecheck/build/lint, cart guest/auth flows, all checkout steps with authorized non-production test data; no unrelated backend edits.
- **Responsive:** 320/360/390/430 phones, tablet, 1280/1440/1920 desktops, reduced-motion and coarse pointer.
- **Limitations:** this contract does not claim authenticated checkout QA or independent 9/10 acceptance. Before full release, verify real rendered compositions, not only code or snapshot files.

## Source-of-truth files

- `docs/frontend-redesign/kt-2026-10-asset-first-public-redesign-contract.md`
- `components/public-v3/home/PublicHomeExperience.tsx`
- `components/public-v3/home/director/useHomeCinematicDirector.ts`
- `components/public-v3/home/director/home-chapters.ts`
- `components/public-v3/home/director/home-beats.ts`
- `components/public-v3/home/data/home-storefront-presentation.ts`
- `components/public-v3/media/kt-media-v3.ts`
- `components/public-v2/commerce/CartExperience.tsx`
- `components/public-v2/commerce/CheckoutExperience.tsx`
- `lib/marketplace-checkout/**`
