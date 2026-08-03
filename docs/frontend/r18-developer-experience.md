# R18 — Developer Portal Experience

## Objective

R18 replaces the placeholder deeper developer catch-all with a protected Editorial Operations integration workbench. It leaves the public `/developers` Editorial Freight entry, Phase 28 services, API DTOs, OpenAPI JSON, production lock, credential lifecycle, rate/quota enforcement, webhook delivery and retry implementation unchanged.

## Verified route inventory and boundary

The prior optional catch-all mixed two different products: zero segments rendered the public developer overview, while every deeper segment rendered an unguarded generic `DeveloperPortalSurface`. R18 makes the public root a static `app/(account)/developers/page.tsx` and changes the deeper matcher to the required `app/(account)/developers/[...segments]` route. The static public page retains its public metadata, header, footer, public visual root and OpenAPI link. Only the required deeper matcher receives `app/(account)/developers/[...segments]/layout.tsx` and its Editorial Operations shell.

This is a route-boundary correction, not a route rename: `/developers` and all pre-existing deeper catch-all paths are retained. The shell is selected by server route structure, never a client pathname check. It contributes the only protected `main` landmark; portal pages use frames and sections only.

## Owner contexts and information architecture

Developer is a protected application context, not a `UserRole`. The existing registry makes it available only to customer and store users. The nested layout calls `requireAuth()`, verifies that context server-side, resolves filtered navigation server-side, and labels the user as an “Integration owner.” It never creates a `DEVELOPER` role.

Verified primary destinations are Applications, Documentation, Credentials, Webhooks, and Usage and quotas. The public root is deliberately absent from protected navigation. Application detail routes provide the secondary credential, webhook, quota and request-activity workspaces; webhook detail routes provide delivery workspaces. There is no invented `/developers/overview`, dashboard route, notification route, API console, or app-ID navigation payload.

## Operational-state hierarchy and overview

The applications workspace is the protected overview because it is the first verified owner route. Its presentation precedence is: no applications; unknown application source state; suspended/revoked; not approved; submitted/under review; missing recorded terms acceptance; approved/active without active credential; credential security action; webhook delivery failure; recorded quota usage; otherwise ready. The selector is presentation-only and maps unknown application status to unavailable, never healthy or approved.

At most four direct source-backed counts appear: applications, active credential records, active webhook endpoints, and canonical delivery-failure records. There are no uptime, latency, success-rate, traffic, forecast, quota-exhaustion, or health-score claims.

## Application lifecycle, terms, environments and scopes

Application list/detail values are selected from the owner-scoped `DeveloperApplication` authority and mirror safe session DTO fields. Creation posts to the unchanged `/api/developer/applications` endpoint. Submission, review and lifecycle decisions remain in the existing API/service workflow; R18 does not offer approval or lifecycle manipulation.

Terms stay with `DeveloperTermsService`. The portal only shows the owner-safe recorded acceptance time. It does not invent terms text or a version, and creation/issuance continues to be enforced on the server.

The exact environment authority is `TEST` and `LIVE`. Test is shown textually. Live applications display a locked status while `DEVELOPER_API_PRODUCTION_VALIDATION_APPROVED` remains false; the lock reason is `DEVELOPER_API_CONSOLIDATED_VALIDATION_NOT_APPROVED`. No UI infers live readiness or merges environment data.

Scope display is sourced from canonical stored scope grants and `DEVELOPER_SCOPE_DESCRIPTIONS`. `ACTIVE`/`APPROVED` grants display as approved, draft grants as requested, and retired grants as retired. The page does not derive scopes from routes, account permissions, or submitted form choices.

## Credentials, display-once secrets, rotation and revocation

Credential rows read only public reference, prefix, masked display, application/environment association, status, timestamps and dates. The server projection never selects credential hash, fingerprint, or raw material. Creation and rotation call the existing session API only after explicit user action; the API remains responsible for owner, terms, application, scope, environment, quota, generation, hashing, audit and one-time response behavior.

A small client island holds a returned `secret` only in transient component state. It is not included in server props, route parameters, fragments, metadata, analytics, logging, browser storage, refetch logic, documentation examples, or toast copy. A labelled Copy secret action requires an explicit click, announces success/failure, and shows an accurate unrecoverable warning. Dismissing or navigating away unmounts the island; reloading cannot reconstruct the secret. Rotation uses the canonical service to create a replacement and mark the previous credential expiring under its existing overlap policy; revocation asks for explicit confirmation and never optimistically removes a record.

## Rate limits, quotas and API activity

