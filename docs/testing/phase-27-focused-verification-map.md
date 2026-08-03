# Phase 27 focused verification map

## Scope and counting rule

This is the authoritative Phase 27 focused-verification inventory. `npx vitest run tests/phase27 --reporter=dot` completed with **17 files and 53 passing tests**. The two scaffold-inspection tests are preserved for Phase 30 handoff but are `INVALID_FOR_FOCUSED_COUNT`; therefore the focused executable count is **51 passing tests**. No `skip` or `todo` marker exists under `tests/phase27`.

`COMPLETE` below means the named executable contract test passed against the production service/module or a source-backed route/component contract. PostgreSQL, full authenticated HTTP, provider-network, Playwright, and deployment validation remain intentionally deferred to Phase 30.

## Baseline inventory before expansion

| Baseline file | Exact existing test names | Production source under test | Baseline classification | Final disposition |
|---|---|---|---|---|
| `api.test.ts` | `contains canonical user inbox operations`; `contains every required template and route lifecycle endpoint`; `uses exact permission and same-origin administration guards` | notification route files; `admin-api.ts` | `PARTIAL` | Superseded by API contract audit; retained as `REDUNDANT` regression coverage. |
| `component.test.ts` | `reuses one canonical notification centre across product roles`; `has source-backed admin loading, locked, empty and error states` | shared notification components/pages | `PARTIAL` | Superseded by component contract audit; retained as `REDUNDANT`. |
| `contracts.test.ts` | `requires channel-specific marketing consent and verified destinations`; `prevents unsafe external restricted content and action URLs`; `renders strictly and escapes html`; `bounds retry and never retries configuration failure`; `makes marketing unsubscribe opaque, signed, channel-bound and expiring` | `contracts.ts`, `template-renderer.ts` | `PARTIAL` | Complements expanded renderer contract coverage; `COMPLETE`. |
| `permission.test.ts` | `keeps editing, approval, publication and delivery retry separate`; `does not grant destructive notification controls by default` | `permission-keys.ts` | `PARTIAL` | Complements role/default audit; `COMPLETE`. |
| `processor.test.ts` | `ships the complete bounded processor inventory`; `routes apply through the production lock and dry runs through real candidate selectors` | scripts; `processor.service.ts` | `PARTIAL` | Complements behavioural processor tests; `COMPLETE`. |
| `production-composition.test.ts` | `uses concrete repositories, not-configured providers and remains locked` | `composition-root.ts`, production lock | `PARTIAL` | Exact dependency order added; `COMPLETE`. |
| `service.test.ts` | `exposes one service for every canonical authority`; `uses exact recipient subjects and only narrow reconciliation actions`; `registers only durable event families already found in the repository` | `authority.ts`, `event-registry.ts` | `PARTIAL` | Complements behavioural service tests; `COMPLETE`. |
| `source-audit.test.ts` | `removes independent production email providers and adapts auth at the Phase 27 boundary`; `keeps secrets, raw push endpoints and arbitrary sending outside DTOs and logs` | compatibility adapter, security boundary, endpoint DTO, disabled manual send route | `PARTIAL` | Complements executable whole-source audit; `COMPLETE`. |
| `scaffold-audit.test.ts` | `contains meaningful PostgreSQL setup, action and assertions without running PostgreSQL`; `contains meaningful Playwright scenarios without invoking Playwright` | Phase 30 scaffolds only | `INVALID_FOR_FOCUSED_COUNT` | Remains non-counting by design. |

## Final executable test inventory

