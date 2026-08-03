# R6 public services architecture

R6 rebuilds the public services surface as a static, server-first editorial system. It preserves all eleven existing detail URLs, keeps the authenticated delivery request as the only public quote destination, and does not alter product, account, pricing, or operational code.

## Exact route inventory and matrix

| ID | Route | Page title | Family | Indexable | Primary CTA | Related services |
| --- | --- | --- | --- | --- | --- | --- |
| `parcel` | `/services/parcel` | Small parcels. Clear progress. | Everyday movement | Yes | Get a quote → `/account/request-delivery` | business, pricing, e-commerce |
| `ecommerce` | `/services/ecommerce` | Orders moving beyond checkout. | Business flow | Yes | Get a quote → `/account/request-delivery` | business, parcel, pricing |
| `food` | `/services/food` | Local orders in motion. | Everyday movement | Yes | Get a quote → `/account/request-delivery` | grocery, pharmacy, pricing |
| `grocery` | `/services/grocery` | From store to doorstep. | Everyday movement | Yes | Get a quote → `/account/request-delivery` | food, pharmacy, pricing |
| `pharmacy` | `/services/pharmacy` | Deliveries that need clear handling notes. | Everyday movement | Yes | Get a quote → `/account/request-delivery` | grocery, food, pricing |
| `moving` | `/services/moving` | More than a parcel. | Planned movement | Yes | Get a quote → `/account/request-delivery` | freight, shuttle, pricing |
| `freight` | `/services/freight` | Larger loads, coordinated clearly. | Planned movement | Yes | Get a quote → `/account/request-delivery` | moving, shuttle, pricing |
| `shuttle` | `/services/shuttle` | Planned transport, clearly arranged. | Planned movement | Yes | Get a quote → `/account/request-delivery` | moving, freight, pricing |
| `business` | `/services/business` | Delivery that fits repeat operations. | Business flow | Yes | Get a quote → `/account/request-delivery` | e-commerce, parcel, driver network |
| `driver-network` | `/services/driver-network` | The people behind every handoff. | Business flow | Yes | Contact support → `/contact` | business, e-commerce, parcel |
| `pricing` | `/services/pricing` | Understand what shapes a quote. | Quote intelligence | Yes | Get a quote → `/account/request-delivery` | parcel, business, freight |

The overview remains `/services`. No route was renamed, consolidated, redirected, or converted to a dynamic slug route.

## Service families and shared architecture

The registry groups routes into four editorial families: `EVERYDAY_MOVEMENT`, `BUSINESS_FLOW`, `PLANNED_MOVEMENT`, and `QUOTE_INTELLIGENCE`. Families share typography, action controls, local provisional media, thin borders, cool-neutral canvases, and decorative route lines. They vary through hero proportions, image subject, detail sequencing, rhythm, and operational emphasis rather than separate colour systems or controls.

`ServiceDetailPage` is a Server Component. Each explicit `page.tsx` imports the route-specific registry definition and metadata, then renders the shared page. The shared contract covers breadcrumb, hero, clear CTA, use cases, request narrative, preparation, quote factors, coverage, confirmation requirements, related services, native FAQ disclosure, and closing CTA. `ServicesOverviewPage` contains an editorial hero, complete numbered route index, linked family atlas, process, pricing/coverage/business pathways, FAQs, and quote CTA.

`lib/public-services/service-page-registry.ts` is the presentation authority for route identity, family, copy, metadata, media references, related routes, and CTAs. It contains no database calls, pricing logic, permissions, internal state, or quote formulas. `ServiceCoverage` is the only R6 component that consults active delivery regions and does so server-side with the same contact fallback used by the public coverage surface.

## Content, quote, pricing, coverage, and restrictions truth

The source of public request facts is the authenticated Request a Delivery form: delivery type, pickup and dropoff contact/access details, parcel count and description, optional schedule date, and notes. Current quotes remain authoritative only at `/account/request-delivery`; public service pages never create an additional quote form, query parameter, calculator, rate table, distance estimate, or fixed price. `/services/pricing` is explanatory only. The former `PricingCalculator.tsx` has been removed.

