# Phase 1.5 — Super Admin commerce and store operations

Scope: the existing approved Gauteng parcel and marketplace launch. No automatic new finance authority, discounts, storefront publication, ad campaign activation or promoter payout approval. Source precedence follows the client's eight documents and subsequent explicit owner decisions; later requests authorize development of administration tools, not unilateral activation of commercial programmes.

**Release evidence:** Update the commit and exact GitHub CI/production certification results for each new release. Earlier branch/test results do not certify this SHA.

## Delivered in the current engineering candidate

| Requested action | Current implementation / boundary |
|---|---|
| Super Admin console | Dedicated role-isolated `/admin/super-admin`, navigation visible only to SUPER_ADMIN, categorized access to existing store/catalog/order/ad/promotion/promoter workspaces |
| Add a store | `CREATE_STORE` creates a PENDING store from an *already verified and active STORE account without another owned store*; locked concurrent slug/owner check, immutable audit event; no auto-approval. Does not invent a new password or bypass vendor authentication |
| Add store items | `CREATE_PRODUCT_DRAFT` creates store-private product drafts under selected store through canonical catalog policy and evidence. Requires approved product type/category; no direct live publication |
| Listings and prices | `CREATE_OFFER_DRAFT` with real variant, selling unit and inventory mode; `CREATE_PRICE_DRAFT` creates a versioned ZAR price. Never overwrites active price |
| Priced item options | `CREATE_PRICED_ATTRIBUTES` attaches an exact priced option group only to an unpublished DRAFT offer with store-ownership validation; cannot silently alter active offers |
| Password reset | Super Admin may queue expiring link delivered to an eligible verified user's email. No password/token returned, audit event, recipient rate limit, no privileged admin takeover |
| Store approvals, item approvals, discounts, coupons, orders | Existing canonical screens and domain APIs linked from the console; authorization, seller-of-record and payment conditions remain independent |
| Advertising, creative placements, promoter/refer-and-earn | Existing governance/review screens linked; optional commercial activation and real payouts remain excluded until owner and finance authorizations |

## Explicit remaining Phase 1.5 work (not yet claimed complete)

1. **Net-new vendor onboarding:** Signup automatically creates a vendor store, and `storeAccess` rejects multiple owned stores. The direct add-store function therefore only covers verified vendor profiles with no store. Build a full invitation/registration completion and store ownership workflow with separate RBAC and tenant proofs; design a multi-store workspace selector before supporting more than one store per owner.
2. **On-behalf catalog media upload and bulk product CSV:** Existing catalog product-import apply intentionally refuses to claim completion; build canonical row parser, owner-scoped uploaded-media flow, moderation, repeat/replay tests and real stock/packing evidence. The UI currently creates text-based product drafts but does not upload imagery.
3. **Pair and bulk packaging/pricing:** Catalog supports EACH, FIXED_WEIGHT, VARIABLE_WEIGHT, VOLUME, LENGTH, modifiers and per-variant draft prices; it does *not* have native PAIR/BULK priced inventory conversions or tiered wholesale discounts. Add measured package composition, tiered price version authority, cart/checkout snapshots, tax, refunds, fulfillment and stock reservations with real DB/browser evidence before launch.
4. **Dedicated banner editor and scheduling:** Managed advertising placements and creatives exist; homepage banner draft/render/publication is not independently wired in this release. Add responsive media validation, accessibility, approved asset targeting, scheduling, manual rollback and safe publication after legal/marketing approval.
5. **Commercial approval scope:** Coupon, promotional, promoter and advertising activation still require the existing governance gates and owner approval; management tools may be prepared now but do not activate excluded revenue programmes.
6. **Exact-source QA:** Unit/service tests plus release CI, disposable PostgreSQL/browser role journeys at mobile/desktop, independent client/finance sign-off and final production SHAs must be recorded. Do not use protected database for synthetic transactions.

## Acceptance semantics

Use `DONE`, `TESTED_LOCALLY`, `IN_CI`, `BLOCKED_EXTERNAL`, `NOT_IMPLEMENTED`, or `DEFERRED_BY_POLICY` with exact SHA, timestamp and artifact reference. This phase is **PARTIAL** while the six items above remain open. A navigation link alone is not proof that a requested operation is implemented.
