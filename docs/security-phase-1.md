# KT Couriers Phase 1 Security Hardening

## What Changed

Phase 1 hardens the existing custom authentication system without changing the platform roadmap or portal behavior.

- Sessions now support revocation metadata.
- Current-user resolution rejects expired, revoked, and non-active user sessions.
- Logout revokes the current database-backed session before clearing the cookie.
- Login attempts are recorded in `LoginHistory`.
- Security-sensitive auth, session, status-change, and origin rejection actions are recorded in `SecurityEvent`.
- Browser-facing mutating API route handlers enforce same-origin checks through `lib/security/request-origin.ts`.
- `/api/maps/route-estimate` uses the standardized origin enforcement path and checks the result before route calculation.

## Session Revocation Behavior

An active session is defined as a session with:

- `expiresAt` greater than the current time.
- `revokedAt` set to `null`.
- A linked user whose `status` is allowed for application access.

If a user becomes suspended, disabled, or otherwise non-active, existing sessions are rejected during current-user resolution and the session is revoked with the `USER_STATUS_NOT_ALLOWED` reason.

Admin status changes to a non-active status revoke all active sessions for the target user.

## Login History

`LoginHistory` records successful and failed login attempts with:

- Optional `userId`.
- Normalized email address when available.
- Success flag.
- Failure reason when applicable.
- IP address and user agent metadata.
- Timestamp.

It does not store passwords, password hashes, session tokens, OTP codes, reset tokens, or raw cookies.

## Security Events

`SecurityEvent` records security-relevant events with type, severity, optional user and actor references, request metadata, and minimal JSON metadata.

Phase 1 event types include:

- `LOGIN_SUCCESS`
- `LOGIN_FAILED`
- `LOGOUT`
- `SESSION_REVOKED`
- `USER_STATUS_BLOCKED_SESSION`
- `USER_STATUS_CHANGED`
- `ORIGIN_CHECK_FAILED`

Logging failures are caught inside the service and do not break the primary request flow.

## Origin / CSRF Rule

All browser-facing mutating `app/api/**/route.ts` handlers use `enforceSameOriginRequest` before body parsing, database writes, email sends, map-provider calls, session changes, or user-state changes.

The helper validates `Origin` first, falls back to `Referer`, allows configured app origins and local development origins, and returns a generic `403` JSON response on failure:

```json
{ "error": "Invalid request origin" }
```

Requests without both `Origin` and `Referer` are allowed for Phase 1 compatibility with non-browser or server-side callers; normal authentication still applies.

## Files And Route Areas

- `prisma/schema.prisma`
- `lib/auth/session.ts`
- `lib/auth/current-user.ts`
- `lib/security/request-origin.ts`
- `lib/security/request-metadata.ts`
- `lib/services/login-history.service.ts`
- `lib/services/security-events.service.ts`
- `lib/services/admin-users.service.ts`
- `app/api/auth/**`
- `app/api/account/**`
- `app/api/store/**`
- `app/api/driver/**`
- `app/api/admin/**`
- `app/api/orders/**`
- `app/api/contact/route.ts`
- `app/api/maps/route-estimate/route.ts`

## Deferred Work

- Employee permission system.
- Full two-factor authentication.
- Distributed rate limiting.
- File upload security.
- Payment and webhook verification.
- Public API key security.
- Security dashboard UI.
