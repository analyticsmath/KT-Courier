# R17 — Promoter and Referral Experience

## Objective

R17 replaces the legacy client-side promoter JSON viewer with a protected, server-rendered referral ledger. It preserves every verified `/promoter` path, the existing API/service/lifecycle authorities, ownership checks, production lock, and permissions. It changes presentation only.

## Verified route inventory and shell boundary

The live tree has 18 promoter pages: overview; referral tools; referrals and referral detail; earnings and earning detail; wallet; withdrawals; programmes and programme detail; assets; performance; compliance; profile; notifications; support; disputes and dispute detail. There are no promoter-local loading, error, or not-found boundaries; the existing root boundaries apply.

`app/(account)/promoter/layout.tsx` is the R17 boundary. The promoter tree did not inherit `app/(account)/account/layout.tsx`, whose guard is `CUSTOMER`. The nested layout therefore calls `requireRole(PROMOTER)`, resolves the R13 registry projection server-side, and mounts exactly one `EditorialOperationsShell` / main landmark. It does not duplicate a customer shell or add client role guessing.

Desktop navigation uses the server-filtered Workspace (Overview, Programmes, Referral tools, Referrals), Finance (Earnings, Wallet, Withdrawals), Growth (Assets), and Account (Compliance, Profile, Disputes, Notifications, Support) groups. Performance remains route-continuous but is removed from promoted navigation because no promoter-safe reporting projection is verified. Compact promoter navigation uses the existing labelled top bar and full-screen navigator, rather than a customer-style bottom bar.

## Operational state and lifecycle

`lib/promoter-presentation/promoter-overview-selection.ts` is a pure display selection, not a lifecycle authority. Its precedence is: restricted/closed/rejected account; changes required; applied/under review; approved but not active; active with incomplete readiness; active with pending qualification; active without recent activity; source unavailable. Unknown values are shown as unavailable and never treated as active, approved, eligible, or payable.

The exact account values are `APPLIED`, `UNDER_REVIEW`, `CHANGES_REQUIRED`, `APPROVED`, `ACTIVE`, `SUSPENDED`, `TERMINATED`, and `REJECTED`. The UI provides cautious, promoter-facing explanations and links only to existing profile, compliance, or support pages. It exposes no reviewer identity, internal note, fraud/risk finding, funding data, compliance evidence, or activation promise. There is no promoter application-submission or resubmission route in the live tree, so R17 adds neither.

## Overview and referral tools

The overview shows four bounded, source-backed values only: pending qualification count, active referral-code count, server-derived held earnings, and the wallet's available balance. It then prioritises programme state, one masked active code when one exists, recent owned attributed records, and a desktop-only earning context rail. It has no visits, clicks, impressions, customer counts, conversion rate, forecasts, growth, campaign metrics, charts, ranks, or artificial activity.

The only verified self-service referral tool is `PromoterReferralCode`. The current promoter-safe projection exposes `maskedDisplay`, status, dates, and optional channel name; it does not expose a full code or a server-confirmed shareable URL. R17 consequently renders no copy, native-share, social-network, QR, link builder, custom redirect, or artificial short-link UI. The existing creation and archival endpoints are retained but their canonical production lock is currently active, so the page truthfully presents no unusable controls. Channels remain API-backed but have no concrete protected page route.

## Attributed referrals, qualification, and privacy

Referral list and detail queries are server-owned and scope every row to the promoter account. They display only public reference, attribution status, promoter-safe qualification state, source category, and authoritative dates. Customer name, email, phone, address, order value, payment data, device/network fingerprint, raw subject identifier, attribution evidence, fraud signal, and internal matching data are never selected for the presentation.

Qualification maps are explicit for `PENDING`, `EVIDENCE_OBSERVED`, `QUALIFIED_HELD`, `RELEASABLE`, `RELEASED`, `INVALIDATED`, `REVERSED`, and `RECONCILIATION_REQUIRED`. A held earning is never labelled available; released is never equated with paid. Detail timelines include only stored attribution, qualification-record, qualification, and release timestamps. They never manufacture missing steps, a future release date, fraud review, funding event, or administrative actor.

## Earnings, wallet, and withdrawals

Earning pages use only the stored decimal fields and exact status projection. Decimal display is formatted server-side without numeric coercion. The UI distinguishes pending, held, payable, partially withdrawn, withdrawn, reversed, and reconciliation-required values, and excludes journal identifiers, commission plans/calculations, customer/order data, funding, and internal evidence.

Wallet is classified as a **read-only projection**: available, pending, and locked balances are selected without ledger-account or journal fields. Withdrawals show only request reference, amount, status, date, and safely masked payout destination. The promoter withdrawal endpoint remains production locked, so no withdrawal form, balance-derived eligibility, destination-management UI, payout promise, provider payload, maker/checker identity, or completion inference is added.

## Programme, profile, compliance, notifications, disputes, support, and performance

Programmes show only active-programme safe facts, enrolment state, and dates—not commission terms, eligibility algorithms, or hidden controls. Assets show approved titles, descriptions, and required disclosure without storage keys or invented download URLs. Profile and compliance show only promoter-safe readiness state; their PATCH endpoints are locked, so no misleading editable form is rendered.

Notifications use the owned inbox projection of title, body, state, time, and an owned `/promoter/*` deep link where supplied. Disputes show owned reference, category, status, timestamps, and a safe resolution when present; user statement/evidence details are withheld and mutation controls remain locked. Support is intentionally an honest unavailable state because no promoter support-ticket/contact projection exists. Performance is also an honest unavailable state: the current endpoint's vanity metrics are not used as an R17 reporting authority.

## Server/client, accessibility, performance, and security

Pages, data selection, navigation filtering, financial text, status mapping, and lists are Server Components. No page-wide client component, browser cache, permission fetch, raw Prisma object, or raw financial/attribution record is sent to the client. The existing R13 shell keeps its skip link, one main landmark, focus styling, forced-colours treatment, reduced-motion support, and safe-area spacing.

Every R17 page has one H1. Tables have captions, compact records are semantic lists, timelines are ordered lists, statuses use text as well as colour, and primary route actions have 44px targets. Data tables do not squeeze into compact screens: referral, earning, withdrawal, code, programme, asset, dispute, and notification records use structured mobile lists. The overview limits referral data to five records and does not load full earning or referral history. No new package, chart, QR, social SDK, or illustration asset is added.

## Production/provider locks and known backend limitations

The fixed promoter production lock remains authoritative. R17 neither changes nor bypasses it. Mutation APIs, code generation/archival, programme enrolment, profile/compliance edits, dispute mutation/evidence, and withdrawal requests remain unavailable according to their canonical API policy.

Known limitations: no promoter-safe share URL/full code projection; no referral-link model/route; no promoter filter or pagination contract; no promoter application form/resubmission route; no support-ticket/contact DTO; no notification preference route; no promoter-safe performance-reporting DTO; and no promoted withdrawal-detail route. R17 reports these rather than filling gaps with fixtures.

## R18 boundary

R18 — Developer Portal Experience
