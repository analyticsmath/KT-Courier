# R10 static-site closure

R10 closes the public implementation boundary. It does not approve legal content, activate marketplace commerce, perform R11 browser QA, or certify accessibility/performance.

## 1. Public route inventory and route-status matrix

The typed authority is `lib/public-site/public-route-registry.ts`. It is a presentation/validation registry only: it has no permission, session, payment, or private-identifier state.

| Routes | Family | Status | Indexability / sitemap | Canonical policy | Launch state |
| --- | --- | --- | --- | --- | --- |
| `/`, `/about`, `/coverage-areas`, `/membership`, `/careers`, `/faq`, `/contact` | Marketing/support | `READY` or `READY_PROVISIONAL_MEDIA` | Index/follow; root sitemap | Preferred route on the canonical origin | Public content is available; provisional-media limitations remain documented. |
| `/services` and the 11 routes in `publicServicePages` | Service | `READY_PROVISIONAL_MEDIA` | Index/follow; root sitemap | Each service route is self-canonical | Public information only; current suitability is confirmed through the existing request flow. |
| `/join` | Participation | `READY` | Index/follow; root sitemap | Self-canonical | Existing participation locks and states are preserved. |
| `/developers` | Developer | `READY` | Index/follow; root sitemap | Self-canonical | Public overview only; descendant portal routes remain protected/noindex. |
| `/shop` and `/shop/*` | Marketplace | `LOCKED_INFORMATIONAL` | Noindex while production lock is active; no root sitemap entry | `/shop` is the informational canonical only | Marketplace activation remains locked. |
| `/cart`, `/checkout/*`, `/order-confirmation/*`, `/membership/checkout` | Functional | `NOINDEX_FUNCTIONAL` / `UNAVAILABLE` | Noindex; excluded | No private token/query canonical | Existing functionality is untouched. |
| `/login`, `/signup`, other auth routes | Auth | `NOINDEX_FUNCTIONAL` | Noindex; excluded | Auth routes have no sitemap authority | Existing auth behavior is untouched. |
| `/account/*`, `/applicant/*`, dashboards, admin, store, driver, payment routes | Protected | `PROTECTED` | Noindex/excluded by metadata/prefix policy | No public canonical authority | Not public SEO surfaces. |
| `/privacy-policy`, `/terms`, `/cookie-policy`, `/accessibility` | Legal | `LEGAL_REVIEW_REQUIRED` / `LEGAL_DRAFT` | Noindex; excluded | Self-canonical for continuity of required links | Legal publication blockers remain open. |
| `/safety` | Support | `UNAVAILABLE` | Noindex; excluded | Self-canonical | Unsupported operational claims removed pending authority. |

## 2. Legal matrix and approval model

The source of truth is `lib/public-legal/legal-document-registry.ts`; no registry item becomes approved merely because this implementation exists.

| Route / document | Pre-R10 content | Content authority | Status | Effective date / contact authority | Indexability / sitemap | Missing inputs and launch status |
| --- | --- | --- | --- | --- | --- | --- |
| `/privacy-policy` / Privacy Notice | Placeholder processing claims | No approved public source found | `COUNSEL_REVIEW_REQUIRED` | None supplied | Noindex / absent | Approved notice, legal entity, privacy contact, retention, legal-basis, recipients, transfer decisions; blocker `R10-LEGAL-001`. |
| `/terms` / Website Terms | Placeholder website/delivery terms | No approved public source found | `COUNSEL_REVIEW_REQUIRED` | None supplied | Noindex / absent | Approved scope and terms, legal entity, relationship to separate agreements; blocker `R10-LEGAL-002`. |
| `/cookie-policy` / Cookie Notice | Placeholder cookie names/purposes | No approved public source found | `COUNSEL_REVIEW_REQUIRED` | None supplied | Noindex / absent | Approved disclosure and tracking decision; blocker `R10-LEGAL-003`. |
| `/accessibility` / Accessibility Statement | Unsupported WCAG/conformance language | No approved public source found | `DRAFT_UNAPPROVED` | None supplied | Noindex / absent | Approved statement and supported feedback/contact wording. |
| No route / PAIA Manual | No public manual found | No approved source found | `MISSING` | No Information Officer authority found | No route / absent | Approved manual or publication decision and authority inputs; blocker `R10-LEGAL-004`. |

