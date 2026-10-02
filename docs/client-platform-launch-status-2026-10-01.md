# KT Couriers client implementation and launch status

This records the actual implementation against the client's latest Website & System Changes (3) and Delivery and Access (3) documents, read in full on 1 October 2026. Production deployment verification is recorded separately below. A passing infrastructure healthcheck does not mean every commercial workflow is ready.

## Requirements

| Client requirement | Implemented behavior | Remaining launch dependency |
| --- | --- | --- |
| Accepted delivery van and branding | Existing van and cool-white visual system retained. No arbitrary category colors or client art-direction changes added. | None for this increment. |
| Quote before signup | Anonymous, owner-bound, expiring quotes use trusted Maps geocoding/routing and versioned server tariffs. Signup is required to book/pay/track. | Live catalog and quote page return 200. The Johannesburg/Sandton quote reaches trusted geocoding but returns COVERAGE_UNAVAILABLE. Approved geographic service-area centers/radii must be configured before a successful live quote can be verified. |
| Economy and Standard | Initial client prices R89/R129/R179 and R129/R179/R249; final explicit Standard turnaround 1–2 business days. Admin edits create audited rule versions. | Actual operational service regions must be active. |
| Express | Configurable per-size base/per-km charges and service coverage; inactive initial draft. | Older client document supplies R5.50/R8.50/R13.00 size amounts alongside R5.50/km. Confirm whether they are size-specific per-km rates or additional base fees. |
| Marketplace tariffs | Existing commercial pricing architecture remains separate from parcel quotes. | R90–170 range has no complete distance/size/high-risk formula. Configure approved tariffs before enabling live purchases. |
| Scheduled booking | Future collection time is separate from service level and retains the selected service's price. | Operational collection-window capacity policies, where required. |
| Province expansion | Service/province/region availability is configurable; current public quotes require actual active regions for both endpoints. No permanent Gauteng-only constraint. | Activate each new operational area before exposing it. |
| Avatar and customer account | Raster-validated private avatar upload; account history, addresses, chats, notifications and settings integrated. | Transactional-email delivery prevents new customer enrollment until configured and validated. |
| Business employee access | Real membership, owner controls, invitation acceptance, section permissions, disable/remove/reactivate and four role presets. Actual employees remain the actor. | Employee email invitations need working transactional email. |
| Driver/customer/admin chat | Separate retained delivery and support threads; current assignment and actual participant authority enforced. | Email notification delivery is separate from in-app chat. |
| Store reviews | Actual completed-order reviews and business replies, with employee review permissions. | None for the implemented workflow. |
| Driver cash | Real ledger-derived balance, collection/deposit history, related orders and outstanding amounts. Pre-pickup collection is rejected. | Actual deposit bank instructions. |
| Deposit reconciliation | Receipt submissions, audited bank verification, idempotent canonical ledger reconciliation and crash replay protection. | Real bank evidence is required for confirmation; no fake deposits or clearance. |
| COD | Approved store/service/province/region/order scopes, configurable split and maximum cash amount. Digital deposit is charged correctly; cash completion is checked before OTP/proof consumption. | Administrators must enable eligibility and approved limits for actual stores. Initial 50/50 can be configured without rebuilding. |
| Business expense report | Actual delivery, commission, subscription, marketing and refund records, exact money, filters, complete bounded totals and safe CSV export. | Requires underlying actual platform transactions; no fabricated spending. |
| Coupons and item campaigns | Persisted percentage/fixed drafts, dates, limits, actual owned catalog targets, keyed codes, revisions, submission and audited rule review. Budget/redemption screens show actual records. | Activation, checkout redemption, funding and reversal integration remains unfinished and disabled. Draft/rule approval is not a live discount. |
| Banner/advertising tools | Existing managed-marketing requests, placements and workflow remain integrated; secure artwork upload is available from business tools. | Approved package prices and actual paid/approved publication evidence. |
| Business plan and wallet | Actual contracts, invoices, entitlement grants and canonical ledger/payment history shown in the same business dashboard. | New recurring subscriptions and external provider-account authorization remain disabled pending implementation/validation and approved commercial terms. |
| Superuser business support | Required reason, real SUPER_ADMIN identity, permission checks, expiring read-only grant, audit history visible to the business. No owner-session substitution. | None for the implemented read-only support workflow. |
| Commissions | Existing configuration engine supports separate store/driver/platform/promoter rules. No unapproved final percentage was introduced. | Final production settlement schedules and real merchant onboarding. Client explicitly says to confirm these before live financial transactions. |