Coverage remains local and request-specific. Active region names are displayed only when the server source returns active configured records and the service definition permits that general coverage context. Specialized, planned, pharmacy, food, grocery, freight, moving, and shuttle enquiries use a contact/quote-confirmation message rather than implying universal availability. If the region source cannot be read, the page asks visitors to share addresses with the team; it does not claim no coverage.

Restrictions use only honest confirmation language. There are no medical, cold-chain, regulatory, passenger, insurance, hazardous-goods, freight-capacity, delivery-time, or guaranteed-availability claims. Driver network is a support-contact explanation, not a public enrolment, assignment, or earnings product. Order updates remain account-based; no anonymous tracking is introduced.

## Breadcrumb, metadata, structured data, and sitemap

`PublicBreadcrumbs` renders an ordered list in `<nav aria-label="Breadcrumb">`; the current page is non-clickable and carries `aria-current="page"`. `publicBreadcrumbJsonLd` emits a safely serialized `BreadcrumbList` only, without service pricing, review, rating, or area-served claims.

Every route has a static, route-specific metadata export from `publicServiceMetadata`: a unique title and description, canonical path, Open Graph title/description, and a local registered image. `/services` has matching static overview metadata. `app/sitemap.ts` now derives the eleven completed service-detail entries from the indexable registry. It intentionally adds no account, query, draft, alias, marketplace, or new legal URL. Existing robots rules are untouched.

## Media, motion, responsive, accessibility, and performance

R6 adds no source image. It reuses the documented local R2/R4 provisional campaign library only through `lib/public-assets/service-media.ts`; the companion [R6 media ledger](./r6-service-media.md) records the mappings, crop constraints, and replacement holds. No remote image is hotlinked and no asset is marked final.

Service pages introduce no JavaScript animation, GSAP controller, ScrollTrigger, pin, scrub, custom scroller, or autoplay. Route lines are decorative static SVGs. This intentionally leaves the R5 homepage journey as the signature motion system. The static pages remain complete with JavaScript unavailable and respect reduced-motion and forced-colour preferences through their scoped CSS.

The CSS Module uses bounded layouts, semantic image sizes, mobile-first single columns, vertical route index and related service rows, 44px-or-better main actions, focus outlines, native `<details>` FAQs, non-colour-only numbered/arrow cues, and forced-colours styling. Desktop family layouts begin at deliberate breakpoints; there is no root overflow rule or decorative fragile overlap. Only one meaningful hero image per route is priority-loaded; narrative and related imagery stays lazy and has explicit `sizes`.

## Known content and media gaps / production holds

- Existing source data supports request inputs and account order-status visibility, but not public fixed prices, timings, capacity limits, medical handling, freight specifications, passenger schedules, driver enrolment, or earnings. Those claims remain absent.
- R2 service media is provisional stock photography. High-priority business-dispatch and freight crops require brand-safe replacements before final production approval; parcel-handoff needs a strict no-readable-document crop. People and brand reviews are inherited from R2/R4 and must be re-reviewed against final renders.
- There is no verified public per-service region capability data. Quote confirmation remains the correct specialized-service hold.

## Manual review procedure

1. Review `/services` and every route in the matrix at 320, 390, 768, 1024, 1280, 1440, and 1920 px.
2. Confirm each primary quote CTA lands on the authenticated request route and each order-update action lands on `/account/orders`.
3. Check the live active-region state and the server-fallback state without treating either as a blanket service guarantee.
4. Review image crops for visible marks, readable documents, recognizable people, inaccurate service implication, and loading priority.
5. Check keyboard focus, native FAQ operation, forced colours, 200% zoom, reduced motion, canonical metadata, JSON-LD, sitemap entries, and no horizontal root overflow.

## Next-phase boundary

R6 ends at the public services surface. It does not begin R7 work or modify About, Coverage, Membership, Careers, FAQ, Contact, the homepage motion journey, public header/footer, account flows, dashboard, marketplace, backend, database, locks, or dependencies.
