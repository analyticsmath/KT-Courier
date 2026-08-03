# Phase 28 research and implementation map

This is a source-of-truth status map. `CONCRETE` means the named behavior is
implemented in source and covered by the focused verification map.

| Capability | Classification | Evidence |
| --- | --- | --- |
| Opaque Bearer credential format, hash verification, terms and scope grants | CONCRETE | `lib/developer-api/crypto.ts`, `services.ts` |
| Root-route authentication and active owner/store binding | CONCRETE | `gateway.ts`, `public-resource-adapters.ts` |
| Public quote/order/store-order canonical delegation | CONCRETE | `public-resource-adapters.ts` |
| Bounded JSON parsing and explicit public mutation schemas | CONCRETE | `schemas.ts`, `gateway.ts` |
| Cursor signing, bounded filters, basic credential rate limit and quota persistence | CONCRETE | `services.ts`, `gateway.ts` |
| Encrypted verification challenge and bounded webhook HTTP execution contract | CONCRETE | `crypto.ts`, `services.ts` |
| Complete multidimensional rate-limit and quota enforcement | CONCRETE | `DbRateLimitService` and `DbQuotaService` enforce complete repository-backed identities, deterministic windows/periods, atomic or serializable consumption, safe rollover, and fail-closed policy selection. |
| Durable order/store/dispatch event registry, public projection, immutable event creation and subscription fan-out | CONCRETE | `webhook-projection.ts`, `contracts.ts` |
| Canonical processor candidate selection | CONCRETE | `processor-service.ts` and the 12 Phase 28 script wrappers use bounded, deterministic Prisma selectors. |
| Full payment, refund and subscription webhook event matrix | CONCRETE | `payment-status-history`, `refund-status-history`, and `subscription-event-intent` have privacy-safe adapters. Events without a durable canonical source remain explicitly unsupported. |
| Complete self-service and admin control planes | CONCRETE | `session-gateway.ts` provides owner-bound applications, terms, credentials, usage, webhooks, delivery, review, scope, audit and safe operating workflows through canonical services. |
| OpenAPI parity for every public route, DTO, error and webhook surface | CONCRETE | The checked-in `openapi/kt-couriers-v1.json` is runtime-served verbatim and checked against the independent route manifest and runtime schema audit. |
| Full Phase 28 focused verification matrix | CONCRETE | `docs/testing/phase-28-focused-verification-map.md` records every focused family. PostgreSQL concurrency and Playwright are explicitly invalid for the focused count and deferred to Phase 30. |
| Live activation | NOT_IN_SCOPE | Locked by `DEVELOPER_API_CONSOLIDATED_VALIDATION_APPROVED`; no approval evidence is present. |