## Verification and deployment

The feature branch is `feat/client-platform-requirements`; release PR is https://github.com/analyticsmath/KT-Courier/pull/10. Commit 5790f4e persists release hardening. A quality-closure increment follows it.

At that commit: 375 focused tests passed; strict production Next build and TypeScript passed; 69 migrations executed on a fresh PGlite PostgreSQL-compatible database. GitHub CI passed real pricing, dispatch, cross-module, ledger, PostgreSQL webhook-concurrency, migration-smoke, container-build, Docker runtime and release-critical Paystack/security/refund/processor jobs. The quality job found existing lint/source-fixture failures, which were corrected before merge. Final local validation: all 3060 tests across 710 files pass, full repository lint passes with no errors or warnings, and full TypeScript passes. These checks do not validate existing production data or perform real external payment charges.

Railway web configuration preserves existing pre-deploy migration/seed/sync commands and appends client delivery-rule initialization. The missing promotion HMAC key was generated and configured without exposing it. Unrelated staged Railway changes were not applied. PR #10 merged at main commit af993ba9ec03ceec333f2d12758b198293ce5dc6 after all enabled GitHub checks passed (run 36926163881). Railway deployment cf8fe68d-1782-4c7d-bced-ff414de4852d succeeded after production migrations and client delivery initialization. Vercel production deployment dpl_99nNXt9vXnD6GFo9RpCRWYWwcQsV reached READY with both custom domains and no alias error.

## Inputs needed for a complete launch

1. Transactional-email provider credential and verified sender. Existing MX/cPanel email DNS must be preserved. Notification delivery also needs completed runtime validation; a missing credential is not the only blocker.
2. Actual deposit bank instructions and reconciliation operating process.
3. Approved merchant onboarding and final commission/settlement rules.
4. Express fee interpretation and a complete marketplace delivery formula.
5. Subscription package terms/prices and the supported external account/payment authorization contract.
6. Finish and validate promotion funding/redemption/reversal integration before financial activation.

Production signup, OTP resend and password-reset requests return a safe, uniform 503 while account-email delivery cannot run, instead of creating unusable accounts or falsely claiming messages were sent. Existing account login and consumption of valid reset tokens remain available. A declaration of 100% customer readiness would be inaccurate until these dependencies are resolved.

## Live release and security follow-up

At 21:19 UTC on 1 October 2026, www.ktcouriers.com and the Railway domain return 200 for readiness (healthy database/Redis), delivery catalog, quote, login, signup and the tracked 512px brand icon. Employee and conversation APIs return 401 to anonymous requests. Camera/geolocation policy permits the current origin. Initial mutation testing caught missing website origin configuration; adding explicit HTTPS apex/www/Railway origins fixed the 403 while unrelated origins remain rejected. Configuration deployment aecf7af0-a022-40d3-abb9-2776af56cfb7 succeeded. No successful payable quote is claimed: seeded regions lack geographic coverage geometry. Approved operating-region centers and coverage radii must be configured in Admin → Service regions. Active city labels alone are insufficient. No fake region or road distance was inserted.

The security follow-up pins Next.js and its ESLint configuration to patched 16.3.8, patches compatible dependency advisories and Vitest tooling, replaces internal full-page redirects with Next navigation and tests explicit production proxy origins and rejection of spoofed hosts/lookalikes. The local Next 16.3.8 build, full TypeScript, lint and all 3062 tests passed before the execution environment went offline during a final rebuild. The production dependency audit reports zero advisories. GitHub regenerates the lockfile and verifies the exact committed source and dependencies before merge; local checks do not substitute for that final commit's CI.

