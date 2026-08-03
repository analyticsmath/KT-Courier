# R11 — Public static-site final QA and audit

Audit date: 2026-07-29  
Scope: public marketing, legal, public-entry, marketplace-preview, authentication, and anonymous functional routes. Protected operational dashboards are recorded as boundaries only; they are not redesigned in R11.

## A. Outcome

**Launch decision: NO-GO.** The public shell, entry surfaces, metadata boundaries, static accessibility hooks, and locked-marketplace treatment are materially safer after the R11 fixes. Launch cannot be approved while the R10 legal, brand, marketplace-production, typecheck, and browser-QA gates remain open.

This is a source/static audit. `VERIFIED_PASS` means a targeted command completed successfully. `SOURCE_REVIEWED` means the conclusion comes from code inspection and still needs runtime/browser evidence where noted. `NOT_RUN_BY_SCOPE` is deliberately not a failure.

## B. R11 scope and boundaries

Included:

- Public and anonymous route inventory, routing boundaries, navigation, metadata, sitemap/robots, forms, source-level accessibility, privacy/storage scan, and focused test/lint evidence.
- Remediation that is local to the public surface: public shell consistency, skip links, static noindex/canonical handling, locked-marketplace header behavior, and the contact form.

Excluded:

- Protected account, driver, promoter, store, developer-console, and applicant application redesign.
- Backend/API behavior changes, authentication-flow changes, schema/migrations, package updates, production configuration, legal-copy authoring, build, full typecheck, full test suite, browser automation, Lighthouse, and deployment.

## C. Evidence and validation limits

| Evidence | Result | Meaning |
| --- | --- | --- |
| Focused ESLint on R11 source files | `VERIFIED_PASS` | No lint output or non-zero exit for the explicit file list. |
| `tests/r11/public-static-audit.test.ts`, R7, R8, R10 focused suites | `VERIFIED_PASS` | 4 files, 29 tests passed. |
| R9 public-entry suite | `SOURCE_CONFLICT` | 3 legacy source-contract assertions fail; see section R. |
| R4/R5/R6 supporting suites | `SOURCE_CONFLICT` | 1 R6 legacy sitemap source-contract assertion fails; see section R. |
| Trailing-whitespace scan of R11 file list | `VERIFIED_PASS` | No matches. |
| `git diff --check` | `VERIFIED_PASS_WITH_LIMIT` | Clean tracked diff; the repository’s public rebuild is predominantly untracked, so this is not a whole-worktree assertion. |
| Full build, full `tsc --noEmit`, full suite, browser/AT/performance checks | `NOT_RUN_BY_SCOPE` | Intentionally deferred; R10 already records a repository-wide TypeScript baseline failure. |

The focused test invocation emitted the existing `vite-tsconfig-paths` deprecation warning; it did not affect the pass/fail result.

## D. Route inventory and ownership boundary

| Route family | Delivery state | Index/sitemap intent | R11 disposition |
| --- | --- | --- | --- |
| `/`, `/about`, `/accessibility`, `/contact`, `/coverage-areas`, `/faq`, `/join`, `/membership`, `/safety` | Public marketing / supporting surface | Indexable only where represented in the public-route registry | Public static QA surface. |
| `/services` and `/services/{business,driver-network,ecommerce,food,freight,grocery,moving,parcel,pharmacy,pricing,shuttle}` | Public service architecture | Indexable service pages | Public static QA surface. |
| `/careers`, `/careers/jobs`, `/careers/jobs/[reference]` | Public recruitment entry | Review required for dynamic job-detail metadata | Public entry surface; legacy dynamic detail is an open finding. |
| `/privacy-policy`, `/terms`, `/cookie-policy` | Legal/public supporting pages | Currently noindex and excluded until approved source material exists | Do not treat as launch-ready legal publication. |
| `/shop`, `/shop/categories`, `/shop/categories/[...categoryPath]`, `/shop/collections`, `/shop/collections/[collectionSlug]`, `/shop/products/[product]`, `/shop/products/[product]/[variantReference]`, `/shop/search`, `/shop/stores`, `/shop/stores/[storeSlug]`, `/shop/stores/[storeSlug]/categories/[...categoryPath]` | Marketplace public entry / catalog | Locked, noindex, excluded from sitemap until existing production approval is true | R11 preserves the lock and prevents the extra storefront header while locked. |
| `/cart`, `/checkout`, `/checkout/[reference]`, `/checkout/[reference]/{cancel,contact,delivery,payment,return,review,status}`, `/order-confirmation/[publicReference]`, `/membership/checkout` | Anonymous transaction functionality | Noindex; canonical must not inherit `/` | Functional boundary, not marketing pages. |
| `/login`, `/signup`, `/signup/select`, `/forgot-password`, `/reset-password`, `/verify-otp`, `/security-verification`, `/session-expired`, `/account-locked`, `/accept-invitation` | Authentication public entry | Noindex; canonical suppressed | R11 static QA surface. |
| `/developers` | Public developer overview | Indexable canonical `/developers` | Now uses the public visual shell. |
| `/developers/*`, `/account/*`, `/driver/*`, `/promoter/*`, `/store/*` | Protected operational applications | Noindex/auth-gated by their feature boundary | Out of redesign scope. |
| `/applicant`, `/applicant/applications`, `/applicant/applications/[reference]`, `/applicant/checks`, `/applicant/confirmation`, `/applicant/documents`, `/applicant/interviews`, `/applicant/new/[openingReference]`, `/applicant/offer`, `/applicant/personal-details`, `/applicant/privacy`, `/applicant/profile`, `/applicant/questions`, `/applicant/review`, `/applicant/data-requests` | Applicant workflow | Noindex and canonical suppression added at route-group boundary | Retains its legacy operational UI; no redesign/auth re-architecture in R11. |
| Root `not-found`, root `error`, marketplace `error` | Error handling | No sitemap entry; verify UI manually | Browser/AT validation remains required. |

