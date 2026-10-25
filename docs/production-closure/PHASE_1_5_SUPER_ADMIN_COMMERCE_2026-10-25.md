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

## 2026-10-25 extended engineering work — implementation and audit

The following work has been implemented in this candidate (do **not** interpret this table as signed-off production acceptance until exact SHA release evidence exists):

| Capability | Implementation and safety boundary | Acceptance evidence |
|---|---|---|
| Store onboarding | Super Admin issues a private 72-hour registration invitation tied to email/store name. The invited vendor registers using the existing signup, creates their own password, verifies email, and receives only a PENDING store. Existing verified account flow remains supported; no implicit multi-store ownership. | `tests/admin/store-invite-policy.test.ts`; external signup/OTP acceptance still needed |
| CSV authoring | Typed header and RFC 4180 quoted CSV, 64 KB/100 row cap, formula/HTML/URL protection, dry-run preview; all rows become DRAFT products in one transaction, with canonical evidence and one idempotent batch receipt; never creates live listings. | `tests/admin/super-admin-bulk-catalog.test.ts`, `tests/admin/super-admin-bulk-service.test.ts`; isolated PostgreSQL/browser acceptance still needed |
| On-behalf media | Super Admin-scoped catalog media upload intent, binary transfer and completion, MIME/byte inspection and store/product ownership checks. Primary images can attach only to editable catalog products and still require moderation. No trusted external image URL is accepted as product media. | `tests/api/super-admin-media-route.test.ts`; real Cloudinary upload to be tested |
| Each / Pair / Pack / Bulk | New catalog selling-unit enum; PAIR=2, PACK/BULK=2..1000 declared constituent units and independently inventoried sellable SKU; existing EACH/weight/volume/length unaffected. Source selling unit is preserved in checkout snapshots. | `tests/catalog/volume-price-tiers.test.ts`, marketplace cart resolver and checkout tests; fulfillment/stock scenario against live-shaped synthetic data pending |
| Volume discounts | Immutable versioned price DRAFT supports ten increasing-quantity/decreasing-amount price tiers; server reselects quantity tier at cart/checkout and computes exact money. No automatic activation of unapproved price versions. | Pricing tests and cart resolver regression; Paystack/refund/provider evidence remains external |
| Homepage editorial banners | Authenticated Super Admin draft form with Cloudinary account URL, alt text, safe internal link, max 180-day window; different Super Admin approval, audit, disable/rollback-to-no-banner, public scheduled display and PII-free projection. This does not authorize advertising campaigns. | `tests/admin/home-banner-policy.test.ts`, `tests/admin/home-banner-operations.test.ts`, desktop/mobile visual/browser sign-off pending |
| Advertising, coupons, promoter referral programs | Reuse canonical `/admin/advertising`, `/admin/promotions`, `/admin/promoter-programs`, plus moderation pages already provided. Existing policy intentionally excludes live paid programme/payout activation from initial launch; approval cannot be forged by Super Admin authoring. | Existing enterprise policy and moderation tests; owner finance sign-off required for activation |
| Password reset, item approval, orders, store management | Existing role-gated flows, available from Super Admin console. No second shadow admin/payment system created. | Existing tests in `tests/admin/*` plus global regression |

### Phase 1.5 SWOT / threat model

- **Strengths:** existing canonical catalog, granular permissions, moderation, protected financial ledger, atomic transaction receipts, secure audited media ingestion, robust product-type schemas.
- **Weaknesses:** draft authoring does not itself establish a ready-to-ship product; real media, stock, packaging, tax, approval and checkout need operator completion; owner multi-store workflows intentionally unsupported to avoid ambiguous tenancy.
- **Opportunities:** unified supplier-controlled marketplace with pair/multipack SKUs, quantity discounts, auditable banners, safe back-office bulk authoring and real ownership verification.
- **Threats:** malicious CSV formulas, replay/partial imports, cross-store image attach, unapproved banner ads, stock miscounting with mixed pack/loose inventory, payment-rounding errors, abusive registration invitations, misrepresented operational readiness.

**Release gates:** exact-commit full Vitest, TypeScript, route authorization inventory, migration safety, Prisma schema validate, server build, Chromium desktop/mobile role tests, Vercel/Railway health and clean sign-off. Changes go directly to main, no new branches. No test transactions or commercial approvals written to protected production.
