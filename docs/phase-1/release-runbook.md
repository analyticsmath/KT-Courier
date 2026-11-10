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
| `PAYSTACK_SECRET_KEY` | Server Payments | Paystack secret key (`sk_test_...` for controlled test checkout or `sk_live_...` after Phase 3 financial sign-off). |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Browser Payments | Matching Paystack public key (`pk_test_...` or `pk_live_...`). |
| `PAYSTACK_ALLOW_TEST_IN_PRODUCTION` | Controlled Staging / Prod Test | Set to `"true"` **only** during owner-authorized controlled Paystack test-mode checkout in a production build; must be unset/`"false"` before live-money cutover. |
| `EMAIL_PROVIDER` & `RESEND_API_KEY` | Transactional Email | Set `EMAIL_PROVIDER=resend` and valid `RESEND_API_KEY` with verified sender domain before enabling `notifications.email_enabled=true`. |

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
