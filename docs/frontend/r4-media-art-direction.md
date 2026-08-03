# R4 homepage media art direction

R4 keeps the R3 native-scroll and header interactions unchanged. It refines the homepage's static media composition and provides a documented hand-off for the R5 motion implementation. Every asset remains provisional; none is final or production-approved.

## Review method

The R2 local exports, their original provenance in [the R2 ledger](./r2-provisional-media.md), rendered dimensions, byte weights, crop utility, visible signage/brands, people, and section role were reviewed. Scores below use `5` for strong and `1` for poor. `U` is urgency, not a quality score.

| ID | L | R | S | C | D | M | K | B | P | T | F | U | Disposition and crop direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R2-HERO-01 | 5 | 5 | 1 | 2 | 2 | 1 | 2 | 2 | 5 | 4 | 1 | High | **Reject as cutout.** Retain only as a bounded loading-dock frame; rear view, printed vehicle text, and no front/side profile prevent signature-vehicle approval. |
| R2-HERO-02 | 5 | 5 | 1 | 3 | 4 | 2 | 2 | 3 | 3 | 4 | 1 | High | Retire from hero. Johannesburg provenance is useful, but roadworks undermine the controlled transport environment. |
| R2-HERO-03 | 5 | 4 | 2 | 2 | 2 | 3 | 1 | 1 | 2 | 3 | 1 | High | Retire from hero. Dense market signage and non-local visual context make it unsuitable. |
| R2-HERO-04 | 5 | 4 | 3 | 4 | 3 | 3 | 3 | 4 | 3 | 3 | 2 | High | Keep as small parcel-detail/closing media; crop tightly to hands and parcel and replace for production. |
| R2-DOC-01 | 5 | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 3 | 4 | 3 | Medium | Keep as the preparation portrait; preserve hands and boxes. |
| R2-DOC-02 | 5 | 4 | 3 | 4 | 4 | 3 | 3 | 4 | 3 | 4 | 2 | Medium | Keep as the driver-arrival context; it is generic stock styling, not a hero vehicle. |
| R2-DOC-03 | 5 | 4 | 4 | 4 | 4 | 3 | 3 | 4 | 3 | 4 | 2 | High | Keep only with the document cropped out of legibility. |
| R2-DOC-04 | 5 | 4 | 4 | 4 | 4 | 3 | 3 | 3 | 4 | 4 | 3 | Medium | Keep as the wide transit interruption; cab and road must remain visible. |
| R2-DOC-05 | 5 | 4 | 3 | 4 | 3 | 3 | 3 | 4 | 3 | 4 | 2 | Medium | Keep as the tracking close-up; crop to the device and hands, never claim a live order. |
| R2-DOC-06 | 5 | 4 | 4 | 4 | 4 | 3 | 3 | 4 | 2 | 4 | 3 | Medium | Keep as the concluding handoff; replace later with a less staged local scene. |
| R2-SVC-01 | 5 | 4 | 4 | 3 | 4 | 3 | 3 | 1 | 4 | 4 | 1 | High | Keep provisionally only with the far-right vehicle mark out of crop; source a replacement before production. |
| R2-SVC-02 | 5 | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 3 | 4 | 3 | Medium | Keep in the local-delivery role; grocery bags remain the focal action. |
| R2-SVC-03 | 5 | 4 | 4 | 4 | 4 | 3 | 3 | 4 | 4 | 4 | 3 | Medium | Keep for parcels/documents; central cargo crop remains useful. |
| R2-SVC-04 | 5 | 4 | 4 | 3 | 3 | 4 | 3 | 2 | 3 | 3 | 1 | High | Keep provisionally only with the bag mark excluded; source a brand-free freight replacement. |
| R2-NET-01 | 5 | 4 | 4 | 4 | 4 | 3 | 3 | 4 | 2 | 4 | 3 | Medium | Keep as wide store preparation; no identity or testimonial claim is attached. |
| R2-NET-02 | 5 | 4 | 3 | 4 | 3 | 4 | 3 | 4 | 2 | 4 | 2 | Medium | Keep as the tall driver operation frame; replace with a less generic local candidate later. |
| R2-MKT-01 | 5 | 4 | 3 | 4 | 3 | 4 | 3 | 2 | 2 | 4 | 2 | Medium | Keep as editorial storefront only; never present it as live inventory or a named merchant. |
| R2-MKT-02 | 5 | 4 | 4 | 4 | 4 | 3 | 3 | 4 | 3 | 4 | 3 | Medium | Keep as the fulfilment frame; it communicates preparation without fabricated commerce data. |
| R2-COV-01 | 5 | 5 | 5 | 5 | 5 | 4 | 4 | 4 | 3 | 4 | 4 | Low | Keep. This is the strongest local commercial-road asset; use only as context, never as an availability map. |

Legend: `L` legal provenance, `R` source resolution, `S` subject suitability, `C` crop flexibility, `D` desktop usefulness, `M` mobile usefulness, `K` campaign consistency, `B` visible-brand cleanliness, `P` people/release risk, `T` technical quality, `F` final-production potential, `U` replacement urgency.

## R4 selection and quality-gate result

