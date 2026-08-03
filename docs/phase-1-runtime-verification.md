# Phase 1 — Runtime Verification Checklist

Use this checklist to verify the KT Couriers Phase 1 deployment manually after initial setup.
Run through this before presenting to a client or approving a production deployment.

---

## Prerequisites

Before running any test below, confirm:

- [ ] `DATABASE_URL` is set in `.env` (local) or environment (staging/production)
- [ ] `npx prisma migrate deploy` (or `migrate dev`) has been run and reported success
- [ ] `npm run prisma:seed` has been run at least once in a clean environment
- [ ] `npm run build && npm start` (or `npm run dev`) is running without errors
- [ ] `NEXT_PUBLIC_APP_URL` is set (e.g., `http://localhost:3000` locally)

---

## 1. Database

| # | Check | Pass |
|---|-------|------|
| 1.1 | `npx prisma migrate status` — all migrations applied, no pending | ☐ |
| 1.2 | `npx prisma studio` (optional) — all tables exist and contain seed data | ☐ |
| 1.3 | Seed script ran without errors: `npm run prisma:seed` | ☐ |
| 1.4 | Seed creates: admin user, super admin, customer, store user, pricing rules, system settings | ☐ |

---

## 2. Auth

| # | Check | Pass |
|---|-------|------|
| 2.1 | Customer signup → 201 response + `_dev_otp` in development | ☐ |
| 2.2 | Store signup → 201 response + `_dev_otp` in development | ☐ |
| 2.3 | Duplicate email signup → 409 conflict | ☐ |
| 2.4 | OTP verification with valid code → session cookie set, redirect to `/account` | ☐ |
| 2.5 | OTP verification with expired/wrong code → 400 error | ☐ |
| 2.6 | Resend OTP → new code issued, old code consumed | ☐ |
| 2.7 | Login with correct credentials → session cookie, redirect | ☐ |
| 2.8 | Login with wrong password → 401 generic error (no user existence hint) | ☐ |
| 2.9 | Login with unverified account → 403 with `requiresVerification: true` | ☐ |
| 2.10 | Logout → session cookie cleared, DB session deleted | ☐ |
| 2.11 | Forgot password → 200 generic response (no user hint) + `_dev_token` in dev | ☐ |
| 2.12 | Reset password with valid token → password updated, all sessions invalidated | ☐ |
| 2.13 | Reset password with expired/used token → 400 error | ☐ |
| 2.14 | Login after password reset → works with new password | ☐ |

---

## 3. Role Guards

| # | Check | Pass |
|---|-------|------|
| 3.1 | Visiting `/account` unauthenticated → redirect to `/auth/login` | ☐ |
| 3.2 | Visiting `/store` unauthenticated → redirect to `/auth/login` | ☐ |
| 3.3 | Visiting `/admin` unauthenticated → redirect to `/auth/login` | ☐ |
| 3.4 | Customer visiting `/admin` → redirect (role guard) | ☐ |
| 3.5 | Store user visiting `/admin` → redirect (role guard) | ☐ |
| 3.6 | Admin visiting `/admin` → access granted | ☐ |
| 3.7 | `GET /api/admin/users` as customer → 403 | ☐ |
| 3.8 | `GET /api/admin/users` as admin → 200 | ☐ |

---

## 4. Profiles

| # | Check | Pass |
|---|-------|------|
| 4.1 | Customer profile update (`PATCH /api/account/profile`) → saved and reflected | ☐ |
| 4.2 | Store profile update (`PATCH /api/store/profile`) → saved and reflected | ☐ |
| 4.3 | Admin can see users list (`/admin/users`) with correct roles/statuses | ☐ |
| 4.4 | Admin can see stores list (`/admin/stores`) | ☐ |

---

## 5. Orders

| # | Check | Pass |
|---|-------|------|
| 5.1 | Customer creates order via `/account/request-delivery` wizard → `POST /api/orders` → 201 | ☐ |
| 5.2 | Store creates order via `/store/new-delivery` → success | ☐ |
| 5.3 | Order number format: `KT-{YEAR}-{6-digit}` | ☐ |
| 5.4 | Order appears in customer order list (`/account/orders`) | ☐ |
| 5.5 | Order appears in store order list (`/store/orders`) | ☐ |
| 5.6 | Admin can see all orders (`/admin/orders`) | ☐ |
| 5.7 | Customer CANNOT see another customer's order (`GET /api/orders/[other-id]` → 404) | ☐ |
| 5.8 | Admin updates order status → OrderStatusHistory entry created | ☐ |
| 5.9 | Invalid status transition → 400 | ☐ |
| 5.10 | Price estimate (`POST /api/orders/estimate`) → server-calculated price returned | ☐ |

---

## 6. Pricing

| # | Check | Pass |
|---|-------|------|
| 6.1 | Admin creates a pricing rule (`/admin/pricing`) | ☐ |
| 6.2 | Admin updates an existing rule | ☐ |
| 6.3 | Admin deactivates a rule → `active: false` | ☐ |
| 6.4 | Price estimate recalculates when rule changes | ☐ |
| 6.5 | Inactive rule not applied to new estimates | ☐ |

---

## 7. Contact

