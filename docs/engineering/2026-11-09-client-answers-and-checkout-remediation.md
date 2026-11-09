# KT Couriers — Client Answers, Checkout Incident Analysis & Remediation
Date: **9 November 2026**
Branch: `engineering/phases-1-2-3-20261108`
Status: **PARTIAL ENGINEERING FIXES IMPLEMENTED; NOT CERTIFIED FOR PRODUCTION**
Primary sources: the nine client documents (highest precedence: *Website Developer Brief*, then *Delivery and Access* and *Website & System Changes* for conflicts), the client’s latest answers, and the approximately 79-second WhatsApp screen recording supplied 5 November 2026.

## 1. Critical incident: what the video actually establishes

The video shows the public parcel/customer account journey transitioning to the store checkout. At the marketplace checkout contact step, the screen asks the known user to re-enter their name, email and phone; the next address step requires reentry even when an address is already saved in their account. The recording alone **does not show a completed card authorization, its provider response, an actual cross-domain cookie drop, or the full store pickup/availability error**. Those are distinct client-reported symptoms requiring separate live/provider evidence.

**Source cause for repeated entry:** `components/public-v2/commerce/CheckoutExperience.tsx` loaded only the checkout-specific contact/address snapshot. It never requested `/api/account/addresses`, authenticated profile details, or a saved address. The same customer already has a server-side address book via `lib/services/customer-addresses.service.ts`, but the two checkout presentations were disconnected. `MarketingNavigation.tsx` and public mobile navigation also sent a purported customer to `/login` irrespective of valid session; that creates the appearance of being signed out. A linked unauthenticated-looking page is **not by itself proof of session revocation**.

**Fix published on this same branch:** `GET /api/checkout/[reference]` first validates the caller’s owner-scoped checkout, then includes `account` (name/email/phone) and `savedAddresses` only for the authenticated CUSTOMER owner, with no-store response headers; guest checkouts receive neither. The checkout UI prepopulates existing account contact and preferred delivery address only if there is no previous checkout snapshot, and offers a saved-address selector. Valid saved map evidence is displayed, but **the server re-geocodes and rechecks live coverage**; manual editing clears stale map evidence. Public desktop/mobile navigation resolves the role through the same authenticated `/api/auth/me` endpoint rather than always rendering sign-in. No cross-domain cookie copying, trust weakening, implicit payment completion, or invented address/coordinates is introduced.

**Verification:** 18 targeted unit/API/negative-owner tests passed, targeted ESLint passed and TypeScript `--noEmit` passed in the isolated workspace with 6144 MB heap. These tests **do not replace browser login/account-switch, checkout, maps, staging or live Paystack acceptance**. Source has been committed to the requested GitHub engineering branch only.

## 2. Store collection and delivery availability error analysis

The reported:
- “This store has not configured a complete collection address, including suburb, postal code and a confirmed map location...”
- “Delivery availability must be confirmed for this address, active service, and route...”

...are **real fail-closed commercial prerequisites**. Existing `completeStorePickupAddress` and `describeStoreCollectionEvidence` require the store-owned saved `PICKUP` to include street, suburb (line2), city, province, four-digit South African postcode and valid map latitude/longitude. `getStorePickupOperationalPreflight` and store certification additionally check current active region/service and independent checkout evidence. A business profile's old free-text address or an arbitrary numeric map coordinate must not automatically transform into a certified pickup point. The `store-addresses.service` save flow revokes stale go-Live/checkout certification when a pickup location changes.

**Corroboration:** production Railway web logs contained repeated warnings `An address could not be resolved into a verified delivery point.` around November 3–5, including during the date of the client recording. This establishes real geocoding/availability failures, **not** which particular store records lack street/suburb/postcode/map data, whether Google Maps API quotas or keys are healthy, or which commercial region/service records are active today. The actual missing fields and counts must come from an approved, least-privilege production audit rather than guessing or setting fake pins.

**Do not “fix” by** disabling map verification, falsely marking stores ACTIVE, forcing every address into Gauteng, enabling cash for high-risk areas, inventing a driver, or offering Paystack success without a verified callback. Onboarding/activation must fail safely until the store owner/admin supplies genuine pickup details, active coverage and an independently witnessed test order. Notify the affected merchant with its exact missing fields.

## 3. Card payment incident, separate from the video

Parcel card payment uses `PublicDeliveryQuoteForm` → `/api/public/delivery-quotes/[id]/book` → canonical order → `/api/orders/[id]/payment` / `/api/payments/[publicReference]/checkout-session`. Marketplace card payment uses checkout address/quotes/review/reservation → `/api/checkout/[reference]/prepare-payment` → Paystack customer redirect → signed provider webhook/ledger confirmation. **No successful live card payment was conducted in this review.**

