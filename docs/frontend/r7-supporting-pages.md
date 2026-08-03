# R7 — Supporting public pages

## Scope and verified route inventory

R7 implements the six canonical public supporting pages without changing route ownership, backend workflows, or account paths.

| Page | Canonical route | Primary authority | Primary action | Indexable |
| --- | --- | --- | --- | --- |
| About | `/about` | Existing public delivery/account behaviour and service copy | `/account/request-delivery` | Yes |
| Coverage areas | `/coverage-areas` | `listDeliveryRegions(true)` | `/account/request-delivery` | Yes |
| Membership | `/membership` | Existing unavailable public/account membership state and subscription production lock | `/contact` | Yes |
| Careers | `/careers` | `OpeningService.getPublicOpenings()` | Published role detail when available | Yes |
| FAQ | `/faq` | `lib/public-faq/faqs.ts`, reusing R6 service FAQ authority | `/account/request-delivery` | Yes |
| Contact | `/contact` | `ContactForm` and `/api/contact` | Canonical contact submission | Yes |

`/membership/checkout` remains preserved but is noindex because online checkout is unavailable. It does not offer payment or an unsupported membership action.

## Public Compass

The pages use the Editorial Freight visual boundary: Mona Sans for interface and body copy, restrained Newsreader display headings, a neutral canvas, carbon text, oxide-red actions, thin separators, and local provisional editorial media. Each page uses the same header/footer and support primitives but has a different reading purpose: institutional orientation, coverage data, commercial truth, recruitment state, reference reading, and human handoff.

## Shared architecture and boundaries

`components/public-v2/support/` provides the server-rendered breadcrumb-aware hero, closing CTA, factual list, data-state treatment, breadcrumb JSON-LD script, and scoped CSS module. Route-specific components live under `components/public-v2/{about,coverage,membership,careers,faq,contact}`.

Only the existing `ContactForm` remains a client component. The six route pages, their supporting components, coverage snapshot, careers snapshot, FAQ registry, and metadata remain server-first. No R7 page mounts homepage motion or native scroller code.

## Content authority and page behaviour

### About

The page explains account-based delivery requests, business/store order visibility, operational review, and contact-led driver-network participation. It deliberately omits team profiles because no published team source was found. It makes no claims about history, scale, awards, customers, offices, or technical architecture not already public.

### Coverage areas

`getPublicCoverageSnapshot()` calls the existing active delivery-region authority once on the server.

- `ACTIVE_REGIONS`: lists the active source records in source order.
- `EMPTY_CONFIGURATION`: says that online region information is not published; it does not claim service is unavailable.
- `SOURCE_UNAVAILABLE`: says the source could not be loaded and directs visitors to the quote/contact path without exposing an exception.

The page has no map, postcode lookup, city inventory, route estimate, anonymous tracking, or national-coverage claim. Some service types need request-level suitability confirmation, consistent with the service registry.

### Membership

The subscription codebase contains internal plan, contract, billing, entitlement, cancellation, and recurring-payment foundations. Its production lock remains off, and both the existing public and account-facing membership screens state that online subscriptions are unavailable. Therefore the public page is `INFORMATIONAL_ONLY`:

- no public plan name, price, benefit, billing cadence, renewal explanation, cancellation promise, or checkout control;
- no import of billing logic into a public client component;
- contact is the only membership-information action;
- a normal delivery request remains separate and available through its existing account path.

### Careers

`getPublicCareerOpenings()` reads only `OpeningService.getPublicOpenings()`, which returns published recruitment DTOs. If records are available, each list row uses the source title, track, location policy/location, relationship classification, closing date where present, summary, and canonical detail route. If the source returns no roles, the page renders an honest no-published-openings state. If the source cannot be read, it renders a distinct unavailable state rather than a false empty list.

No generic application form, role, salary, benefit, hiring promise, culture claim, or JobPosting schema is generated. JobPosting is intentionally deferred because the current public DTO does not provide all compliant public posting fields such as publication date.

### FAQ

