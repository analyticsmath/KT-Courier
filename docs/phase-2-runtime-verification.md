# Phase 2.1 Runtime Verification Checklist

## Pre-requisites

- [ ] DATABASE_URL is set and PostgreSQL is running
- [ ] `npx prisma migrate dev` has been run (migration: `phase_2_1_route_foundation`)
- [ ] `npx prisma generate` has been run
- [ ] Dev server is running: `npm run dev`

## Google Maps (Optional for most tests)

- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` set for autocomplete tests
- [ ] `GOOGLE_MAPS_SERVER_KEY` set for route calculation tests
- [ ] APIs enabled in Google Cloud Console: Maps JS API, Places API, Routes API

---

## Address Autocomplete

### With Google Maps key configured
1. Navigate to `/account/request-delivery`
2. On Step 2 (Pickup), start typing an address — e.g. "15 Long Street, Cape Town"
3. Verify: autocomplete suggestions appear in dropdown
4. Select a suggestion
5. Verify: "Address confirmed" indicator appears below input
6. Proceed to Step 3 (Dropoff) and repeat
7. Navigate to Step 5 (Review)
8. Verify: route estimate appears (if `GOOGLE_MAPS_SERVER_KEY` is set)

### Without Google Maps key (manual fallback)
1. Remove `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` from .env
2. Navigate to `/account/request-delivery`
3. Verify: manual address fields shown (line1, city, province, postal code)
4. Verify: development warning note visible (non-scary, informational)
5. Complete form with manual addresses
6. Verify: order submits successfully

---

## Route Calculation

### With `GOOGLE_MAPS_SERVER_KEY` configured
1. Submit a delivery request with two addresses that have coordinates
2. Retrieve the order from `/api/orders/[id]` or admin detail page
3. Verify: `distanceMeters` is populated
4. Verify: `durationSeconds` is populated
5. Verify: `routeSummary` shows e.g. "32.5 km · ~45 min"
6. Verify: `routeProvider` is "google_routes"

### Without `GOOGLE_MAPS_SERVER_KEY`
1. Submit order with coordinates
2. Verify: order creates successfully (no crash)
3. Verify: `distanceMeters` is null on the order
4. Admin order detail: "Route estimate unavailable" message shown

---

## Admin Delivery Regions

1. Navigate to `/admin/regions`
2. Click "+ Add region"
3. Create a test region: Cape Town Metro, slug: `cape-town-metro`, active: true
4. Set center coordinates: lat -33.9249, lng 18.4241, radius 25 km
5. Click "Create region"
6. Verify: region appears in list with Active badge
7. Click "Deactivate" — verify badge changes to Inactive
8. Click "Activate" — verify badge returns to Active
9. Click "Edit" — update description, click "Save changes"
10. Navigate to `/coverage-areas` — verify region appears in "Active service areas"

---

## Order Detail Pages

1. Submit a delivery order (any method)
2. Navigate to admin order detail: `/admin/orders/[id]`
3. Verify: Pickup and Dropoff show AddressSummaryCard (not old AddressBlock)
4. Verify: Route information section shows RoutePreviewCard
5. Navigate to customer order detail: `/account/orders/[id]`
6. Verify: addresses shown with new components
7. Navigate to store order detail: `/store/orders/[id]`
8. Verify: "Status updates" header (not "Status history")

---

## Coverage Page

1. Navigate to `/coverage-areas`
2. If active regions exist in DB: verify they appear in "Active service areas" grid
3. If no regions: verify page shows informational text only (no crash)

---

## Existing Feature Regression Check

- [ ] Login/signup still works
- [ ] OTP flow still works
- [ ] Password reset still works
- [ ] Contact form still works
- [ ] Admin order status update still works
- [ ] Admin pricing rules CRUD still works
- [ ] Email logs viewer still works
- [ ] Customer order list still works

---

## Runtime Testing Blockers

If DATABASE_URL is not configured:
- All DB-dependent pages show empty states or errors
- Prisma migrate cannot be run
- Order creation will fail (DB required)
- Address autocomplete UI will still work (client-only)

---

# Phase 2.3 Runtime Verification Addendum

## Migration

- Migration name: `20260611000000_phase_2_3_address_book`
- Run `npx prisma generate` after the schema change.
- If the existing database was previously managed with `db push` and has no migration baseline, review the incremental migration before running `npx prisma migrate deploy`.

## Customer Address Book

1. Log in as a customer.
2. Navigate to `/account/addresses`.
3. Add a pickup address with Google Places if keys are configured.
4. Verify the address card shows `Location captured`.
5. Add a manual dropoff address with Maps disabled or unavailable.
6. Edit the label and set it as default.
7. Delete a saved address.
8. Confirm another customer cannot access the address through `/api/account/addresses/[id]`.

## Request Delivery With Saved Addresses

1. Navigate to `/account/request-delivery`.
2. On pickup or dropoff steps, choose a saved address.
3. Verify contact fields and notes prefill when saved.
4. Submit the order.
5. Verify the order has separate pickup/dropoff snapshot rows and does not reference the saved address directly.

## Store Pickup Address

1. Log in as a store user.
2. Navigate to `/store/profile`.
3. Save a default pickup address.
4. Verify `/store/new-delivery` prefills pickup details.
5. Override pickup details in the new order form.
6. Submit the order.
7. Verify the store default pickup address remains unchanged.

## Repeat Delivery

1. Open an existing customer order and click `Create similar`.
2. Verify `/account/request-delivery?repeatFrom=...` loads copied pickup/dropoff/parcel basics.
3. Submit after review and verify a new order number is created.
4. Repeat as a store user from `/store/orders/[id]`.
5. Verify a customer cannot repeat another customer's order and a store cannot repeat another store's order.
6. Verify route data is recalculated or left null by the existing server route calculation logic.

## Dashboard Intelligence

1. Customer dashboard: verify latest active order, saved address count, and recent orders come from real DB records.
2. Store dashboard: verify operational counts match store orders and active orders are grouped by status.
3. Admin dashboard: verify route coverage, missing route count, failed orders, and active delivery regions are real counts.
4. Admin order list: search by order number, customer email/name, store name, pickup city, and dropoff city.
5. Coverage page: verify active region names, city/province, radius/max distance, and base fee display only when configured.

---

# Phase 2.4 Driver Operations Foundation Verification

## Pre-requisites
- [ ] PostgreSQL is running at localhost:5433
- [ ] Database is updated with migration `20260611000001_phase_2_4_driver_foundation`
- [ ] Seeding is executed to create test drivers

## Admin Driver Management Portal

1. Log in as an Administrator (`admin@ktcouriers.local` / `ChangeMe123!`).
2. Navigate to `/admin/drivers`.
3. Verify: The list shows seeded drivers (`Sipho CapeTown`, `Jabu JoBurg`, `Thabo Pending`).
4. Search: Type `Sipho` and click Search. Verify only Sipho's card/row remains.
5. Filters: Select Status = `Active` and verify. Select Availability = `Offline` and verify.
6. Create/Link: Click "Link Driver Profile". Select a user from the dropdown, fill out displayName/phone/vehicle details, and click "Create Profile". Verify it creates successfully.
7. Manage Detail: Click "Manage" on `Thabo Pending`.
   - Update vehicle make, model, registration, and license details. Save and verify.
   - Click "Approve & Active". Verify status changes to ACTIVE and onboarding status changes to APPROVED. Check the audit trail log at the bottom to verify the logging entry is added.
   - Update Service Regions: Check `Cape Town Metro` and `Johannesburg Metro`, select `Cape Town Metro` as primary region, and click "Update Regions Mappings". Verify it updates cleanly.
   - Try to Reject/Suspend a driver. Click "Suspend Driver" without entering a reason. Verify validation blocks the transition. Enter a reason "License expired" and click suspend. Verify status transitions to SUSPENDED.
   - Notes: Add service notes and internal admin notes. Click "Save Notes". Verify success.

## Driver Self-Service Portal

1. Log in as Driver 1 (`driver1@ktcouriers.local` / `ChangeMe123!`).
2. Verify: Redirection goes to `/driver` dashboard.
3. Dashboard:
   - Check the profile card shows code `DRV-1001`, status ACTIVE, and onboarding status APPROVED.
   - Check the assigned vehicle card shows `Motorbike` and `CA 123-456`.
   - Check the Assigned Deliveries card shows the Phase 2.4 placeholder warning: "Assignments will appear here once dispatch is enabled."
4. Profile Page:
   - Navigate to `/driver/profile`.
   - Update emergency contact name to `Aletta CapeTown` and phone to `+27 82 111 2222`. Click "Save Changes". Verify success.
   - Check that vehicle registration and license details are read-only.
5. Availability Page:
   - Navigate to `/driver/availability`.
   - Toggle to `Unavailable`. Verify the badge changes to Unavailable and success message appears.
   - Toggle to `Offline`. Verify the badge changes.
   - Toggle to `Available`. Verify the badge changes to Available.

## Privacy & Security

1. Log in as a Customer or Store user.
2. Attempt to access `/driver`, `/driver/profile`, or `/driver/availability`. Verify: System redirects you to the login/landing page.
3. Call driver APIs (e.g. `GET /api/driver/profile`) as a customer/store. Verify: A `403 Forbidden` response is returned.
4. Call admin driver APIs (e.g. `GET /api/admin/drivers`) as a driver. Verify: A `403 Forbidden` response is returned.

---

# Phase 2.5 Runtime Verification Addendum

## Pre-requisites
- [ ] Migration `20260611000002_phase_2_5_dispatch` applied
- [ ] Seed data includes test drivers and orders from Phase 2.4/2.5

## Dispatch Workflow

1. Log in as Admin.
2. Navigate to `/admin/orders/[id]` for an order in CONFIRMED status.
3. Verify the Driver Assignment panel shows eligible drivers.
4. Assign a driver — verify assignment appears with PENDING_ACCEPTANCE status.
5. Log in as the assigned driver.
6. Navigate to `/driver/assignments`. Verify the pending assignment appears.
7. Accept the assignment — verify status changes to ACCEPTED.
8. Log in as Admin and verify the assignment panel reflects ACCEPTED.
9. Attempt to dispatch to a second driver while first is ACCEPTED — verify it is blocked.
10. Reject assignment as driver — verify order returns to CONFIRMED for re-dispatch.

## Dispatch Security

1. As a customer, call `POST /api/admin/orders/[id]/assign` — verify 403.
2. As a driver, try to accept another driver's assignment — verify 403 or 404.
3. Verify rate limiting: rapid accept/reject calls return 429 after threshold.

---

# Phase 2.6 Runtime Verification Addendum

## Pre-requisites

- [ ] Migration `20260611000003_phase_2_6_pickup_custody` applied
- [ ] `npx prisma generate` run after schema update
- [ ] Seed includes Phase 2.6 demo assignment: DRV-1001 → KT-DEV-002 (status: ACCEPTED, order: PICKUP_SCHEDULED)
- [ ] Dev server running

## Driver Workbench

1. Log in as driver1@ktcouriers.local (DRV-1001).
2. Navigate to `/driver` — verify the "Driver Workbench" quick-access block appears (requires approved/active driver).
3. Click "Open Workbench →" — verify redirect to `/driver/workbench`.
4. Verify: Summary stats row shows accepted count, pickup-ready count, in-progress count (real numbers from DB).
5. Verify: Availability status bar shows driver's current availability.
6. Verify: KT-DEV-002 appears as a workbench card showing:
   - Order number and PICKUP_SCHEDULED badge
   - Pickup city → Dropoff city
   - Distance/duration if calculated
   - Pickup address and contact
   - Parcel count and description
   - "Go to Pickup Actions →" link

## Start Pickup

1. From the workbench card for KT-DEV-002, click "Go to Pickup Actions →" to reach `/driver/assignments/[id]`.
2. Verify: "Pickup Actions" section is visible (assignment ACCEPTED + order in pickup-eligible status).
3. Click "Start Pickup".
4. Optionally add a driver note.
5. Submit.
6. Verify:
   - Success message appears
   - Order status badge updates to PICKUP_SCHEDULED (if it was CONFIRMED) or stays PICKUP_SCHEDULED
   - Pickup Activity section shows PICKUP_STARTED event with timestamp
   - In-progress indicator appears on workbench card

## Complete Pickup

1. From the same assignment detail page (after starting pickup).
2. Click "Confirm Pickup".
3. Fill in: parcel count (e.g. 1), parcel condition (Good), optional customer note.
4. Check the confirmation checkbox: "I confirm the parcel has been collected."
5. Submit.
6. Verify:
   - Order status updates to PICKED_UP
   - Pickup Activity shows PICKUP_COMPLETED event
   - Customer/store receives status email (check logs or email test inbox)
   - "Confirm Pickup" action disappears (order no longer pickup-eligible)
   - Assignment remains ACCEPTED (NOT COMPLETED — that is Phase 2.7)

## Pickup Failed

1. Use a fresh ACCEPTED assignment (re-seed or create a new one).
2. Start pickup, then attempt to record failure.
3. Select a failure reason (e.g., "Parcel not ready").
4. Enter an explanatory note (required).
5. Submit.
6. Verify:
   - Order stays in PICKUP_SCHEDULED (not changed to FAILED or any other status)
   - PICKUP_FAILED event appears in Pickup Activity
   - Exception is visible at `/admin/pickup-exceptions`

## Admin Pickup Exceptions

1. Log in as Admin.
2. Navigate to `/admin/pickup-exceptions`.
3. Verify: exceptions list shows any PICKUP_FAILED events recorded by drivers.
4. Verify each card shows: order number, driver code, failure reason, driver note, region, timestamp.
5. Click "Review Order" — verify redirect to admin order detail for the correct order.
6. Verify: No exceptions shows empty state (not a crash).

## Admin Order Operational Events

1. Navigate to `/admin/orders/[id]` for an order with pickup events.
2. Verify: "Pickup & Operational Events" section appears above the status timeline.
3. Verify each event shows: event label, actor role, driver code, timestamp.
4. For PICKUP_FAILED events: verify failure reason label is shown in red.
5. For PICKUP_COMPLETED events: verify parcel condition and count are shown.
6. Verify: internal notes (internalNote) are shown in amber highlight boxes.
7. Verify: location captured indicator appears when lat/lng were recorded.

## Admin Operational Note

1. POST to `/api/admin/orders/[id]/operational-note` with:
   ```json
   { "internalNote": "Called customer — confirmed parcel re-ready for collection.", "publicNote": "Pickup rescheduled." }
   ```
2. Verify: ADMIN_OPERATION_NOTE_ADDED event appears in operational events timeline on admin order detail.
3. Verify: AdminActivityLog has an entry for this note action.

## Privacy Boundary Checks

### Customer/Store cannot see driver PII or internal notes

1. Log in as a customer and navigate to `/account/orders/[id]` for an order with pickup events.
2. Verify: Only public-facing status labels appear (e.g., "Your parcel has been collected.").
3. Verify: No driver code, driver name, internal notes, or failure reason details are visible.
4. Call `GET /api/account/orders/[id]` directly — verify response has no internalNote, driverCode, or failureReason fields.

### Driver cannot see admin internal notes

1. Log in as a driver and call `GET /api/driver/workbench` — verify response includes own operational events without internalNote.
2. Verify driver assignment detail page shows only own public notes and failure reasons, not admin internal notes.

### Driver cannot act on another driver's assignment

1. As driver2 (DRV-1002), attempt `POST /api/driver/assignments/[DRV-1001-assignment-id]/pickup/start`.
2. Verify: 403 or 404 response is returned.

## Rate Limiting

1. Rapidly call `POST /api/driver/assignments/[id]/pickup/start` more than 10 times in 10 minutes.
2. Verify: 429 Too Many Requests response after threshold.
3. Repeat for `/pickup/complete` (max 10/10min) and `/pickup/fail` (max 15/10min).

## System Integrity Checks

- [ ] Order status transitions only happen through `transitionOrderStatus()` — no direct DB status writes bypass status history
- [ ] Every pickup mutation creates both `OrderOperationalEvent` AND `OrderAssignmentEvent`
- [ ] Assignment status remains ACCEPTED after all Phase 2.6 actions (no premature COMPLETED)
- [ ] Driver availability is ON_DELIVERY after pickup start/complete
- [ ] Driver availability resets to AVAILABLE after pickup fail only if no other active accepted assignments
- [ ] Suspended or inactive drivers receive 403 on any pickup mutation attempt

## Known Limitations / Phase 2.7 Carry-Forward

- Assignment does NOT complete on pickup — remains ACCEPTED until delivery (Phase 2.7)
- No delivery proof, OTP, or recipient signature in Phase 2.6
- No live GPS tracking or route map
- DELIVERY_STARTED / DELIVERY_COMPLETED / DELIVERY_FAILED events are Phase 2.7
- Driver availability only resets to AVAILABLE after delivery (Phase 2.7), not after pickup complete


---

## Phase 2.7 — Delivery Execution, OTP, and Proof of Delivery

### Build Verification

- [x] `prisma format` — passes (schema formatted)
- [x] `prisma generate` — Prisma Client generated (v5.22.0), ProofOfDelivery and DeliveryOtp models included
- [x] `eslint` — 0 errors, 0 warnings (--max-warnings 0)
- [x] `tsc --noEmit` — 0 errors
- [x] `next build` — 88 pages compiled successfully

### Schema Changes Verified

- [x] `ProofOfDelivery` model added with `orderId @unique`, `assignmentId @unique`
- [x] `DeliveryOtp` model added with `codeHash` (never plaintext), `expiresAt`, `attempts`, `maxAttempts`
- [x] `OrderOperationalEventType` extended: DELIVERY_STARTED, DELIVERY_OTP_GENERATED, DELIVERY_OTP_VERIFIED, DELIVERY_COMPLETED, DELIVERY_ATTEMPTED, DELIVERY_FAILED, POD_CREATED, ADMIN_DELIVERY_OVERRIDE
- [x] `OrderAssignmentEventType` extended: DELIVERY_STARTED, DELIVERY_OTP_SENT, DELIVERY_OTP_VERIFIED, DELIVERY_COMPLETED, DELIVERY_ATTEMPTED, DELIVERY_FAILED
- [x] `EmailTemplateType` extended: DELIVERY_OTP
- [x] `deliveryExceptionReason DeliveryExceptionReason?` field on `OrderOperationalEvent`
- [x] Migration file: `20260611000004_phase_2_7_delivery_pod/migration.sql`

### OTP Security Requirements

- [x] OTP code is NEVER stored in plaintext — only SHA-256 hash stored in `codeHash`
- [x] OTP code is NEVER logged
- [x] OTP code is NEVER returned to the client (API returns `sent: true`, not the code)
- [x] OTP expiry: 30 minutes (`DELIVERY_OTP_EXPIRY_MINUTES = 30`)
- [x] Max attempts: 5 before lockout (`DELIVERY_OTP_MAX_ATTEMPTS = 5`)
- [x] Attempts incremented BEFORE comparing hash (oracle-attack prevention)
- [x] Email failure invalidates OTP immediately (no dangling codes)
- [x] `getDevOtpForOrder()` returns null in production (NODE_ENV guard)

### Privacy Boundary Verification

- [x] `AdminPodDto` exposes: internalNote, driverCode, all fields
- [x] `PublicPodDto` exposes: methodLabel, recipientName, deliveredAt, publicNote ONLY (no internalNote, no driver PII)
- [x] `CUSTOMER_OPERATIONAL_EVENT_LABELS` used for customer-facing delivery events
- [x] Customer/store order detail page shows `PublicPodDto` (no internalNote, no driver code)
- [x] Admin order detail page shows `AdminPodDto` (full detail including internalNote)

### Driver Access Controls

- [x] `assertDeliveryEligibility` enforces: driver status ACTIVE, own assignment only, ACCEPTED status, order in PICKED_UP/IN_TRANSIT
- [x] Suspended/inactive drivers receive 403 on all delivery mutation endpoints
- [x] Driver cannot act on another driver's assignment (checked by `driverProfileId` filter on query)

### Delivery Workflow Verification (Manual Runtime Checklist)

1. Start Delivery:
   - PICKED_UP order → Start Delivery → order moves to IN_TRANSIT
   - POST `/api/driver/assignments/:id/delivery/start` returns updated assignment
   - `DELIVERY_STARTED` operational event created with `publicNote = "Your delivery is on its way."`
   - Driver availability set to `ON_DELIVERY`

2. Send OTP:
   - POST `/api/driver/assignments/:id/delivery/otp` triggers email to recipient
   - Response: `{ sent: true, sentToEmail, expiresAt }` (no OTP code in response)
   - GET `/api/driver/assignments/:id/delivery/otp` returns safe status (`hasActiveOtp`, `attemptsUsed`, etc. — no hash)
   - Multiple sends invalidate previous OTP

3. Complete Delivery (OTP verify):
   - POST `/api/driver/assignments/:id/delivery/complete` with `{ otpCode, recipientName, confirmDelivery: true }`
   - OTP verified before any DB writes
   - Wrong code increments attempts (oracle-prevention)
   - Correct code: creates ProofOfDelivery, order → DELIVERED, assignment → COMPLETED
   - Driver availability → AVAILABLE (if no other active assignments)
   - Status email sent non-blocking

4. Delivery Attempted:
   - POST `/api/driver/assignments/:id/delivery/attempt` with reason + driverNote
   - Order → DELIVERY_ATTEMPTED (or stays if already DELIVERY_ATTEMPTED)
   - Assignment stays ACCEPTED
   - `DELIVERY_ATTEMPTED` event created with `deliveryExceptionReason`

5. Delivery Failed:
   - POST `/api/driver/assignments/:id/delivery/fail` with reason + note
   - Order → FAILED
   - Assignment stays ACCEPTED (admin resolves)
   - `DELIVERY_FAILED` event created with `deliveryExceptionReason`

### Admin Actions Verification

- [x] GET `/api/admin/orders/:id/proof-of-delivery` returns full `AdminPodDto` (requires ADMIN/SUPER_ADMIN)
- [x] POST `/api/admin/orders/:id/proof-of-delivery` creates manual override POD (`ADMIN_MANUAL` method)
- [x] Admin manual override always records `AdminActivityLog` via `recordAdminActivity`
- [x] GET `/api/admin/delivery-exceptions` returns paginated list with filter by eventType
- [x] Admin order detail page shows POD panel + delivery exception reason in operational events
- [x] `/admin/delivery-exceptions` page with ATTEMPTED/FAILED filter tabs

### Driver UI Verification

- [x] `/driver/delivery` page — server-rendered delivery workbench with summary counts and assignment cards
- [x] `/driver/assignments/:id` — delivery actions section added (start, OTP send, OTP verify/complete, attempted, failed)
- [x] Delivery forms: OTP input (6-digit, numeric keyboard), recipient name required, confirm checkbox

### Customer/Store UI Verification

- [x] `/account/orders/:id` — POD card shown when order is DELIVERED (public fields only)
- [x] `/store/orders/:id` — POD card shown when order is DELIVERED (public fields only)
- [x] Status timeline shows DELIVERED entry (from statusHistory)

### Rate Limiting Verification

1. POST `/api/driver/assignments/:id/delivery/start` → limited to 10 per 10 min per IP
2. POST `/api/driver/assignments/:id/delivery/otp` → limited to 5 per 15 min per IP (resend guard)
3. POST `/api/driver/assignments/:id/delivery/complete` → limited to 10 per 10 min per IP
4. POST `/api/driver/assignments/:id/delivery/attempt` → limited to 15 per 10 min per IP
5. POST `/api/driver/assignments/:id/delivery/fail` → limited to 10 per 10 min per IP
6. POST `/api/admin/orders/:id/proof-of-delivery` → limited to 10 per 10 min per IP

### Seed Data

- `KT-DEV-007` order seeded in PICKED_UP status with driver DRV-1001 ACCEPTED assignment
- Run `npx prisma db seed` to create/reset seed data
- Use `getDevOtpForOrder(orderId)` (development only) to retrieve OTP for testing

### Known Limitations / Phase 2.8+ Carry-Forward

- Photo upload not implemented (ProofOfDeliveryMethod.PHOTO_FUTURE is a placeholder)
- Signature capture not implemented (ProofOfDeliveryMethod.SIGNATURE_FUTURE is a placeholder)
- No live GPS tracking or real-time route map
- No driver earnings or payment processing
- Multi-instance OTP resend rate limiting requires Redis (current implementation is in-memory, single-instance only)
- Assignment remains ACCEPTED after hard failure — admin must manually reassign or close
