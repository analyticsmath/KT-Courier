# KT Couriers — Phase 1 Production Release & Verification Runbook

> **Safety Boundary**: Do not execute production deployments, live database mutations, or live Paystack financial transactions without separate, explicit human approval.

## 1. Required Environment Variables & Secrets Checklist

| Variable | Scope | Phase 1 Requirement & Validation Rule |
|---|---|---|
| `DATABASE_URL` | Server / Prisma | PostgreSQL 16 connection URL (`?schema=public`). |
| `SHADOW_DATABASE_URL` | CI / Migration Diff | Disposable shadow database URL for `prisma migrate diff`. |
| `REDIS_URL` | Server / Rate Limit | Redis 7 connection URL (`redis://...`). |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | Server Auth | Minimum 32-byte high-entropy secret for session signing. |
| `NOTIFICATION_ENDPOINT_ENCRYPTION_KEY` | Server Notifications | Base64-encoded 32-byte key for AES-256-GCM notification endpoint vault (`lib/notifications/endpoint-vault.ts`). |
| `GOOGLE_MAPS_SERVER_KEY` | Server Pricing & Geocoding | Authoritative server-side Google Geocoding & Routes API key (`ZA` region restriction). |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | Browser Autocomplete | Browser-restricted Google Maps Places API key (never trusted for server pricing). |
| `PAYSTACK_MODE` | Server Payments (`lib/payments/providers/paystack/paystack-config.ts`) | `"disabled"` \| `"test"` \| `"live"`. In `production` runtime, requires `"live"` unless the time-bounded temporary sandbox override below is active. |
| `PAYSTACK_SECRET_KEY` | Server Payments | Paystack secret key (`sk_test_...` when `PAYSTACK_MODE=test` in non-production; `sk_live_...` when `PAYSTACK_MODE=live` in production). |
| `PAYSTACK_PUBLIC_KEY` | Server / Checkout Config | Matching Paystack public key (`pk_test_...` or `pk_live_...`) where applicable. Never use `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`. |
| `PAYSTACK_CREDENTIAL_VERSION` | Server Payments | Credential version identifier (`^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$`, defaults to `"v1"`). |
| `PAYMENT_APP_ORIGIN` | Server Payments | Canonical HTTPS origin (`https://...` in production; `http://localhost:...` allowed only in non-production) used for Paystack callback URLs. |
| `CHECKOUT_PUBLIC_ENABLED` | Production Financial Gate | Must be `"true"` to enable live Paystack checkout in production (`CONSOLIDATED_VALIDATION_NOT_APPROVED` when `"false"`). |
| `PAYSTACK_TEMPORARY_SANDBOX_ENABLED` | Bounded Production Sandbox | Set to `"true"` **only** during an owner-authorized, time-boxed production sandbox verification window (maximum 6 hours). Preserves `PAYSTACK_SECRET_KEY` and `PAYSTACK_MODE=live` untouched and fails closed on expiry. |
| `PAYSTACK_TEMPORARY_SANDBOX_UNTIL` | Bounded Production Sandbox | Strict UTC ISO-8601 deadline (`YYYY-MM-DDTHH:mm:ssZ`, `> now` and `<= now + 6h`) required when `PAYSTACK_TEMPORARY_SANDBOX_ENABLED="true"`. |
| `PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY` | Bounded Production Sandbox | Paystack test secret key (`sk_test_...`) used exclusively while the temporary sandbox window is active. |
| `PAYSTACK_TEMPORARY_SANDBOX_PUBLIC_KEY` | Bounded Production Sandbox | Paystack test public key (`pk_test_...`) paired with `PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY`. |
| `EMAIL_PROVIDER` & `RESEND_API_KEY` | Transactional Email | Set `EMAIL_PROVIDER=resend` and valid `RESEND_API_KEY` with verified sender domain before enabling live external email delivery (`EXTERNAL_APPROVAL_REQUIRED` until live inbox receipts are recorded). |

## 2. Pre-Deployment Verification Sequence

Run the following deterministic checks from the repository root before any deployment:

```bash
npm ci
npx prisma generate
npm run migrations:check
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run docker:config
npm run docker:migration-smoke
npm run test:paystack:contract
npm run test:paystack:invariants
npm run test:payments
npm run test:security:bola
npm run test:processors
```

## 3. Initial Commercial & Operational Configuration Sequence

After applying migrations (`npx prisma migrate deploy`), verify or configure the following via the Admin Portal (`/admin/**`):

1. **Parcel Profiles (`/admin/commercial/parcel-profiles`)**:
   - Confirm active `SMALL` (`30×25×10 cm`, max `2 kg`), `MEDIUM` (`40×35×25 cm`, max `5 kg`), and `LARGE` (`60×45×45 cm`, max `15 kg`).
   - Keep `EXPRESS_S`, `EXPRESS_M`, `EXPRESS_L` inactive.
2. **Delivery Regions & Services (`/admin/delivery-regions` & `/admin/delivery-services`)**:
   - Confirm active `Gauteng` regions for **Johannesburg** and **Pretoria / Tshwane**.
   - Confirm active `CLIENT_ECONOMY` (`R89`/`R129`/`R179`, 3–4 business days), `CLIENT_STANDARD` (`R129`/`R179`/`R249`, 1–2 business days), and `CLIENT_EXPRESS` (`R5.50/km` + confirmed parcel-size fee).
3. **Payment Method Policy (`/admin/payments/policies`)**:
   - Ensure active platform-default `PaymentMethodPolicy` (`mode = "DIGITAL_ONLY"`) is effective so online Paystack Card payments are enabled while unapproved cash modes remain gated.
4. **VAT & High-Risk Locality Controls (`/admin/settings`)**:
   - Verify `pricing.vat.enabled = false` and `pricing.marketplace_vat.enabled = false` (per client initial preference; toggle to `true` with `0.15` rate when SARS VAT registration requires tax-invoice collection).
   - Verify `delivery.high_risk_areas` contains all 42 client-designated Johannesburg and Pretoria/Tshwane localities with `active = true` and any operational `notes`.
5. **Notification Recipients (`/admin/settings` & `/admin/notifications`)**:
   - Replace placeholder strings (`[add business email]`, `[add owner email]`) by saving verified operational email addresses in `platform.contact_email` and `notifications.admin_alert_recipients` (`PARCEL_ORDER_PAID`, `MARKETPLACE_ORDER_PAID`, `STORE_READINESS_BLOCKER`, `PAYMENT_RECONCILIATION_ALERT`).
6. **Store Certification (`/store/profile`, `/store/addresses`, `/admin/stores/[id]`)**:
   - Complete seller legal identity review, store-owned `PICKUP` address verification, `StoreOrderOperationalPolicy` activation, and 2-admin `StoreCheckoutCertification` before expecting a store to appear `Live` on `/shop`.
