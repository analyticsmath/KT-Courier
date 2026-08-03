# Database Foundation — KT Couriers (Phase 1.4)

## Overview

KT Couriers uses PostgreSQL as its primary database, accessed via Prisma ORM. This document covers the Phase 1.4 schema foundation: the models, relationships, design decisions, and what has been deferred to later phases.

---

## Technology Stack

| Layer | Choice |
|---|---|
| Database | PostgreSQL |
| ORM | Prisma (v7.x) |
| Schema file | `prisma/schema.prisma` |
| Client singleton | `lib/db/prisma.ts` |
| Seed script | `prisma/seed.ts` (development only) |
| ID strategy | `cuid()` — collision-resistant, URL-safe |
| Currency | ZAR (South African Rand) as default |
| Country default | South Africa |

---

## Model Groups

### Core Identity
- `User` — central identity record for all user roles
- `CustomerProfile` — customer-specific metadata (one-to-one with User)
- `StoreProfile` — store/business metadata (one-to-one with User)
- `AdminProfile` — admin metadata (one-to-one with User)
- `DriverProfile` — driver metadata (one-to-one with User, deferred workflow)

### Auth Artifacts
- `Session` — server-managed sessions with hashed tokens
- `OtpCode` — OTP codes for email verification and password reset
- `PasswordResetToken` — time-limited reset tokens

### Stores
- `Store` — a registered business entity with address fields, status, and owner link

### Addresses
- `Address` — normalized, reusable address records. Used for order pickup and dropoff. GPS fields (latitude/longitude) are optional and not yet populated.

### Orders
- `Order` — core delivery record linking customer, store, addresses, and pricing
- `OrderStatusHistory` — append-only audit trail of every status change

### Pricing
- `DeliveryRegion` — named service regions
- `PricingRule` — rules (flat rate, region-based, parcel size, distance, etc.)
- `PricingAuditLog` — record of price calculations applied to orders

### Communications
- `EmailLog` — record of every outbound email attempt with provider response
- `ContactMessage` — form submissions from the public contact page

### Admin & System
- `AdminActivityLog` — audit trail of admin actions
- `SystemSetting` — key-value configuration store with typed values

---

## Key Design Decisions

### Single User table with role profiles
Rather than separate tables per user type, all users share a single `User` table with a `role` field. Each role has an optional one-to-one profile table (`CustomerProfile`, `StoreProfile`, etc.). This simplifies auth, session management, and cross-role querying while still allowing role-specific data isolation.

### Simplified Phase 1 order lifecycle
The DB-level `OrderStatus` enum uses a simplified lifecycle:
```
DRAFT → PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
                                           → CANCELLED
```

The frontend `types/order.ts` retains a more granular display lifecycle (`requested`, `assigned`, `picked_up`, `in_transit`, `delivered`, `failed`) for use with mock data and status badge components. A mapping layer will be added in Phase 1.5 when real orders are wired.

### Hashed tokens only
Passwords, session tokens, OTP codes, and password reset tokens are all stored as bcrypt/hash values only. Plaintext secrets are never stored in the database.

### Optional GPS coordinates
The `Address` model has optional `latitude`/`longitude` as `Decimal(10,7)`. These are not populated by this phase. A maps/geocoding integration will populate them in a future phase.

### Soft relations with SetNull
Soft foreign key behavior (`onDelete: SetNull`) is used where child records should survive if the parent is deleted (e.g., orders survive if a user is deleted). Cascade deletes are used for profile tables that have no independent value.

### Pricing as audit records
`PricingAuditLog` captures a snapshot of how a price was calculated at the time of order creation, including a `breakdown` JSON field. This ensures historical accuracy even if pricing rules change later.

---

## Relationships Summary

```
User ─1:1─ CustomerProfile
User ─1:1─ StoreProfile
User ─1:1─ AdminProfile
User ─1:1─ DriverProfile
User ─1:N─ Session
User ─1:N─ OtpCode
User ─1:N─ PasswordResetToken
User ─1:N─ Order (as customer)
User ─1:N─ ContactMessage
User ─1:N─ EmailLog
User ─1:N─ AdminActivityLog (as actor)
User ─1:N─ OrderStatusHistory (as actor)

Store ─1:N─ Order

Address ─1:N─ Order (as pickupAddress)
Address ─1:N─ Order (as dropoffAddress)

Order ─1:N─ OrderStatusHistory
Order ─1:N─ EmailLog
Order ─1:N─ PricingAuditLog

DeliveryRegion ─1:N─ PricingRule
PricingRule ─1:N─ PricingAuditLog
```

---

## Indexes

All major lookup and filter fields are indexed. Key examples:
- `User.email` — for login lookup
- `User.role`, `User.status` — for admin user list filtering
- `Session.tokenHash` — unique, for session validation
- `Order.orderNumber` — unique, for order reference lookup
- `Order.status`, `Order.customerId`, `Order.storeId` — for dashboard list queries
- `Order.scheduledFor` — for scheduling queries
- `OtpCode.email`, `OtpCode.expiresAt` — for OTP validation
- `Store.slug` — for public-facing store lookup

---

## What Is Deferred to Later Phases

| Feature | Phase |
|---|---|
| Auth implementation (login, signup, session creation) | Phase 1.5 |
| Email provider integration | Phase 2.x |
| Driver assignment workflow | Phase 2.x |
| Maps / geocoding / GPS coordinates | Phase 2.x |
| Payment processing | Phase 2.x |
| Subscriptions | Phase 2.x |
| Real order API endpoints | Phase 1.5+ |
| Admin panel wiring to real data | Phase 1.5+ |

---

## Migration & Seed Commands

```bash
# Generate Prisma client after schema changes
npm run prisma:generate

# Create and apply a new migration (development)
npm run prisma:migrate
# or: npx prisma migrate dev --name <migration-name>

# Apply existing migrations (CI / production)
npm run prisma:deploy

# Open Prisma Studio (visual DB browser)
npm run prisma:studio

# Run seed (development only)
npm run prisma:seed
# or: npx prisma db seed

# Reset local database and re-seed (development only)
npx prisma migrate reset
```

---

## Production Cautions

- **Never run `prisma migrate reset` in production** — it drops all data.
- **Never run `prisma:seed` in production** — it creates demo users with known passwords.
- **Always use `npm run prisma:deploy`** (not `migrate dev`) in production CI/CD.
- `DATABASE_URL` must be set in the deployment environment, never committed to git.
- Enable connection pooling (PgBouncer / Supabase Pooler) for production deployments to avoid exhausting PostgreSQL connections under Next.js serverless load.
- See `docs/environment.md` for full environment variable requirements.
