# Catalog UX research conversion

The implementation converts the brief's marketplace/UX findings into a progressive authoring experience:

- Existing-product discovery and deterministic duplicate hints precede identity creation.
- Product type and category are separate choices: type drives data requirements; category drives navigation.
- Thirteen labelled steps reduce a large schema into comprehensible decisions.
- Local autosave/recovery, explicit completion markers, an error-summary focus target, and server draft creation prevent accidental data loss.
- Variants, media, compliance, offer, price, inventory, and modifiers are visually separate, matching the domain boundaries.
- Preview shows the exact draft and publication lock; the quality checklist remains explainable and advisory.
- Tables expose search/status/readiness evidence without customer-storefront behaviour.

WCAG-oriented patterns include semantic headings, native labels, keyboard step buttons, text status labels, minimum touch targets, `aria-live` save state, non-drag workflows, alt-text requirements, responsive overflow, and accessible table names. Full WCAG browser testing is deferred.

## Trusted media correction

The media step now progresses through secure intent creation, bounded byte upload, server validation and READY association. It presents phase progress, safe errors, retry for the selected file, and existing READY assets owned by the authenticated store. An asset is never presented as attached before READY.

Each association captures alt text, primary selection, deterministic order and product/default-variant scope. Move earlier/later controls provide mobile and keyboard ordering without drag-only interaction. Removing an item removes only the draft association, never the asset evidence. Autosave persists safe public asset references, not blob URLs, local paths or storage keys.

Admin review presents owner scope, owning store, lifecycle, inspected MIME/size/dimensions, truncated checksum, privacy result, associations, review reasons and immutable history while omitting credentials and internal storage paths.
