# KT Couriers — Deployment Readiness Guide

Phase 1.10. For internal use during initial deployment and client review setup.

---

## Required Environment Variables

### Always Required

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/kt_courier` |
| `NEXT_PUBLIC_APP_URL` | Publicly accessible app base URL — used for password reset links | `https://ktcouriers.co.za` |

### Required for Email Delivery

| Variable | Description | Example |
|---|---|---|
| `RESEND_API_KEY` | Resend API key — required for production email delivery | `re_xxxxxxxxxxxxxxxx` |
| `EMAIL_FROM` | Sender address (verified in Resend) | `KT Couriers <noreply@ktcouriers.co.za>` |
| `EMAIL_REPLY_TO` | Address for admin notifications (contact/order alerts) | `support@ktcouriers.co.za` |

### Optional

| Variable | Description | Default |
|---|---|---|
| `EMAIL_PROVIDER` | Force `console` to disable delivery (dev/testing) | Auto-detected from `RESEND_API_KEY` |

### Security Note
**Never** store `RESEND_API_KEY` or any secret in:
- The database (`SystemSetting` table)
- Client-side code
- Version control (`.env` files must be in `.gitignore`)

---

## Local Development Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd kt-courier

# 2. Install dependencies
npm install

# 3. Create .env file (copy from .env.example if provided)
#    Minimum required for local dev:
#    DATABASE_URL=postgresql://...
#    NEXT_PUBLIC_APP_URL=http://localhost:3000

# 4. Generate Prisma client
npx prisma generate

# 5. Run migrations
npx prisma migrate dev

# 6. Seed the database
npm run prisma:seed

# 7. Start dev server
npm run dev
```

The seed script creates:
- Super admin: `superadmin@ktcouriers.co.za`
- Admin: `admin@ktcouriers.co.za`
- Customer: `customer@example.com`
- Store: `store@example.com`

Passwords are set in the seed file. **Change all seeded passwords immediately in production.**

---

## Staging Setup

1. Provision a PostgreSQL database (Supabase, Railway, Neon, or self-hosted).
2. Set all required env vars in your hosting dashboard.
3. Run migrations: `npx prisma migrate deploy` (not `migrate dev` — no schema changes on staging).
4. Optionally run seed for initial data: `npm run prisma:seed`
5. Set `NEXT_PUBLIC_APP_URL` to the staging domain.
6. Set `RESEND_API_KEY` and `EMAIL_FROM` only if you want real email delivery on staging. If not, omit `RESEND_API_KEY` — emails will be logged as FAILED (console provider in production mode).

---

## Production Setup

### Pre-deployment Checklist

- [ ] PostgreSQL provisioned and `DATABASE_URL` set
- [ ] `NEXT_PUBLIC_APP_URL` set to production domain
- [ ] `RESEND_API_KEY` obtained from Resend dashboard
- [ ] `EMAIL_FROM` domain is verified in Resend (DNS records added)
- [ ] `EMAIL_REPLY_TO` set to a monitored inbox
- [ ] All seeded default passwords changed
- [ ] Admin accounts set up with real credentials
- [ ] Legal pages reviewed by counsel (see Client TODOs below)
- [ ] Coverage areas confirmed with operations (see Client TODOs below)
- [ ] Brand assets finalized (logo, favicons — see Client TODOs)

### Deploy Commands (Vercel or similar)

```bash
# Build
npm run build

# Database migration (run once before traffic)
npx prisma migrate deploy

