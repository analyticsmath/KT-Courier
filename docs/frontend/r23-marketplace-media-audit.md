# R23 — Marketplace media audit

## Authority and results

| Surface | Authority | Fields available to R23 | R23 treatment |
| --- | --- | --- | --- |
| Store cover | `StorefrontStoreDocument.heroMediaReference` | media reference only | Cover via existing `/api/catalog/media/[publicReference]`; decorative alt because no source alt is projected. |
| Store logo | `StorefrontStoreDocument.logoMediaReference` | media reference + canonical store name | Logo alt is the canonical store-name logo relationship. |
| Category media | `StorefrontCategoryDocument.publicImageReference` | media reference, no safe alt | Not rendered until a meaningful projection alt/use decision exists. |
| Product media | `StorefrontProductDocument.primaryMedia*` | reference, width, height, canonical alt | Used as deterministic primary media with responsive sizes and detail LCP priority. |
| Gallery media | No public gallery collection in `StorefrontDocument` | none | One-image gallery state; no fabricated thumbnails. |

## Dimensions, ratios and formats

The product DTO carries real width and height, so the UI reserves its geometry. Store/category DTOs do not carry public dimensions or format; their source assets are delivered only by the trusted existing media route and are not documented here with invented values. The local R23 preflight database was unavailable, so exact seeded-record counts, asset dimensions, format totals, invalid media rows and LCP candidate reference values could not be verified.

## Missing/invalid assets and replacement requirements

Absent `primaryMedia`, `heroMediaReference` or logo fields produce visible, labelled neutral fallbacks. An API media delivery failure should remain a source error, not be replaced with stock imagery. Before production review, obtain projection-backed store/category media dimensions, format and suitable public alt/use metadata; keep provider storage keys and internal media audit data out of the public UI.
