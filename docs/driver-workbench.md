# Driver Workbench

> Phase 8 supersedes the narrow pickup-only description below. See
> [Phase 8 driver operations hardening](./phase-8-driver-operations-hardening.md)
> for accepted-current-driver authority, idempotent mobile commands, transit,
> OTP, POD, retryable attempts, and the privacy-minimised workbench API.

## Overview

The Driver Workbench is the primary operational interface for drivers who have accepted
delivery assignments. It shows all accepted assignments with orders ready for pickup and
provides the pickup action workflow.

---

## Access

Route: `/driver/workbench`

Requirements:
- Authenticated user with `DRIVER` role
- Active `DriverProfile` (status = `ACTIVE`)
- Must have accepted assignments to see work items

---

## What the Workbench Shows

1. **Summary stats**: accepted count, pickup-ready count, in-progress count
2. **Availability status**: current driver availability with link to manage
3. **Pickup-ready cards**: one card per accepted assignment where order is CONFIRMED or PICKUP_SCHEDULED

### Workbench Card Contents
- Order number and status badge
- In-progress indicator if pickup started
- Pickup city → Dropoff city
- Distance and estimated duration
- Pickup address with contact and access notes
- Parcel count and description
- Last operational event (if any)
- Link to Pickup Actions (opens assignment detail)

---

## Pickup Actions (Assignment Detail Page)

Route: `/driver/assignments/[id]`

### Available actions when assignment is ACCEPTED + order is CONFIRMED/PICKUP_SCHEDULED:

#### Start Pickup
- Optional driver note (internal — not shown to customer)
- Confirms driver is heading to pickup
- If order is CONFIRMED → transitions to PICKUP_SCHEDULED
- Creates PICKUP_STARTED operational event
- Sets driver availability to ON_DELIVERY

#### Confirm Pickup (Complete)
- Parcel count (required)
- Parcel condition (selector)
- Optional note for customer (public)
- Optional driver note (internal)
- Confirmation checkbox: "I confirm the parcel has been collected."
- Transitions order to PICKED_UP
- Sends status email to customer/store
- Creates PICKUP_COMPLETED operational event

#### Pickup Failed
- Failure reason (required)
- Note explaining what happened (required)
- Records PICKUP_FAILED event for admin review
- Does NOT mark delivery attempted
- Order stays in PICKUP_SCHEDULED for admin action

---

## Empty State

When driver has no accepted pickup-ready assignments:
- Clear "No pickup-ready assignments" message
- Link to assignments list

---

## What Workbench Does NOT Show

- Fake orders or metrics
- Fake route map or tracking
- Fake earnings
- Other drivers' assignments
- Terminal or completed orders

---

## Security Rules

1. Driver can only see their own accepted assignments
2. Suspended/inactive drivers see warning and cannot use pickup actions
3. Driver cannot perform pickup actions for another driver's assignment
4. All mutations require auth, role, ownership check, Zod validation, origin check, rate limiting