The shared legal presentation is server-rendered in `components/public-v2/legal/`. It provides publication status, reserved table-of-contents/anchored-section support for future approved content, clear reading width, focusable links, scroll margins, and scoped print output. It renders no generated clauses, dates, version, approver, entity, address, officer, retention, refund, liability, dispute, governing-law, or consent language.

## 3. Privacy, cookies, and PAIA readiness

- The repository-derived processing inventory is [privacy-data-inventory.md](../legal/privacy-data-inventory.md).
- The storage audit is [cookie-storage-inventory.md](../legal/cookie-storage-inventory.md). It records only named cookie metadata, never values or tokens.
- The source scan found essential first-party session/cart cookies and a protected catalog draft `localStorage` use. It found no analytics, advertising, tag manager, social pixel, or consent-management package.
- No cookie banner or preference UI was added because no identified non-essential tracking has an approved consent model.
- No PAIA route, PDF, download, Information Officer detail, or access procedure was invented.

## 4. Brand, icons, Open Graph, and manifest

`KtCouriersWordmark` retains readable type as the primary identity and gives linked marks the accessible name “KT Couriers”; decorative mark details are hidden from assistive technology. `KtCouriersMark` is a compact R10 digital utility mark, not a trademark registration claim.

The Next 16 image metadata routes are `app/icon.tsx` (512 × 512), `app/apple-icon.tsx` (180 × 180), and `app/opengraph-image.tsx` (1200 × 630). `app/manifest.ts` declares a browser-mode manifest only. The legacy 32 × 32 `favicon.ico` remains a documented replacement blocker; it has not been described as a final asset.

The full asset matrix, colors, safe use, sizes, byte sizes, hashes, and replacement process are in [r10-brand-assets.md](r10-brand-assets.md). The default OG card uses an in-repository, generated, text-led brand composition and no remote image, provisional campaign image, fake product, price, or review. Route-level R10 metadata now consistently falls back to that card instead of referencing provisional media.

## 5. SEO matrix, metadata, and canonical audit

The server-safe origin authority is `lib/public-site/site-origin.ts`. It normalizes only HTTP(S) origins, rejects path/query/fragment/credentials, never derives canonicals from a request host, and takes the repository’s established `https://ktcouriers.com` authority unless a verified server-side `KT_COURIERS_SITE_ORIGIN` is supplied. The root metadata configuration is `lib/public-site/site-metadata.ts`.

| Route group | Title / description ownership | Canonical | Robots | OG | Structured data | Sitemap | Closure action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home | Central public metadata; absolute homepage title | `/` | Index/follow | Default R10 card | None added | Included | Complete. |
| Services and 11 service pages | Service registry title/description | Each route | Index/follow | Default R10 card | Visible breadcrumb list | Included | Complete; no provisional social image. |
| About, Coverage, Membership, Careers, FAQ, Contact, Join | Central public metadata helper | Each route | Index/follow | Default R10 card | Existing visible route content only | Included | Complete. |
| Developers | Existing public developer metadata | `/developers` | Index/follow | Root default card | Visible breadcrumb list | Included | Existing OpenAPI authority preserved. |
| Marketplace landing/descendants | Dynamic marketplace layout/route metadata | `/shop` only for landing | Noindex while locked | Default R10 card | Data schema remains inaccessible while locked | Excluded from root sitemap | Lock preserved. |
| Auth, cart, checkout, confirmation, protected families | Existing functional metadata | No token/query canonical | Noindex | No public social card requirement | None added | Excluded | Existing flows preserved. |
| Legal and safety review states | Legal metadata helper / public helper | Each stable route | Noindex | Default inherited card; no legal screenshot | None | Excluded | Honest publication state. |

The title template is `%s | KT Couriers`; route inputs no longer include the `| KT Couriers` suffix. Canonicals are produced through the Next Metadata API, omit tracking/query/fragment data, and use the same no-trailing-slash route policy as the App Router. No localhost or preview hostname is hardcoded in R10 metadata.

## 6. Sitemap and robots closure

`app/sitemap.ts` maps only indexable, sitemap-enabled definitions from the route registry and deliberately omits generated build dates and marketing priorities. It includes the home, Services overview, eleven service routes, About, Coverage, Membership, Careers, FAQ, Contact, Join, and Developers. It excludes locked Marketplace, legal review pages, auth, protected, cart, checkout, order-confirmation, and token/query routes.

