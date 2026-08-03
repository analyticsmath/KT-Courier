# R9 public marketplace, participation, and developer entry surfaces

## Summary and phase boundary

R9 adds server-first public entry surfaces for the locked marketplace,
participation, and developer API. It deliberately does **not** activate the
storefront, cart, checkout, payment, promoter, recruitment, or developer
backend.

Deferred: catalog activation, storefront browsing, cart persistence, checkout
and payment, protected developer-portal redesign, dashboard work, final media
approval, and any operational lifecycle change.

The source-backed matrices used before implementation are in
[R9 public-entry matrices](./r9-public-entry-matrices.md).

## Marketplace inventory

| Route family | Lock/data authority | Public rendering | Indexing/canonical action |
| --- | --- | --- | --- |
| `/shop` | `storefrontPublicExposureAllowed()` and canonical storefront service | Editorial preview only while locked; actual storefront branch remains for an allowed future state | Indexable canonical `/shop`; actions to `/join#stores` and the account delivery request |
| Category, store, product, variant, collection descendants | Same server storefront guard; projections only queried after the guard | `MarketplaceUnavailable` with no entity DTO, query echo, price, store, product, or schema | `noindex, follow` while locked; no private-entity canonical |
| `/shop/search` | Same storefront availability state | No search form, input, ranking, sample result, or client fixture | `noindex, follow`; return to marketplace or a verified alternative |
| `/cart` | Cart authority unchanged and unused by R9 | No line, persistence claim, total, charge, discount, or checkout CTA | `noindex, follow`; marketplace, delivery request, and contact alternatives |
| `/checkout` | Checkout authority unchanged and production lock remains false | No form, address, payment, reservation, review, or completion simulation | `noindex, follow`; cart/contact alternatives |
| `/order-confirmation/[publicReference]` | Existing order ownership/guest-secret authority remains unchanged | A generic authorized-flow boundary; no parameter echo and no status claim | `noindex, follow`; account updates or support |

`MarketplaceUnavailable` receives only a safe route context. It never accepts
catalog, search, store, product, checkout, provider, or internal lock data.

## Participation inventory and page

`/join` is the canonical public participation route and uses stable anchors:
`#stores`, `#drivers`, and `#promoters`.

| Pathway | Authority and state | Canonical action | Claims intentionally absent |
| --- | --- | --- | --- |
| Stores | Existing `StoreSignupSchema` / signup form; business account registration exists; marketplace remains locked | `/signup?role=store` | Fees, commission, settlement timing, approval timing, marketplace placement, volume |
| Drivers | Driver-network information is contact-led; recruitment publishes role-specific pathways only | `/services/driver-network`, then `/careers` for published roles | Vehicle/licence/insurance/screening requirements, rates, income, commission, work volume, timing |
| Promoters | Protected promoter lifecycle includes application, review outcomes, agreement, approval, and activation; there is no public endpoint | `/contact` labelled “Ask about the promoter programme” | Acceptance, referrals, customers, earnings, withdrawals, commission, risk/fraud and private data |

The page is intentionally varied rather than a set of repeated cards: a store
operation split, a driver information section, a dark promoter context, and a
route comparison. It uses a server-safe participation registry and no public
application duplication.

## Developer inventory and page

`/developers` is now the public overview at the existing canonical route. The
existing non-root developer portal route family and `/api/developer/*` remain
unchanged; the latter remains session- and owner-permission-authorized.

- Application authority: `DeveloperApplicationService`; canonical lifecycle
  includes draft, submitted, under review, approved, active, and the existing
  exception/closure states.
- Terms authority: `DeveloperTermsService`, accepted through the application
  workflow.
- Credential authority: `CredentialService`; opaque credential and webhook
  signing secret display only once in the protected workflow.
- Environments: test is documented; live exists in the OpenAPI contract but is
  not presented as active.
- Scopes: sourced from `DEVELOPER_SCOPES` and descriptions, never from account
  permission keys.
- Limits and quotas: sourced from per-operation OpenAPI extensions; no numeric
  allocation is invented.
- Idempotency: documented only where the served contract declares
  `Idempotency-Key`.
- Errors: documented from the RFC 9457-style public Problem Details contract.
- Webhooks: documentation covers protected subscription creation, verification,
  raw-body digest/signature/timestamp/replay checks, and canonical retry
  behavior. The shown envelope uses obvious placeholders only.
- OpenAPI: the only public contract link is `/api/openapi/v1.json`, served from
  `openapi/kt-couriers-v1.json`; no second copy or browser console is created.

The developer page is typography-led and server-rendered. Its restrained dark
technical plane uses real version, scope, and contract terms; it has no
terminal imitation, API logs, usage charts, endpoint call, secret, production
hostname, or customer data.

## SEO, accessibility, and performance

- `/shop`, `/join`, and `/developers` have unique canonical metadata and are
  added to the root sitemap. Marketplace descendants, cart, checkout, order
  confirmation, and developer portal subroutes are noindex.
- The locked marketplace does not emit catalog Product, Offer, or rating
  structured data. Private/storefront sitemap segments continue to return no
  records while the server lock is false.
- `robots.ts` allows the three approved R9 public pages and continues to
  disallow account, store, admin, API, and marketplace-search crawl areas.
- Public breadcrumbs are visible and the new indexable pages emit the existing
  safe breadcrumb JSON-LD helper.
