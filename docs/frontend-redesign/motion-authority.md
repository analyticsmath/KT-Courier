# Motion authority

`SignatureHomepageMotion.tsx` is the only new public-home motion boundary. It uses `@gsap/react`'s scoped lifecycle, GSAP context cleanup, and `ScrollTrigger`; no global smooth scroller, scroll proxy, or React scroll-state loop is introduced.

## Meaningful sequences

- Opening: the environment, hero, parcel, and copy settle into the route composition.
- Handoff: desktop scroll advances an illustrative delivery-state story. It is explicitly labelled as a product story, not live tracking.
- Media field: desktop scroll carries the image field across the page; narrow layouts keep native horizontal browsing.
- Network: service media and links reveal as a linked system, not as generic staggered cards.

At `prefers-reduced-motion: reduce`, final readable states render without pinned or scrubbed motion. Narrow layouts never receive the desktop pinned handoff treatment.
