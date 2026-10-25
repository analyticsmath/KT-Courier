# KT Couriers — three-phase engineering and production completion

**Plan baseline:** 2026-10-25, `main` baseline `db45e6341d4a62b9ebdf197a7600fbed627b5e6b`. Reconcile with current SHA after each release. This is a fixed launch-gate register, **not** a claim of 100% completion. Do not reset scoring based on chat or repository size.

## Scope and source precedence

Required first-launch scope: Gauteng personal parcels (Economy/Standard/Express, subject to actual coverage and capacity), approved marketplace checkout, customer/vendor/driver/admin role flows, payment/return/refund, OTP and POD, tracking, financial ledger and supported 100% parcel COD. Scope is governed by the eight client documents; *Delivery and Access* and *Website & System Changes* take precedence **only where they conflict**. Subsequent explicit owner decisions recorded in `docs/client-authority/2026-10/` and current repository must be traced, not silently overridden. Legacy 50/50 policies **do not authorize** 100% personal-parcel cash collection. Subscriptions, promoters/recruitment and paid advertising remain disabled by existing approved initial-launch scope.

Evidence tiers: **T1** targeted unit and static contract; **T2** disposable PostgreSQL/Redis integration; **T3** real HTTP/Chromium at 390/1440 + keyboard; **T4** full clean-install CI, migrations, security, build and exact-SHA deployment; **T5** real provider, genuine identity/vehicle/route, bank/cash and client legal/financial authorization. Synthetic tests never count as T5.

## Phase 1 — release foundation and audited administrative UX

**Engineering owner.** No user account data or payment balances may be changed by test fixtures in the protected production database.

| Gate | Acceptance / evidence | Status on 2026-10-25 |
|---|---|---|
| P1-01 Booking selection | Public parcel contact payload parses, FULL_COD requested where appropriate, discontinued DEPOSIT_PLUS_COD rejected, unapproved FULL_COD produces a typed 422 without consuming quote or creating order | Corrected in phase-1 candidate; exact-SHA browser remains required |
| P1-02 COD readiness | Readiness checks use independently approved 100% personal parcel scope, valid current bank instructions, positive cash limit and unchanged remittance version; 50/50 store policy must not create false-ready | Corrected in phase-1 candidate; production currently BLOCKED pending approved bank/policy |
| P1-03 Admin release control | Show real blocker/ready/deferred counts, owner-grouped evidence, direct paths to finance/coverage/notifications, keyboard-operable filters, no invented launch score or unapproved overrides | Implemented in phase-1 candidate; browser review pending |
| P1-04 Code/regressions | Full Vitest suites, typecheck, lint, Prisma validation, migration safety, clean Docker build and new tests PASS | CI proof to be recorded for candidate SHA |
| P1-05 Certification | All mandatory exact-commit production certification jobs PASS, including disposable quote-to-booking browser flows with zero critical skips | Must be rerun on deployed candidate SHA |
| P1-06 Hosting | Vercel production + Railway web + Railway worker same healthy git SHA, migrations successful, /api/health and /api/ready 200; no test flags or secrets exposed | Must be confirmed after new commit |

**Exit:** Phase 1 is accepted only when P1-01 through P1-06 all pass in CI/runtime; otherwise it remains **PARTIAL**, regardless of code changes being merged.

## Phase 2 — role-by-role feature and functional acceptance

**Engineering + controlled QA owner.** Use isolated disposable users, drivers, vendors, seeded catalog, simulated provider hooks and synthetic OTP/financial references. Do not request actual client personnel for repeatable software testing.

| Gate | Acceptance / evidence |
|---|---|
| P2-01 Identity | Customer/vendor/driver/admin sign-up, email code/resend, session lifecycle, RBAC/tenant isolation, suspension/revocation, forms and mobile/keyboard |
| P2-02 Parcel | Address/coverage fallback, tariff/parcel limits, schedule, quote ownership, online checkout, full COD choice, expiration/cancellation/refund |
| P2-03 Marketplace | Green Basket Grocers or **isolated fictional test store** catalog media, real inventory invariants, storefront, cart, Paystack sandbox, vendor receive/prepare/pack, store order, driver handoff, refund/substitution |
| P2-04 Driver and delivery | Onboarding/docs, vehicle weights, route availability, dispatch, pickup OTP, custody, location permission, live tracking, delivery OTP/POD, failed delivery and redelivery, non-GPS fallback |
| P2-05 Cash & finance | Full COD obligation, collect-on-delivery, exact sums, cannot handover before OTP, driver custody, bank deposit/in-person remittance, verified finance review, ledger balance, replay/duplicate/race proof |
| P2-06 Notifications | Required email templates, sender/receiver OTP, vendor and driver notifications, failed attempts, provider accepted vs mailbox delivery, suppression, no leaked PII |
| P2-07 Administration and visual UX | Customer/vendor/driver/admin dashboards: clear workflow hierarchy, meaningful statuses/actions, readable financial tables, responsive 320/390/768/1440 and keyboard/screen-reader checks |
| P2-08 Nonfunctional | Load/capacity and route monitoring, security/CSRF/BOLA, secret/media access, retention, duplicate-event protection, rollback and restore drills on isolated backups |

**Exit:** Every required journey has positive and negative T2/T3 evidence on the same candidate and no unresolved P0 defects. Record any P1 UX polish with ownership and bounded acceptance; do not claim real bank/road acceptance from test accounts.

## Phase 3 — production activation and legitimate operating authority

| Gate | Acceptance / evidence |
|---|---|
| P3-01 Live providers | Resend domain and real recipient OTP, Maps/geocoding, Cloudinary/private media, live or approved provider Paystack transaction with signed webhooks, refund and external ledger/balance proof. Synthetic Paystack can demonstrate implementation only. |
| P3-02 Financial authority | Genuine KT banking details input privately by authorized admin; 100% parcel COD scope/max amount/settlement timing approved by distinct finance approver; independently verified bank receipt or physically counted handover; commission/VAT/contracts and withdrawal permissions approved. |
| P3-03 Operational capacity | Genuine drivers with valid licences and vehicles, dispatch-region coverage and working delivery capacity, genuine vendor stock/packing agreements, active hours, parcel acceptance, complaints/failure procedures. |
| P3-04 Regulatory/disclosure | Real company service/physical address, legal/privacy/refunds/security review and documented approver; no fabricated physical address or legal sign-off. |
| P3-05 Production proof | Exact-SHA release parity (GitHub/Vercel/Railway), current CI/certification, clean readiness matrix, monitored sample customer-to-driver handover and funds reconciliation, backup-restore/rollback evidence, independently reviewed acceptance records. |

**Client message trigger:** After completion of all *engineering-owned* P1 and P2 gates, extract only unresolved P3 client/finance/legal/operational inputs. Never ask the client to supply test users, QA devices or dummy drivers. Use approved information already on file; do not request it again. **Commercial launch GO** requires every mandatory P3 gate to pass, not an arbitrary percentage.

## Change-control and reporting contract

Each gate has fixed key, owner, evidence tier, exact commit, evidence artifact link, UTC run time and disposition (`PASS`, `FAIL`, `NOT_RUN`, `BLOCKED_EXTERNAL`, `DEFERRED_BY_SCOPE`). Failure findings must include reproducible traces and tests. New SHA invalidates commit-specific CI, browser, deployment and controlled finance evidence until rerun. Do not overwrite historical results. All source changes go directly to `main` per owner instruction; no branches. Finance records, policies and protected production rows remain unmodified until authorized.
