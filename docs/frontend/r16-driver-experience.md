# R16 — Driver Operations Experience

## 1. Objective

R16 rebuilds the live protected driver experience as a calm, mobile-first field-operations workspace. It changes presentation only: dispatch allocation, assignment ownership, availability, pickup, delivery, OTP, proof, location, earnings, wallet, withdrawal, authentication, permission, provider, and production-lock authorities remain unchanged.

## 2. Verified route inventory

The live driver tree contains ten routes: `/driver`, `/driver/assignments`, `/driver/assignments/[id]`, `/driver/workbench`, `/driver/delivery`, `/driver/availability`, `/driver/earnings`, `/driver/earnings/[publicReference]`, `/driver/notifications`, and `/driver/profile`. The full authority matrix is in [r16-driver-route-matrix.md](r16-driver-route-matrix.md).

## 3. Driver information architecture

Desktop uses the existing server-filtered R13 rail. Compact driver navigation keeps Home, Assignments, Active delivery, Availability, Earnings, and More; More contains the remaining route-backed Notifications and Profile destinations. `/driver/workbench` remains reachable from existing work links and its own URL, without adding an unstable dynamic record to navigation.

## 4. Driver operational-state hierarchy

`lib/driver-presentation/driver-state.ts` is a pure display mapping. Precedence is account suspended/rejected, account action required, active delivery, active pickup, assignment decision required, available without assignment, unavailable/offline, then source unavailable. It uses actual driver, assignment, and order statuses only, does not transition a state, and makes unknown availability visibly unavailable rather than assuming availability.

## 5. Home

`/driver` has a purpose-built home. It shows at most two compact source-backed counts (current assignments and offers awaiting decision), then one dominant active run or decision-required offer. Account, vehicle, and region facts move to a secondary desktop context panel. No chart, dashboard KPI wall, map, rating, acceptance score, projected earnings, streak, ETA, or fabricated performance measure is present.

## 6. Availability

`/driver/availability` retains the existing PATCH authority, active-account rule, availability revision, stale conflict handling, and server response. R16 presents three labelled operational buttons rather than a decorative switch. It disables duplicate submission, shows the pending state, changes its local confirmed state only after a successful response, and announces errors without silently refreshing away the failure.

## 7. Assignment queue

`/driver/assignments` preserves the real `filter` query parameter and list service. It uses structured records with reference, safe city-to-city summary, canonical assignment status, current order status, deadline when the server provides it, and display-only next-action text. It does not surface a pre-acceptance full customer/contact payload, dispatch notes, risk data, earning promise, fabricated distance, or fake ETA.

## 8. Assignment detail

`/driver/assignments/[id]` remains the dedicated, owner-scoped detail route and existing client operation island. R16 improves the protected header, exposes status and source events, keeps route facts readable, and calls out the limitations of the provider contract. It retains the route's existing fetches, operation IDs, assignment version payloads, and all canonical endpoints.

## 9. Accept and reject

Accept and reject retain their existing role guard, owner lookup, origin enforcement, IP rate limits, validation, assignment status and version checks, audit behavior, and service responses. The UI leaves an offer visible until server confirmation and offers a non-manipulative rejection confirmation with the existing required free-text reason payload. R16 does not invent a penalty or reassignment outcome.

## 10. Active run

Home, pickup workbench, and delivery workbench put the real current assignment ahead of summaries. They show source status, a simple pickup-to-destination sequence, and a link to the detail route for the next allowed server action. There is no percentage, animated vehicle, turn-by-turn interface, hidden future action, fake map, or dispatch-private state.

## 11. Pickup

Pickup work is sourced from `getWorkbenchAssignments` and `getDriverWorkbench`. The detail route keeps start, complete, and failure calls to the existing pickup APIs, including the supplied operation ID and assignment version where those endpoints require them. Parcel count/condition and confirmation validation remain canonical. R16 does not create arrival, geofence, manual-location, or custody actions beyond the current service lifecycle.

## 12. Pickup OTP

No pickup-OTP route, DTO field, or action is present in the live driver surface. R16 adds none.

## 13. Custody

The current service establishes custody through canonical pickup completion and exposes `custodyEstablishedAt` only in the workbench projection. R16 links to that existing detail flow and does not add client-authoritative custody status or an extra confirmation route.

## 14. Delivery

Delivery work comes from `getDeliveryAssignments` and its server summary. Start/resume, delivery-attempt, failure, and completion remain existing detail-route API calls. The service enforces active profile, current accepted assignment, order state, idempotency/concurrency where supported, and canonical state transitions.

## 15. Delivery OTP

Delivery OTP is six numeric digits, expires after the configured 30-minute server policy, and has a server-issued maximum-attempt policy. The detail route can request/resend only while source state allows, supports browser paste in the numeric single field, adds `autocomplete="one-time-code"`, and never logs or stores a code. The recipient destination, cooldown, rate limit, hash-only storage, and verification stay in existing services.

## 16. Proof of delivery

The delivery service creates the canonical proof record as part of a successful server transaction. The driver UI has no source-backed photo, camera, signature, evidence-reference, preview, content URL, or file-upload authority. R16 explicitly says so rather than pretending a file selection is delivery success.

## 17. Exceptions and completion

Pickup failure, delivery attempted, and delivery failure retain existing reason validation and required notes. The UI does not claim reassignment, retry, or completion until the canonical endpoint responds. Completion waits for OTP verification and the server transaction. Unknown states remain viewable rather than being recoloured as success.

## 18. Maps, location, and connectivity

