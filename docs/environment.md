# Environment Variables

KT Couriers environment variables must be set locally and in each deployment environment.
**Never commit real values to version control.** The `.gitignore` already excludes all `.env*` files.

---

## Required Variables

### `DATABASE_URL`

PostgreSQL connection string for Prisma.

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
```

- **Local development**: point at your local or cloud-hosted PostgreSQL instance.
- **Production / staging**: set in your hosting platform's environment variable configuration (Vercel, Railway, Render, Fly.io, etc.).
- **Connection pooling**: when using a PgBouncer-style pooler (e.g. Supabase Pooler) you may also need `DIRECT_URL`. See Prisma docs for your host.

---

## Email Variables (Phase 1.9)

### `RESEND_API_KEY`

API key for the Resend email provider.

```
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxx"
```

- **Development**: omit to use the console fallback (emails logged, not delivered).
- **Production**: required for real email delivery.
- Must never be stored in the database or SystemSetting.

### `EMAIL_FROM`

Sender address for outbound emails. Must be a verified sender in your Resend account.

```
EMAIL_FROM="KT Couriers <noreply@ktcouriers.co.za>"
```

Falls back to `"KT Couriers <noreply@ktcouriers.co.za>"` if not set.

### `EMAIL_REPLY_TO` *(optional)*

Reply-to address for outbound emails. Also used as the admin/support notification recipient for contact form and new order alerts.

```
EMAIL_REPLY_TO="support@ktcouriers.co.za"
```

If not set and `RESEND_API_KEY` is absent, admin notification emails are skipped.

### `EMAIL_PROVIDER` *(optional)*

Override the email provider. Defaults to `"resend"` if `RESEND_API_KEY` is set, otherwise `"console"`.

```
EMAIL_PROVIDER="console"    # force console even if RESEND_API_KEY is set
EMAIL_PROVIDER="resend"     # force Resend (requires RESEND_API_KEY)
```

### `NEXT_PUBLIC_APP_URL` *(optional)*

Base URL used in email links (password reset, order detail URLs, admin links).

```
NEXT_PUBLIC_APP_URL="https://ktcouriers.co.za"
```

Falls back to `"http://localhost:3000"` in development or `"https://ktcouriers.co.za"` in production.

---

## Google Maps Variables (Phase 2.1)

### `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`

Public API key for the Maps JavaScript API and Places API (browser-safe).
This key is embedded in the client bundle and visible to users — restrict it by HTTP referrer in Google Cloud Console.

```
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY="AIzaSy..."
```

- **Development**: omit to use manual address input fallback.
- **Production**: required for address autocomplete. Restrict to your domain and to Maps JavaScript API + Places API only.

### `GOOGLE_MAPS_SERVER_KEY`

Private API key for server-side route calculation (Routes API). Never exposed to the browser.

```
GOOGLE_MAPS_SERVER_KEY="AIzaSy..."
```

- **Development**: omit to disable route distance/duration calculation (orders still created without route data).
- **Production**: required for route estimates. Restrict by IP or to Routes API only.

### `GOOGLE_MAPS_REGION_BIAS` *(optional)*

Two-letter country code for address search bias. Defaults to `ZA` (South Africa).

```
GOOGLE_MAPS_REGION_BIAS="ZA"
```

---

## How to Configure Locally

1. Create a file named `.env` in the project root (`kt-courier/.env`). This file is already git-ignored.
2. Add your environment variables:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/kt_courier_dev?schema=public"
RESEND_API_KEY="re_your_key_here"
EMAIL_FROM="KT Couriers <noreply@yourdomain.com>"
EMAIL_REPLY_TO="support@yourdomain.com"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

3. Run `npm run prisma:migrate` to apply migrations, then `npm run prisma:seed` for development seed data.
4. Google Maps keys are optional for development. Omit them to use manual address input and disable route calculation.

---

## Development defaults

| Variable | Development default | Notes |
|---|---|---|
| `RESEND_API_KEY` | *(unset)* | Console provider used; emails logged, not delivered |
| `EMAIL_FROM` | `KT Couriers <noreply@ktcouriers.co.za>` | Safe fallback |
| `EMAIL_REPLY_TO` | *(unset)* | Admin notification emails skipped |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Used in password reset links |

---

## Production Checklist

- [ ] `DATABASE_URL` is set in the deployment environment
- [ ] `RESEND_API_KEY` is set and verified sender domain is configured in Resend
- [ ] `EMAIL_FROM` matches a verified sender in Resend
- [ ] `EMAIL_REPLY_TO` is set if admin notification emails are required
- [ ] `NEXT_PUBLIC_APP_URL` is set to the production domain
- [ ] No `.env` files are tracked in git (`git status` should show none)
- [ ] Database is provisioned and accessible
- [ ] Prisma migrations have been run: `npm run prisma:deploy`
- [ ] Seed data has NOT been applied to production (seeds are development-only)
- [ ] `NODE_ENV=production` is set — hides `_dev_otp` and `_dev_token` from API responses

---

## Security notes

- `RESEND_API_KEY` must never be stored in `SystemSetting`, the database, or exposed to the client
- Email provider keys must not appear in application logs
- `_dev_otp` and `_dev_token` are only visible when `NODE_ENV !== "production"`
