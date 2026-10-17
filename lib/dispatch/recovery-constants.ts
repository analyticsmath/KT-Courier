/** Bounded, URL-safe operator idempotency key for the mutating dispatch-recovery operation. */
export const RECOVERY_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
export const RECOVERY_REASON_MAX_LENGTH = 500;
