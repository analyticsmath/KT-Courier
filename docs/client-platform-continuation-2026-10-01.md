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