The original hero truck does **not** pass the signature-truck quality gate. It is an opaque rear loading-dock photograph: it has no three-quarter front view, no complete cab/mirror/wheel read, carries printed vehicle text, and cannot receive a credible local alpha mask. R4 therefore does not simulate a cutout. `CutoutImage` remains available for a future approved, manually masked truck; the current hero uses a visibly rectangular editorial frame and an independent neutral stage shadow.

An official-source search also rejected these candidate photographs: [Unsplash box truck by Matthew LeJune](https://unsplash.com/photos/white-box-truck-Bd8K792pEro) (visible `HUB` branding) and [Pexels delivery truck by NGUYỄN THÀNH NHƠN](https://www.pexels.com/photo/white-delivery-truck-on-urban-road-in-daylight-31049388/) (prominent livery, signage, and non-local setting). Neither candidate was added to the repository.

The R4 environment instead derives from the existing, documented Johannesburg R2-COV-01 source. This strengthens local context without inventing locations or expanding coverage claims.

## R4 derivative ledger

The script at `scripts/public-v2/process-r4-media.mjs` is deterministic: it validates paths, uses the focal points encoded in the script, avoids upscaling, strips non-essential metadata through a fresh WebP encode, and writes only to `public/images/kt-couriers/provisional/r4/`. It does not download, generate, mask, or overwrite source media.

| ID | Source master/export | Output | Dimensions | Size | SHA-256 | Crop intent |
| --- | --- | --- | --- | --- | --- | --- |
| <a id="r4-hero-truck-frame"></a>R4-HERO-TRUCK-FRAME | R2-HERO-01 | `hero/r4-truck-desktop.webp` | 1600×1067 | 71,130 B | `d418ce44ee905fad8e468af3d7c7a156298701367a60bb69eecd1f4b0218fcef` | Desktop loading-dock frame, original 3:2 composition. |
| R4-HERO-TRUCK-FRAME | R2-HERO-01 | `hero/r4-truck-tablet.webp` | 1320×990 | 60,986 B | `604eca637e4d612e03847003d15bff62f4d7ab24c85124a9bcbb4fe2e1a6f48b` | 4:3 stage crop retaining truck and doorway. |
| R4-HERO-TRUCK-FRAME | R2-HERO-01 | `hero/r4-truck-mobile.webp` | 920×1100 | 61,136 B | `fa81dd66d0c3081eafed9da67873d2e8fb0deb40b2546430b5bcb3b8862ee303` | Vertical crop with the vehicle as the immediate subject. |
| <a id="r4-hero-environment"></a>R4-HERO-ENVIRONMENT | R2-COV-01 | `hero/r4-environment-desktop.webp` | 2000×1000 | 450,536 B | `9b63f10f645778ca4676feb492e5fa6c32990ec344a65d0465b9d95d653a2055` | Wide Johannesburg commercial-road plane. |
| R4-HERO-ENVIRONMENT | R2-COV-01 | `hero/r4-environment-tablet.webp` | 1500×1000 | 278,440 B | `6c60f03e5ec9546bea3cf8a35cf0663cf2b4b4fb7fa1f7cc36efabf38ae177ba` | Landscape city-road crop. |
| R4-HERO-ENVIRONMENT | R2-COV-01 | `hero/r4-environment-mobile.webp` | 920×1120 | 207,974 B | `524039a4f7dffc307746f8a861b48a7f7b289eee739b3d670923c36f8fe1f1ea` | Tall road-and-building geometry. |
| <a id="r4-coverage"></a>R4-COV-01 | R2-COV-01 | `coverage/r4-coverage-mobile.webp` | 960×1040 | 202,120 B | `3bf9ca616d261aca58029a023276ff55f7be98ea64d9ef7d9c638415a89ff23b` | Near-square road crop for narrow viewports. |

## Static composition and R5 hand-off

- `RouteLine`, `RouteSegment`, and `RouteCheckpoint` are decorative SVG narrative geometry. They carry no coordinates, labels, coverage claims, or live-tracking meaning.
- The hero establishes a local layer scale: environment, route, independent shadow, bounded truck frame, copy, and command dock. It exposes `hero-start` and `hero-exit` anchors plus the documented R5 motion layer attributes and static CSS variables.
- R5 may apply a restrained `BOUNDED_CAMERA` treatment to those existing layers, but the opaque frame remains inside this hero stage. It never becomes an isolated vehicle or crosses into another section.
- The documentary sequence now has a static narrative route, retains its native scroller semantics, and gives transit a wider editorial frame. The service deck has static, restrained desktop offsets only; mobile remains flat.
- Coverage uses source-backed region data and its existing contact fallback. The image is context only, not a map.
- Marketplace, operational control, FAQ, closing, footer, tracking copy, and all R3 native-scroller behaviour retain their factual and interaction boundaries.

## Production hold points

1. Commission or license a neutral, medium-duty enclosed KT vehicle photographed in a clean three-quarter front view; create a professional manual alpha mask before enabling the cutout treatment.
2. Replace high-urgency R2 service and documentary candidates before final campaign approval.
3. Re-review model/release and competing-brand risk against the final selected crops.
