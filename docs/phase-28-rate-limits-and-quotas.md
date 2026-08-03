# Phase 28 rate limits and quotas

Rate decisions are made by `DbRateLimitService` against immutable policy
versions and a SHA-256 identity built from credential, application, exact
resource owner, approved scope grant, route class, and environment. Windows
are deterministic; the database counter uses a conditional atomic increment,
and the safe remaining window is returned as `Retry-After` through Problem
Details. IP may be a supplemental risk input but is never the identity.

Quota decisions are made by `DbQuotaService` in a serializable repository
transaction. Its dimensions are application, canonical application owner,
application environment, operation category, and UTC-day period. It supports
`requests`, `quoteGenerations`, `orderCreations`,
`activeWebhookSubscriptions`, `webhookVerificationAttempts`, and
`manualDeliveryRetries`. A missing/invalid policy fails closed; an exhausted
counter returns `API_QUOTA_EXCEEDED`. Administrators have no counter-edit or
bypass route.
