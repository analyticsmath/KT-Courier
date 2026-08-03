# Phase 27 research and implementation map

## Authority audit

| Source path/family | Classification | Phase 27 disposition |
|---|---|---|
| `lib/notifications/*`, `app/api/notifications/*`, `app/api/admin/notifications/*` | `CANONICAL_PHASE27` | Canonical categories, templates, routes, source receipts, inbox, preferences, endpoints, suppression, delivery and reconciliation. |
| `lib/notifications/security-delivery.ts` | `CANONICAL_PHASE27` | Narrow encrypted security-intent boundary. It accepts transient security values but stores them only in `NotificationSecurePayload`; safe intent/audit records never contain them. |
| `scripts/*notification*.mjs`, `scripts/phase27-processor-*` | `CANONICAL_PHASE27` | Bounded dry-run-default processors invoke `NotificationProcessorService`; `--apply` reaches the production lock. |
| `lib/services/notification-events.service.ts` | `LEGACY_REQUIRES_ADAPTER` | Compatibility façade appends durable source intents only; it does not resolve recipients or send a channel. |
| `lib/email/email-service.ts` | `LEGACY_REQUIRES_ADAPTER` | Compatibility API now appends a Phase 27 intent and has no provider or renderer/delivery side effect. |
| `lib/email/email-templates.ts`, `lib/email/email-renderer.ts`, `lib/services/email-log.service.ts`, `app/(admin)/admin/emails/*`, `app/api/admin/emails/*` | `LEGACY_REQUIRES_REMOVAL` | Historical templates/log views remain readable for migration evidence. Manual test sending is disabled; none is a production provider. |
| deleted `lib/email/providers/resend-email-provider.ts`, deleted `lib/email/providers/console-email-provider.ts`, deleted `lib/email/email-provider.ts` | `UNUSED` | Removed. No direct Resend/console production adapter remains. |
| `lib/auth/otp.ts`, `OtpCode`, `DeliveryOtp`, password-reset token authority, `app/api/auth/verify-otp/*` | `SECURITY_AUTHORITY_OUTSIDE_PHASE27` | Authentication/delivery owns generation, hashing, expiry and verification. It calls the Phase 27 security boundary for delivery intent only. |
| `tests/phase27/*`, `tests/phase27/scaffolds/*` | `TEST_ONLY` | Focused policy/service/API/component/permission/processor/audit checks and deferred DB/browser scaffolds. |
| SMS, FCM, Web Push provider implementations | `UNUSED` | No provider existed. Phase 27 exposes fail-closed NotConfigured adapters only. |

## OTP and security-email boundary

The former direct OTP path was `app/api/driver/assignments/[id]/delivery/otp/route.ts` → `lib/services/delivery-otp.service.ts` → `lib/email/email-service.ts` → provider. It owned OTP generation, validation, template rendering, provider delivery, retry behavior and `EmailLog` audit.

Now:

```text
authentication or delivery authority
→ creates and hashes OTP/security token
→ queueSecurityNotification
→ NotificationEventIntent (safe metadata only)
→ NotificationSecurePayload (AES-GCM encrypted transient rendering values)
→ Phase 27 source intake / template / delivery authority
→ fail-closed provider adapter
```

Authentication continues to generate and verify credentials. It does not select a provider, render an external message, or write a normal notification audit record containing an OTP. A security intent requires a canonical account recipient; initial email verification is explicitly marked as the one bootstrap exception because it is the act that verifies the account email. Expired intents are rejected before queueing, the delivery expiry is preserved by retries, and the `operationId`/source receipt rejects replay with changed safe payload.

## Event families and category registry

`lib/notifications/event-registry.ts` includes only real repository families: order confirmation/status, delivery OTP, account verification/reset/change, subscriptions, promoter application/reconciliation, and store-order status/handoff events. The registry is configuration input; it cannot send. A route is the only mapping from a source event to category, policy, template version and channel policy. Unknown/unmapped events create `EVENT_ROUTE_NOT_CONFIGURED` reconciliation evidence.

## Delivery and privacy audit

- No application code calls Resend, console email delivery, SMS or push delivery directly.
- Provider readiness exposes a provider name and `ready: false` only; it never exposes configuration or credentials.
- Push endpoint DTOs expose a masked destination only. Encryption is mandatory before persistence.
- External restricted content, arbitrary action URLs, unknown variables, unsafe HTML and channel-length overflow are rejected by the renderer contract.
- Suppression and consent are evaluated before an external delivery becomes eligible. A route payload cannot bypass preferences, quiet hours or suppression.
- A provider acceptance is `PROVIDER_ACCEPTED`, never `DELIVERED`; receipts are provider-matched and monotonic.

## Product surfaces

`NotificationCentre` and `NotificationIndicator` are shared by customer, store, driver, promoter, applicant and admin surfaces. They read the same `NotificationInboxItem` projection and authenticated `/api/notifications` ownership boundary. There is no role-specific notification database.

Admin pages under `/admin/notifications` are source-backed for categories, templates, routes, deliveries, suppressions, providers and reconciliation. The screens render populated/empty, lifecycle state, provider-locked and error/loading conditions from canonical data; they contain no static operational entities or metrics.
