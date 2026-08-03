# Phase 18 product catalog

Status: **IMPLEMENTATION COMPLETE — DEEP VALIDATION DEFERRED TO PHASE 26.5**.

Phase 18 adds an authenticated catalog-authoring foundation. It deliberately separates product identity, exact variant identity, store offer, immutable price version, and location inventory. Legacy Phase 4 product tables remain compatibility-only and are never activated or backfilled.

Implemented boundaries include hierarchical taxonomy; reviewed, versioned product-type schemas; canonical and store-private products; option fingerprints and GS1 GTIN validation; store offers; VAT-inclusive ZAR prices; movement-backed inventory; trusted asset associations; modifiers; compliance restrictions; moderation; duplicate candidates; quality scores; CSV import evidence; immutable snapshots; and catalog change events.

The architect media correction completes the source-level trusted intake boundary: explicit platform/store ownership, idempotent expiring upload intents, server-owned opaque storage keys, bounded application upload, signature/MIME/dimension/privacy inspection, SHA-256 evidence, READY-only attachment, safe delivery authorization, a deterministic injected test adapter, review history and dry-run cleanup. No cloud vendor was selected. Production upload and public delivery remain locked until a reviewed provider and scanner are validated in Phase 26.5.

The hard-coded `CATALOG_PRODUCTION_VALIDATION_APPROVED = false` lock blocks product-type, product, offer, price and publication activation. There is no environment bypass. Draft creation, editing, review, import dry-run, and controlled test injection remain possible.

No public storefront, customer search, cart, checkout, reservation, marketplace order, payment, ledger, promotion, advertising, review, wish-list, or earnings mutation was added.

## Runtime shape

- Store authoring routes live at `/store/catalog` and `/api/store/catalog/*`.
- Administration lives at `/admin/catalog` and `/api/admin/catalog/*`.
- Mutations require authentication, active exact store ownership or exact admin permission, explicit-DENY-aware permission evaluation, same-origin checks, bounded JSON, rate limiting, strict Zod schemas, optimistic versions, and operation IDs where evidence changes.
- `CatalogPublicationSnapshot` is the only intended Phase 19/20 internal read boundary.

See `docs/phase-18-research-and-implementation-map.md` for the pre-edit audit and `docs/deferred-validation/phase-18-risk-register.md` for the validation boundary.
