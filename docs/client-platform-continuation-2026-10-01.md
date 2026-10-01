# Client platform continuation checkpoint — 2026-10-01

Status: implementation remains in progress. This is not customer-readiness or deployment approval.

## Durable implementation

The feature branch contains the quote, employee, chat, review, avatar, authentication and driver cash changes. Last implementation commit before this checkpoint: 8db8c0e43dec5c39c466016fa816153d43b7b353.

The cash increment adds:
- Actual-driver cash history, cash-in-custody ledger totals and deposit submissions.
- Administrator configuration of actual bank instructions and bank receipt review.
- Full collected-amount deposit evidence, operation replay protection and reconciliation receipt matching.
- Crash recovery when the canonical ledger posted but confirmation did not finish.
- Active driver checks at the collection endpoint.
- Server rejection of cash collection before pickup.
- Transactional COD checks before delivery OTP and proof consumption.

Validation of the cash increment: 89 tests in nine files passed; affected ESLint checks reported zero errors/warnings; full TypeScript check passed after correcting the deposit relation name to `driver`.

## Recovered COD increment — persisted 2026-10-01

Historical context: the workspace went offline immediately after the COD/payment-policy full TypeScript command returned exit code 0. A subsequent shell invocation failed to reconnect. Repeated attempts finally returned `409 Conflict, environment_offline: Environment is not connected`.

The work listed below was reconstructed after the workspace reset and is now committed remotely as 9b48587ce051f74d1f0c302776183b438bdebba7. All follow-up review fixes below are included. Fresh verification: 111 tests in 12 files passed, affected lint passed and full TypeScript check passed.

New files:
- `lib/client-platform/payment-configuration.service.ts`
- `components/forms/PaymentPolicyConfiguration.tsx`
- `app/(admin)/admin/payment-policies/page.tsx`
- `app/api/admin/payment-policies/route.ts`
- `app/api/public/delivery-quotes/[id]/payment-methods/route.ts`
- `tests/client-platform/payment-policy.test.ts`

Modified files:
- `lib/payments/payment-policy.service.ts`
- `lib/commercial/configuration.service.ts`
- `lib/services/orders.service.ts`
- `lib/services/payment-subject.service.ts`
- `lib/services/payment-preparation.service.ts`
- `lib/services/payment-customer-query.service.ts`
- `lib/client-platform/api.ts`
- `lib/client-platform/contracts.ts`
- `lib/dto/payment.dto.ts`
- `components/forms/PublicDeliveryQuoteForm.tsx`
- `app/(payments)/orders/[orderReference]/payment/page.tsx`
- `app/(store)/store/orders/[id]/page.tsx`
- `lib/protected-navigation/protected-navigation-registry.ts`
- `tests/services/payment-subject.service.test.ts`
- `tests/services/payment-preparation.service.test.ts`
- `tests/marketplace-checkout/marketplace-cod.test.ts`

Local verification: 105 tests in 12 files passed; affected ESLint checks reported zero errors/warnings; full Next route type generation and TypeScript check returned exit code 0. Logs were `/tmp/kt-cod-policy-tests.log`, `/tmp/kt-cod-lint.json`, `/tmp/kt-cod-typecheck.log`. These logs may be lost if the execution workspace resets. No production migration or deployment occurred.

### Local behavior implemented

Payment policy context adds stable service key, both provinces, destination region and order ID. Every scope must match. Malformed or missing province evidence cannot match province-specific policies. The resolver groups identical scopes and picks the newest version; duplicate equal versions or equally specific overlapping different scopes fail closed. A specific order override has priority over general multi-scope policies.

Cash policies require an explicit matching store ID on the policy, an ACTIVE store and ACTIVE owner with verified email. Global cash eligibility is denied. Deposit-plus-cash uses one valid fixed or fractional percentage deposit; the required deposit must be greater than zero and less than total. Maximum COD amount applies to the cash component. Cash policies require a positive cash limit. Decimal arithmetic and half-up cent rounding remain authoritative.

The commercial configuration helper calls the canonical resolver instead of composing successive OR filters that overwrote prior scope and effective-date conditions.

