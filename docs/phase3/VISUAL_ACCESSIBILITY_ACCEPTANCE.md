# Visual and accessibility acceptance

The application build covers the route tree, and repository browser tests include keyboard, mobile viewport, store-order accessibility and reduced-motion/brand regressions. Exact acceptance requires the current hosted browser job output and reviewed 320, 390, 768 and 1440 pixel captures, keyboard and focus checks, assistive technology, 200% zoom and a human product/design/a11y review.

No human visual review or assistive-technology review is claimed. The `visual_acceptance` gate remains `OPEN` until the exact current source has reviewed captures and a named reviewer. See the browser stages in [the certification workflow](../../.github/workflows/production-certification.yml).