Maintainer sources: https://github.com/vercel/next.js/releases/tag/v16.3.8 and https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j. An advisory finding is not a claim of an observed exploit. This patch does not complete or unlock the unfinished promotion funding/redemption/reversal, recurring subscription authorization or notification runtime. Required business/provider inputs above still prevent 100% customer readiness.

## Vercel middleware startup correction

PR #11 merged at 0105cd0f044afbc202222f0b8051eab6fc95a88c after all enabled jobs in GitHub run 36929804735 passed; production audit found zero advisories. Railway f07b7924-d26e-45c4-86f4-4b70d3c8d79c started Next 16.3.8 and passed readiness. Vercel dpl_BPf9LFUUiPYDkjxGjkBN1RK3VDZB reached READY but actual HTTP checks caught 500s: its serverless middleware loaded the application's instrumentation hook and rejected missing DATABASE_URL and public app configuration before forwarding.

The correction shares an explicit Vercel proxy-only runtime classifier between instrumentation and request routing. Only Vercel production/preview without a database and without Railway service/environment markers skips database startup validation. Railway, stateful Vercel and malformed/unknown platform flags continue enforcing it. No placeholder database, new provider credential or financial gate override is introduced. Dedicated tests exercise forwarding startup and rejection of invalid stateful runtimes. Actual production HTTP verification remains required after the correction is deployed; a provider READY status alone is insufficient.

## Verified startup repair and 2 October continuation

PR #12 merged at ebf4bb12bb58d08f19a9b4eae7adefa253a506a7. Railway e6a58f93-f35e-4542-90b7-7c60b1bb5c02 succeeded; Vercel dpl_CPXEFTMWF9YzpHiZXfNXQeAonydi reached READY on the same source. The independent HTTP probe at 22:16:45 UTC on 1 October verified both origins: readiness/catalog/quote/login return 200, database and Redis are healthy, private employee/conversation APIs return 401, unrelated mutation origins return 403. The Vercel startup 500 is resolved. A valid-origin live quote still returns 409 COVERAGE_UNAVAILABLE. On 2 October the user selected defined service zones; their approved geometry is still required. No province-wide coverage was substituted.

The 2 October continuation closes a concrete email durability gap. Signup, OTP replacement and password-reset token issuance write their encrypted notification intent in the same database transaction. Persistence failure returns a safe unavailable response and rolls back the token/account changes. Security intents are serialized per operation in PostgreSQL; replay checks bind actual recipient, event, aggregate, expiry and private values. V2 AES-GCM envelopes bind ciphertext to the operation and retain a reader for the previous authenticated envelope. No private token values enter public evidence.

The Resend adapter uses the SDK's API idempotency option instead of email headers, requires an explicit sender and an actual provider message reference, and reports safe normalized failure codes. Delivery retries keep one provider key while recording distinct attempts, honor retry due times, check provider availability before claiming, and scope suppression to the actual recipient. These changes do not claim completed receipt ingestion or unlock the notification runtime.

Local checks before the build workspace reset passed all 3089 tests across 714 files, full lint and TypeScript. The local build was interrupted and is not reported as passing. The committed source is independently checked in GitHub CI, including eight real PostgreSQL outbox/API scenarios: concurrency, replay conflicts, encryption failure, bootstrap authority, atomic rollback, failed signup, failed OTP resend and failed password recovery. Production email credentials/sender and consolidated runtime validation remain required. Promotion funding/redemption/reversal and recurring subscription/provider authorization remain unfinished and disabled.


### Further account and CI verification corrections

Password reset consumption now serializes per user and commits the password update, single-use token consumption, invalidation of sibling reset links, session revocation and encrypted password-change intent together. The PostgreSQL suite includes rollback on encrypted-payload write failure plus concurrent resets with the same and different links. These scenarios require CI verification before release.

The previously intermittent payout/dispute test failure was diagnosed from its preserved rejection: a random hexadecimal fixture nonce sometimes contained six consecutive digits, which the existing opaque bank-reference policy correctly rejects. The test nonce is now encoded using letters, preserving entropy and leaving the production reference policy and financial assertions unchanged. This corrects the fixture; it does not establish complete production financial readiness.

The owner selected defined service zones for launch. Exact approved region centers and radii remain outstanding; province-wide coverage and invented geometry have not been enabled.