`app/robots.ts` references canonical root and marketplace sitemap routes; it leaves public CSS, scripts, fonts, and images crawlable. It disallows safe private/operational prefixes and does not treat robots rules as authorization. Marketplace descendant, auth, cart, checkout, and legal indexability is still controlled by route metadata.

## 7. Structured-data audit

Retained types are only evidence-backed output already visible on the relevant route: service/developer breadcrumb lists and marketplace product/offer schema that is gated behind the existing public-storefront production lock. R10 did not add WebSite SearchAction, Organization facts, address, telephone, sameAs, logo claim, ratings, reviews, salaries, opening hours, or compliance schema. No fake Product, Offer, AggregateRating, Review, or hidden FAQ schema was added.

## 8. Internal links, header, and footer

The header remains focused on Services, Coverage, Marketplace, Join, Membership, Careers, About, Support, tracking, sign-in, and the existing quote route. The mobile sheet uses the same navigation array. The footer provides Services, Coverage, Marketplace, Join, Careers, About, FAQ, Contact, Developers, and stable legal-review links without fake social, app-store, telephone, email, office, or legal-entity details.

The R10 source audit found no `javascript:` or blank-placeholder `href` in public navigation. Existing guarded account request/order links were preserved; they were not replaced merely because sign-in is required. Valid existing fragments are `#service-index`, `#stores`, `#drivers`, `#promoters`, `#support`, and `#coverage`.

## 9. Not-found, errors, locked states, assets, and accessibility

`PublicNotFound` provides one H1 plus Return home, Explore services, and Contact support actions. Its route metadata is noindex. `PublicErrorState` is a generic client error boundary with retry, home, and contact actions and no stack trace, database detail, error digest, or fake case number. Next 16 error boundaries are client components and cannot export static metadata; actual error responses retain their error status while no manual `document.head` mutation was introduced.

Locked/unavailable presentation remains distinct: marketplace is locked informationally, membership checkout is unavailable, legal documents need review, safety publication is in preparation, and protected routes remain protected. No backend lock, payment, auth, session, dashboard, catalog, or marketplace behavior was changed.

The public asset source scan found local in-repository image paths and the R2/R4 provisionally labelled media system. R10 adds only the compact-mark SVG and generated metadata routes. No remote hotlink, watermark, thumbnail source, source-master asset, or license document is referenced by R10. Full size/hash records for new brand assets are in the brand document.

Legal print rules are scoped to the legal component module: they remove the legal TOC, print black on white, retain headings/status/text, and avoid changing dashboard printing. R10 surfaces use one H1, accessible wordmark labels, decorative SVG hiding, visible focus inherited from the public visual system, semantic navigation, anchor scroll margin, and reduced-motion-compatible static presentation. Forced-colors, zoom/reflow, keyboard, and print output require R11 browser evidence.

## 10. Performance, server/client boundary, and TypeScript

Metadata, origin, sitemap, robots, registries, legal review pages, icons, OG card, manifest, and not-found page are server-first. The existing public header keeps its bounded client interaction; the error boundary remains client-only as required by Next. No runtime SEO package, client metadata manager, analytics package, dependency, or image dependency was added.

Focused R10 type errors were corrected. Repository-wide `tsc --noEmit` still reports pre-existing errors in `lib/developer-api`, `lib/notifications`, and existing integration/Phase 27 test files; see `R10-TYPECHECK-001` in the launch blocker registry. R10 does not claim a clean repository-wide typecheck.

## 11. Launch blockers and manual validation

The complete evidence-based list is [r10-launch-blockers.md](r10-launch-blockers.md). It includes legal source approval, PAIA readiness, legal identity/contact authority, legacy ICO replacement, marketplace lock approval, baseline TypeScript remediation, and R11 QA.

Run the following ordered checks from the repository root:

```powershell
npx vitest run tests/r10/public-site-closure.test.ts
```

```powershell
npx eslint app/layout.tsx app/sitemap.ts app/robots.ts app/manifest.ts app/icon.tsx app/apple-icon.tsx app/opengraph-image.tsx 'app/(public)/privacy-policy/page.tsx' 'app/(public)/terms/page.tsx' 'app/(public)/cookie-policy/page.tsx' 'app/(public)/accessibility/page.tsx' 'app/(public)/safety/page.tsx' components/public-v2/legal components/public-v2/brand components/public-v2/errors lib/public-site lib/public-legal lib/public-assets/brand-assets.ts
```

