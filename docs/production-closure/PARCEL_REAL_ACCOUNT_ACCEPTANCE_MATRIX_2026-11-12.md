# KT Couriers — Parcel Delivery Real-Account Acceptance Matrix

**Purpose:** The development team creates customer, vendor/store and driver accounts using their own real emails **after** engineering CI and the approved test configuration are ready. Accounts, real OTPs, real locations, bank details, store verification and provider settlements are never fabricated or seeded into production for this exercise.

**Evidence rule:** Each test must record the actual order reference, role, transition, verified receipt/ledger journal if applicable, and successful/failed result. Do not disclose OTPs, sensitive PII, card details, private documents or credentials in shared tickets.

## A. Preflight and test safety

1. Capture the exact tested GitHub SHA, passing CI, tested Vercel/Railway deployment SHA and operational feature flags.
2. Confirm the system is operating in the intended, explicitly authorized payment-provider mode. **Do not use real money or a production card without the owner's authorization.**
3. Confirm an active, genuinely approved Johannesburg/Pretoria coverage region, selected service, parcel profile/weight rule, route provider and tax toggle. Do not invent a covered suburb.
4. Ensure the administrative notification recipient(s) are verified and mail delivery status is observable. Confirm SMS/OTP/email providers are provisioned.
5. Vendor owner must genuinely complete pickup address, phone, coordinates, opening hours and store certification. Do not manually force an INCOMPLETE store LIVE.
6. Driver must genuinely submit identity, required documents and vehicle details; only a privileged reviewer approves them. Enable genuine service region and online availability.
7. Cash policies and remittance bank details must have documented independent approval, per-store/per-service/per-region scope, amount limits and high-risk exclusions. If not approved, **test card-only first**.
8. The operator can review dispatch exceptions, deposits, claims, refunded states and all immutable audit/financial entries.

## B. Customer-originated direct parcel

| Step | Customer action | Expected canonical evidence |
| --- | --- | --- |
| B1 | Request guest quote for valid pickup/dropoff, size/weight, STANDARD or EXPRESS as available | Quote with active route, exact amount in ZAR, policy snapshot, expiry; no signup required |
| B2 | Sign up with a real test email; verify; enter parcel booking and recipient contact | Same customer account can access parcel and marketplace; quote owner now bound; no cross-account access |
| B3 | Book with DIGITAL_ONLY | Exactly one immutable order and quote consumption; order remains PENDING and cannot dispatch |
| B4 | Complete explicitly authorized provider test checkout | Provider signature and exact verified amount; success ledger journal; payment source-bound to order |
| B5 | Check status and dispatch | PENDING -> CONFIRMED once, with status history and notification; paid order can be assigned; wrong/unposted payment cannot |
| B6 | Admin offers assignment to approved driver; driver accepts | Versioned assignment, eligibility, release of stale offers, operational events |
| B7 | Driver starts collection and confirms sender pickup OTP | Only designated sender authorizes pickup; custody and timestamp recorded; wrong/stale code does not |
| B8 | Driver starts transit and sends location sample | IN_TRANSIT status, fresh geographic/location evidence, customer tracking |
| B9 | Driver requests recipient OTP, uploads proof and completes handover | Recipient OTP + POD + location and immutable delivery event; one delivered terminal transition |
| B10 | Inspect customer history, receipt, driver account, operator notifications | Accurate driver earning/commission, no premature reward, delivery receipt, relevant alerts |

## C. Vendor-originated direct parcel

| Step | Vendor action | Expected evidence |
| --- | --- | --- |
| C1 | Register vendor account with real email; complete genuinely serviceable store pickup address | Store remains inactive until independent setup/delivery/checkout certification |
| C2 | Open store parcel booking, request a quote | Pickup prefilled from verified store location; cannot substitute an unauthorized pickup |
| C3 | Book vendor-owned delivery with DIGITAL_ONLY or genuinely approved scoped COD | Order source STORE, correct store ownership, wallet/payer authority, pricing and sender email |
| C4 | Complete provider test checkout or approved cash policy | Same payment gate and idempotency as customer; no confirmation based on redirect alone |
| C5 | Dispatch and complete physical handover | Driver verifies sender at store; recipient OTP and POD; store history/tracking and finance match |
| C6 | Separately purchase a marketplace item from the store | Certified store checkout, preparation, separate verified merchant handoff, courier bridge, no duplicate courier order |

## D. Driver / admin / cash and exceptions

| Scenario | Expected behavior |
| --- | --- |
| Driver with pending/expired identity or vehicle documents | Cannot receive an active offer |
| Unavailable/outside-region/over-capacity driver | Cannot accept an ineligible offer |
| Duplicate offer / concurrent driver accept | Exactly one current assignment; version conflicts fail cleanly |
| Reassignment before custody | Only authorized admin, reason and audit history, original offer revoked |
| Reassignment after custody | Restricted custody/exception workflow, never silent driver swap |
| Failed pickup / recipient absent / redelivery | Evidence, retryable attempt or manual exception queue, no fake proof |
| Invalid pickup/delivery OTP | No custody/delivery transition; attempt limits and resend policy work |
| Customer cancels before dispatch | Correct cancellation state, refund method subject to actual funds and policy |
| FULL_COD booking, only if independently enabled | Immediate CONFIRMED booking with CASH_DUE_ON_DELIVERY, **never** labelled PAID |
| DEPOSIT_PLUS_COD booking | PENDING until exact provider-ledger-backed deposit activates COD; collection allowed only after pickup |
| Full wallet funding for a parcel | Wallet spend posts a single settled journal and order status history, then unlocks dispatch; retries do not debit twice |
| Partial wallet + online card for a parcel | Only the provider remainder is charged, and the reserved wallet portion is consumed once after verified payment |
| Partial wallet + approved 50/50 COD | Exact provider remainder plus independently posted wallet consumption must equal committed digital deposit; verified wallet journal ID is stored in COD deposit evidence |
| Tampered wallet contribution or wrong ledger journal | Cash deposit remains PENDING, parcel is not confirmed, and no driver cash obligation is activated |
| Full or split cash collected by driver | Correct original actor, collected amount and double-entry cash custody |
| Bank deposit evidence | Real uploaded evidence, finance review, independently confirmed settlement and shortage handling |
| Duplicate cash operation | Same authorized collector may replay; different actor or conflicting payload denied |
| High-risk pickup or dropoff | Cash choice not offered and server rejects bypass |
| Finance reconciliation required | Dispatch and financial release remain blocked pending resolution |
| Review and complaint after delivery | Customer can review delivery separately and submit claims; admin sees linked driver/order |

## E. Engineering evidence and acceptance policy

The code-level release is not equivalent to live external-provider acceptance. Prior to real-account acceptance, the automation must pass at the **same exact SHA**, including the whole unit/component suite, lint, types, optimized Next build, disposable PostgreSQL integration, Docker smoke and relevant Playwright E2E. CI variables that disable deferred suites must be reported as SKIPPED rather than PASS. A claimed complete real-world delivery requires actual messages, actual authenticated users, driver/operator observation, real identity documents, and genuine provider/bank evidence.

**Latest code-level fixes in this pass:** removal of invalid dispatch-source control byte; actor-bound pickup/COD receipt replay; transaction-scoped parcel dispatch funding gate; approved FULL_COD booking status; provider-ledger-backed digital-payment confirmation (Paystack and PayFast); deposit activation and reconciliation hold checks.

No bank account number, production secret, OTP, real email identity or real payment reference belongs in this document.
