# Phase 2.6 — Pickup Custody Workflow

## Overview

Phase 2.6 delivers the first real operational handover in the KT Couriers order lifecycle:
once an order is assigned and accepted, the driver can take formal custody of the parcel
through the pickup workflow.

---

## Domain Model: OrderOperationalEvent

### Purpose
A generalised event rail for order-level operational actions. Designed to support Phase 2.6
pickup events and Phase 2.7 delivery/POD events using the same foundation.

### Key Fields
| Field | Purpose |
|-------|---------|
| `orderId` | Order being operated on |
| `assignmentId` | Optional — link to the active assignment |
| `driverProfileId` | Optional — driver who performed the action |
| `actorUserId` | Required — who did it |
| `actorRole` | DRIVER, ADMIN |
| `eventType` | `OrderOperationalEventType` enum value |
| `statusBefore` / `statusAfter` | Order status snapshot before and after |
| `occurredAt` | When the physical event occurred |
| `publicNote` | Safe note shown to customer/store |
| `internalNote` | Admin/driver internal note — NEVER exposed to customer/store |
| `failureReason` | `PickupFailureReason` enum — set on PICKUP_FAILED |
| `parcelCondition` | `ParcelCondition` enum — set on PICKUP_COMPLETED |
| `parcelCount` | Confirmed parcel count on completion |
| `latitude` / `longitude` | Optional location capture |

---

## OrderOperationalEventType Enum

| Value | Meaning |
|-------|---------|
| `PICKUP_STARTED` | Driver has started heading to pickup location |
| `PICKUP_COMPLETED` | Driver has confirmed parcel collected |
| `PICKUP_FAILED` | Driver could not complete pickup |
| `PARCEL_CONDITION_RECORDED` | (Future) explicit condition record |
| `DRIVER_NOTE_ADDED` | Driver added a note |
| `ADMIN_OPERATION_NOTE_ADDED` | Admin added an operational note |

---

## PickupFailureReason Enum

| Value | Label |
|-------|-------|
| `PARCEL_NOT_READY` | Parcel not ready |
| `SENDER_UNAVAILABLE` | Sender unavailable |
| `PICKUP_ADDRESS_ISSUE` | Pickup address issue |
| `ACCESS_ISSUE` | Access issue |
| `ORDER_CANCELLED_AT_PICKUP` | Order cancelled at pickup |
| `SAFETY_ISSUE` | Safety issue |
| `OTHER` | Other |

---

## ParcelCondition Enum

| Value | Label |
|-------|-------|
| `NOT_RECORDED` | Not recorded |
| `GOOD` | Good condition |
| `DAMAGED_PACKAGING` | Damaged packaging |
| `FRAGILE` | Fragile |
| `INCOMPLETE` | Incomplete |
| `REQUIRES_ADMIN_REVIEW` | Requires admin review |

---

## Pickup Workflow Rules

### Eligibility

Driver can perform pickup actions only if:
1. Authenticated user has `DRIVER` role
2. Driver has an active `DriverProfile`
3. Driver status is `ACTIVE`
4. Driver owns the assignment (`driverProfileId` matches)
5. Assignment status is `ACCEPTED`
6. Order status is `CONFIRMED` or `PICKUP_SCHEDULED`
7. Order is not in a terminal or post-pickup status

### PICKUP_STARTED

- If order is `CONFIRMED` → transition to `PICKUP_SCHEDULED` (allowed by transition matrix)
- If order is `PICKUP_SCHEDULED` → no status change
- Creates `OrderOperationalEvent` (PICKUP_STARTED)
- Creates `OrderAssignmentEvent` (PICKUP_STARTED) — assignment remains ACCEPTED
- Sets driver availability to `ON_DELIVERY`
- Public note: "Pickup is in progress."

### PICKUP_COMPLETED

- Order must be `CONFIRMED` or `PICKUP_SCHEDULED`
- Transitions order to `PICKED_UP` via existing lifecycle service
- Creates `OrderStatusHistory` entry
- Creates `OrderOperationalEvent` (PICKUP_COMPLETED)
- Creates `OrderAssignmentEvent` (PICKUP_COMPLETED) — assignment remains ACCEPTED
- Driver availability stays `ON_DELIVERY`
- Sends non-blocking status email to customer/store

**Assignment is NOT marked COMPLETED on pickup completion.** Assignment completes only
after delivery in Phase 2.7.

### PICKUP_FAILED