New strict admin schema accepts: storeId, service stable key, nullable province list, nullable regionId/orderId, DIGITAL/FULL_COD/DEPOSIT_PLUS_COD, fractional depositPercent, positive maximumCodAmount, active, expectedVersion and a reason of 10–500 characters. Actual ADMIN/SUPER_ADMIN plus cod_operations.manage is required. Writes use scope advisory locks, version comparison, immutable successor versions, supersede prior active versions, validate active service/region/approved store and audit the actual actor.

An active per-order override locks the Order row and requires the same store, pre-pickup status, no prepared payment, no collected cash and no paid deposit. It recomputes the canonical split from the existing quote, updates the committed payment-policy snapshot, and creates/updates/removes the unpaid COD obligation atomically. Paid/prepared/picked-up orders remain locked. No client price or owner impersonation is accepted.

Quote payment-method GET authenticates the actual user and business delivery permission. Digital is always offered; eligible configured cash split is additional. Quote provinces come from metadata.bookingInput, not inputSnapshot (the latter uses pickup/dropoff coordinates and omits province). Booking schema accepts the optional payment method. Booking sends it to actual order creation; order creation resolves cash policy using the transaction, actual quote service IDs/key, address provinces and destination region. Digital booking does not require a global cash policy.

Order payment subject includes COD evidence. For DEPOSIT_PLUS_COD it charges digitalRequired, not the full quote, and cross-checks the immutable snapshot, sum of required components, zero already-collected/paid amounts and PENDING status. Full cash cannot start online payment. Business Finance employees are authorized against the exact order store and remain the actual payer.

Payment preparation locks the Order row and re-resolves the subject inside the payment transaction before creating the Payment. If amount or currency changed since the initial subject resolution it rejects, requiring reload. This shares locking with per-order overrides.

Business order detail has a payment link only for owners/Finance access. Payment page lookup recognizes active Finance memberships. When an existing payment belongs to another actual payer, the page shows its status and disables checkout rather than substituting that payer.

### Follow-up review items before persisting/deploying

- Display an intentional cash-only/nonpayable state on the payment page: full-COD or an unpaid delivered order currently causes resolveOrderPaymentSubject to reject; avoid an unhandled page error.
- Round percentage-to-fraction UI serialization to four decimals rather than relying on raw binary Number division.
- Review whether historical policy versions should expose an edit action; saving a stale version correctly fails optimistic concurrency.
- Add admin policy write tests, particularly paid-order refusal and serialization/retry behavior.
- Re-run affected checks after any fixes, save the increment remotely, then continue the remaining requirements.

## Remaining implementation and launch work

- Business expense history with date/type/status filters, exact totals and safe CSV export derived from actual delivery, commission, subscription and marketing records.
- Actual coupon/campaign authoring, targets, dates, limits and audited management. Existing promotion administration services are still stubbed and production activation remains locked; never present drafts as live discount redemption.
- Marketing artwork upload UI integration, banner placements, activation and genuine campaign performance.
- Subscription and provider wallet integration using real configured commercial/provider capabilities.
- Audited SUPER_ADMIN business oversight with required reason and visible real actor, without owner session substitution.
- Full build, broader financial/security regression checks and integration proof.
- Production initialization/migrations and coordinated Railway/Vercel deployment, then live readiness verification.

Preserve the accepted van hero and existing design standards. Do not implement arbitrary colored categories or client art-direction changes.

No Express size fees, Marketplace pricing formula, legal merchant facts, external provider wallet contract or bank account details were invented. These remain configuration/business inputs where the documents do not provide them. Keep unrelated production financial gates locked until their actual workflows are validated.

## Business reporting and oversight increment

Implemented exact-money business expense projections with date/type/status filters, bounded complete totals, paid/unpaid/deducted/refund states and CSV formula protection; marketing artwork upload controls; corrected destination URL defaults; real-identity SUPER_ADMIN read-only support dashboard with required reason, 15-minute grant, permission rechecks and business-visible access history. Finance, marketing and settings employee modules are enforced separately. No owner-session impersonation.

Verification: 123 tests in 14 files passed; full Next type generation and TypeScript check passed. Production deployment is still pending.

