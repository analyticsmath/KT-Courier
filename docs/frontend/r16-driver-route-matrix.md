# R16 — Driver Route Matrix

This matrix records the live `app/(driver)/driver` surface. It is based on the current route tree, DTOs, route handlers, and services; it does not add the conceptual routes that are absent from the repository.

| Route | Purpose / authority | Status and role | DTO / canonical actions | Mobile strategy | Location / OTP / proof | Financial / lock | Risk and R16 state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/driver` | Driver home; `getDriverProfileByUserId`, `listDriverAssignments` | `DRIVER`; profile required | `DriverSelfDto`, `DriverAssignmentDto`; links only | Dominant active run or offer, two small source-backed counts | No location, OTP, or proof mutation | None | Redesigned. Deterministic operational state prevents an unknown availability from appearing as available. |
| `/driver/assignments` | Owned assignment queue; `listDriverAssignments` | `DRIVER`; driver profile required | `DriverAssignmentDto`; filter is `all`, `active`, or `history` | Structured record list, not a squeezed table | No location, OTP, or proof | None | Redesigned. Sorting is presentation-only and documented. |
| `/driver/assignments/[id]` | Owned assignment workspace; `/api/driver/assignments/[id]` | `DRIVER`; owned assignment required | `DriverAssignmentDto`, `WorkbenchAssignmentDto`; accept, reject, pickup, delivery, OTP, exception actions | Dedicated full-page workspace with large labelled actions | OTP required for completion; no source-backed file/camera upload; optional location fields are not generated | None | Retained path and action contracts. Client island is necessary for the existing canonical operations. |
| `/driver/workbench` | Pickup-stage work; `getDriverWorkbench`, `getWorkbenchAssignments`, `getWorkbenchSummary` | `DRIVER`, active profile for work | `DriverWorkbenchDto`, `WorkbenchAssignmentDto`; links to detail actions | One-column pickup records, active operation first | No map/location/navigation authority | None | Redesigned. No distance, ETA, or route presentation. |
| `/driver/delivery` | Delivery-stage work; `getDeliveryAssignments`, `getDeliveryWorkbenchSummary` | `DRIVER`, active profile for work | `DeliveryAssignmentDto`; links to detail actions | One-column delivery records, source status first | OTP and completion are on detail; no map or proof file control | None | Redesigned. Explicit no-provider fallback. |
| `/driver/availability` | Availability selection; `/api/driver/availability` and `updateOwnAvailability` | `DRIVER`; active account required by service | `DriverSelfDto`; PATCH includes expected revision | Three 44px+ labelled state buttons | No location/OTP/proof | None | Redesigned. No optimistic confirmation; stale/server errors remain visible. |
| `/driver/earnings` | Owner earning list and summary; earning query/summary services | `DRIVER`; active approved driver enforced by services | `DriverEarningListItemDto`; read-only | Compact financial records, amounts as issued | None | Driver-earning production readiness remains active | Redesigned. No withdrawal route, control, or raw lock code. |
| `/driver/earnings/[publicReference]` | Owner earning evidence; `getDriverEarningForOwner` | `DRIVER`; owned earning required | `DriverEarningDetailDto`; read-only | One-column record and history | None | Existing readiness lock remains; internal reason is hidden | Redesigned. No journal IDs, maker-checker data, or withdrawal action. |
| `/driver/notifications` | Canonical inbox; `NotificationCentre` | Driver session in protected layout | Server inbox projection used by existing component; read-only | Existing semantic inbox list | None | None | Route retained; no notification preference route exists. |
| `/driver/profile` | Driver-owned contact update; `/api/driver/profile` and profile service | `DRIVER`; profile required | `DriverSelfDto`; PATCH contact fields only | One-column form then source-owned vehicle/region context | No document upload authority | None | Redesigned. Documents/compliance have no driver-self route or DTO projection. |

## Implementation map

| File / route | Current purpose and authority | Server/client | R16 presentation change | Mobile, privacy, and regression notes |
| --- | --- | --- | --- | --- |
| `app/(driver)/driver/layout.tsx` | Driver role guard, server-filtered R13 navigation, notification projection | Server | Unchanged | R13 shell and permission filtering remain intact. |
| `app/(driver)/driver/page.tsx` | Home data composition | Server | Uses `DriverHomePage` and deterministic state selection | No private detail is serialized to a broad client island. |
| `components/protected-v2/driver/*` | New R16 display layer | Server except existing action callers | Active-run, queue, home, scoped styles | Uses existing shared SVG only for empty/restricted guidance. |
| `lib/driver-presentation/*` | New pure display mappings | Server-safe pure modules | State precedence and record ordering | Never sends commands, creates state, or calculates ETA/distance. |
| `app/(driver)/driver/assignments/[id]/page.tsx` | Existing action island and canonical API caller | Client | Clearer header, paste-safe OTP semantics, explicit proof limitation | Actions, payloads, route calls, versions, and operation IDs are retained. |
| `components/driver/DriverAvailabilityToggle.tsx` | Existing availability API island | Client | Consequential labelled buttons with server-confirmed feedback | Existing optimistic-concurrency payload is unchanged. |
| `components/driver/DriverProfileForm.tsx` | Existing driver-owned profile API island | Client | Protected form composition and source-owned context panels | Vehicle, licence, and regions stay read-only. |

## Ordering rules

`prioritiseDriverAssignments` displays accepted work in this exact source-state order: `DELIVERY_ATTEMPTED`, `IN_TRANSIT`, `PICKED_UP`, `PICKUP_SCHEDULED`, `CONFIRMED`, other accepted states, then `ASSIGNED`, then all other records. Offers tie-break by authoritative expiry, then accepted/assigned time. No client urgency score, distance, ETA, or inferred priority is created. Unknown states remain visible and fall behind known active stages rather than being treated as complete.