## E. Rendering, content, and routing findings

Marketing route wrappers are server-rendered/static where expected; individual headings are commonly composed by their feature components rather than declared in route wrappers. Authentication pages have static metadata and use the auth shell. Applicant and legacy job-detail surfaces are client-oriented operational/legacy routes, not suitable evidence for public marketing readiness.

The optional developer catch-all previously allowed `/developers` to bypass the shared public header, footer, font variables, and main landmark. The zero-segment public overview is now explicitly wrapped by `PublicVisualRoot`, `PublicHeader`, `main#main-content`, and `PublicFooter`; child developer-console segments retain their protected surface.

## F. Metadata, canonical, and robots audit

The root site metadata establishes the home canonical. Before R11, several anonymous transactional, auth, applicant, and locked marketplace descendant routes could inherit that canonical. R11 adds the shared `noIndexPublicMetadata` helper and applies it at the relevant route/layout boundaries.

| Rule | R11 result |
| --- | --- |
| Marketing canonical | `SOURCE_REVIEWED`: public metadata helpers provide route-specific canonical metadata. |
| `/developers` canonical | `SOURCE_REVIEWED`: `/developers` is explicit; `/developers/*` suppresses canonical and is noindex. |
| Auth, applicant, cart, checkout, confirmation | `VERIFIED_PASS`: static contract test checks noindex/canonical-suppression coverage. |
| Locked marketplace descendants | `VERIFIED_PASS`: static contract test checks static and dynamic noindex treatment, including faceted store categories. |
| Dynamic careers job detail | `OPEN`: no dedicated metadata contract was found. |

## G. Sitemap, robots, and indexing

The R10 public-route registry is the current sitemap source of truth. It excludes legal pages awaiting approved copy and marketplace pages while `STOREFRONT_PRODUCTION_VALIDATION_APPROVED` is false. R11 does not bypass that lock. The old R6/R9 tests assert superseded implementation strings instead of the registry behavior; this is tracked in section R and must be reconciled before relying on the full suite as a release gate.

`robots.txt` is only one layer; R11’s route metadata prevents accidental indexing/canonical contamination of functional, auth, applicant, and locked-marketplace endpoints.

## H. Navigation and destination audit

The public header/footer own marketing navigation, and the public developer overview now participates in that shell. Locked `/shop` no longer mounts a second `StorefrontHeader` below the public header. This preserves catalog navigation when the marketplace is available while keeping the locked preview on the public shell only.

Source links were reviewed as internal routes or explicit external destinations. Browser verification is still needed for active states, scroll/sticky behavior, footer links, redirects, and all mobile menu interactions.

## I. Responsive and visual-system audit

Public V2 styles are token-led and most interactive style modules include reduced-motion and forced-colors rules. The static/non-interactive brand, errors, legal, and site modules need browser review rather than a blanket source verdict. `service-pages.module.css` uses a separate styling pattern and requires visual review at the breakpoint matrix below.

The R11 changes keep the existing public typography and visual-root composition; no dashboard visual system was copied into public pages.

## J. Accessibility audit

