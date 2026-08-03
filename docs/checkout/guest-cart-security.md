# Guest cart security

Guest authority is a high-entropy, HttpOnly, SameSite=Lax cookie secret; only its
SHA-256 hash is persisted. Public references do not grant access. Secrets rotate
after sensitive claim/merge operations, cookies expire, and cross-origin mutation
is rejected before owner checks.
