# KT Couriers — Production Delivery Readiness Audit

**Audit date:** 22 October 2026 (UTC). **Repository branch:** `main` only. **Scope:** public quotation, parcel operations, dispatch, driver workflow, payments and administration.

## Authority and precedence

The customer's eight current DOCX documents are the requirements baseline. Where requirements conflict, **KT COURIERS — Delivery and Access.docx** and **KT COURIERS — WEBSITE & SYSTEM CHANGES.docx** take precedence. Preserve all other consistent requirements from About Us, Updated Details, Shipping & Delivery, Privacy, Refund & Cancellation, and Terms & Conditions. Distinguish product specifications from verified operational evidence.

Specific resolved precedence:
- **Standard** is R129/R179/R249 (Small/Medium/Large) and **1–2 business days**, per the explicit final statement in Delivery and Access, despite nearby inconsistent 2–3-day wording.
- **Scheduled** means a future pickup/delivery date/window, not a third delivery speed or a standalone tariff.
- **Economy** is R89/R129/R179 and 3–4 business days.
- **Express** has a stated R5.50/km reference, but the parcel-size adjustment is not unambiguously finalized. Keep the existing Express draft **inactive** until the exact calculation is approved, including all sizes, minimums, surcharges, and settlement impact.
- The business operates online and has no public walk-in office. Do not present an email address as a physical street address.
- South Africa-wide store discoverability is separate from currently supported delivery routes. Initial active delivery coverage is Gauteng; expansion must be admin-configurable.

## Verified deployment and data sources

| Surface | Observation and evidence |
| --- | --- |
| GitHub | `analyticsmath/KT-Courier`, default branch `main`; latest reviewed SHA `d9ae8eae6d84cd9cbc92f5e64372356d1136333f` (before this audit commit) |
| Vercel | Project `kt-courier`; latest reviewed production deployment `dpl_6DXiDM9tDgyWY1HPBbDpqvbWx9Uq` marked `READY`; same reviewed SHA |
| Edge routing | `lib/deployment/edge-routing.ts` pins production Vercel edge to `https://kt-couriers-preproduction-web.onrender.com`; verify this named origin is actually the intended secure production runtime |
| Neon | Project `KT Couriers Production - Frankfurt`, branch `production-render`, database `kt_couriers`; 86 applied Prisma migrations observed |
| Runtime health | `GET https://www.ktcouriers.com/api/health` returned `200` and status `ok` |
| Runtime readiness | `GET https://www.ktcouriers.com/api/ready` returned `200`; database reachable; Redis configured, connected, healthy |
| Public quote APIs | `GET /api/public/parcel-profiles` and `GET /api/public/delivery-quotes` returned correct nonempty active catalogs after configuration activation |

**Limit:** A ready deployment, database and Redis do not establish end-to-end quotation, booking, payment, dispatch or delivery completion. Render workspace/environment configuration and payment-provider secret values have not been verified in this audit. Do not publish credentials in reports.

## Production configuration activation performed on 22 October 2026

The initial database state had 0 published delivery services, 0 regions, and three parcel profiles still in DRAFT. Consequently, both public GET catalog endpoints returned `[]`, and guest quote controls were disabled.

A single guarded, transactional, audited, insert-only production database activation:
- Activated Gauteng as an operational **PROVINCE** coverage region (`gauteng-province-wide`).
- Kept original Small, Medium and Large DRAFT records and inserted matching **ACTIVE version 2** records: Small 30×20×10 cm / 5 kg; Medium 50×40×30 cm / 15 kg; Large 70×50×50 cm / 30 kg.
- Inserted active Economy and Standard, with user-approved size tariffs and turnaround times.
- Inserted Express as **DRAFT**, not bookable.
- Recorded **seven** administrator activity log records. The transaction checked the single active superuser and the exact original profile dimensions/weights before writing.

Post-transaction counts: **3 active parcel profiles, 2 active service definitions, 1 Express draft, 1 active coverage region**.

Browser and direct HTTP rechecks then confirmed that `https://www.ktcouriers.com/quote` presents the two services and three parcel profiles and that the guest form's formerly disabled controls are enabled.

This activation did **not** create bookings, change payment balances, approve drivers, or write orders.

## Confirmed remaining critical blocker — server address resolution

One controlled guest quotation attempt, Economy/Small/1 kg from a Sandton street address to a Midrand street address, returned:

`POST /api/public/delivery-quotes → HTTP 422 {"code":"ADDRESS_UNRESOLVED","error":"Check both street addresses and try again."}`

The quote was **not issued**. `lib/client-platform/delivery.service.ts` calls `geocodeSouthAfricanAddress` for both submitted addresses. `lib/maps/geocode.service.ts` returns null when the server Google Maps configuration is absent, geocoding fails, or the provider rejects an address. `lib/maps/routes.service.ts` subsequently requires a working Google Routes API. The observed result alone does not distinguish missing credentials from invalid/incomplete addresses.

Next acceptance gate:
1. Confirm the correct server-side `GOOGLE_MAPS_SERVER_KEY`, provider API enablement (Geocoding and Routes), restrictions, billing and quotas **in the actual Render production environment**, without exposing the key.
2. Confirm any browser autocomplete key is appropriately configured/restricted; manual address fallback must remain accessible.
3. Reproduce one legitimate complete Gauteng street-to-street quote with verified coordinates and road distance; confirm base/size pricing, any allowed surcharges, VAT policy and final price in server-issued snapshot.
4. Test invalid/non-Gauteng address denial, wrong or missing parcel size/weight, expired quote, and repeatability.
5. Only then verify customer registration/authentication-to-booking and receipt/waybill flow.