| Test family | Exact test file and test names | Production source | Status |
|---|---|---|---|
| Category/template/route | `category-template-route.behavior.test.ts` — `freezes stable category policy and rejects invalid mandatory or marketing combinations`; `retires categories and excludes them from new templates`; `enforces draft, approval separation, publication, immutable published metadata and versioned rendering`; `rejects unsafe rendering contracts and only retires non-draft versions`; `freezes exact category, template version and recipient policy before activation` | `authority.ts`, `template-renderer.ts` | `COMPLETE` |
| Source intake/logical message | `source-intake-logical.behavior.test.ts` — `validates source authority, preserves identical replay, and rejects changed payloads`; `fans out atomically with all frozen message authorities and no duplicate under concurrent intake`; `does not consume a source receipt until the transaction has persisted its recipient and logical message`; `opens reconciliation rather than dropping unmapped events or unresolved recipients`; `returns the original immutable message on an identical replay and conflicts on changed variables` | `authority.ts`, `notification.service.ts` | `COMPLETE` |
| Recipient/preference/inbox | `recipient-preference-inbox.behavior.test.ts` — `resolves every bounded subject through canonical active users and never an all-admin fallback`; `rejects missing, inactive, or wrong-role recipients instead of silently broadening access`; `applies mandatory, consent, channel opt-in, preference, suppression and verified-destination policy`; `uses strict South African fallback quiet windows, bounded day rules, and route-policy bypass only`; `uses deterministic daily digest buckets and excludes mandatory, urgent, security, legal, and expired content`; `preserves inbox evidence while enforcing exact owner, expiry, and irreversible archive semantics`; `marks stale endpoints and permits revocation only by their exact owner` | `authority.ts` | `COMPLETE` |
| Renderer/delivery/receipts | `renderer-delivery-receipt.behavior.test.ts` — `renders only declared typed variables and escapes user HTML`; `rejects missing, unknown, malformed, restricted, script-like, and oversized content`; `enforces retry bounds, expiry, purpose eligibility, and opaque channel-bound unsubscribe tokens`; `fails closed with normalized non-success results when providers are not configured`; `enforces one delivery per logical message/channel and only monotonic provider receipt transitions` | `contracts.ts`, `template-renderer.ts`, `notification.service.ts`, `providers.ts` | `COMPLETE` |
| Encryption | `endpoint-security.behavior.test.ts` — `uses deterministic fingerprints with randomized encrypted storage and never returns a raw endpoint`; `fails closed when no valid endpoint encryption key is configured` | `endpoint-vault.ts` | `COMPLETE` |
| Authority audit | `source-authority-audit.behavior.test.ts` — `proves only canonical Phase 27 code can own production email, SMS, or push delivery` | `audit-phase27-notification-authority.mjs` | `COMPLETE` |
| API/components | `api-component-contract.behavior.test.ts` — `puts every user notification route behind exact self-service access, origin, and rate-limit policy`; `enforces preference, consent, endpoint, and unsubscribe privacy contracts at their API boundaries`; `puts every admin notification route behind an exact permission, same-origin, rate-limit, and canonical service boundary`; `uses the shared centre and source-backed operations surfaces across all six product roles` | user/admin API routes, policies, shared components | `COMPLETE` |
| Processor/composition | `processor-composition.behavior.test.ts` — `uses real candidates with deterministic operation IDs in dry-run mode and rejects invalid limits`; `keeps apply locked before lifecycle mutation and exposes no generic reconciliation resolve action`; plus `production-composition.test.ts` | `processor.service.ts`, `composition-root.ts`, production lock | `COMPLETE` |

## Requirement-to-evidence matrix

| Required invariant family | Exact focused evidence | Production authority | Final status |
|---|---|---|---|
| Canonical provider/source authority; OTP security boundary; no legacy provider | `source-authority-audit.behavior.test.ts` and `source-audit.test.ts` | audit script; `security-delivery.ts`; legacy adapter | `COMPLETE` |
| OTP values restricted/encrypted; expiry and idempotent intent boundary | `source-audit.test.ts` / authority audit plus `contracts.test.ts` retry/expiry contract | `security-delivery.ts`, `delivery-otp.service.ts`, `contracts.ts` | `COMPLETE` |
| Category policy, lifecycle, retirement, mandatory security/legal, marketing consent | category test `freezes…`; `retires…`; recipient-preference `applies mandatory…` | `NotificationCategoryService`, preference service | `COMPLETE` |
| Versioned templates: draft/review/approve/publish/retire, frozen locale/variables/sensitivity/action route | category-template tests `enforces…` and `rejects…` | `NotificationTemplateService`, renderer | `COMPLETE` |
| Strict renderer: types, required/unknown values, HTML/script/eval/Function, URL, currency/date/length/channel/restricted content | renderer test `renders…`; `rejects…`; baseline contract tests | `template-renderer.ts`, `contracts.ts` | `COMPLETE` |
| Versioned event route exact dependencies, approval/activation/immutability, payload cannot override policy | category-template test `freezes exact…` | `NotificationRouteService` | `COMPLETE` |
| Source authority, receipt identity/hash, idempotency, conflict, atomic fanout, unmapped/unresolved reconciliation, no delete | source-intake tests `validates…`; `fans out…`; `does not consume…`; `opens reconciliation…` | `NotificationSourceIntakeService` | `COMPLETE` |
| Logical-message frozen receipt/category/purpose/sensitivity/priority/recipient/template/route/policy/variables/expiry/dedupe | source-intake test `fans out…`; logical test `returns original…` | intake service; `NotificationService` | `COMPLETE` |
| Bounded recipient roles, canonical active user, verified contact, no all-admin fallback and cross-role denial | recipient tests `resolves every…`; `rejects missing…` | `RecipientPolicyService` | `COMPLETE` |
| Preference order; mandatory, consent, category/channel, in-app, SMS/push opt-in, suppression/readiness | recipient-preference test `applies mandatory…` | `NotificationPreferenceService`, `deliveryEligible` | `COMPLETE` |
| Timezone, overnight/day quiet hours, South African fallback, policy-only bypass | recipient-preference test `uses strict South African…` | `inQuietHours`, preference service | `COMPLETE` |
| Deterministic daily digests, exact user/channel/timezone/membership, duplicate/expired/security/legal/urgent exclusions | recipient-preference test `uses deterministic daily…` | `NotificationDigestService` | `COMPLETE` |
| Channel-specific marketing consent and opaque signed unsubscribe/replay | renderer-delivery test `enforces retry…`; API contract `enforces preference…` | consent/unsubscribe routes; `contracts.ts` | `COMPLETE` |
| Endpoint encryption/fingerprint/masking/ownership/revoke/stale/invalid timezone | endpoint-security tests; recipient-inbox endpoint test; API contract | endpoint vault/service/routes | `COMPLETE` |
| Inbox pagination/owner/read/unread/read-all/archive/expiry/evidence | recipient-inbox test `preserves inbox evidence…`; API contract | `NotificationInboxService`, user routes | `COMPLETE` |
| Delivery, attempts/retries/expiry, non-fake provider adapters, receipts monotonic/idempotent | renderer-delivery tests `enforces retry…`; `fails closed…`; `enforces one delivery…` | delivery service, provider adapters, receipt service | `COMPLETE` |
| Suppression and reconciliation narrow actions/no generic resolve | recipient-preference `applies…`; processor test `keeps apply locked…`; service test | suppression/reconciliation services | `COMPLETE` |
| All user APIs: ownership, permission, same-origin, rate limit, validation, consent/endpoint privacy | API contract test `puts every user…`; `enforces preference…` | `api-policy.ts`, 14 user route handlers | `COMPLETE` |
| All admin APIs: exact permissions, same-origin/rate-limit, lifecycle/readiness, no manual send/delivered mutation | API contract test `puts every admin…` | `admin-api.ts`, 23 admin route handlers | `COMPLETE` |
| Shared component states, source-backed admin surface, accessibility, six-role reuse | API/component test `uses the shared…`; baseline component tests | notification components/pages | `COMPLETE` |
| Permission separation/default deny/self-service role boundaries | baseline permission tests; API contract exact permission audit | `permission-keys.ts`, permission policy | `COMPLETE` |
| Twelve processors: manifest, dry-run, bounded limit, deterministic operation ID, lock/no direct lifecycle mutation | baseline processor tests; processor-composition tests | processor scripts/service | `COMPLETE` |
| Production composition exact order and fail-closed providers/readiness lock | production-composition test `uses concrete…` | `composition-root.ts`, readiness lock | `COMPLETE` |
| Schema/migration invariants, one migration and no data/credential/consent/endpoint insert | `phase-27-migration-manifest.md`; Prisma validation check | schema and Phase 27 SQL | `COMPLETE` |