| Control | Status | R11 action / remaining proof |
| --- | --- | --- |
| Skip to main content | `VERIFIED_PASS` (source) | Added focus-revealed skip links to public and auth shells, targeting `main#main-content`. Verify keyboard operation in browser. |
| Main landmarks | `SOURCE_REVIEWED` | Public, auth, and public developer overview have named main targets. Review all error and legacy routes manually. |
| Contact field labels/errors | `VERIFIED_PASS` (source) | Native controls have labels, autocomplete, `aria-invalid`, and `aria-describedby` tied to error text. |
| Error/success announcement | `VERIFIED_PASS` (source) | Contact generic failure uses `role=alert`; success uses `role=status`. Test with screen readers. |
| Keyboard/focus visibility | `SOURCE_REVIEWED` | Public contact controls have `:focus-visible`, 48px minimum control height, forced-colors rules. Validate overlays and menus manually. |
| Motion/high contrast | `SOURCE_REVIEWED` | Interactive modules have source support; verify every animated component and OS forced-color mode in browser. |
| Semantic headings | `OPEN_MANUAL` | Inspect one visible H1 and heading order per route family at runtime. |

## K. Forms and user feedback

`ContactForm` remains on the existing `POST /api/contact` contract (`name`, `email`, `phone`, `enquiryType`, `message`). It was moved off legacy dashboard-style shared controls to a scoped public form style. It does not prevent paste, supplies name/email/telephone autocomplete, exposes field-specific errors programmatically, and converts non-field API failures to a safe generic message rather than displaying raw response text.

Submission success, network failure, field-validation behavior, focus recovery, and duplicate-submit behavior require browser evidence. Transaction, membership, marketplace, and applicant forms retain their existing feature behavior and are not rewritten here.

## L. Auth and protected-surface boundary

Authentication pages are noindex and use the auth shell’s skip target. The public developer overview’s anonymous entry now links to `/login` without an ignored arbitrary `next` query; no server redirect/authentication behavior was changed.

R11 did not test role redirects or authenticated pages. Those require representative accounts and a protected-application phase. Treat any apparent access to an account, applicant, developer-console, driver, promoter, or store route without a valid session as a security defect, not a public-visual task.

## M. Security, privacy, and data-exposure review

Static source scans found no `localStorage`, `sessionStorage`, `document.cookie`, or `NEXT_PUBLIC_*` secret/token/key patterns in the audited public/auth/contact source. No third-party tracking integration was found in that static scan. This is not runtime network proof.

Open security finding: the careers opening API’s generic 500 path returns `error.message`, and the legacy job-detail client presents API error content. The message must be normalized server-side and the public UI must present a safe generic failure. This is an API/recruitment-owner remediation, outside R11’s no-backend-change boundary.

## N. Brand and media readiness

R10’s approved asset routing remains in place. The legacy `/favicon.ico` fallback is still a R10 brand blocker pending an approved compact-mark export. R11 does not claim final brand/legal approval or substitute generated legal copy for approved source material.

## O. Performance readiness

Source review indicates local media/font handling and image configuration are present. No production build, network waterfall, Core Web Vitals, image-size audit, Lighthouse run, or mobile throttling test was performed by scope. Performance is therefore **not approved**.

## P. Required browser and assistive-technology matrix

Run this after the repository-wide typecheck baseline is clean, using at least Chrome and one independent engine, with keyboard-only and a screen reader where available.

| Viewport / mode | Routes and checks |
| --- | --- |
| 360 × 800 mobile | `/`, `/services`, one service detail, `/contact`, `/login`, `/developers`, locked `/shop`; menu, focus, overflow, tap targets, sticky/header behavior. |
| 768 × 1024 tablet | Header/footer wrapping, card grids, service navigation, contact validation, auth shell, errors. |
| 1440 × 900 desktop | All primary navigation/footer destinations, visual regressions, max-width rhythm, developer overview. |
| Keyboard only | Skip link on public/auth/developer entry, modal/menu focus trap, visible focus, escape/close, no traps. |
| Screen reader | Contact labels/errors/status, heading order, landmark names, route-change/error announcements. |
| Reduced motion / forced colors | Home, service, auth, support and marketplace-preview interaction surfaces. |
| Anonymous functional routes | `/cart`, `/checkout`, representative checkout detail/status, order confirmation: no homepage canonical, safe error states, no sensitive data in UI. |
| Locked marketplace | `/shop` plus a category/product/store URL: no duplicate header, no store/catalog leakage, noindex response metadata. |
| Careers/applicant | Job-detail API failure is generic; applicant routes either correctly enforce session/role or are escalated. |

## Q. Manual validation commands

