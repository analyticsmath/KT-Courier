# Phase 1 Final Blocker Repair — Validation Record

## Scope and disposition

- Branch: `phase/1-foundations`
- Baseline commit and tag: `8e76e558286ad4fcdcc50922625c9d65c6792fe8` (`baseline-pre-phase-1b-20260803`)
- This record covers Phase 1 blocker repair only. It makes no overall platform production-readiness claim.
- Human full-suite validation remains pending.
- Human production-build validation remains pending.

## Sitemap regression repair

Human validation found two sitemap regression failures:

- `tests/services/storefront-sitemap.service.test.ts`
- `tests/storefront/storefront-sitemap-policy.test.ts`

The sitemap route did not execute the canonical `storefrontPublicExposureAllowed` lock. The repair invokes that production lock before any category, store, or search-projection read and returns an empty sitemap when public exposure is denied.

The metadata route now uses `export const dynamic = "force-dynamic"`. This is intentionally narrow to `app/(public)/shop/sitemap.ts`; the `/shop` layout remains unchanged. The decision prevents sitemap prerendering from attempting a PostgreSQL connection during the production build while retaining truthful runtime failures for canonical projection reads.

Collection sitemap support is not implemented. The `collections` segment therefore returns an empty array before constructing or querying the product search adapter. No static marketplace fallback records are introduced.

Focused behavioral tests cover denied exposure without projection reads, canonical category and store URLs, indexable canonical product and variant URLs, product URL de-duplication, the collections early return, and propagation of projection failures.

## Lint debt disposition

Full repository lint baseline:
Not clean

Observed full-repository findings:
330 errors
107 warnings

Phase 1 changed-file lint:
Must be clean with zero errors and zero warnings

Disposition:
Historical repository lint debt is outside Phase 1 scope and must be addressed through a dedicated baseline lint-remediation program.

The historical repository lint backlog is not classified as a Phase 1 regression. Reporting file-tracing warnings remain non-blocking technical debt. Twenty payout/withdrawal todo tests remain explicitly disclosed.

## Final validation boundary

The implementation validation for this patch includes focused sitemap, marketplace-closure, catalogue-autosave, and affected protected-boundary tests; TypeScript; changed-file lint; route governance; and patch-integrity checks. The repository owner retains ownership of the complete default regression suite and production build gates.