```powershell
npx tsc --noEmit --pretty false
```

```powershell
git diff --check
```

```powershell
rg -n -i "google analytics|googletagmanager|facebook\\.net|tracking pixel|gtag\\(" app components lib
```

```powershell
rg -n "localhost|vercel\\.app|href=\\\"#\\\"|javascript:" app components/public-v2 lib/public-site
```

## 12. R10 file ledger

| Path | Responsibility | Server/client status | Risk |
| --- | --- | --- | --- |
| `app/layout.tsx` | Central metadata integration | Server | Low; metadata-only authority. |
| `app/sitemap.ts`, `app/robots.ts` | Registry-driven crawl closure | Server route metadata | Low; no authorization behavior changed. |
| `app/manifest.ts`, `app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx` | Next 16 web metadata assets | Server image/metadata routes | Low; no runtime application state. |
| `app/(public)/privacy-policy/page.tsx`, `terms/page.tsx`, `cookie-policy/page.tsx`, `accessibility/page.tsx` | Legal review-state routes | Server | Medium legal presentation; no legal prose generated. |
| `app/(public)/safety/page.tsx` | Removes unsupported safety claims until source authority exists | Server | Medium content correction; remains noindex. |
| `app/(public)/page.tsx`, `about/page.tsx`, `coverage-areas/page.tsx`, `membership/page.tsx`, `careers/page.tsx`, `faq/page.tsx`, `contact/page.tsx`, `join/page.tsx`, `services/page.tsx` | Complete public metadata and OG fallback | Server | Low SEO-only change. |
| `app/(public)/shop/layout.tsx`, `app/(public)/shop/sitemap.ts` | Marketplace lock-aware metadata and sitemap dates | Server | Low; existing production lock remains authoritative. |
| `app/(auth)/*/page.tsx` metadata and `app/(account)/developers/[[...segments]]/page.tsx` metadata | Removes inherited duplicate `KT Couriers` title suffixes | Server metadata only | Low; no authentication or developer-portal behavior changed. |
| `components/public-v2/legal/*` | Legal document architecture, TOC, status and print styles | Server components/CSS module | Medium presentation only. |
| `components/public-v2/brand/*`, `components/public-v2/site/PublicHeaderV2.tsx`, `PublicFooterV2.tsx` | Readable wordmark and compact mark integration | Header remains client; footer/server utilities remain compatible | Low visual/accessibility change. |
| `components/public-v2/errors/*`, `app/not-found.tsx`, `app/error.tsx` | Public 404 and safe error state | 404 server; error boundary client as Next requires | Low; no error contracts changed. |
| `lib/public-site/*`, `lib/public-legal/legal-document-registry.ts`, `lib/public-assets/brand-assets.ts` | Typed SEO/legal/asset authorities | Server-safe modules | Low; no product or permission data. |
| `public/images/kt-couriers/brand/kt-couriers-mark.svg` | Compact-mark source reference | Static asset | Low; no remote asset or claim. |
| `components/marketing/LegalDocument.tsx` | Removed unused placeholder legal component | Removed | Low; no remaining imports. |
| `docs/legal/privacy-data-inventory.md`, `docs/legal/cookie-storage-inventory.md`, `docs/frontend/r10-brand-assets.md`, `r10-launch-blockers.md`, this document | Evidence and implementation documentation | Documentation | Low. |
| `tests/r10/public-site-closure.test.ts` | Focused route/legal/SEO/asset/link contracts | Test-only | Low. |

## 13. R11 browser-review checklist

Review the homepage; Services overview and every service; About; Coverage; Membership; Careers; FAQ; Contact; Marketplace; Join; Developers; Login and signup; every legal route; public 404; and public error state at 320px, 390px, 768px, 834px, 1024px, 1280px, 1440px, and 1920px.

Verify header/mobile navigation/footer links, canonical tags, metadata titles, social-card preview, favicon, Apple icon, manifest, sitemap, robots, legal noindex states, print preview, keyboard operation, forced colours, reduced motion, 200% zoom, 400% reflow, overflow, images, links, console errors, homepage motion, native scroller, auth, and marketplace lock regression.

R11 — Public Static-Site Final QA, Accessibility, Performance and Launch Audit
