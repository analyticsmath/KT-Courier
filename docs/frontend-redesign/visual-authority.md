# Visual authority

The public signature system is intentionally spare: quiet near-white surfaces, near-black action surfaces, large Mona Sans display type, and the owner-supplied KT Couriers mark. It applies only within `[data-kt-signature="v2"]`, so protected areas retain their established visual contracts.

## Rules

- Use semantic tokens, never a literal brand colour inside a scene.
- Treat blue as direction or a selected state; reserve red for short markers, sequence numbers, and small points of emphasis.
- Keep the primary action near-black. Do not turn every link or button blue.
- Build sections as image, type, line, and surface compositions rather than repeated rounded-card grids.
- Use the actual logo asset at `/images/kt-couriers/brand/logo.svg`; do not redraw or approximate it.

The opening, handoff, network, coverage, commerce bridge, and closing scenes in `SignatureHomepage.tsx` are the reference implementation.
