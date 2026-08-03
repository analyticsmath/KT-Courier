# Auth Foundation — Phase 1.5

KT Couriers uses a custom credentials-based authentication system. No third-party auth provider (NextAuth, Clerk, etc.) is used in this phase.

---

## Overview

| Concern | Approach |
|---|---|
| Password storage | bcryptjs, 12 rounds |
| Session tokens | 32-byte crypto.randomBytes, SHA-256 hashed in DB |
| OTP codes | 6-digit crypto.randomInt, SHA-256 hashed in DB |
| Reset tokens | 32-byte crypto.randomBytes, SHA-256 hashed in DB |
| Session transport | HTTP-only cookie (`kt_session`) |
| Route protection | Server-side layout checks (no Edge middleware) |

---

## Cookie

| Property | Value |
|---|---|
| Name | `kt_session` |
| Duration | 14 days |
| `httpOnly` | `true` |
| `secure` | `true` in production, `false` in development |
| `sameSite` | `lax` |
| `path` | `/` |

---

## Session

- Sessions are stored in the `Session` table.
- Only the **SHA-256 hash** of the raw token is stored (`tokenHash`).
- The raw token lives only in the HTTP-only cookie.
- Sessions expire after 14 days (`expiresAt`).
- On password reset, all existing sessions for the user are invalidated.

---

## OTP (Email Verification)

- 6-digit numeric code generated with `crypto.randomInt`.
- Stored hashed (`codeHash` SHA-256) in the `OtpCode` table.
- Purpose: `EMAIL_VERIFICATION`.
- Expiry: **15 minutes** from creation.
- Marked `consumedAt` on first use — cannot be reused.
- On resend: all active OTPs for that email are consumed before a new one is created.
- **Development only**: the raw OTP code is returned in the API response under `_dev_otp`. This field is absent in production.

---

## Password Reset Tokens

- 32-byte random token.
- Stored hashed (`tokenHash` SHA-256) in the `PasswordResetToken` table.
- Expiry: **1 hour** from creation.
- Marked `usedAt` on use — cannot be reused.
- `forgot-password` endpoint always returns a generic success message to avoid user enumeration.
- **Development only**: the raw reset token is returned in the API response under `_dev_token`. This field is absent in production.

---

## Auth Flow

### Signup (Customer)
1. `POST /api/auth/signup` with `accountType: "CUSTOMER"`, name, email, phone, password, confirmPassword
2. User + `CustomerProfile` created in a transaction.
3. OTP created and a durable Phase 27 `EMAIL_VERIFICATION_OTP` security-delivery intent queued; authentication does not send email directly.
4. Response includes `email` for redirect.
5. Frontend redirects to `/verify-otp?email=...`.

### Signup (Store / Business)
1. `POST /api/auth/signup` with `accountType: "STORE"`, storeName, contactPerson, email, phone, password, confirmPassword
2. User + `StoreProfile` created in a transaction.
3. Same OTP flow as above.

### Email Verification
1. `POST /api/auth/verify-otp` with `email` and `code`.
2. OTP hash matched, expiry checked, `consumedAt` set.
3. User `status` → `ACTIVE`, `emailVerifiedAt` set.
4. Session created, cookie set.
5. Frontend redirected to role-based dashboard.

### Login
1. `POST /api/auth/login` with email and password.
2. Password verified with bcryptjs.
3. Suspended/disabled accounts receive a generic error.
4. Unverified accounts receive `requiresVerification: true` — frontend redirects to OTP page.
5. Session created, cookie set, `lastLoginAt` updated.
6. Redirect target determined by role:
   - `CUSTOMER` → `/account`
   - `STORE` → `/store`
   - `ADMIN` / `SUPER_ADMIN` → `/admin`

### Logout
1. `POST /api/auth/logout`.
2. Session deleted from DB.
3. Cookie cleared.

### Forgot Password
1. `POST /api/auth/forgot-password` with email.
2. Always returns a generic success (prevents user enumeration).
3. If user exists, a `PasswordResetToken` is created and `PASSWORD_RESET` email sent (non-blocking).
4. In development, the raw token is exposed in `_dev_token`.

### Reset Password
1. `POST /api/auth/reset-password` with token, password, confirmPassword.
2. Token hashed and matched against DB.
3. Expiry and `usedAt` checked.
4. Password updated, token marked used, all sessions invalidated.
5. `PASSWORD_CHANGED` confirmation email sent (non-blocking).

### GET /api/auth/me
- Returns the current authenticated user's safe fields (no passwordHash, tokenHash, OTP data).
- Returns 401 if not authenticated or session expired.

---

## Route Protection

Protected routes use server-side layout checks (not Edge middleware, since Prisma requires Node.js):

| Route group | Required role(s) |
|---|---|
| `/account/*` | `CUSTOMER` |
| `/store/*` | `STORE` |
| `/admin/*` | `ADMIN`, `SUPER_ADMIN` |

Guard helpers in `lib/auth/guards.ts`:
- `requireAuth()` — redirects to `/login` if not authenticated.
- `requireRole(...roles)` — redirects to `/login` if wrong role.

---

## Dashboard User Data

Dashboard layouts now show real user data from the session:
- **Account layout**: displays authenticated customer name or email.
- **Store layout**: displays store name from `StoreProfile` (falls back to user name/email).
- **Admin layout**: displays user name or email with role label.

---

## Email integration (Phase 1.9)

Auth flows create Phase 27 security-delivery intents (non-blocking):
- Signup: `EMAIL_VERIFICATION_OTP`
- Resend OTP: `EMAIL_VERIFICATION_OTP`
- Forgot password: `PASSWORD_RESET` (with secure reset URL)
- Reset password success: `PASSWORD_CHANGED`

If the email provider is not configured, the console fallback logs the intent. Auth flows do not fail if email delivery fails.

## Deferred to Later Phases

| Feature | Phase |
|---|---|
| Rate limiting on auth endpoints | Phase 1.10 (Hardening) |
| CSRF protection on state-mutating endpoints | Phase 1.10 (Hardening) |
| Driver portal auth | Phase 3.x (Driver App) |
| Admin invite flow | Future |
| Multi-factor authentication | Future |
| Social login | Future |

---

## Security Notes

- Passwords are never stored in plaintext.
- Session tokens are never stored in plaintext — only SHA-256 hashes.
- OTP codes are never stored in plaintext — only SHA-256 hashes.
- Reset tokens are never stored in plaintext — only SHA-256 hashes.
- `_dev_otp` and `_dev_token` fields are guarded by `NODE_ENV !== "production"`.
- `forgot-password` always returns a success message — email existence is never revealed.
- Login errors use a single generic message — password correctness is never confirmed separately from email existence.
