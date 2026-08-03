# Phase 2.5 — Dispatch and Assignment Workflow

## Overview

Phase 2.5 connects real orders to real drivers via a formal assignment domain.
Admin can assign, reassign, and cancel assignments. Drivers can accept or reject assignments.
All actions are audited via assignment events and admin activity logs.

## What was implemented

- `OrderAssignment` model — single active assignment per order enforced in service layer
- `OrderAssignmentEvent` model — full audit trail of every status change
- Assignment lifecycle: ASSIGNED → ACCEPTED/REJECTED/CANCELLED
- Admin dispatch board at `/admin/dispatch`
- Admin dispatch APIs: assign, reassign, unassign
- Driver assignment APIs: list, detail, accept, reject
- Admin order detail: assignment panel with active assignment + history
- Admin orders list: assignment column + unassigned/assigned filter
- Driver dashboard: real active assignments (no fake data)
- Driver assignment pages: `/driver/assignments` and `/driver/assignments/[id]`
- Navigation updated: Dispatch in admin nav, Assignments in driver nav
- Driver eligibility service: deterministic, region-aware, no AI scoring

## Assignment statuses

| Status    | Meaning                                       |
|-----------|-----------------------------------------------|
| ASSIGNED  | Admin has dispatched order to driver          |
| ACCEPTED  | Driver has accepted the assignment            |
| REJECTED  | Driver has rejected; must be reassigned       |
| CANCELLED | Admin cancelled; driver freed                 |
| COMPLETED | Set by Phase 2.6+ when delivery concludes     |

## Assignable order statuses

Only `CONFIRMED` and `PICKUP_SCHEDULED` orders can be assigned in Phase 2.5.

## Driver eligibility rules

Required:
- DriverStatus = ACTIVE
- DriverAvailability = AVAILABLE (UNAVAILABLE/OFFLINE allowed with admin override)
- Not suspended, not rejected

Preferred:
- Service region matches order delivery region → RECOMMENDED
- Available, no active assignments → RECOMMENDED
- Available, has active assignments → AVAILABLE
- Region mismatch → REGION_MISMATCH
- Unavailable/Offline → UNAVAILABLE
- ON_DELIVERY → BUSY (cannot be assigned in Phase 2.5)

## Assignment lifecycle rules

- Only ONE active (ASSIGNED or ACCEPTED) assignment per order at any time
- Enforced in `assignments.service.ts` via `findActiveAssignment` guard
- Reassignment cancels the current assignment, creates a new one with `reassignedFromId` linkage
- Admin cancellation requires a reason
- Driver rejection requires a reason
- No order status side effects on assignment in Phase 2.5 (no auto-PICKUP_SCHEDULED on assign)

## Privacy and security boundaries

**Admin sees:** driver phone, vehicle registration, service regions, internal notes, assignment events
**Driver sees:** order pickup/dropoff addresses, route estimate, assignment status, own events
**Customer/store sees:** assignment status label only ("Driver assigned", "Driver preparing for pickup")
**Customer/store NEVER sees:** driver phone, registration, emergency contact, admin notes, events

## API endpoints

### Admin

| Method | Endpoint                              | Description                |
|--------|---------------------------------------|----------------------------|
| GET    | /api/admin/dispatch                   | Dispatch board data        |
| POST   | /api/admin/orders/[id]/assign         | Assign driver to order     |
| POST   | /api/admin/orders/[id]/reassign       | Reassign to different driver |
| POST   | /api/admin/orders/[id]/unassign       | Cancel active assignment   |
| GET    | /api/admin/assignments/[id]           | Assignment detail          |

### Driver

| Method | Endpoint                                  | Description                |
|--------|-------------------------------------------|----------------------------|
| GET    | /api/driver/assignments                   | List own assignments       |
| GET    | /api/driver/assignments/[id]              | Own assignment detail      |
| POST   | /api/driver/assignments/[id]/accept       | Accept ASSIGNED assignment |
| POST   | /api/driver/assignments/[id]/reject       | Reject ASSIGNED assignment |

## Security

All mutation routes enforce:
- Auth guard (session required)
- Role guard (ADMIN/SUPER_ADMIN for admin routes; DRIVER for driver routes)
- Ownership validation (driver can only operate on own assignments)
- Origin check (CSRF protection)
- Rate limiting (DISPATCH_ASSIGN: 30/10min, DISPATCH_REASSIGN: 20/10min, etc.)
- Zod validation on all inputs
- Safe error responses (no raw Prisma errors, no secret leakage)

## Audit logging

Every dispatch action creates:
1. `OrderAssignmentEvent` — immutable record on the assignment
2. `AdminActivityLog` — admin audit trail with actor, action, orderId, assignmentId, driverProfileId

## Phase 2.6 handoff

Phase 2.6 (Pickup Custody) will:
- Add `PICKED_UP` evidence when driver physically collects parcel
- Set driver availability to `ON_DELIVERY` on pickup
- Add OTP or photo proof-of-collection
- Transition assignment to `COMPLETED` when order reaches `DELIVERED`

The `completedAt` field on `OrderAssignment` is reserved for Phase 2.6.
The `ASSIGNMENT_COMPLETED` event type is defined but not triggered in Phase 2.5.

## What was NOT implemented (by design)

- Pickup proof or delivery proof
- OTP delivery confirmation
- Parcel custody chain
- Live tracking or route optimization
- Driver earnings or payouts
- PayFast or payment flows
- SMS notifications (email notifications are non-blocking future work)

## Migration

Migration file: `20260611000002_phase_2_5_dispatch_assignment`
Creates: `OrderAssignment`, `OrderAssignmentEvent` tables + enums.
Safe to apply against Phase 2.4 baseline.

## Known limitations and carry-forward

- No automated test runner — lifecycle helpers are pure and testable when runner is configured
- Production/staging migration safety must be verified before deploy
- Rate limiting is in-memory (single instance) — Redis/Upstash needed for multi-instance deploys
- Driver accept/reject does not change driver availability to ON_DELIVERY (Phase 2.6 responsibility)
- Email notification on assignment is documented as future (non-blocking)