`lib/public-faq/faqs.ts` is the R7 canonical source. It reuses `serviceFaqs` for delivery, quotes, coverage, orders, business, and driver participation; it adds only verified public explanations for membership and contact. The page uses server-rendered native `details`/`summary`, allows multiple disclosures to remain open, and uses ordinary category anchors instead of client-side search. FAQPage schema is derived from exactly the visible questions and answers.

### Contact

The page embeds the existing `ContactForm` once. It preserves the `name`, `email`, `phone`, `enquiry_type`, and `message` mapping, `ContactFormSchema` validation, same-origin enforcement, rate limiting, persistence, audit behaviour, server errors, and success state through `/api/contact`. The published enquiry types are delivery question, business account, existing order, pricing, and general support. No email address, phone number, office address, opening time, map, or social profile is invented.

## SEO, sitemap, and structured data

Each R7 canonical page has a unique title, description, canonical URL, and Open Graph title/description. The five image-led pages use a local provisional OG image; FAQ intentionally has no image. BreadcrumbList is emitted for every R7 page. ContactPage schema contains only page identity, and FAQPage schema contains only visible content. No Organization address, Offer, areaServed, review, rating, JobPosting, or contactPoint data is invented.

`app/sitemap.ts` now includes `/membership` and `/careers`; it includes no account, applicant, query, checkout, or alias route. `app/robots.ts` needs no correction because the six canonical routes are already allowed.

## Media strategy and production holds

R7 adds no media file. `lib/public-assets/supporting-page-media.ts` centralises six reuses from the documented R2/R4 local campaign library. All have local dimensions, meaningful alt text, source-ledger references, visual-use restrictions, `PROVISIONAL_R2` or `PROVISIONAL_R4` status, and a replacement priority inherited from the original entry. They are contextual photography only; none establishes coverage, employee identity, plan benefits, a merchant relationship, or final production approval.

See `r7-supporting-page-media.md` for the complete media matrix. Final photography, a published team source, public membership authority, and compliant job-posting date data remain production holds.

## Accessibility and responsive behaviour

Every principal route has one H1, an ordered breadcrumb trail, semantic links/buttons, visible focus styles, readable 44px actions, compact mobile wrapping, reduced-motion handling, and forced-colours treatment. Coverage states are textual rather than colour-only; roles use semantic articles/lists; FAQ uses native disclosure; the untouched canonical form retains labels and server errors. Desktop content is bounded to 84rem, tablet grids are intentional two-column arrangements, and mobile collapses media and actions without a desktop collage.

## Validation and manual QA

Focused R7 tests verify routes, metadata, sitemap, breadcrumb JSON-LD, coverage authority/states, membership claims, careers authority/states, FAQ visibility/schema, contact contract, media provenance, and server/client boundaries. TypeScript is not repository-clean because of pre-existing errors in public navigation, developer API, notifications, and multiple unrelated integration/phase tests; R7 adds no TypeScript errors after the careers DTO type fix.

Manual review:

1. Open each route at 320, 390, 768, 834, 1024, 1280, 1440, and 1920 pixels.
2. Confirm breadcrumb wrapping, header/footer continuity, visible focus, 200% zoom, reduced motion, forced colours, and no root horizontal overflow.
3. Test all three coverage data states with appropriate non-production data conditions.
4. Confirm careers roles, no-role, and unavailable-source messages remain distinct.
5. Test contact client validation, accepted submission, server failure, duplicate/rate-limit responses, and keyboard flow without changing the endpoint.
6. Inspect page source/head for canonical URLs, metadata, FAQPage, ContactPage, BreadcrumbList, and sitemap entries.
7. Recheck homepage and Services routes for regression.

## Safety confirmation and next boundary

R7 changes no backend logic, database schema, migration, authentication service, permission, recruitment state transition, lead persistence, rate limit, membership billing logic, production lock, marketplace state, dashboard, dependency, generated file, or final media. It creates no fake history, coverage, membership benefit, job, contact detail, anonymous tracking, remote media, or final-media claim.

R8 — Public Authentication and Account Entry Experience
