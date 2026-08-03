# Phase 2.4: Driver Operations Foundation

This document details the architecture, design, lifecycle, and operational behaviors of the driver engine implemented in Phase 2.4 of the KT Couriers platform.

---

## 1. Driver Lifecycle & Onboarding

Drivers are first-class operational actors. Every driver profile is linked to a `User` account with the `UserRole.DRIVER` role.

### Onboarding Flow
1. **User Creation:** An administrator creates a user account with the `UserRole.DRIVER` role (via the Admin Users console or database seeding).
2. **Profile Linking:** The administrator navigates to the Drivers console and links the `DRIVER` user to a new `DriverProfile`. A unique, sequential code (e.g., `DRV-1001`) is generated automatically.
3. **Onboarding Statuses (`DriverOnboardingStatus`):**
   - `INVITED`: The driver user has been created but profile details have not yet been input.
   - `PROFILE_INCOMPLETE`: Profile is linked but vehicle, license, or contact details are missing.
   - `PENDING_REVIEW`: Profile information is complete and submitted to admin for verification.
   - `APPROVED`: The profile has been verified and approved by an administrator.
   - `REJECTED`: The profile has been rejected by an administrator.

---

## 2. Driver Status & Availability Matrix

A driver's operational eligibility is governed by two orthogonal states: **Driver Status** (admin-controlled) and **Driver Availability** (driver/admin-controlled).

### Driver Status (`DriverStatus`)
Admin-controlled state indicating platform authorization:
- `PENDING_REVIEW`: Profile is under inspection. Cannot be active.
- `ACTIVE`: Approved to operate. Can set availability and receive jobs.
- `INACTIVE`: Temporarily off the platform. Forced offline.
- `SUSPENDED`: Suspended by admin for policy violation. Forced offline.
- `REJECTED`: Application rejected. Forced offline.

### Central Transition Rules
Transitions are validated through a central rules engine (`isValidStatusTransition`):
- `PENDING_REVIEW` → `ACTIVE` or `REJECTED`
- `ACTIVE` → `INACTIVE` or `SUSPENDED`
- `INACTIVE` → `ACTIVE` or `SUSPENDED`
- `SUSPENDED` → `ACTIVE` or `INACTIVE`
- `REJECTED` → `PENDING_REVIEW` (to allow re-evaluation)

*Note: Transitioning to `REJECTED` or `SUSPENDED` requires a valid reason string (minimum 3 characters) which is stored in the database and audit-logged.*

### Driver Availability (`DriverAvailability`)
Driver self-service state indicating readiness to receive work:
- `AVAILABLE`: Active and ready to accept dispatches.
- `UNAVAILABLE`: Active but on a break or temporarily busy.
- `ON_DELIVERY`: Currently executing an order (reserved for Phase 2.5 dispatch).
- `OFFLINE`: Checked out / off duty.

### Availability Guards
1. **Approval Guard:** Non-active drivers (`PENDING_REVIEW`, `SUSPENDED`, `REJECTED`, `INACTIVE`) are forced to `OFFLINE` and blocked from setting themselves to `AVAILABLE`.
2. **Self-Service Boundaries:** Drivers can toggle between `AVAILABLE`, `UNAVAILABLE`, and `OFFLINE`. They *cannot* set themselves to `ON_DELIVERY` manually.

---

## 3. Coverage Regions & Vehicle Profiles

### Driver Service Regions
- A driver can operate in multiple `DeliveryRegion` service zones.
- The admin assigns these regions via a checkbox list in the driver detail console.
- A driver can have exactly one **Primary Region**, which dictates their default hub/location.
- **Region Deletion Guard:** To prevent broken routes, delivery regions linked to active drivers are protected by database-level constraints (`onDelete: Restrict`).

### Vehicle Profiles
Driver profiles contain transport parameters:
- `vehicleType` (`MOTORBIKE`, `CAR`, `VAN`, `TRUCK`, `BICYCLE`, `WALKER`, `OTHER`)
- `vehicleMake`, `vehicleModel`, `vehicleColor`, `vehicleRegistration`
- `licenseNumber`, `licenseExpiryDate`

---

## 4. Privacy & Access Boundaries

Drivers handle highly sensitive information. Access is restricted under strict boundaries:

- **Admin View:** Admins have full access to profile, vehicle, license number, emergency contacts, internal notes, documents, and operation logs.
- **Driver View:** Drivers can view their own profile, vehicle details, assigned regions, and toggle availability. They cannot view other drivers' profiles or edit admin-only fields.
- **Store & Customer Boundary:** Store and customer users **cannot** view driver profiles, license numbers, emergency contacts, or internal notes. They do not have access to any driver APIs.

---

## 5. Audit Logging

Every admin operation on a driver profile is recorded in the platform `AdminActivityLog` with the following parameters:
- `actorUserId`: The Admin/Super-Admin user who executed the action.
- `action`: `CREATE`, `UPDATE`, or `STATUS_CHANGE`.
- `entityType`: `"Driver"`.
- `entityId`: The `DriverProfile` ID.
- `message`: User-friendly audit description (e.g. status changes including reasons).
- `metadata`: JSON payload containing old values, new values, reasons, and driverProfileId.

No secrets, passwords, or private documents are ever logged.

---

## 6. What is NOT Implemented (Phase 2.5 Handoff)

This phase establishes the foundation. The following are explicitly excluded and deferred to Phase 2.5+:
1. **Dispatch Board & Assignment:** No matching engine, no order assignment to drivers.
2. **Accept/Reject Workflows:** Drivers cannot accept/reject dispatches.
3. **Delivery Proofs:** No OTP validation, signature capture, or photo upload.
4. **Live Tracking:** No geolocation updates or map tracking.
5. **Payouts & Earnings:** No financial ledger, payouts, or PayFast driver integration.