- All new compositions have clear heading order, labelled landmarks, native
  links, keyboard focusable actions, local meaningful image alternatives, and
  `EDITORIAL_ONLY` captions. Decorative route graphics are hidden from assistive
  technology.
- CSS contains responsive reflow at tablet and desktop breakpoints, horizontal
  overflow-safe code blocks, `prefers-reduced-motion`, and forced-colours
  border fallbacks. No root overflow or fixed page pinning is introduced.
- Pages are Server Components. The only existing client island reached on the
  actual storefront branch is unchanged. Locked pages fetch no catalog data;
  the public developer overview does not parse or ship the OpenAPI document.

## Media provenance

All R9 images reuse the local, provisional R2 campaign library through
`lib/public-assets/r9-entry-media.ts`. They are editorial context only—never
catalog media, a published store, a programme member, a product, inventory,
price, promotion, or rating. Source provenance, original source information,
and replacement requirements remain in the R2 ledger.

| Asset | Role | Dimensions / format / bytes | Provenance and replacement |
| --- | --- | --- | --- |
| `R2-MKT-01` | Marketplace storefront | 1600×2400 WebP, 292,904 B | `#r2-mkt-01`; provisional, replacement pending |
| `R2-MKT-02` | Marketplace fulfilment | 1600×1067 WebP, 80,106 B | `#r2-mkt-02`; provisional, replacement pending |
| `R2-DOC-01` | Marketplace preparation | 1600×2000 WebP, 183,396 B | `#r2-doc-01`; provisional, replacement pending |
| `R2-NET-01` | Store participation | 1600×1067 WebP, 78,990 B | `#r2-net-01`; provisional, replacement pending |
| `R2-NET-02` | Driver participation | 1600×2400 WebP, 149,358 B | `#r2-net-02`; provisional, replacement pending |
| `R2-DOC-06` | Promoter participation | 1600×1068 WebP, 92,648 B | `#r2-doc-06`; provisional, replacement pending |

No remote image is hotlinked and no image is marked final. Priority replacement
is approved KT Couriers operational photography with written provenance,
appropriate releases, and no misleading third-party branding.

## Validation

Focused validation is in
`tests/public-v2/r9-public-entry-surfaces.test.ts`. It covers the unchanged
storefront guard, fixture removal, locked descendant order, cart/checkout/order
boundary, verified participation CTAs, developer contract linkage, media
provenance, sitemap limits, server-first rendering, and accessibility CSS
fallbacks.

Focused R9 lint and tests pass. Repository-wide TypeScript remains blocked by
pre-existing errors in developer API schemas/services, notifications, and
unrelated integration and phase-27 tests; R9 contributes no errors in that
run. The in-app browser connection was unavailable during this implementation,
so the manual review below remains required.

## Safety confirmation

R9 changes no storefront lock, marketplace activation, catalog backend, cart
domain logic, checkout logic, PayFast behavior, promoter backend, recruitment
backend, developer backend, database schema, migration, authentication
behavior, permission, dashboard, dependency, generated file, credential, or
webhook secret. It creates no fake product, store, category, collection,
price, rating, cart, checkout, payment, order confirmation, income promise,
fee, commission, remote asset, final-media claim, purple treatment, broad
gradient, glass effect, or page pinning.

## Manual validation commands

```powershell
npx vitest run tests/public-v2/r9-public-entry-surfaces.test.ts
```

```powershell
npx eslint 'app/(public)/shop/**/*.tsx' 'app/(public)/cart/page.tsx' 'app/(public)/checkout/page.tsx' 'app/(public)/order-confirmation/[publicReference]/page.tsx' 'app/(public)/join/page.tsx' 'app/(account)/developers/[[...segments]]/page.tsx' 'components/public-v2/marketplace/**/*.tsx' 'components/public-v2/participation/**/*.tsx' 'components/public-v2/developers/**/*.tsx' 'components/public-v2/navigation/PublicBreadcrumbs.tsx' 'components/public-v2/site/PublicNavigation.tsx' 'lib/public-marketplace/**/*.ts' 'lib/public-participation/**/*.ts' 'lib/public-assets/r9-entry-media.ts'
```

```powershell
npx tsc --noEmit --pretty false
```

```powershell
npm run dev
```

```powershell
git diff --check
```

## Browser-review checklist

- Visit `/shop`, a locked category, store, product, collection, and search
  route. Confirm truthful locked copy, no fixture catalog, no entity data, and
  no search form.
- Visit `/cart`, `/checkout`, and an order-confirmation URL. Confirm no cart
  line, total, payment control, order reference echo, or success state.
- Visit `/join`, its three anchors, each action, and `/developers`; confirm
  store/driver/promoter CTAs follow only verified routes and developer OpenAPI
  action points to `/api/openapi/v1.json`.
- Check anonymous developer entry and an authenticated developer session where
  safely available; protected application/credential data must remain
  owner-bound.
- Review at 320, 390, 768, 834, 1024, 1280, 1440, and 1920 CSS pixels.
- Test keyboard focus order, reduced motion, forced colours, 200% zoom, 400%
  reflow, root overflow, and code-block overflow.
- Inspect title, canonical, noindex behavior, sitemap, robots, console errors,
  page source for secrets, and no fake commerce/guaranteed-income language.
- Recheck homepage, Services, R7 support pages, and R8 auth flows.

## Next phase

R10 — Legal, SEO, Brand Assets and Static-Site Closure