- Order must be `CONFIRMED` or `PICKUP_SCHEDULED`
- Does NOT change order status — order stays in `PICKUP_SCHEDULED` for admin review
- Creates `OrderOperationalEvent` (PICKUP_FAILED) with failure reason and note
- Creates `OrderAssignmentEvent` (PICKUP_FAILED) — assignment remains ACCEPTED
- Driver availability: if no other active accepted assignments → set `AVAILABLE`; else stays `ON_DELIVERY`
- Does NOT create a `DELIVERY_ATTEMPTED` status — this is pickup, not delivery

---

## OrderAssignmentEventType Extension

Phase 2.6 adds three values to the existing `OrderAssignmentEventType` enum:
- `PICKUP_STARTED`
- `PICKUP_COMPLETED`  
- `PICKUP_FAILED`

These events record pickup activity against the assignment without changing assignment status.

---

## Driver Availability Behavior

| Scenario | Driver Availability |
|----------|---------------------|
| Pickup started | Set to `ON_DELIVERY` |
| Pickup completed | Stays `ON_DELIVERY` |
| Pickup failed, no other active assignments | Set to `AVAILABLE` |
| Pickup failed, has other active assignments | Stays `ON_DELIVERY` |
| Suspended/inactive driver | Blocked — cannot perform any pickup action |

---

## Privacy Boundaries

### Customer/Store sees:
- Public event label (e.g., "Your parcel has been collected.")
- `publicNote` only
- `occurredAt` timestamp
- NO internal notes, NO driver PII, NO exact GPS, NO failure reason details

### Driver sees:
- Own event type and label
- Own `publicNote`
- Own parcel condition/count
- Own failure reason
- NO internalNote (admin operational notes are not visible to driver)

### Admin sees:
- Full event: type, label, status before/after, actor, driver code, public and internal notes,
  failure reason, parcel condition, parcel count, location capture status

---

## Order Status Relationships

| Phase 2.6 Action | Order Status Transition |
|-----------------|------------------------|
| Pickup started (CONFIRMED order) | CONFIRMED → PICKUP_SCHEDULED |
| Pickup started (PICKUP_SCHEDULED order) | No change |
| Pickup completed | PICKUP_SCHEDULED → PICKED_UP |
| Pickup failed | No change (stays PICKUP_SCHEDULED for admin) |

---

## API Endpoints

| Method | Route | Role | Purpose |
|--------|-------|------|---------|
| GET | `/api/driver/workbench` | DRIVER | List accepted pickup-ready assignments |
| POST | `/api/driver/assignments/[id]/pickup/start` | DRIVER | Start pickup |
| POST | `/api/driver/assignments/[id]/pickup/complete` | DRIVER | Complete pickup |
| POST | `/api/driver/assignments/[id]/pickup/fail` | DRIVER | Record pickup failure |
| GET | `/api/admin/pickup-exceptions` | ADMIN/SUPER_ADMIN | List pickup failure events |
| GET | `/api/admin/orders/[id]/operational-events` | ADMIN/SUPER_ADMIN | Order operational events |
| POST | `/api/admin/orders/[id]/operational-note` | ADMIN/SUPER_ADMIN | Add admin operational note |

All mutation routes include: auth guard, role guard, ownership validation, Zod validation,
origin check, rate limiting, safe errors.

---

## Not Implemented in Phase 2.6

- Delivery proof / Photo proof
- OTP delivery confirmation
- Recipient signature capture
- Live driver tracking
- Route optimisation
- Driver earnings and payouts
- PayFast / payment processing
- Final UI polish

---

## Phase 2.7 Delivery/POD Handoff

Phase 2.7 should build on top of `OrderOperationalEvent` to add:
- `DELIVERY_STARTED` event
- `DELIVERY_COMPLETED` event (with POD)
- `DELIVERY_FAILED` event
- OTP confirmation model
- Assignment `COMPLETED` transition (after delivery, not pickup)
- Driver availability reset to `AVAILABLE` after delivery

The `OrderOperationalEvent` model is designed as the shared event rail for both phases.

---

## Migration

Migration name: `20260611000003_phase_2_6_pickup_custody`

Operations:
1. Extends `OrderAssignmentEventType` enum with PICKUP_STARTED, PICKUP_COMPLETED, PICKUP_FAILED
2. Creates `OrderOperationalEventType`, `PickupFailureReason`, `ParcelCondition` enums
3. Creates `OrderOperationalEvent` table with full index and FK set

Status: **Applied locally. Staging/production must be baselined before applying.**

---

## Seed Data

Demo accepted assignment created:
- Driver: `driver1@ktcouriers.local` (DRV-1001)
- Order: `KT-DEV-002` (status: PICKUP_SCHEDULED)
- Assignment: ACCEPTED, ready for pickup workflow testing

Use this to test the full pickup custody flow in development.
