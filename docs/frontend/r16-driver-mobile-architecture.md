# R16 — Driver Mobile Architecture

## Navigation

The existing R13 driver navigation remains server-filtered and route-backed: Home, Assignments, Active delivery, Availability, and Earnings are mobile priorities; Notifications and Profile remain in More. `/driver/workbench` is a real focused pickup route but is not inserted into the fixed navigation because the existing registry already has a bounded, route-backed mobile set. Assignment details remain dedicated URLs, not drawers or modal-only workspaces.

## Operational hierarchy and next action

The mobile home selects exactly one primary state: suspended/rejected account; account review; active delivery; active pickup; assignment decision; available without work; unavailable/offline; or source unavailable. An active assignment or dispatched offer appears before secondary account context. The next action is a link to the existing assignment detail route; it never authorizes an action itself.

## Lists, pickup, delivery, and exceptions

Assignment, pickup, delivery, and earnings lists use labelled one-column records. Desktop can expand into a bounded protected workspace, but no desktop table is compressed into a narrow mobile viewport. Pickup, delivery, attempted-delivery, failure, and rejection forms remain inside the established assignment detail client island with server error text and disabled submission controls.

## OTP, proof, camera, and keyboard

The existing six-digit OTP field supports normal paste through its single numeric text input, uses `autocomplete="one-time-code"`, accepts only digits, and is never persisted or logged by the UI. It is still verified only by the completion endpoint. The current driver contract contains no camera, signature, proof-file upload, or preview authority. R16 therefore shows an explicit OTP/server-confirmation proof limitation instead of a decorative capture surface. There is no fixed action bar, so the software keyboard does not hide a required page action.

## Maps, location, navigation, and connectivity

No driver route has a connected map frame, external-navigation link, browser-geolocation request, live tracking, route optimization, coordinate generation, ETA, or distance computation in R16. Pickup and delivery pages say this directly. Network/API failures are local errors on the existing action form; an action is never marked complete until the server returns success. No offline persistence or background location tracking exists.

## One-handed use, safe areas, and accessibility

Primary availability and record actions have a minimum 44px target. Mobile records are whole-row links with visible labels, statuses use text plus a marker, timelines are ordered lists, forms use explicit labels and live error messages, and the R13 shell supplies skip navigation, safe-area spacing, forced-colours focus treatment, reduced motion, and root overflow containment. Review widths are 320, 360, 390, 430, 600, 768, 834, 1024, 1280, 1440, and 1920px plus mobile landscape, 200% zoom, and 400% reflow.
