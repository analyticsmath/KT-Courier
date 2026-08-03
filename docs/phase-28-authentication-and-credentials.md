# Phase 28 authentication and credentials

Use `Authorization: Bearer <opaque credential>` only from a protected backend. Credentials use `kt_test_` or `kt_live_` prefixes, are random, one-time displayed, HMAC-hashed, fingerprinted, rotatable, revocable, and never stored or logged in plaintext. OAuth is unsupported.
