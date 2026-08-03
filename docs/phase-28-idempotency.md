# Phase 28 idempotency

Every public mutation with external effects requires `Idempotency-Key`. The key is bounded and hashed with credential, method, normalized route, query, and request hash. Identical requests replay; changed requests return `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`.