# Start server
npm start
```

### Vercel-specific Notes

- Set all env vars under **Project → Settings → Environment Variables**.
- `DATABASE_URL` should use a **pooler** connection string if using Supabase/Neon (e.g., `?pgbouncer=true&connection_limit=1` for Prisma).
- `NEXT_PUBLIC_APP_URL` must be set to your Vercel production URL or custom domain.
- Vercel runs serverless functions per-route. The **in-memory rate limiter** (`lib/security/rate-limit.ts`) does NOT persist across serverless invocations. Rate limiting will be per-instance, not global. **Upgrade to Redis/Upstash KV before high-traffic launch** — see Phase 2 hardening section below.

---

## Database Migration Commands

| Command | When to use |
|---|---|
| `npx prisma migrate dev` | Local development — creates migration files |
| `npx prisma migrate deploy` | Staging/production — applies pending migrations only |
| `npx prisma migrate status` | Check which migrations are pending |
| `npx prisma generate` | After any schema change — regenerates Prisma client |
| `npx prisma studio` | GUI browser for data inspection (dev/staging only) |

### Phase 2.3 Migration

Phase 2.3 adds saved-address ownership and store default pickup support.

- Migration: `20260611000000_phase_2_3_address_book`
- Adds nullable `Address.userId`, `Address.storeId`, `Address.isDefault`, and `Store.defaultPickupAddressId`.
- Existing order address snapshots are preserved.
- If an environment has no migration baseline because it was created with `prisma db push`, review the incremental SQL before `migrate deploy`.

### Seed Caution

`npm run prisma:seed` is destructive in an existing database if it uses `upsert`. It is safe to re-run (idempotent for known seed records) but verify the seed script behavior before running on a database with live customer data.

---

## Post-Deploy Smoke Test

After every production deployment, run these quick checks:

1. Load `https://ktcouriers.co.za` → homepage renders correctly
2. Load `/services`, `/contact`, `/about` → no 500 errors
3. Attempt signup → account created, OTP email received (check email delivery)
4. Attempt login → session cookie set, redirected to dashboard
5. Load `/admin` with admin credentials → dashboard loads with real counts
6. Send a test email from `/admin/emails` → email log created, check Resend dashboard
7. Submit contact form → confirmation email received within 30 seconds
8. Create a test order → order number assigned, email confirmation received
9. Check `/admin/activity` → recent actions logged
10. Add a customer saved address and verify it appears in `/account/request-delivery`
11. Add a store pickup address and verify it prefills `/store/new-delivery`

---

## Rollback Notes

If a deployment causes data issues:

- Rollback the application code (Vercel: redeploy previous deployment).
- Database schema rollbacks require a reverse migration file — Prisma does not auto-rollback. Create a new migration to revert schema changes.
- Do not run `prisma migrate dev` on production. Use `prisma migrate deploy` only.

---

## Phase 2 Hardening Items (Not in Phase 1)

These are documented as required upgrades before high-traffic or public launch:

| Item | Impact |
|---|---|
| Replace in-memory rate limiter with Redis/Upstash KV | Multi-instance / serverless rate limiting |
| Add CSP with nonce-based script-src | Cross-site script injection protection |
| Add HSTS header at CDN level | Enforce HTTPS for all connections |
| Add Resend webhook handler for bounces/complaints | Suppress invalid email addresses automatically |
| Add email retry logic (manual or queue-based) | Resilient delivery for transient failures |
| Add structured server-side logging (Axiom, Datadog, Logtail) | Production observability |
| Add full migration baseline if the database was bootstrapped with db push | Reliable fresh-environment rebuilds |

---

## Client Review TODOs

These items require client decisions before production sign-off:

| Item | Owner | Status |
|---|---|---|
| Legal copy review (Privacy Policy, Terms of Service) | Legal counsel | Pending |
| Coverage area map / delivery zones confirmation | Operations | Pending |
| Brand assets: final logo, favicon, OG images | Design | Pending |
| Resend sender verification for production email domain | Tech | Pending |
| Admin account setup with real credentials | Tech | Pending |
| `metadataBase` URL in Next.js metadata config | Tech | Pending |
| Custom domain SSL certificate (handled by Vercel/CDN) | Tech | Pending |

---

## Resend Configuration

1. Create a Resend account at resend.com.
2. Add your domain (e.g., `ktcouriers.co.za`) under **Domains**.
3. Add the provided DNS records (SPF, DKIM, DMARC) to your DNS provider.
4. Wait for verification (usually < 30 minutes).
5. Create an API key under **API Keys** with **Full Access** scope.
6. Set `RESEND_API_KEY` in your hosting environment.
7. Set `EMAIL_FROM` to a verified address on the domain: `KT Couriers <noreply@ktcouriers.co.za>`.

Without domain verification, Resend will reject sends. The application will mark EmailLog records FAILED and log the error server-side, without crashing any other operation.

---

## `metadataBase` Note

The Next.js `metadata` configuration in `app/layout.tsx` should include:

```typescript
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://ktcouriers.co.za"),
  // ...
};
```

Without `metadataBase`, Next.js will warn about relative Open Graph/Twitter image URLs. This is a client review item — set it once the production domain is confirmed.