There is no driver map provider component, navigation link, map configuration consumer, browser location collection, external route URI, or live tracking UI in the current driver route tree. Although some DTOs expose source distance/duration or optional coordinate validation fields, R16 displays neither as an invented live route, ETA, or arrival confirmation. Provider or connectivity absence is explicit; no coordinate, geofence, offline queue, or background tracking is created.

## 19. History

Assignments retain the existing `history` filter and canonical event timeline in detail. There is no separate delivery-history route, so R16 does not create or alias one.

## 20. Earnings, wallet, and withdrawals

Earnings use owner-scoped earning services and exact server-issued decimal strings with `ZAR`. List/detail hide ledger and journal implementation fields and no browser arithmetic is performed. The existing driver-earning readiness state remains active, but raw lock code/reason is not rendered. No driver wallet, payout destination, withdrawal, withdrawal history, or maker-checker route exists, so R16 adds none.

## 21. Documents, vehicle, regions, notifications, profile, and security

Profile retains only the driver-owned contact PATCH form. Vehicle, licence, and regions are read-only source fields. `DriverSelfDto` has no driver-self documents/compliance projection or document mutation authority, so no such route/control is fabricated. Notifications retain the existing canonical inbox route. No driver security, password, login-history, preferences, or support route exists in the live tree.

## 22. Server/client boundaries

Home, queue, workbench, delivery, earnings, profile composition, and data selection are Server Components. Client islands are confined to the existing assignment-operation route plus profile and availability mutations. No raw Prisma record, session, permission list, OTP, provider secret, location, file, or internal financial data is passed to a new page-wide client store.

## 23. Accessibility and performance

R16 builds on the R13 skip link, main landmark, focus, reduced-motion, forced-colours, and safe-area rules. Records are semantic lists, stop sequences/timelines are ordered, statuses contain text plus marker, primary targets are at least 44px, forms announce server errors, and the OTP field works with paste. Queries are bounded existing service queries; no map, camera, chart, tracking, or offline dependency is loaded.

## 24. Security, privacy, and production controls

Role guard, route ownership, active-profile checks, assignment-current checks, optimistic versions, rate limits, idempotency, OTP hashing, and production locks remain in their existing APIs/services. R16 excludes dispatch/private notes, risk fields, unneeded customer data, location history, provider payloads, proof storage references, ledger IDs, and raw lock evidence.

## 25. Known backend limitations

- No driver document/compliance, service-region manager, security, support, wallet, or withdrawal route/projection exists.
- No driver map/navigation/provider-state or safe external-navigation projection exists.
- No driver proof file/camera/signature capture contract exists.
- The existing detail client island uses endpoint fetches rather than an RSC detail projection; it remains client-scoped to preserve the canonical action behavior.
- The assigned-offer rejection route's canonical wire payload uses a required free-text note plus `reasonCode`; no source-backed reason catalogue exists.

## 26. Files changed

| File | Responsibility / boundary |
| --- | --- |
| `app/(driver)/driver/page.tsx` | Server home composition. |
| `app/(driver)/driver/assignments/page.tsx` | Server assignment queue composition. |
| `app/(driver)/driver/assignments/[id]/page.tsx` | Existing client action workspace; R16 header, OTP semantics, proof limitation. |
| `app/(driver)/driver/workbench/page.tsx` | Server pickup workbench. |
| `app/(driver)/driver/delivery/page.tsx` | Server delivery workbench. |
| `app/(driver)/driver/availability/page.tsx` | Server availability page composition. |
| `app/(driver)/driver/earnings/page.tsx` | Server earning list/summary. |
| `app/(driver)/driver/earnings/[publicReference]/page.tsx` | Server owner earning detail. |
| `app/(driver)/driver/notifications/page.tsx` | Driver role composition around the existing inbox. |
| `app/(driver)/driver/profile/page.tsx` | Server profile composition. |
| `components/driver/DriverAvailabilityToggle.tsx` | Existing availability mutation island, redesigned presentation only. |
| `components/driver/DriverProfileForm.tsx` | Existing profile mutation island, redesigned presentation only. |
| `components/protected-v2/driver/DriverActiveRun.tsx` | Active-run record presentation. |
| `components/protected-v2/driver/DriverAssignmentQueue.tsx` | Structured assignment queue. |
| `components/protected-v2/driver/DriverHomePage.tsx` | Mobile-first driver home presentation. |
| `components/protected-v2/driver/driver-pages.module.css` | Scoped R16 driver styles. |
| `components/protected-v2/driver/index.ts` | Driver component exports. |
| `lib/driver-presentation/driver-state.ts` | Deterministic state hierarchy and next-action labels. |
| `lib/driver-presentation/assignment-priority.ts` | Deterministic record ordering. |
| `tests/driver-presentation/driver-state.test.ts` | Focused R16 presentation tests. |
| `docs/frontend/r16-driver-experience.md` | R16 implementation record. |
| `docs/frontend/r16-driver-route-matrix.md` | Actual route/authority matrix and implementation map. |
| `docs/frontend/r16-driver-mobile-architecture.md` | Compact interaction architecture. |
| `docs/frontend/r16-driver-illustrations.md` | Illustration usage record. |

## 27. Validation and R17 boundary

Focused state/priority tests cover presentation precedence and ordering. Repository-wide TypeScript currently has pre-existing failures outside R16; R16's earning implicit-any diagnostic was corrected. Manual browser review remains necessary for protected authentication, real operation lifecycle fixtures, provider availability, OTP rate limits, and responsive/assistive technology behavior.

R17 — Promoter and Referral Experience
