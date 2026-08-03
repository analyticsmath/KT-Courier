# Development Seed Data

The seed script (`prisma/seed.ts`) populates a local development database with safe, non-production data. It is idempotent — safe to run multiple times.

**Never run the seed against a production or staging database.**

---

## What Gets Seeded

### Users

| Email | Role | Password | Notes |
|---|---|---|---|
| `superadmin@ktcouriers.local` | `SUPER_ADMIN` | `ChangeMe123!` | Full platform access |
| `admin@ktcouriers.local` | `ADMIN` | `ChangeMe123!` | Operations administrator |

All seeded users are `ACTIVE` with `emailVerifiedAt` set.

### Delivery Regions

Five placeholder regions are seeded:
- City Centre
- Northern Suburbs
- Southern Suburbs
- Eastern Areas
- Western Areas

These represent structural placeholders. Real coverage areas will be configured by the client before launch.

### Pricing Rules

Four baseline pricing rules are seeded in ZAR:
- Base Same-Day Delivery — R75.00 (flat, city centre region)
- Scheduled Delivery — R60.00 (flat)
- Business Account Delivery — R55.00 (flat, discounted)
- Parcel / Document Delivery — R50.00 (parcel size)

These are placeholder values. Final pricing must be set by the client.

### System Settings

Eight system settings are seeded covering platform name, contact email, operating hours, order configuration, and notification switches. Email notifications are seeded as **disabled** for safe local development.

---

## Running the Seed

Requires `DATABASE_URL` to be set. See `docs/environment.md`.

```bash
# Via npm script
npm run prisma:seed

# Or via Prisma CLI (also called by `prisma migrate dev`)
npx prisma db seed
```

---

## Resetting the Local Database

To completely reset and re-seed:

```bash
# Drop and recreate the database schema, then re-run migrations and seed
npx prisma migrate reset
```

This command will:
1. Drop all tables
2. Re-apply all migrations
3. Run the seed automatically (because `prisma.seed` is configured in package.json)

**Only run `prisma migrate reset` against a local development database.**

---

## Demo Credential Caution

The password `ChangeMe123!` is committed to source code in `prisma/seed.ts`. This is intentional for development convenience. It carries no production risk because:

- Seeds are never run against production databases
- The `.env` file (which contains `DATABASE_URL`) is git-ignored
- Production user credentials are set via the auth system, not seed data

Before any real deployment:
- Do not seed the production database
- Create real admin accounts through the admin panel or a one-time secure provisioning script
- Rotate all credentials that were used during development
