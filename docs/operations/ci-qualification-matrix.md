# KT-Courier — CI Qualification & Release Truth Matrix

## 1. Always-Required CI Steps (Deterministic, Credential-Independent)

The following qualification checks run unconditionally on every push/PR without external credentials:

- **Lint & Syntax**: `npm run lint`
- **TypeScript Static Verification**: `npm run typecheck`
- **Prisma Schema Validation**: `npx prisma validate`
- **Unit & Security Core Tests**: `npm run test:coverage`
- **Database Migration Safety Check**: `npm run migrations:check`
- **Standalone Next.js Build**: `npm run build`
- **Docker Compose Validation**: `npm run docker:config`
- **Docker Image Build**: `npm run docker:build`

---

## 2. Deferred / External Qualification Steps

The following integration jobs are conditionally deferred using GitHub Actions variables:

| CI Variable | Target Verification Suite | Reason for Deferral |
| :--- | :--- | :--- |
| `ENABLE_DEFERRED_PAYMENT_VALIDATION` | `npm run db:verify:payments` | Requires live/sandbox PayFast credentials. |
| `ENABLE_DEFERRED_PAYFAST_VALIDATION` | `npm run test:integration:payfast` | Requires active PayFast merchant sandbox account. |
| `ENABLE_DEFERRED_PAYFAST_CONFIRMATION_VALIDATION` | `npm run test:integration:payfast-confirmation` | Requires external ITN callback endpoint. |
| `ENABLE_DEFERRED_WITHDRAWAL_VALIDATION` | `npm run test:integration:withdrawals` | Requires banking/payout sandbox. |
| `ENABLE_DEFERRED_REFUND_VALIDATION` | `npm run test:integration:refunds` | Requires refund gateway endpoint. |
| `ENABLE_DEFERRED_STORE_EARNING_VALIDATION` | `npm run test:integration:store-earnings` | Requires multi-day maturity simulations. |
| `ENABLE_DEFERRED_DRIVER_EARNING_VALIDATION` | `npm run test:integration:driver-earnings` | Requires driver trip simulation fixtures. |
| `ENABLE_DEFERRED_STOREFRONT_VALIDATION` | `npm run test:integration:storefront` | Requires storefront publication snapshots. |

> **Release Rule**: A green GitHub Actions run where deferred variables are `false` confirms deterministic build and source safety. Full release qualification is completed by the owner running external live qualification suites with real credentials.