The portal keeps these concerns distinct. Owner-safe `DeveloperApiQuotaUsage` counter records are displayed as recorded use by dimension and period, without a forecast or upgrade claim. The Phase 28 rate counter is keyed by a protected identity hash and has no owner-safe remaining/reset projection. R18 therefore renders an honest unavailable state rather than deriving a rate window from request logs.

Request activity is shown only where the existing owner API exposes safe request ID, route template, method, response status and timestamp data. It excludes headers, credentials, query values, bodies, internal hosts, stack traces, duration/latency claims, and idempotency record data.

## Webhook endpoints, verification, subscriptions and signing secrets

Endpoint list/detail views select only masked endpoint, application/environment, status, version, exact event selection and safe timestamps. Raw URL, endpoint fingerprint, encrypted endpoint, verification challenge, DNS/SSRF evidence and signing secret are never selected. Creation and edit use only `WEBHOOK_EVENT_CATALOG` event names. The canonical endpoint service still validates HTTPS, host safety, owner, scope, environment and verification; no client validation is authoritative.

The UI exposes only API-supported actions: edit subscriptions with `If-Match`, verification request, pause/resume, revoke, and signing-secret rotation. It waits for server responses. New signing secrets follow the same one-time transient reveal policy as credentials; stored signing secrets are never read or displayed.

## Deliveries, attempts, retries and payload policy

Delivery list/detail uses safe metadata only: event type when it has a canonical public-event projection, masked endpoint, status, attempt count and timestamps. Attempt history contains canonical attempt status, response status, failure class and times. It intentionally omits next-retry estimates, bodies, response previews, headers, signatures, secret versions, payloads, private references and customer data.

Payload visibility is `METADATA_ONLY` for the owner portal because the existing session DTO does not authorize a payload projection. Redaction is therefore server-side by omission, not a browser masking trick. Retry appears only for an existing `FAILED_RETRYABLE` delivery and only with the owner retry permission; it posts to the existing endpoint and waits for confirmation.

## OpenAPI, guidance, audit and notifications

`/api/openapi/v1.json`, served from `openapi/kt-couriers-v1.json`, remains the only specification authority. The documentation page links to it and provides only contract-backed bearer, idempotency, Problem Details, scope and webhook-signature guidance with placeholders. There is no Swagger, Redoc, live executor, proxy, terminal, generated code sample, or credential injection tool.

The Phase 28 developer audit model has no verified owner-scoped portal DTO, so R18 does not expose a fabricated audit timeline. Likewise, no dedicated developer notification route exists. The shared shell retains the existing safe notification-count projection and uses `/account/notifications` for customers or `/store/notifications` for stores; it does not invent developer notification categories or delivery channels.

## Server/client boundaries, mobile, accessibility and performance

Pages and the nested layout are Server Components. Server-only code resolves session/context, effective permission set, application ownership, safe associations and all record projections. Client islands are restricted to existing API form submissions, explicit secret copy/dismissal, and confirmed credential/webhook/delivery actions. They receive no raw Prisma model, permissions, session, raw secret before an action response, hash, endpoint, headers or payload.

Tables use the R13 `EditorialTable` with `mobileMode="stack"`, producing structured records at compact widths rather than a squeezed technical grid. Detail data uses one-column definition lists on small screens; code blocks have their own scroll region. The shell supplies a top app bar and full navigator rather than a consumer bottom-navigation model. Status is textual plus semantic status treatment, tables have captions, attempt history is ordered, secret warning/copy result are programmatically associated, and existing protected reduced-motion, forced-colours, focus, zoom and safe-area rules apply.

The overview uses bounded queries (31 quota records, 100 requests/deliveries/attempts) and does not fetch OpenAPI JSON or full payloads. Any N+1 or missing portal-safe projection is a backend follow-up, not a frontend workaround.

## Security, privacy and production locks

R18 preserves authenticated owner filtering in both page projections and existing API routes. It changes no auth/session, permissions, lifecycle, terms, scope grant, credential, quota, rate, webhook, retry, OpenAPI, Prisma, migration, dependency or generated file. It exposes no another-owner record, secret, hash, encrypted value, header, cookie, payload, review evidence, internal network evidence, path or stack trace.

## Known backend limitations

- No owner-safe remaining/reset rate-limit DTO exists.
- Quota records expose canonical counters but not a safe total/remaining projection; R18 does not invent one.
- No owner-safe audit timeline DTO exists.
- Delivery payload/header/response-body views are not authorized by the existing owner DTO.
- The existing owner session API has bounded fixed lists rather than portal-specific cursor controls; R18 preserves that contract.

## R19 boundary

R19 — Recruitment Applicant Experience
