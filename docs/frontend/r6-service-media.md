# R6 service media ledger

R6 sourced, downloaded, generated, and reprocessed **no new media**. All entries below are reuse mappings from the existing local R2/R4 provisional campaign library. Their source URLs, photographer, licence, download date, source dimensions, local export dimensions, byte sizes, SHA-256 hashes, recognizable-person review, and original crop review remain in the [R2 provisional media ledger](./r2-provisional-media.md); R4 derivative information remains in [R4 media art direction](./r4-media-art-direction.md).

The R6 application has no source URLs in components and references local files only through `lib/public-assets/service-media.ts`. None of these assets is final or production-approved. `PROVISIONAL_R6` is not used because R6 introduced no newly sourced or reprocessed asset.

| R6 asset ID | Local export / dimensions / format | Source ledger status | R6 usages | Crop and visible-brand hold | Recognizable-person hold | Replacement priority |
| --- | --- | --- | --- | --- | --- | --- |
| `parcel-detail` | `r2/hero/r2-hero-04-parcel-detail.webp` · 1600×1067 · WebP | R2-HERO-04 · `PROVISIONAL_R2` | overview, parcel, pricing | Hands/parcel only; keep paper content unreadable | Incidental person | High |
| `parcel-handoff` | `r2/documentary/r2-doc-03-pickup.webp` · 1600×1068 · WebP | R2-DOC-03 · `PROVISIONAL_R2` | parcel, pharmacy | Do not expose document/device details as proof or live status | Two hands; no identity claim | High |
| `food-grocery-preparation` | `r2/services/r2-svc-02-local-delivery.webp` · 1600×2400 · WebP | R2-SVC-02 · `PROVISIONAL_R2` | food, grocery | Grocery preparation context only; no food-safety or named-retailer implication | One courier | Medium |
| `business-dispatch` | `r2/services/r2-svc-01-business.webp` · 1600×1067 · WebP | R2-SVC-01 · `PROVISIONAL_R2` | overview, e-commerce, business | Exclude far-right vehicle mark; do not claim named merchant fulfilment | Worker incidental | High |
| `operations-preparation` | `r2/documentary/r2-doc-01-prepare.webp` · 1600×2000 · WebP | R2-DOC-01 · `PROVISIONAL_R2` | e-commerce, moving, freight, shuttle, business | Boxes/worker only; provisional stock styling remains | Worker visible | Medium |
| `freight-movement` | `r2/services/r2-svc-04-moving-freight.webp` · 1600×2400 · WebP | R2-SVC-04 · `PROVISIONAL_R2` | moving, freight | Exclude possible bag mark; context only, no capacity/load guarantee | One worker | High |
| `driver-context` | `r2/network/r2-net-02-driver.webp` · 1600×2400 · WebP | R2-NET-02 · `PROVISIONAL_R2` | driver network | Contextual driver portrait; never imply employment, enrolment, or earnings | One driver | Medium |
| `store-preparation` | `r2/network/r2-net-01-store.webp` · 1600×1067 · WebP | R2-NET-01 · `PROVISIONAL_R2` | business, e-commerce, driver network | Contextual store preparation only; no named merchant or active inventory claim | Two people | Medium |
| `delivery-status-context` | `r2/documentary/r2-doc-05-tracking.webp` · 1600×1068 · WebP | R2-DOC-05 · `PROVISIONAL_R2` | pricing, pharmacy | Account-status context only; never anonymous or live-driver tracking | People cropped; no personal account data | Medium |
| `local-road-context` | `r2/coverage/r2-cov-01-road-network.webp` · 2200×1467 · WebP; R4 mobile derivative available | R4-COV-01 / R2-COV-01 · `PROVISIONAL_R4` | shuttle, freight, moving | Local road context only; never a route, passenger-service, or coverage guarantee | Incidental people/signage | Low |
| `delivery-handoff` | `r2/documentary/r2-doc-06-handoff.webp` · 1600×1068 · WebP | R2-DOC-06 · `PROVISIONAL_R2` | food, grocery, pharmacy, parcel, driver network | Generic doorway handoff only; no specialized handling or confirmation promise | Two people | Medium |

## Registry and replacement procedure

1. Verify a candidate licence and record the exact source page, photographer, licence URL, download date, source dimensions, derivative details, file size, and SHA-256 in this document before it is used.
2. Store approved local exports outside public source evidence and expose only web derivatives under the project’s provisional media hierarchy.
3. Update the one corresponding `serviceMedia` record with the local path, dimensions, focal point, variants, service usage, status, visible-brand result, and replacement priority.
4. Re-check every route consuming that record, including mobile crops and Open Graph output, before changing status. Do not mark an asset final without manual production approval.

## R6 production replacement holds

- Replace `business-dispatch` and `freight-movement` before final campaign approval with clearly brand-safe, licence-reviewed local operations imagery.
- Replace or tightly crop `parcel-detail` and `parcel-handoff` so no paper, device, or personal information can be read.
- Review person/model-release and local-context suitability on every final crop; R6 does not make a release or legal clearance assertion.