| # | Check | Pass |
|---|-------|------|
| 7.1 | Public contact form submits → 200 success | ☐ |
| 7.2 | Contact message appears in admin `/admin/contact-messages` | ☐ |
| 7.3 | Admin marks message as READ → status updated | ☐ |
| 7.4 | Admin marks as RESPONDED → status updated | ☐ |
| 7.5 | Admin marks as ARCHIVED → status updated | ☐ |
| 7.6 | Invalid transition rejected → 400 | ☐ |
| 7.7 | Rate limit triggers on contact form after 5 rapid submissions | ☐ |

---

## 8. Settings

| # | Check | Pass |
|---|-------|------|
| 8.1 | Admin views settings (`/admin/settings`) → seeded defaults visible | ☐ |
| 8.2 | Admin updates a STRING setting → saved | ☐ |
| 8.3 | Admin updates a BOOLEAN setting → saved | ☐ |
| 8.4 | Admin cannot set forbidden keys (e.g., `SECRET_KEY`) → 400 | ☐ |
| 8.5 | Activity log records the update → visible in `/admin/activity` | ☐ |

---

## 9. Email

| # | Check | Pass |
|---|-------|------|
| 9.1 | Dev: signup triggers `EMAIL_VERIFICATION_OTP` EmailLog → status SENT (console simulated) | ☐ |
| 9.2 | Dev: forgot password triggers `PASSWORD_RESET` EmailLog | ☐ |
| 9.3 | Dev: contact form triggers `CONTACT_RECEIVED` EmailLog | ☐ |
| 9.4 | Dev: order creation triggers `ORDER_CONFIRMATION` EmailLog | ☐ |
| 9.5 | Admin: status update triggers `ORDER_STATUS_CHANGED` EmailLog | ☐ |
| 9.6 | Admin email logs page (`/admin/emails`) shows all records | ☐ |
| 9.7 | Admin email log detail page (`/admin/emails/[id]`) shows full record | ☐ |
| 9.8 | Admin test email form → sends WELCOME template, log created | ☐ |
| 9.9 | Production: RESEND_API_KEY absent → EmailLog status = FAILED (not SENT) | ☐ |
| 9.10 | Production: with RESEND_API_KEY set → EmailLog status = SENT + providerMessageId | ☐ |
| 9.11 | Admin emails banner: console provider → amber warning; resend → green confirmation | ☐ |

---

## 10. Security Hardening (Phase 1.10)

| # | Check | Pass |
|---|-------|------|
| 10.1 | Login rate limit: >10 attempts per 10 min from same IP+email → 429 with `Retry-After` header | ☐ |
| 10.2 | Signup rate limit: >5 attempts per hour from same IP → 429 | ☐ |
| 10.3 | Forgot-password rate limit: >5 per hour → 429 | ☐ |
| 10.4 | Contact rate limit: >5 per 10 min → 429 | ☐ |
| 10.5 | Admin test email rate limit: >5 per 10 min → 429 | ☐ |
| 10.6 | Security headers present on responses: `X-Content-Type-Options: nosniff` | ☐ |
| 10.7 | Security headers present: `X-Frame-Options: DENY` | ☐ |
| 10.8 | Security headers present: `Referrer-Policy: strict-origin-when-cross-origin` | ☐ |
| 10.9 | Security headers present: `Permissions-Policy: camera=(), ...` | ☐ |
| 10.10 | Cross-origin POST to `/api/auth/login` from unknown origin → 403 | ☐ |
| 10.11 | `GET /api/admin/users` with customer session → 403 (not 401) | ☐ |
| 10.12 | Response body never includes `passwordHash`, `tokenHash`, `codeHash`, `stack` | ☐ |

---

## 11. Build & Static Validation

| # | Check | Pass |
|---|-------|------|
| 11.1 | `npm run lint` → 0 errors, 0 warnings | ☐ |
| 11.2 | `npx tsc --noEmit` → 0 errors | ☐ |
| 11.3 | `npm run build` → clean build, no unhandled errors | ☐ |
| 11.4 | `npx prisma format` → no schema changes | ☐ |
| 11.5 | `npx prisma generate` → client generated without errors | ☐ |

---

## 12. Admin Dashboard Spot Check

| # | Check | Pass |
|---|-------|------|
| 12.1 | Admin dashboard (`/admin`) shows real counts (not zeroes if data exists) | ☐ |
| 12.2 | "New contact messages" alert appears when unread messages exist | ☐ |
| 12.3 | Recent orders section populated | ☐ |
| 12.4 | Recent activity log populated after any admin action | ☐ |

---

## 13. Edge Cases

| # | Check | Pass |
|---|-------|------|
| 13.1 | Empty order list → "No orders yet" empty state shown | ☐ |
| 13.2 | Empty contact messages → empty state shown | ☐ |
| 13.3 | Empty email logs → "No email logs" shown | ☐ |
| 13.4 | Prisma 500 error does not expose stack trace in API response | ☐ |
| 13.5 | Invalid JSON body → 400/422 (not 500) | ☐ |

---

## Notes Section

Use this space to record observations, failures, or issues found during verification:

```
Date: _______________
Environment: _______________
Tester: _______________

Issues found:
-
-
-

Blockers before production:
-
-
```
