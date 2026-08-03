# Phase 1.6 — User, Customer & Store Backend Foundation

## Overview

Phase 1.6 replaces mock/static dashboard behavior with a real database-backed service layer. No order engine, pricing, email provider, maps, payments, driver assignment, or subscriptions were introduced.

---

## Key Changes

### Store signup fix

Phase 1.5 only created `User` + `StoreProfile` during store registration. Phase 1.6 fixes this with a single `$transaction` that atomically creates:

1. `User` (role: STORE, status: PENDING_VERIFICATION)
2. `StoreProfile` (storeName from form)
3. `Store` (ownerUserId, slug, addressLine1 from businessAddress field, country: "South Africa", status: PENDING)
4. `OtpCode` (for email verification)

The slug is pre-generated outside the transaction using `generateUniqueSlug`, which tries `base-slug`, `base-slug-2` … `base-slug-99`, then a random 4-char hex suffix. The DB `@unique` constraint on `Store.slug` acts as the final safety net.

### Business address persistence

The signup form's `businessAddress` field is now written to `Store.addressLine1`. Previously it was silently ignored.

---

## Profile / Store Relationship

```
User (role=STORE)
  └── StoreProfile (1:1)    — contact details, business name
  └── Store (1:many by ownerUserId, usually 1)  — operational record, slug, address
```

Mutations through `/api/store/profile` PATCH keep `StoreProfile` and `Store` in sync:
- `storeName` → `StoreProfile.storeName` + `Store.name`
- `contactPerson` → `StoreProfile.contactPerson` + `Store.contactName` + `User.name`
- `businessPhone` → `StoreProfile.businessPhone` + `Store.contactPhone`
- `businessEmail` → `StoreProfile.businessEmail` + `Store.contactEmail`
- Address fields → `Store.*` only (not on `StoreProfile`)

**The store slug is never changed after creation.**

For customers, mutations through `/api/account/profile` PATCH keep `User` and `CustomerProfile` in sync:
- `name` → `User.name` + `CustomerProfile.displayName`
- `phone` → `User.phone` + `CustomerProfile.defaultPhone`

---

## Admin Management Scope

Admins can:
- List and search users and stores with pagination
- View user/store detail
- Update user name, phone, status (ACTIVE / SUSPENDED / DISABLED)
- Update store contact info, address, name
- Set store status (PENDING → ACTIVE → SUSPENDED / DISABLED)
- Toggle store featured flag

Admins **cannot**:
- Change any user's role
- Modify or suspend ADMIN or SUPER_ADMIN accounts
- Promote users to SUPER_ADMIN (deferred to Phase 1.10 hardening)

All admin mutations are logged to `AdminActivityLog` via `recordAdminActivity()`. Logging failures are silently swallowed — they never block the primary mutation.

---

## Activity Logging

`lib/services/admin-activity.service.ts` exposes `recordAdminActivity({ actorUserId, action, entityType, entityId, message, metadata })`.

Logged actions: `UPDATE`, `STATUS_CHANGE`, `SUSPEND`, `ACTIVATE`, `DISABLE`.

---

## Dashboard Real Data Boundaries

| Dashboard | Real data (Phase 1.6) | Deferred |
|---|---|---|
| Account | Order counts (PENDING, IN_PROGRESS, COMPLETED), user display name | Order list rows (Phase 1.7) |
| Store | Total order count, store name/status/address | Active/completed counts (Phase 1.7) |
| Admin | User counts, store counts, pending store count, recent store list | Order stats, order rows (Phase 1.7) |

All order list sections render `<EmptyState>` rather than fake data.

---

## Response Shape Conventions

All API routes use helpers from `lib/api/response.ts`:

```ts
ok(data)               // 200 { success: true, data }
created(data)          // 201 { success: true, data }
badRequest(msg, errs)  // 400 { success: false, message, errors? }
unprocessable(msg, errs) // 422 { success: false, message, errors? }
unauthorized()         // 401 { success: false, message: "Authentication required." }
forbidden()            // 403 { success: false, message: "Access denied." }
notFound(msg)          // 404 { success: false, message }
conflict(msg)          // 409 { success: false, message }
serverError()          // 500 { success: false, message: "An unexpected error occurred." }
paginated(data, total, page, pageSize) // 200 { success: true, data, pagination: {...} }
```

`parsePagination(searchParams)` extracts `page` / `pageSize` from query params (max 100).

---

## DTO Safety Rules

- **Never** return Prisma model objects directly to the frontend.
- **Never** include `passwordHash`, `tokenHash`, OTP hashes, reset-token data, or internal metadata in responses.
- Use mapper functions: `toUserPublicDto`, `toCustomerProfileDto`, `toStoreProfileDto`, `toAdminUserListItem`, `toAdminStoreListItem`.

---

## Email Integration

Email sending (OTP delivery, password reset links, welcome emails) is deferred to **Phase 1.9**. Until then:
- OTPs and reset tokens are exposed as `_dev_otp` / `_dev_token` fields in non-production responses.
- All auth flows complete without sending email.
- Docs previously referencing "Phase 2.x" for email integration have been corrected to "Phase 1.9".

---

## Deferred Items

| Item | Phase |
|---|---|
| Real email provider (SMTP/Resend) | 1.9 |
| Rate limiting (signups, OTP, password reset) | 1.10 |
| Role management UI (ADMIN assigning STORE_MANAGER) | 1.10 |
| Pagination UI controls (next/prev page buttons) | 1.8 |
| Order list rows in dashboards | 1.7 |
| Admin user detail edit page | 1.8 |
| Admin store detail edit page | 1.8 |
