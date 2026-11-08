# Phase 3 — Ordinary customer/store referral attribution

Source branch: engineering/phases-1-2-3-20261108
Status: Signup attribution foundation implemented; **financial reward and wallet spend remain NOT IMPLEMENTED / NO_GO**.
Do not treat these APIs or database receipts as a financial launch approval.

## Scope now implemented

- Customer and approved store owners can request one stable random KTR- referral code from authenticated GET/POST /api/account/referrals. The endpoint never trusts an owner ID supplied by a caller; store IDs must belong to the authenticated active store owner.
- Signup accepts a narrowly validated optional referralCode for CUSTOMER/STORE (not DRIVER), including links with a ref= query parameter.
- Attribution is persisted inside the original signup PostgreSQL transaction. Invalid or inactive code, cross-program promoter code, self-referral or repeated attribution aborts without leaving a newly registered user.
- ReferralEvent stores only a PENDING ordinary-signup claim. No code issuance or signup event transfers money.
- An additive partial UNIQUE index applies to ordinary-signup events only; existing promoter event rows and legacy referrals are not reclassified or deleted.
- Shared authorization inventory includes the authenticated two-role referral route.

## Proof at implementation

- TypeScript, ESLint and migration safety checks passed.
- Seven new ordinary-referral unit tests, five new API tests, two isolated PostgreSQL integration tests passed.
- Existing route authorization inventory suite passed eight tests.
- Full Vitest suite passed: 1,032 files, 5,118 tests (snapshot before final GitHub commit); disposable migration applied successfully only to named local kt_launch_test.

## Still required before activation

1. Establish an authoritative, idempotent source-backed first qualifying paid order predicate across courier and marketplace orders, with exact verified provider funding and refund/chargeback handling.
2. Post a balanced, immutable R5 (admin-configurable) referral reward journal to the correct customer/store wallet liability, including overpayment/reversal/debt behavior. Prevent promoter double-rewards and detect self-referrals across contact aliases. No credit can be made using data from the signup request or a user-supplied order amount.
3. Implement checkout wallet spending and recovery/refund allocation; until then a credited balance cannot be advertised as usable for purchases.
4. Surface the earning/share journey in customer/store dashboards only when financial processing and operator acceptance are ready.
5. Certify exact-source application/browser/database tests and independently approve production financial settings and provider contract.

The existing engineering release register contains nine open or validation-blocked launch gates. None are marked implemented by this work. Do not merge main or deploy to Railway/Vercel while required gates remain unresolved.


## Source-backed payment eligibility continuation (read-only)

The admin GET endpoint /api/admin/referrals/[id]/eligibility requires both
customers.read and finance.read and returns an explicit non-authorization
response. It never posts referral money, advances referral status, or bypasses
a release/finance gate. The code is intended to underpin the future audited
R5 payout processor, not authorize it.

Validation uses the first successful source payment from the actual referred
account, and checks exact full-value provider clearing/held double-entry
journals, linked verified webhooks, signatures, source addresses, merchant
and attempt identity, real PRODUCTION (not sandbox) environment, no refund
reservation/completion or payment dispute, and completed delivery. Courier
COD must be fully reconciled. Marketplace orders must be fully digitally paid
with every store group settled and physically delivered. Orders without
complete financial and fulfilment evidence remain ineligible.

The referrer identity is rechecked at inspection time; phone aliases in
South African +27 / 0027 / local 0 formats are treated as the same number.
Any completed payment predating original referral attribution fails closed.
Tests cover negative forged/partial money receipts, sandbox evidence,
refund/dispute, split-cash, incomplete multi-store delivery and owner access.

**NO monetary disbursement has been implemented**: posting, reversal/debt,
store-spend and customer-spend remain release-blocking work, and operator
approval is required before real R5 wallet credit.
