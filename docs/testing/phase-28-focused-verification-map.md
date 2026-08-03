# Phase 28 focused verification map

PostgreSQL concurrency and Playwright execution remain Phase 30 scaffolds and
are explicitly excluded from focused-count totals. Every required focused row
below is executable and complete.

| Required invariant | Production source | Test family | Test file | Test name | Status |
| --- | --- | --- | --- | --- | --- |
| Credentials, cursor, SSRF, signatures, lock | `crypto.ts`, `services.ts`, `contracts.ts` | policy | `tests/phase28/developer-api-policy.test.ts` | Phase 28 public developer API policy | COMPLETE |
| Permission uniqueness, no wildcard and ownership-only scope | `permission-keys.ts`, `contracts.ts` | permission | `tests/phase28/developer-api-policy.test.ts` | has an exact read-only financial scope extension | COMPLETE |
| Payment adapter safe projection | `webhook-projection.ts` | service | `tests/phase28/developer-webhook-projection.test.ts` | maps a canonical payment status history | COMPLETE |
| Refund adapter safe projection | `webhook-projection.ts` | service | `tests/phase28/developer-webhook-projection.test.ts` | maps canonical refund and subscription intent records | COMPLETE |
| Subscription adapter safe projection | `webhook-projection.ts` | service | `tests/phase28/developer-webhook-projection.test.ts` | maps canonical refund and subscription intent records | COMPLETE |
| Event registry, ownership fan-out, replay conflict | `contracts.ts`, `webhook-projection.ts` | service | `tests/phase28/developer-webhook-projection.test.ts` | creates a privacy-minimised immutable event | COMPLETE |
| Webhook endpoint security and source selectors | `services.ts`, `webhook-projection.ts` | service | `tests/phase28/developer-webhook-registry.test.ts` | webhook registry and endpoint authority | COMPLETE |
| Repository rate authority | `services.ts` | policy | `tests/phase28/developer-api-rate-quota.test.ts` | hashes all mandatory rate dimensions | COMPLETE |
| Repository quota authority | `services.ts` | policy | `tests/phase28/developer-api-rate-quota.test.ts` | uses a serializable repository transaction | COMPLETE |
| Public runtime/OpenAPI methods, scopes, errors, policy metadata | `gateway.ts`, `openapi.ts`, `openapi/kt-couriers-v1.json` | OpenAPI parity | `tests/phase28/developer-openapi-parity.test.ts` | serves the checked-in static artifact | COMPLETE |
| Public route authority and unsafe-source audit | `gateway.ts`, `public-resource-adapters.ts` | source audit | `tests/phase28/developer-api-source-audit.test.ts` | Phase 28 source authority audit | COMPLETE |
| Developer self-service and admin control-plane source contract | `session-gateway.ts`, `DeveloperPortalSurface.tsx` | developer/admin/component | `tests/phase28/developer-api-component-contract.test.ts` | Phase 28 developer portal contracts | COMPLETE |
| Processor bounds, selectors, deterministic candidates, production lock | `processor-service.ts`, `phase28-processor-runner.ts` | processor/composition | `tests/phase28/developer-api-processor.test.ts` | Phase 28 processor authority | COMPLETE |
| Migration additive/no operational data | `20260727000000_phase28_public_api_webhooks/migration.sql` | source audit | `tests/phase28/developer-api-source-audit.test.ts` | keeps the migration additive | COMPLETE |
| Focused skipped/TODO audit | `tests/phase28` | scaffold audit | `tests/phase28/*.test.ts` | grep audit in lightweight validation | COMPLETE |
| PostgreSQL and Playwright scaffolds | `tests/phase28/scaffolds` | scaffold | `postgresql-developer-api.scaffold.ts`, `playwright-developer-api.scaffold.ts` | not executed | INVALID_FOR_FOCUSED_COUNT |
