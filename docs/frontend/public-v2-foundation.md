# Public v2 foundation (R1)

## Purpose

R1 creates a reusable, isolated technical foundation for the future KT Couriers public and authentication visual system. It is infrastructure, not a final page design. Existing public pages, authentication views, headers, footers, and dashboards retain their current presentation in this phase.

## Visual-system boundary

`PublicVisualRoot` adds `data-kt-visual-system="editorial-freight-v1"`. The public route group applies it around the existing public shell, and the auth route group applies it around its existing split layout. New token and component CSS is always nested beneath that attribute.

Use `PublicVisualRoot` only on a public or auth route root. Do not add the attribute to `html`, `body`, dashboard layouts, or a shared dashboard component.

## Dashboard isolation

Dashboard code continues to consume the established `--kt-*` tokens and shared UI components. Editorial Freight variables use distinct `--kt-public-*` names and only exist inside the route-level attribute boundary. No dashboard route is nested inside either new wrapper, so dashboard presentation cannot inherit the new values.

## Token inventory

The foundation exposes these token families within the boundary:

- Canvas and surfaces: `--kt-public-canvas-*`, `--kt-public-surface-*`
- Text: `--kt-public-text-*`
- Lines: `--kt-public-line-*`
- Restrained oxide signal: `--kt-public-signal-*`
- Status families: `--kt-public-{success,warning,error,information,restricted,locked}-{text,surface,border,strong}`
- Typography: `--kt-public-font-{display,body,interface,editorial,mono}`
- Spacing: `--kt-public-space-{1,2,3,4,5,6,8,10,12,16,20,24,32}`
- Radius, shadow, and layout: `--kt-public-radius-*`, `--kt-public-shadow-*`, and `--kt-public-*-max` / gutter / section-block tokens

These values are approved prototypes for the system contract, not final page direction. Components must use semantic tokens rather than introducing page-local colour values.

## R2 font integration

R2 self-hosts Mona Sans and Newsreader from their official repositories. Their variable WOFF2 files live in `app/fonts/public/`, their OFL files live in `docs/licenses/fonts/`, and `app/fonts/public-fonts.ts` uses `next/font/local` to expose the generated source variables.

`app/(public)/layout.tsx` applies the resulting classes only at `PublicVisualRoot`. The scoped Editorial Freight tokens map Mona Sans to display, body, and interface roles, while Newsreader is available only as the editorial accent. `app/layout.tsx` and all dashboard font loading remain unchanged.

## Composition primitives

`components/public-v2/foundation/` contains server-first primitives:

- `PublicVisualRoot`: establishes the public/auth token boundary.
- `PublicContainer`: content, visual, reading, and full width/gutter variants.
- `PublicSection`: neutral rhythm, tone, `id`, and `aria-labelledby` support.
- `EditorialGrid`: four mobile, eight tablet, and twelve desktop columns.
- `ReadingColumn`: readable measure and limited local paragraph/heading rhythm.
- `DesktopOnly` and `MobileOnly`: CSS-only presentation branches.
- `ResponsiveComposition`: an explicit group for decorative or editorial alternatives.

Example:

```tsx
<PublicSection aria-labelledby="service-heading" tone="secondary">
  <PublicContainer variant="content">
    <EditorialGrid>
      <ReadingColumn>
        <h2 id="service-heading">...</h2>
        <p>...</p>
      </ReadingColumn>
    </EditorialGrid>
  </PublicContainer>
</PublicSection>
```

`DesktopOnly`, `MobileOnly`, and `ResponsiveComposition` are only for materially different presentational/editorial treatments. CSS `display: none` removes the hidden branch from the accessibility tree. Never duplicate forms, form field IDs, checkout controls, authentication controls, mutations, or source-backed interactive trees across viewport branches.

## Art-directed images

`ArtDirectedImage` takes mandatory desktop, tablet, and mobile local sources plus explicit intrinsic `width`, `height`, and `sizes`. It uses `getImageProps` with a native `picture` element so the browser selects the approved art direction while Next keeps its image optimisation contract.

- Use only a static import or a root-relative local path.
- Provide meaningful `alt` text, or use `decorative` with no alt text.
- The component throws in development if meaningful and decorative usage is ambiguous.
- Set `priority` only for one known LCP asset. The native `picture` implementation uses eager loading and `fetchpriority="high"`, because a Next preload link cannot select all art-directed source branches. It cannot be combined with `loading` or `fetchPriority`.
- Provide an `aspectRatio` only when the intended crop needs a fixed frame. Otherwise, intrinsic dimensions reserve layout space.

R2 adds provisional local derivatives and a page-specific registry in `lib/public-assets/homepage-media.ts`. Their complete provenance and review record is in `docs/frontend/r2-provisional-media.md`; they are not production-approved entries in the R1 production asset manifest.

## Cutout images