## Source-authority audit result

`node scripts/audit-phase27-notification-authority.mjs` searches production, test, and documentation source for Resend/SMTP/SES, direct provider calls, SMS/FCM/web-push clients, delivery console logs, authentication email callbacks, route/business delivery calls, and legacy notification database authorities. Its final classification totals are:

| Classification | Count | Meaning |
|---|---:|---|
| `CANONICAL_PHASE27` | 4 | One canonical provider-call site plus three read-only historical email-history projections. |
| `SECURITY_EVENT_PRODUCER` | 16 | Authentication/delivery producers enqueue restricted security intents only. |
| `TEST_ONLY` | 5 | Test assertions only. |
| `DOCUMENTATION_ONLY` | 2 | Documentation only. |
| `FORBIDDEN_PRODUCTION_SENDER` | **0** | Required zero. |

The audit's executable assertion is that Phase 27 is the only production email, SMS, and push delivery authority. Legacy email history is read-only compatibility data under `lib/notifications/legacy-email-history.ts`; its former write helpers now fail closed.

## Processor manifest

| Operation | Script | Candidate source | Canonical service | Operation ID | Lock |
|---|---|---|---|---|---|
| preflight | `phase27-notification-preflight.mjs` | category rows | processor service | deterministic SHA-256 prefix | apply locked |
| consume | `consume-notification-source-events.mjs` | event intents | source intake | deterministic | apply locked |
| fanout | `fanout-notification-messages.mjs` | received receipts | source intake fanout | deterministic | apply locked |
| deliver | `deliver-notifications.mjs` | queued deliveries | delivery service | deterministic | apply locked |
| retry | `retry-notification-deliveries.mjs` | retryable due deliveries | delivery service | deterministic | apply locked |
| receipts | `process-notification-receipts.mjs` | provider-accepted deliveries | receipt ingestion | deterministic | apply locked |
| digest | `build-notification-digests.mjs` | fanout messages | digest service | deterministic | apply locked |
| expire | `expire-notifications.mjs` | expired active deliveries | delivery expiry | deterministic | apply locked |
| stale-endpoints | `deactivate-stale-notification-endpoints.mjs` | aged active endpoints | endpoint service | deterministic | apply locked |
| reconciliation | `scan-notification-reconciliation.mjs` | open/in-progress cases | narrow reconciliation action | deterministic | apply locked |
| invariants | `verify-notification-invariants.mjs` | category rows | processor service | deterministic | apply locked |
| integration | `notification-integration-test.mjs` | category rows | processor service/scaffold | deterministic | apply locked |

## Completion

Every required focused invariant has a `COMPLETE` row above. The two PostgreSQL/Playwright scaffolds are intentionally visible but excluded from the focused count. Their execution, deployment migration, provider-network checks, full browser flow, and broader runtime validation are deferred to Phase 30.
