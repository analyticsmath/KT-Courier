# KT Couriers — Phase 3 continuation and verified-progress ledger

**Maintained:** 2026-10-27. **Branch of record:** `main` in `analyticsmath/KT-Courier`; never infer current deploy status from this document alone. The current main SHA must be read at handoff. This is an engineering progress record, not evidence of legal/finance approval and not a credential store.

## What is already delivered — do not redo

- Core parcel booking/COD guardrails, driver OTP + private POD upload, verified delivery location, idempotent driver transitions, pickup and failure paths, marketplace store orders, catalogue/variants/media/import/inventory/moderation, Super Admin controls, and owner-scoped customer tracking already have implemented code and passed historical engineering acceptance. Re-test narrowly when the affected contract changes, not every old feature on every chat turn.
- 2026-10-27 `30f031e17222ec6cedab1af2ef0d4a2165b21c21`: unregistered-store guidance and identifier validation + default public timeline recipient-name minimisation.
- 2026-10-27 `b36387112667d5799e6efd6d4853a6f3b38b2f87`: cancelled marketplace orders no longer show a due customer cash balance. GitHub CI run `40516139374`: SUCCESS; exact SHA Production Certification run `40516139563`: **FAILED at one vendor five-product browser case** (23 component jobs succeeded). The browser timed out locating `getByLabel("Identity version", {exact: true})` after the accessible label changed to `Identity version (reference, not the seller name)`. This is an acceptance-test selector mismatch, not evidence that vendor registration or database approval failed. The candidate uses `seller.locator('input[name="identityVersion"]')` scoped to the identified form, preserving accessible form guidance while stabilizing the journey against copy changes. The exact next commit must still pass the browser case; a local unit result is not Chromium acceptance.

## Current candidate — owner-safe recorded-POD photo indicator

- The delivery completion workflow already requires accepted assignment, valid recipient OTP, reviewed delivery responsibilities, COD readiness, verified delivery location, and private proof upload before atomic `ProofOfDelivery` creation; this remains unchanged.
- Customer-facing marketplace tracking now derives only **whether photo evidence was recorded**, using the private POD pointer's *non-null existence*; it does not return the private reference or raw image URL. The status is shown only if delivered/completed and only on the already owner-/guest-authorized tracking route. It also keeps suppressing live GPS after delivery. The marketplace order-confirmation UI provides a plain-language indication of privately recorded photo evidence.
- Fail-first unit case `tests/services/marketplace-delivery-tracking.service.test.ts` verifies (a) pending orders cannot show POD status, (b) delivered orders expose the boolean and timestamp, (c) absent photo evidence is reported as absent, and (d) no private tokens, raw coordinates, phone or recipient name are serialized. The legacy POD tests remain green.
- Comparable industry evidence: official Uber Direct proof-of-delivery documentation describes context-sensitive PIN, photo and signature requirements, while DoorDash tracking provides milestone/status/POD confirmation. These are design references, not third-party verification of this code: `https://developer.uber.com/docs/deliveries/guides/proof-of-delivery` and `https://developer.doordash.com/en-US/docs/drive/how_to/Parcel/tracking_links/`.

## Phase 3 acceptance gates still blocked on genuine external evidence

- Provider domain/variable existence is not a real Paystack charge/refund/settlement or Resend inbox receipt. As of the previous connected-provider inspection, Resend `ktcouriers.com` domain is verified but the account returned **no delivery-event webhooks**. Confirm webhook tracking and use approved recipient test credentials before any claim of end-to-end email delivery.
- Approved actual store products, quantities, packing dimensions and fulfilment schedule; vendor identity review (including unregistered individual sellers) and commissioned marketplace operations.
- Independently reviewed cash-handling/beneficiary bank, COD limit and remittance policy; signed payout/refund/commission authority. Do not change gates or enable real-money functions to make tests pass.
- Real approved drivers/vehicles/routes, location/OTP/POD/exception operational trial, customer support and warehouse workflow evidence; public legal/POPIA disclosures and sign-offs.
- Last release P3-05 requires exact-main-SHA CI, Chromium/PostgreSQL/security/recovery certification, live deployment equality and a signed final launch verdict. Historical successful unit/E2E checks count only for unchanged contracts, not unrelated provider operations.

## How another chat should continue

1. Read this file, `docs/production-closure/engineering-gates.json`, `docs/production-closure/PHASE_3_PROVIDER_AND_RELEASE_CHECKPOINT_2026-10-27.md`, and GitHub exact-main-SHA workflow results. The 2026-10-08 old Phase 2/3 ledger contains obsolete branch/no-main restrictions superseded by newer user instructions; use recent verified receipts over outdated planned statuses.
2. Prioritize **vendor fulfilment** and **delivery/POD/tracking**. Identify one concrete defect, write a failing test, implement the smallest secure change, run focused + full checks, commit to `main` with expected HEAD and verify hosting. Avoid duplicate branches and arbitrary completion percentages.
3. For P3 external approvals, report what genuine proof is missing. Do not request or expose credentials/bank details in chat, fabricate a delivery, approve another person's identity, or disable COD/payment restrictions.
4. Update this file with the next commit SHA, exact CI/certification results and work still open, so later chats can resume without losing prior evidence.
