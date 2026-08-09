# Final consolidated production validation plan

Run this plan only after Phase 5 source review is accepted. Stop on the first failed gate; fix forward, then restart from the failed gate without duplicating equivalent checks.

| # | Gate | Classification |
|---:|---|---|
| 1 | Repository and prohibited-file review | EXECUTABLE_LOCALLY |
| 2 | Environment-template and secret-free review | EXECUTABLE_LOCALLY |
| 3 | Migration-chain static review | EXECUTABLE_LOCALLY |
| 4 | `prisma format` and `prisma validate` | EXECUTABLE_LOCALLY |
| 5 | Route Handler and Server Action governance | EXECUTABLE_LOCALLY |
| 6 | Changed-file, then full lint | EXECUTABLE_LOCALLY |
| 7 | Typecheck | EXECUTABLE_LOCALLY |
| 8 | Focused Phase 3–5 tests | EXECUTABLE_LOCALLY |
| 9 | Default regression suite | EXECUTABLE_LOCALLY |
| 10 | Provision disposable PostgreSQL | EXECUTABLE_WITH_DISPOSABLE_DATABASE |
| 11 | `prisma migrate status`, then `prisma migrate deploy` | EXECUTABLE_WITH_DISPOSABLE_DATABASE |
| 12 | Real database integration suites | EXECUTABLE_WITH_DISPOSABLE_DATABASE |
| 13 | Critical concurrency scenarios | EXECUTABLE_WITH_DISPOSABLE_DATABASE |
| 14 | Background processor integration checks | EXECUTABLE_WITH_DISPOSABLE_DATABASE |
| 15 | Production build | EXECUTABLE_LOCALLY |
| 16 | Production-like server startup | EXECUTABLE_LOCALLY |
| 17 | Critical browser journeys | REQUIRES_STAGING_INFRASTRUCTURE |
| 18 | Mobile and keyboard review | REQUIRES_HUMAN_REVIEW |
| 19 | Accessibility checks | REQUIRES_STAGING_INFRASTRUCTURE |
| 20 | Console, hydration, and network error review | REQUIRES_STAGING_INFRASTRUCTURE |
| 21 | Security-header and CSP verification | EXECUTABLE_LOCALLY |
| 22 | Health and readiness verification | EXECUTABLE_LOCALLY |
| 23 | Report artifact, expiry, and download authorization verification | EXECUTABLE_WITH_DISPOSABLE_DATABASE |
| 24 | Payment sandbox/provider verification | REQUIRES_SANDBOX_CREDENTIAL |
| 25 | Maps, SMS, media, payout, and webhook-provider checks | REQUIRES_SANDBOX_CREDENTIAL |
| 26 | Backup and restore evidence | REQUIRES_STAGING_INFRASTRUCTURE |
| 27 | Human visual review | REQUIRES_HUMAN_REVIEW |
| 28 | Final risk and deployment decision | REQUIRES_HUMAN_REVIEW |

Critical browser coverage is deliberately concise: authentication/session revocation; storefront/cart/checkout; verified payment projection; order tracking; store fulfilment; admin dispatch; driver pickup/delivery; refund, withdrawal, and subscription status; reconciliation; report generation/download; permission denial; and capability-unavailable states.

For the disposable database gate, inspect pending Phase 3, Phase 4, and Phase 5 migrations first. Use only `prisma migrate status` and `prisma migrate deploy`; never use `migrate dev`, `db push`, reset, or seed against production. Require a pre-deployment backup, migration inspection, application compatibility review, and a documented forward-fix decision. Do not promise automatic destructive rollback.
