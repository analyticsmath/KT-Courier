# Business employee access evidence

Classification: NOT_READY. This records a scoped engineering change; complete
vendor and production acceptance remain open.

Catalog pages previously resolved only the store owner, although catalog APIs
already admitted an active employee with the products module. The candidate
uses the existing catalog authorization authority for page data access. This
retains the employee's actual identity and applies active membership, store
context and explicit permission denials. Inventory and imports pages require
their corresponding read permissions before fetching records.

Seventeen existing employee authorization assertions pass. The full local
unit/API suite passes 3,480 assertions in 766 files, zero skipped (84.61 seconds).
TypeScript, full lint, final browser-file lint, explicit ignored-fixture/runner
lint and the optimized build pass. No actual PostgreSQL or browser lifecycle acceptance is
claimed yet: local Docker Desktop crashes during inference socket initialization,
so isolated CI execution is required.

Four new guarded PostgreSQL cases exercise the canonical invitation/access
services against disposable records: hashed email-bound invitation, disable /
reactivation / removal with owner authority and actor audit, concurrent acceptance
with one audit, foreign/expired/unverified refusal, and foreign-owner/conflicting
business refusal. These are synthetic accounts, not production employees or
human approval evidence.

Two new desktop/phone browser journeys use owner invitation controls and employee
acceptance controls, verify a products-only grant, create a real canonical draft,
refuse finance/employee administration, and exercise native disable, reactivation
and removal. They check direct read/write denial, foreign-store concealment,
anonymous denial and retained owner access. Discovery totals 88 assertions in 25
Chromium files. Execution remains pending. Discovery and test source are not
acceptance; no external invitation messages are sent. Screenshots, traces and
videos are retained only on failure by the shared Playwright configuration.
Native browser visual review remains separately required.