Source intentionally blocks the merchant checkout when `CHECKOUT_PUBLIC_ENABLED`, applicable provider mode/secret/origin, active store fulfilment policy, pickup certification, service/region coverage, exact totals or reservation are not approved. `assertNewMarketplacePaymentPolicyReady` explicitly refuses to take money when there is no effective ACTIVE `StoreOrderOperationalPolicy`. Historical production gate evidence reported that policy inactive; current live row state has **not** been independently rechecked.

**Required exact diagnostic evidence before asserting root cause:** HTTP/status and safe error code for the failed quote booking/payment request, source order/checkout/payment reference, provider mode (not secret), Paystack attempt state, matching verified webhook and immutable journal, current policy/region/pickup certification version, and same-host session. Use read-only redacted traces, with user consent and no real funds unless separately approved.

**External reference:** Paystack's current developer docs require backend-initialized payment, exact amount/currency verification, and signed webhook receipt; a browser redirect alone is not a payment settlement. See https://paystack.com/docs/payments/accept-payments/ and https://paystack.com/docs/payments/webhooks/.

## 4. Client decisions audit versus code

| Client answer (now authoritative unless law requires review) | Source assessment and work remaining |
| --- | --- |
| Prioritize Brief 3.13/3.14/3.4, parcel/card, store checkout, shared customer login/address | **Partial fix committed**: account-aware saved-address and navigation. Store address/coverage/live gates have extensive existing source enforcement; real merchants need data repair and acceptance. Full parcel/store card checkout NOT CERTIFIED. |
| R5 referral after first successful *completed paid order*, customer+store codes, one reward/person, no self-referral | Referral code/atomic signup attribution and read-only first-order verification exist. **Financial R5 journal posting, reversals and spend not implemented**; preserve payout lock. |
| R50 off first marketplace purchase, 7 days, once; adjustable amount/days/minimum | `firstStoreWelcomeDiscount` and configuration default policy exist; **full enforced checkout redemption is not proven**. Do not advertise as live until source-and-ledger bound acceptance exists. |
| 1 point per R1 externally paid excluding VAT/wallet; 100 points = R2; admin adjustable | Policy defaults and reward ledger/admin settings foundations exist; test complete both order types, partial wallet mix, refunds and same-user account. |
| Wallet used on purchases/deliveries only; no customer bank withdrawals; refund to wallet, admin bank case-by-case | Customer wallet and admin grant foundation exists; full wallet spending allocation still incomplete. Confirm legal refund instrument and merchant/acquirer obligations before automatically forcing cash-paid consumer refunds to wallet. |
| Parcel & marketplace VAT separate editable switches, both OFF; new-order-only | Source has separate settings/commerce snapshot work; exact current production values, admin editing, checkout and invoice evidence need verified acceptance. No retroactive tax rewrite. |
| Johannesburg/Pretoria; configurable high-risk localities with notes, no cash | Source high-risk list and admin rules exist. Confirm the client's complete named inventory and independent geographic alias rules. Production high-risk classification and quote checkout snapshot still require acceptance. |
| Multiple notification emails, owner-selectable all key event types | Configurable notification infrastructure exists, templates/event routing remain draft/approval-gated. The client supplied **placeholders** “add business email” and “add owner email”, not real addresses. Do not guess or publish to invented recipients. |
| Driver bank cash deposits with proof; independent admin confirmation; daily settlement; per-driver limit e.g. R1000 | Existing branch has admin cash-limit/editing, finance-reviewed deposit proof and reconciliation source; confirm actual account instructions, daily job, escrow/ledger and dispatch stop in disposable Postgres/driver acceptance. |

## 5. Staging and release plan, no production waiver

1. Complete and source-test same account, address prefill, pickup certification, and route diagnostics (in progress).
2. With approved separate staging account/data: run exact source on staging and check real mapped Johannesburg/Pretoria vendor pickup against configured effective service/coverage. Audit all existing merchant records and report per-store missing facts; invite owners to correct authentic data, or keep stores hidden.
3. Test source-bounded guest and logged-in checkout with card in **Paystack test mode** for parcel and marketplace: first order, retry, abandoned attempt, spoof/partial webhook, refund, split wallet and high-risk noncash. Capture 9-case provider browser acceptance against committed SHA; no double journal or false success.
4. Run complete customer/store/admin/driver journeys, notifications, inventory and geographic high-risk. Only actual approved region/service/driver/fulfilment policy may activate.
5. Complete remaining commercial, legal, financial and data recovery gates, then approve an exact commit release and separately deploy/promote Vercel/Railway; migrations cannot be undone by a website rollback.

## 6. Scope and deadlines

An updated **copy** of the original Developer Brief contains indicative estimates/targets in Section 11 and this latest decision summary. The provided inputs contain **no accepted Rand rate or fixed project fee**, so cost remains `To be agreed`; no fake estimate is recorded. The original nine source attachments are preserved. The client's answers supersede older open questions, but do not certify features as complete.

**Decision remains NO-GO for production:** do not merge, push migrations to the live database, activate transfers or claim every Live store is sellable before the named gates have passed.