`CutoutImage` supports an approved transparent AVIF, WebP, or PNG with intrinsic dimensions, responsive `sizes`, object positioning, optional neutral ground shadow, and decorative-image handling. It has no truck asset, animation, parallax, floating treatment, coloured glow, or reflection. It is the future truck foundation only.

## Accessible dialogs

`AccessibleDialog` is a public-only, controlled native `<dialog>` foundation. It requires a visible title or an `ariaLabel`, supplies a visible close button, supports optional descriptions and `aria-describedby`, and uses native modal focus containment.

It also:

- asks the parent to close on Escape through `onOpenChange(false)`;
- restores focus to the opening control when the controlled state closes;
- locks document scrolling without losing the current scroll position;
- prevents background interaction through `showModal()`;
- does not close for arbitrary internal clicks;
- permits backdrop click closing only with `closeOnBackdropClick`.

Use one dialog at a time. Avoid nested dialogs and do not replace `components/ui/Modal.tsx` with this component in R1.

## Mobile sheets

`MobileSheet` reuses `AccessibleDialog`: below 768px it becomes a bottom sheet with safe-area bottom padding, while larger screens retain the neutral dialog treatment. R2 uses it for the public mobile navigation, with no drag gesture or swipe-to-dismiss implementation.

## Reduced motion

Existing global reduced-motion support is preserved. Editorial Freight additionally scopes `scroll-behavior: auto` to its route boundary when users request reduced motion. `usePrefersReducedMotion` is a client-only hook that is SSR-safe, subscribes to `matchMedia` changes, and removes its listener on cleanup. Use it only when a new public primitive genuinely needs a JavaScript motion decision.

## Asset-manifest workflow

`lib/public-assets/manifest.ts` defines the evidence required for future imagery: provenance, creator, licence, original dimensions and hash, release status, approved uses, alt intent, focal point, colour treatment, derivatives, and approval status.

The exported manifest is deliberately empty. Add no record until the asset has a real source, licence evidence, local derivative path, and approval status. An empty approved collection is valid; no remote URL is an acquired asset merely because it is available online.

## Prohibited patterns

- No gradients, glass surfaces, coloured shadows, or glow.
- No ivory, beige, cream, purple public token family, or decorative rainbow use.
- No stock, placeholder, generated, or invented imagery/data.
- No global restyling of headings, controls, dashboards, or shared Modal/Drawer components.
- No animation, carousel, icon, component-library, or font package additions.
- No viewport JavaScript detection or duplicated critical interactive content.

## Known limitations

- Public Mona Sans and Newsreader files are installed for the public route group only.
- R2 photography is provisional and documented, not production-approved.
- GSAP is not installed.
- The truck and its scroll-linked narrative are not implemented.
- Homepage interaction is limited to native scrollers, sticky-header state, and the existing mobile sheet; auth presentation and marketplace authority remain unchanged.
- The native dialog foundation assumes the application’s modern supported-browser baseline.

## R3 native scrollers

`components/public-v2/interactions/` provides the deliberately small client boundary for homepage rails:

- `NativeScroller` renders a focusable native overflow viewport around a real list. The list and its image/link content remain server-rendered and usable before hydration.
- `ScrollerControls` adds contextual previous/next buttons, a count and/or progress bar, and a polite announcement only after explicit button use.
- `useNativeScroller` uses one `IntersectionObserver` and one `ResizeObserver` per rail. Scroll events schedule a centre-distance fallback in `requestAnimationFrame`, and React state changes only when the selected item changes.
- The viewport supports Home, End, ArrowLeft, and ArrowRight when the viewport itself has focus. It deliberately leaves keys alone inside nested links and controls.
- `usePrefersReducedMotion` switches programmatic movement to `auto`; CSS suppresses selection transforms and icon transitions for the same preference.

The documentary rail, service spectrum, and marketplace preview intentionally share this behavioural core while retaining different track sizing, snap alignment, and visual treatment. There is no autoplay, looping, custom dragging, remote state, or URL state.

`HeaderScrollState` is a separate, small client observer boundary. A sentinel changes only the sticky header’s local `data-scrolled` state; it does not add a global scroll listener or alter document/body styling.

Public tracking language remains account-based: there is no anonymous order lookup. The current login flow has no verified return-path mechanism, so anonymous calls to action link to `/account/orders` and let its existing guard remain authoritative.

## Next phase boundary

R4 adds the static media art-direction system documented in [r4-media-art-direction.md](./r4-media-art-direction.md): a local derivative pipeline, responsive local media variants, semantic editorial frames, decorative route geometry, and a static hero depth model. The original R2 hero vehicle remains an opaque, provisional rectangular stage image; `CutoutImage` is intentionally preserved for a future professionally masked source.

R5 — GSAP ScrollTrigger Hero Journey and Cinematic Motion System