Run only after the pre-existing TypeScript defects are separately resolved; do not use a passing focused test as a release substitute.

```powershell
npx tsc --noEmit
npm run lint
npm test
npm run build
```

Then inspect the rendered metadata, sitemap, and robots behavior in the deployed preview. Confirm production marketplace activation only after the existing approval flag/process is satisfied; do not toggle it solely to make a QA check pass.

## R. Test reconciliation and defect register

| ID | Severity | Status | Evidence / required owner |
| --- | --- | --- | --- |
| R11-SEO-001 | High | Fixed | Anonymous functional/auth/applicant routes no longer inherit the root canonical; R11 static suite passes. |
| R11-VIS-001 | High | Fixed | `/developers` public overview now has the public shell, header/footer, fonts, and main landmark. |
| R11-A11Y-001 | High | Fixed (source) | Contact labels, input-error relationships, status/error roles, and public styling added; needs AT browser proof. |
| R11-A11Y-002 | High | Fixed (source) | Public/auth skip links and main targets added; needs keyboard browser proof. |
| R11-SEO-002 | High | Fixed | Locked shop descendants suppress canonical/indexing; locked state no longer renders a duplicate storefront header. |
| R11-SEC-001 | High | Open | Careers opening API/client can surface raw error detail. Backend/recruitment owner must normalize errors. |
| R11-SEO-003 | Medium | Open | Legacy `/careers/jobs/[reference]` lacks a dedicated metadata contract. Public recruitment owner should add canonical/robots/title behavior. |
| R11-APP-001 | High | Open boundary | Applicant workflow remains a legacy operational client surface. Security/role enforcement and visual redesign belong to protected-app discovery, not R11. |
| R11-TEST-001 | Medium | Open | R6 test expects obsolete `indexablePublicServicePages` source; R10 registry is current sitemap authority. Test owner must migrate assertion to behavior/registry. |
| R11-TEST-002 | Medium | Open | R9 expects literal page-local canonicals and `/shop` in sitemap, conflicting with R10 metadata helpers and production lock. Test owner must reconcile contractual intent. |
| R10-LEGAL-001 … R10-LEGAL-006 | Blocker | Open | Approved legal/identity/agreement sources are still required. See `r10-launch-blockers.md`. |
| R10-MEDIA-001 | Blocker | Open | Approved compact favicon ICO still required. |
| R10-PRODUCTION-001 | Blocker | Open | Marketplace public activation remains locked pending existing approval. |
| R10-TYPECHECK-001 | Blocker | Open | Repository-wide TypeScript baseline still fails in pre-existing developer API, notifications, and integration-test areas. |
| R10-BROWSER-001 | Blocker | Open | The browser/accessibility/performance validation in section P has not yet been run. |

Focused suite results:

```text
PASS  tests/r11/public-static-audit.test.ts
PASS  tests/public-v2/r7-supporting-pages.test.ts
PASS  tests/public-v2/r8-auth-experience.test.ts
PASS  tests/r10/public-site-closure.test.ts
29 tests passed
```

The R9 suite has 3 expected reconciliation failures (page-local canonical literals for `/join` and `/developers`, plus a stale expectation that locked `/shop` appears in the sitemap). The R6 suite has 1 expected reconciliation failure (obsolete source-string expectation for the sitemap implementation). These must be corrected or formally retired; they are not silently waived.

## S. Files changed in R11

- Shared public metadata helper and noindex layout boundaries for auth, applicant, checkout, confirmation, and locked marketplace routes.
- Public/applicant and checkout detail layouts; locked marketplace metadata including faceted store categories.
- Public developer overview shell and safe login entry link.
- Conditional marketplace storefront header for available state only.
- Public contact form and its scoped stylesheet.
- Public/auth skip links and main targets.
- Focused static audit test coverage.

## T. Launch-go/no-go decision

**NO-GO.** Do not approve the public static-site release from this audit. The immediate non-negotiable gates are: approved legal/identity source material, compact approved favicon, clean repository-wide typecheck, reconciled/green release test suite, browser/accessibility/performance evidence, and an explicit marketplace production approval before catalog exposure.

No credentials, secrets, migrations, package installs, production flags, legal claims, or protected-dashboard behaviors were changed by R11.

## U. Exact next phase

**R12 — Protected Application Front-End Discovery and Dashboard System.**

Start only after the R11 public launch blockers are owned. R12 should inventory authenticated role surfaces, validate server-side authorization and role redirects with representative accounts, establish the protected dashboard design/token system, and plan migration of legacy applicant/developer/driver/promoter/store experiences without weakening existing authorization or operational workflows.
