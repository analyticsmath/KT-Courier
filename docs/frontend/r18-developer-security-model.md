# R18 — Developer Security Model

## Ownership and context

Developer is an Editorial Operations context for authenticated `CUSTOMER` and `STORE` users, not a role. The required deeper route layout calls `requireAuth`, validates the context server-side and receives a server-filtered navigation projection. Pages resolve effective permissions on the server; navigation convenience never authorizes a page or mutation.

All presentation reads are constrained by `ownerUserId` or by an application/subscription ID already selected from that owner set. The implementation maps only public references and safe operational fields. It does not serialize raw Prisma objects, session data, raw permission keys, review notes, credential fingerprints/hashes, encrypted endpoint/secret, verification challenge, headers, cookies, payloads or response bodies.

## Credential and secret policy

Credential creation, hashing, rotation, revocation and display-once response semantics remain in `CredentialService` and the existing session API. A new secret enters the browser only after the canonical POST response, is held in component state, can be copied only through explicit activation, and is discarded on component unmount/dismissal. There is no automatic clipboard access, persistence, URL transport, analytics, logger, recovery/reveal-later control or response refetch.

Signing-secret creation/rotation uses the same policy. Credential and signing secret records are always masked on ordinary pages. Revocation is labelled revoke, requires explicit confirmation, waits for server confirmation and leaves historical safe records to the canonical data source.

## Environments, scopes, limits and production

Only `TEST` and `LIVE` are shown. Live remains visibly locked while the existing production readiness authority is false. Scope keys/descriptions come from the canonical scope registry; requested, approved and retired state remains explicit. Account permissions are not scopes.

Rate limiting and quota enforcement are unchanged. Rate counters are not shown because there is no safe owner remaining/reset DTO. Quota records show only canonical recorded counters. No client estimates exhaustion, enforces limits, forecasts usage, or offers upgrades.

## Webhooks and delivery privacy

The client submits only a candidate endpoint and selected exact catalog events; URL safety, SSRF checks, verification, scope, signing, retry policy and delivery execution remain server-authoritative. Ordinary presentation uses a masked endpoint and state only. Signing secrets are never included in delivery views.

Delivery visibility is metadata-only: event type, status, timestamps, attempt count, safe response status and failure class. Headers, bodies, payloads, signatures, customer data, internal network evidence and retry schedules are omitted at the server query boundary. Retry appears only for a canonical retryable record and waits for the existing API response.

## OpenAPI and regression tests

The served `/api/openapi/v1.json` document is the sole API authority. R18 adds no explorer, proxy, live execution or copied schema source. Focused tests cover public/protected route separation, context/role model, verified routes, unknown-state safety, absence of browser persistence/logging and absence of secret-bearing server selections. Focused scans also check the developer client components for browser-storage and logging tokens.
