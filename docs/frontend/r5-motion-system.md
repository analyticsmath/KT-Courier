# R5 homepage motion system

## Purpose and current constraint

R5 adds a small progressive-enhancement motion layer to the public homepage. The static R4 page remains authoritative: headings, links, route graphics, images, and native scrollers are fully rendered before the controller hydrates.

The present hero treatment is explicitly `BOUNDED_CAMERA`. `R4-HERO-TRUCK-FRAME` is a provisional opaque, rear-facing loading-dock photograph. It remains within its bordered editorial frame throughout the page and never crosses into the documentary section. R5 does not claim to complete the final production vehicle animation.

True vehicle traversal is deferred because it needs a licensed, professionally masked three-quarter vehicle with clean edges and a reviewed alpha channel. A future reviewed update can set `motionTreatment: "ISOLATED_VEHICLE"` and add its choreography deliberately; the R5 controller intentionally does not implement that path.

## Dependency and boundary

The user-authorized dependency is `gsap@3.15.0`, including `ScrollTrigger` from the same package. `HomepageMotionController` is the only client boundary and explicitly registers that plugin after hydration. No GSAP import is made by a route, layout, server component, media registry, or dashboard module.

`HomepageV2` remains server-rendered and passes only the stable root ID and the explicit media treatment to the zero-visual controller. The controller owns no page copy, media paths, route data, backend data, or React animation state.

## Implementation map

| File area | Existing responsibility | R5 responsibility | Ownership and risk |
| --- | --- | --- | --- |
| `HomepageV2` | Server-rendered homepage composition | Supplies the stable homepage root and inert controller marker | Server markup; no rail or content risk |
| `HeroScene` and home CSS | Static R4 hero composition | Exposes the pin stage and handoff attributes; preserves local clipping and custom-property transforms | Server markup; GSAP owns only the named layer state |
| `DocumentaryRail` | Server-rendered, native-overflow documentary rail | Adds the normal-flow entry anchor and introduction reveal targets | Server markup; rail viewport, track, items, controls, and keyboard interactions are excluded |
| `motion/*` | New narrow client boundary | Selector validation, matching, timelines, refresh coordination, and cleanup | Client-only; one owner reverts all R5 state |
| Hero media registry | Provisional R4 image metadata | Records `motionTreatment: "BOUNDED_CAMERA"` | Server-safe data; future treatment remains explicit |
| `RouteLine` | Decorative SVG route geometry | Accepts a generic reveal attribute without changing route semantics | Server markup; route animation is stroke progress only |

## Selector and transform contract

The homepage root is `data-kt-homepage="v2"`; the hero scene, stage, layers, anchors, route segments, documentary entry, and reveal targets use stable `data-kt-*` attributes defined in `motion-selectors.ts`. CSS-module names are not the animation API.

Transform ownership is deliberately singular:

- Environment: its CSS custom-property translate/scale composition.
- Hero route: its normalized stroke progress only.
- Shadow: its own translate, horizontal scale, and opacity.
- Bounded truck frame: its own translate, scale, and sub-degree rotation.
- Copy: a small GSAP `y` offset plus its opacity variable.
- Command dock: a sibling of the moving copy block, static and actionable.

The hero root and pin stage are never animated. The stage has a local stacking context, clips its photographic layers inside the hero, and stays below the sticky public header. The header keeps its existing level of `40`; no extreme z-index is introduced.

## Responsive behavior

Desktop requires at least `1120px` width, `680px` height, and `prefers-reduced-motion: no-preference`. It creates exactly one pinned timeline on the inner hero stage, from `top top`, with `pinSpacing: true`, `scrub: 0.65`, and an invalidation-safe distance of `max(620px, min(1100px, 0.96 × viewport height))`.

The labelled desktop story is `arrival`, `routeAwakens`, `cameraTracks`, `handoff`, and `release`. It draws the decorative hero route once, applies a restrained camera treatment to the existing frames, keeps the shadow aligned, and ends with a small continuation cue. Reverse scrolling restores the initial camera state. The route is decorative only: it is hidden from assistive technology and does not represent geography, live location, or tracking.

Tablet applies from `768px` when the desktop eligibility test fails. It uses one short scrubbed trigger with no pin, no long scroll distance, and a smaller depth/route progression. Mobile has no R5 trigger, no pin, and no scrubbed truck journey.

When `prefers-reduced-motion: reduce` is active, the matching conditions create no hero timeline, route-drawing timeline, or secondary reveal. A preference change while the page is open reverts the active match-media branch, removes inline animated state and `data-kt-motion-ready`, and restores the complete static R4 composition.

## Progressive enhancement, refresh, and cleanup

There is no server-rendered hidden state. Without JavaScript, on a setup failure, and before motion initialization, the finished static route is visible and the document height remains normal.

The controller validates every required hero layer before it creates motion. It uses a scoped `gsap.context()` and one `gsap.matchMedia()` owner. Each condition cleanup stops the refresh coordinator and clears the ready attribute; the component cleanup reverts match media first, then its GSAP context. This is safe under App Router development Strict Mode and leaves no R5 pin spacer, transform, listener, or animation-owned frame behind.

For active desktop or tablet motion only, one coalesced refresh coordinator requests a safe refresh after the initial layout, the priority truck image load/decode, and public-font settlement. It cancels its animation frame and image listener on cleanup. No lower-page image is preloaded and no rail image drives refreshes.

## Secondary scenes, interaction, and performance

The only secondary reveal is the documentary introduction heading and decorative route line. It plays once when that normal-flow section enters view. The native documentary rail viewport, track, controls, progress, list items, keyboard handling, and active-index logic are untouched.

No scroll, wheel, touch, pointer, or programmatic-scroll handler is added. There is one principal scrubbed timeline, one non-pinned tablet alternative, and one documentary reveal trigger in an active desktop/tablet branch. `will-change` is assigned only to the active hero targets by GSAP and is removed on context revert.

Hero actions remain enabled throughout motion. The system does not move focus, alter ARIA state during scroll, intercept keyboard scrolling, change native rail behavior, or use overlays. The existing mobile menu and sticky header are not part of the motion tree. At 200% zoom or a short desktop viewport, the layout eligibility naturally selects the non-pinned tablet branch.

## Explicit exclusions and known limitations

R5 does not use ScrollSmoother, `normalizeScroll`, `scrollerProxy`, scroll snapping through ScrollTrigger, global wheel interception, global smooth scrolling, animation-progress React state, a carousel, canvas, WebGL, SVG morphing, text splitting, or an animation package beyond GSAP. It adds no fake tracking, data, coverage, or final-media claim.

The repository has pre-existing global smooth-scroll declarations outside the R5 file boundary; R5 neither uses nor changes them. The existing `.next/dev/types` TypeScript state is also outside R5 scope, so complete type-check success is not claimed.

## Manual visual review

Review at 320, 390, 768, 834, 1024, 1120, 1280, 1440, and 1920 pixels, plus short and tall desktop heights. Check forward, reverse, rapid, and deep-page scrolling; resize after load; wait for fonts and hero-media settlement; switch reduced motion while open; and inspect 200% zoom and keyboard-only flow.

Confirm the mobile menu and each native rail remain independently usable; quote and tracking actions remain clickable; the truck frame and shadow stay inside the hero; the route draws only as decorative geometry; hero entry/release creates no page-level overflow or duplicate pin spacer; JavaScript-disabled markup remains complete; and the console remains clean.

## Next phase

R6 — Public Services Architecture and Eleven Service Pages
