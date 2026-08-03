# Subscription integration scaffolding

The Phase 22 integration suite is intentionally skipped until Phase 26.5. It
must use a uniquely named disposable PostgreSQL database and never the
canonical volume. Required proofs include subject races, provider replay,
authoritative activation, entitlement concurrency, cancellation/renewal races,
refund reversal and production source-lock behaviour.