## Promotion authoring and membership projections

Added actual business-scoped promotion drafts with exact percentage-to-basis-point conversion, fixed discounts, catalog ownership checks, dates, limits, proposed budgets, keyed coupon hashes, idempotent creation and revision comparison. Editing and submission use real employee identity. Administrators can review rules or request changes with audited reasons and cannot self-review; these actions do not activate discounts, create funded budgets or debit wallets. Budget and redemption pages display actual records. Store/product/category/delivery targeting scopes now all constrain eligibility; business campaigns are constrained to their owner store. Membership pages show actual contracts, invoices, grants and effective active business plans. Driver GPS and camera access are restored with same-origin browser policy.

Verification: 149 tests in 17 files pass; affected lint passes; full TypeScript check passes; the production Next build passes with strict build-time TypeScript validation. All 69 migrations applied to a fresh PGlite PostgreSQL-compatible database (439 tables). This migration check validates fresh schema execution, not existing production data or provider settlement. The full repository regression suite is being triaged; some older source-contract and authorization tests already fail and require baseline comparison. Live www.ktcouriers.com and Railway /api/ready both return HTTP 200 with healthy database and Redis before deployment.

Remaining financial implementation is material: canonical promotion checkout/funding still contains stubs and is intentionally inactive; recurring subscription provider authorization remains inactive; public marketplace checkout is disabled. No declaration of complete customer readiness is justified by the checks above. Unconfirmed Express size fees, marketplace tariff formula, supplier legal facts, provider wallet contract and actual bank instructions must come from authoritative business configuration.

## Release hardening and infrastructure preparation

The latest `WEBSITE & SYSTEM CHANGES(3)` and `Delivery and Access(3)` uploads were read in full. Their operational requirements confirm the scope above. The older Updated Details document was also checked: it lists Express size amounts R5.50/R8.50/R13.00 alongside R5.50/km, but does not unambiguously distinguish per-size per-km tariffs from additional base fees. Keep Express draft configuration until the actual fee interpretation is specified; do not claim these rates were never provided.

Fixed a real Paystack result-validation error: valid merchant references containing `=` were rejected. The provider reference validator now accepts the documented character, while refusing markup. Checkout exposure now independently requires the public switch and a consistent runtime classification even when source approval is true.

Checkout contact/address edits authorize before geocoding, refuse reserved/payment/final states, recheck version and status under a row lock, and commit snapshots/version changes together in a serializable transaction. The trusted Maps coordinates resolve an actual active delivery region; hard-coded Johannesburg/Pretoria demo IDs and client-forged service areas are no longer used.

Business authority rejects driver/admin roles before business membership resolution. Authorization fixtures now model real ownership/membership checks. The static route inventory explicitly distinguishes source inspection from runtime proof. Recruitment processor scripts use Node's `--import tsx` runner to avoid unnecessary CLI IPC.

Production signup, OTP resend and password-reset requests now return a uniform HTTP 503 before account lookup/mutation when security-email delivery is unavailable. They no longer claim codes were sent through an unconfigured, source-locked notification authority. Production has no `RESEND_API_KEY` or explicit `EMAIL_FROM`; notification delivery validation is also incomplete. Existing account login and valid reset-token consumption are unaffected. This is an actual launch blocker, not an incidental missing variable. Prior project context confirms no transactional-email credential was supplied.

Verification: 375 focused tests across 54 files passed. The final production build passed, including strict TypeScript checking and all route rendering. Affected lint has zero errors (one ignored-script notice). The final broad run has 3039 passes / 20 failures across 710 files (698 passing / 12 failing). Remaining failures reproduce prior main source/visual expectations or require database lease fixtures; the six additional checkout/fixture/script failures were corrected. Preserve accepted visual design rather than restoring older test-specific artwork. Full-suite green is not yet claimed.

Railway's missing promotion HMAC secret was generated and set without exposing it, with automatic deploy skipped. Only the web service's pre-deploy command/readiness healthcheck were updated, preserving its existing production seed/sync commands and appending audited client delivery initialization. Unrelated staged Railway changes were not applied. Vercel/main production deployment is pending this checkpoint.