Do not fabricate distances or remove geographic checks to make quotations appear to work.

## Driver readiness — hard launch gate

Read-only database counts:
- Driver profiles: **54** — all offline and inactive; **36 pending review and profile incomplete**, **16 inactive and profile incomplete**, **2 rejected and profile incomplete**.
- Registered vehicles: **0**.
- Driver identity/licence verification documents: **0**.
- Delivery orders and driver assignments: **0**.

The codebase already contains dispatch, driver operation, location, OTP and proof-of-delivery modules and tests. These have not been proven with verified real production drivers. **Do not auto-approve imported identities or fake vehicles/documents.**

Required acceptance path: properly onboard/verify eligible real drivers, validate vehicle and document status, test accepted dispatch offers, collection and custody, in-transit GPS permission and consent, recipient OTP issuance/expiry/verification, signature/photo POD as required, failed delivery with recorded reason and retry/redelivery, customer tracking and admin exception desk, and delivery financial settlement.

## Payment, COD and commissions — not yet certified

A read-only count found **one ACTIVE DIGITAL PaymentMethodPolicy**. There is **no verified live 50% online / 50% cash COD enablement**. Payment, COD and cash-deposit transactional tables have no operational records in the observed database.

Per the priority requirements:
- COD must be opt-in by approved store, service, province/region, order and value limit; default deny.
- Initial allowed COD split is 50% online / 50% collected by driver on delivery, adjustable via admin.
- Track total, initial paid, COD due, driver collected, driver deposited, outstanding amount and auditable reconciliations.
- Do not automatically release driver commissions, vendor commissions or settlements based on unverified payments.
- Driver/KT Couriers, store and promoter commission schedules remain configurable. Do not hard-code 70/30, 8–10% or KT50 values as universally approved production rules without the final finance approval.

Test gateway credentials and signed webhook validation, idempotency, refunds, disputes, reconciliation and negative authorization on an isolated payment test path before enabling live money movement.

## Remaining system review and acceptance matrix

| Area | Repository evidence | Operational conclusion |
| --- | --- | --- |
| Guest quote UI and public quote API | `app/(public)/quote/page.tsx`, `components/forms/PublicDeliveryQuoteForm.tsx`, `app/api/public/delivery-quotes/route.ts` | Catalog repaired and UI enabled; **price issuance blocked in observed address test** |
| Configurable services and sizes | `lib/client-platform/initial-delivery.ts`, `lib/client-platform/delivery.service.ts`, `lib/commercial/parcel-profiles.ts` | Approved Economy/Standard and sizes active; Express draft |
| Coverage and routing | `lib/maps/delivery-zone.service.ts`, `lib/maps/geocode.service.ts`, `lib/maps/routes.service.ts` | Gauteng region active; Google Geocoding/Routes not production certified |
| Booking, scheduled date and waybill | `components/forms/PublicDeliveryQuoteForm.tsx`, `app/api/public/delivery-quotes/[id]/book/route.ts` | Source exists; authenticated real booking and document generation not yet certified |
| Driver dispatch and proof | `lib/driver-operations/*`, `lib/dispatch/*`, driver/dispatch/admin routes | Substantial code present; **zero eligible operational drivers** |
| Tracking/GPS/chat | Tracking routes and driver/client modules | Source exists; live consent, location events and channel isolation require end-to-end proof |
| Admin pricing and commercial controls | `app/(admin)/admin/delivery-configuration`, parcel profiles, pricing, finance | Routes exist; admin UI edits/audit and service activation need authenticated acceptance |
| Marketplace/vendor | 28 store rows, 445 catalog offers, vendor dashboards | 14 active, 14 pending stores; checkout, campaigns, ratings and permissions not all certified |
| Payment/COD | Payment and cash tables and admin/driver modules | 50/50 COD, provider callbacks and real-money reconciliation **not certified** |
| Company, legal and consumer policies | Eight supplied owner docs | Compare deployed pages and receipt/email content; legal discrepancies should be reviewed before text updates |
| Homepage brand/animation | Existing public components | Priority requires delivery **panel van**, not long truck; requires visual QA |
| General runtime | health and ready endpoints | Database and Redis healthy; not a substitute for workflow E2E |

The older Terms and Conditions include a strict refund-reporting window that should be reconciled with the later Refund & Cancellation Policy and applicable South African law by the owner/legal reviewer. Do not silently remove statutory rights or invent legal conclusions.

## No-go / go-live release gates

**NO-GO** for a claim of fully operational parcel courier service until all are demonstrated in the actual deployment: real geocoded quote; server-priced booking; configured successful payment/receipt; verified driver acceptance; pickup and custody; location sharing as permitted; OTP/POD or recorded failure reason; notifications; support/admin reporting; cash/commission reconciliation; security and privacy checks. Validate negative authorization on all role boundaries.

Engineering verification commands prescribed by this repository include `npm ci`, `npx prisma generate`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and scoped E2E/integration tests. **These commands were not executed as part of this audit** because a network reset prevented a clean local checkout; do not report green checks without recorded test evidence.

**Scope discipline:** no new Git branch; no Railway reconnect; keep Vercel edge → intended Render runtime → intended Neon production database, and verify Cloudinary media mappings separately before declaring catalog completion. Preserve existing real customer/store data.
