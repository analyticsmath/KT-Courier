# Disposable checkout evidence

The browser runner creates a fresh `kt_phase75_e2e` database in a uniquely
named Docker Compose project. Its commercial fixture initializer refuses
remote databases, different database names, production runtimes, or an absent
explicit E2E runtime before querying or writing any authority.

The fixture uses the existing domain commands to publish legal documents,
author/review/activate the delivery matrix, and author/review a store commission
plan. Maker and reviewer are separate disposable users. The commission
activation uses the existing explicit test-only option inside this guarded
fixture; the production source lock remains false. Store seller identity,
coverage coordinates, legal content, R23.45 delivery tariff and R1 commission
are plainly synthetic test data. None is a production business fact or human
approval. The ordinary admin form has no pre-filled commercial percentage.

The browser app receives a non-secret, unusable Paystack test credential only
to exercise the pre-payment configuration path. Its Docker network is internal
and has no outbound provider access. The disposable `compose.e2e.yml` override
removes the app's published port and exposes a loopback-only, fixed-upstream
ingress on a separate bridge. Only ingress joins both networks. Host, Origin,
cookies, request bodies and responses pass through unchanged. A direct public-IP
TCP probe must fail from the app before browser tests run. `KT_LOCAL_FULL_FLOW` is not enabled, and
the fixture does not fabricate successful payments or create paid orders.
This proves application behavior under controlled inputs; it does not prove
Paystack, Google Maps, legal, financial or live-payment acceptance.

Positive delivery/review/acknowledgement tests require successful source-backed
responses. Rejected payment commands are separately named negative assertions.
Forged browser-return parameters must preserve the entire owned checkout
projection. Cross-browser access checks cover both missing authority (401) and
a different canonical checkout owner (404).

At `95cf5ff4a7eaab1716b25ba2c3f238af8386b322`, main CI and all 20 PostgreSQL
certification jobs passed, while browser certification had 26 passes and seven
failures. Candidate fixture and UI changes require a new exact-commit browser
run; those previous results do not certify the candidate or authorize deployment.

At `14f732c772238708f87d19fc4409cb6aed546080`, all 20 PostgreSQL jobs,
quality, Redis/security and recovery passed. Browser certification and main
CI ledger browser acceptance stopped before tests: the internal network blocked
the host from reaching the app's published port. The ingress repair requires
fresh CI proof. Local Docker builds separately hit memory exhaustion and backend
disconnects; these attempts are failures, not browser acceptance.

At `73f8808d4186113731d81ec9b32b134ef73c5099`, main CI passed and all
20 PostgreSQL certification jobs, quality, Redis/security and recovery passed.
The ingress and outbound isolation checks succeeded. Browser execution reported
29 passed and five failed out of 34: the compiled standalone runtime rejected
the deterministic routing provider, causing absent settlement groups, and the
store selector's accessible label included option text. Candidate fixes retain
the production mock rejection unless explicit E2E runtime, disabled networking,
checkout validation and the exact local browser database all match. Six new
desktop/mobile functional assertions replace three placeholder browser files.
These candidate tests require fresh execution; 29 critical placeholders remain.

The candidate also repairs pricing configuration to read the stored JSON
boolean/number types and legacy strings. An enabled tax policy requires an
explicit valid rate; malformed values fail closed. No production settings,
historic quotes or reviewed service formulas are rewritten. The seeded browser
fixture has explicit 15% VAT, so its R23.45 tariff yields R26.97 delivery total
and R1526.97 checkout total. This is test data, not a new production tariff.

At `be968fb285236ff16ec2c52f4e7404624bea753d`, main CI passed. Certification
quality (3,390 unit/API assertions), recovery, Redis/security and all 20
PostgreSQL jobs passed. Browser execution ran all 40 assertions: 35 passed and
five failed. The prior commission, routing, review and acknowledgement failures
passed. New accessibility assertions incorrectly included Next.js's own route
announcer and the desktop action region on mobile, and the variant assertion
expected the product identity rather than the actual selected offer title.
Candidate scopes checkout errors to the form-associated alert, checks the exact
fixture offer titles and uses the named mobile purchase dock. Fresh execution
remains required; the engineering gates remain open and no deployment is allowed.

At `a636605708ac5cc5e28bcd59b771ca57b808cfaa`, main CI passed. All 40
browser assertions passed with zero skipped (49.6 seconds); quality, all 20
PostgreSQL jobs, Redis/security and recovery also passed. Certification run
`37610397199` correctly failed its final `certified` job because the engineering
manifest still contains open gates. Green component jobs do not authorize release.

The next candidate adds two checkout administration assertions (42 discovered
across ten files) and a shared permission-protected, read-only records projection.
It also binds required-domain notification operation IDs to canonical source
events and replaces racing empty-update upserts with PostgreSQL conflict-safe
insertion. Local disposable closure validation first exposed that intake race
(69 passed, two failed); after the root fix, all 71 tests in ten files passed,
with zero skipped. The eleven required-domain tests include actual guest email
verification, concurrent intake/publication, unverified-account blocking,
preferences, suppression, forged duplicate rejection and pre-send contact
revocation. No external email send or successful payment is claimed by these tests.

At `9d9d337d5f6cc560a007f5e20e6014ea34c81aaa`, main CI `37612330867`
passed. Certification `37612330761` passed all 20 PostgreSQL jobs, quality,
Redis/security, recovery and all 42 browser assertions (53.2 seconds, zero skipped).
The final certified job failed because engineering gates remain open.

The next candidate corrects the source audit to recognize nested, computed and
focused test declarations. Four parser regression tests pass. The regenerated
inventory contains 85 marked files and 41 critical placeholders, correcting the
previous undercount of 28. Newly discovered driver earnings and Phase 26 browser
placeholders are open work; discovering them does not certify or exclude them.

The driver candidate makes profile/account and onboarding/account updates atomic,
preserves independent internal review notes, rejects invalid private headshots,
and returns the canonical public photo reference for reload/resubmission. It adds
identity labels, status/error announcements, error associations, keyboard focus
and 44px controls without approving a driver or changing financial policy.
The initial PostgreSQL run passed 80 assertions in eleven files, zero skipped,
including actual rollback on a test-owned DriverProfile trigger failure. A later
photo reload regression passed in the final local run: 81 assertions in eleven
files, zero skipped (22.01 seconds). The intervening run had 80 passes and one
commission test timeout at 5,000ms during overlapping validation; the sequential
rerun preserved the original timeout and assertions. Lint, TypeScript, optimized
build, 3,393 unit/API tests (759 files) and ten certification-helper tests passed.
Three desktop/mobile/authorization browser assertions require fresh execution.
Browser discovery reports 45 tests in eleven files;
discovery is not execution. No live GPS, POD, document approval or payment is
claimed by these contact/onboarding assertions.

At `7c45c3d7d98c6f60eb9460ed2a99ee6b8cbfce4c`, all 45 browser assertions
passed (50.0 seconds, zero skipped), including the driver contact/onboarding
and authorization checks. All 20 PostgreSQL certification jobs, quality,
Redis/security and recovery passed. Certification `37614766079` failed only
the final certified job on open engineering gates. Main CI `37614766194`
failed its migration-smoke job before executing migrations because Docker Hub
returned HTTP 500 resolving `node:24-bookworm-slim`; the failed job is being
rerun. The certification migration-smoke job passed on the same commit. The
failed-job rerun subsequently passed; main CI is now `SUCCESS` on that exact SHA.

The notification candidate reconstructs courier status from matching canonical
order history, binds confirmation/status operation identities and rejects
unsupported compatibility facts. Fourteen actual courier publication assertions
and eleven other required-domain assertions are included in the local closure
run: 84 passed in eleven files, zero skipped (18.80 seconds). Sixteen focused
payload assertions, lint, TypeScript, optimized build, 3,398 unit/API assertions
in 759 files and twelve helper assertions also passed with zero skipped.
New exact-commit CI validation remains required.

Source and launch-scope review identifies the Phase 26 recruitment pipeline as
optional and locked behind its exported false production constant. The audit
now qualifies that exact directory exclusion from parsed source; enabling the
lock makes its placeholders critical again. Twenty-two previously critical
recruitment placeholders are excluded, never passed, leaving nineteen active
critical placeholders. See `OPTIONAL_RECRUITMENT_EXCLUSION.md`. Canonical driver
onboarding, employee permissions, dispatch and earnings remain critical. The
courier publication suite now fails on an unsafe connection instead of skipping;
the current deferral inventory contains 84 marked files.

At `dbf983c2f75d27dc392910398947a7f7e3ea7843`, main CI `37616145153`
passed. Certification `37616145205` passed all 20 PostgreSQL jobs, quality,
Redis/security, recovery and all 45 browser assertions (45.7 seconds, zero
skipped). The certified job correctly failed on open engineering gates.

The private-media candidate rejects signature-only or truncated raster evidence
before provider allocation or database creation. New JPEG/PNG/WebP objects are
decoded, rotated and re-encoded without cropping or resizing, removing embedded
upload metadata. Stored checksum/size describe normalized bytes; metadata records
the source checksum/size, not retained raw source bytes. Existing objects and
PDF routing are untouched. Thirteen focused native decoder/storage assertions
pass, including cleanup after READY database-write failure and durable quarantine
when cleanup fails. Local closure PostgreSQL passes 87 assertions in twelve files
(23.03 seconds, zero skipped), including physical local-adapter write/read,
canonical ownership, denied access audit and checksums. Its test-owned temporary
cleanup path is validated before recursive removal. Lint, optimized build and
3,408 unit/API assertions across 760 files passed with zero skipped. New
exact-commit CI proof remains required; complete media/browser/provider acceptance
is still open.

At `5284b1aa8701a6c63ecd0d0be06ce69bdd448a9d`, main CI `37617699521`
passed. Certification `37617699534` passed all twenty PostgreSQL jobs, quality,
Redis/security, recovery and all 45 browser assertions (39.5 seconds, zero
skipped). Only the final certified job failed, on the remaining open gates.

The catalog draft candidate scopes persisted fields, in-memory media and browser
change subscriptions to the authenticated owner and store supplied by the server
page. It ignores the legacy unscoped draft because its owner is unknown; it does
not migrate or delete that unattributed data. Matching cross-tab updates and
storage clearing invalidate the current owner's cached draft. Two added browser
assertions cover same-browser account switching, owner-specific reloads, legacy
draft rejection and cross-tab changes at 1440px and 390px. Discovery reports 47
selected assertions in twelve files; these two new assertions require execution.
The three existing catalog UI contract assertions, lint, optimized build and
3,408 unit/API assertions across 760 files pass with zero skipped. Product submission,
duplicate detection, offer/price/inventory activation and full vendor acceptance
remain open.

At `0f11a06101e7dc38490ba9703393c775547a57d0`, certification
`37619110254` passed all twenty PostgreSQL jobs, quality, Redis/security,
recovery and all 47 browser assertions (50.5 seconds, zero skipped), including
both catalog owner isolation assertions. Only the final certified job failed on
open engineering gates. Main CI `37619110251` subsequently passed on that SHA.

The checkout resume candidate selects and projects only editable owner contact
and delivery address fields from the canonical snapshots. Verification records,
guest tokens, protected coordinates and coverage evidence remain private. A keyed
checkout session resets client state across references; an unavailable owner
reference displays an error without a stale contact form or order confirmation.
Five actual PostgreSQL assertions cover customer/guest resumption, foreign and
cross-owner-type denials, rejected corrections without mutation, and replacement
snapshots that preserve historical contact evidence. The local closure run passes
92 assertions in thirteen files (27.59 seconds, zero skipped); nine focused
checkout projection/service assertions also pass. Two replacement customer browser
assertions cover address correction, reload/resumption, spoofed return parameters
and foreign status access at 1440px and 390px. Discovery reports 49 assertions in
thirteen files; these two require execution. The active placeholder inventory is
now eighteen in 83 marked files. Successful payment, finalization, actual paid
confirmation and full financial acceptance remain open.

The candidate also adds four read-only browser capture walks at 1440px, 1366px,
768px and 390px, covering the quote, product detail, store catalog/wizard, driver
profile/onboarding and protected production readiness. Successful CI retains
full-page screenshots in `browser-evidence` for actual visual inspection.
Discovery now reports 53 assertions in fourteen files. Capture generation and
overflow assertions are not a visual sign-off; execution and inspection remain
required. Local lint, TypeScript, optimized build, twelve certification helpers
and 3,409 unit/API assertions across 760 files pass, zero skipped.

At `f7286c8af6f0fd4e8333339d830955983d3b4815`, main CI `37620687563`
passed. Certification `37620687583` passed all twenty PostgreSQL jobs, quality,
Redis/security, recovery and all 53 browser assertions (1.8 minutes, zero skipped).
This includes the customer correction/resumption/access assertions and four
responsive capture walks. Only the final certified job failed on open gates.
The downloaded `browser-evidence` artifact contains 28 actual screenshots; partial
visual inspection found a collapsed mobile missing-image gallery. See
`VISUAL_REVIEW.md`. Capture generation does not sign off every layout or journey.

The editorial candidate captures the form element before each asynchronous save,
returns collection/synonym lifecycle results from their owning transaction,
commits collection removal with its optimistic version and rejects activation
when only tombstoned items remain. Five actual PostgreSQL assertions pass in the
97-assertion, fourteen-file closure run (35.75 seconds, zero skipped), including a
test-owned trigger rollback and concurrent removal conflict. Test-owned lifecycle
evidence survives until the disposable database is destroyed. Lint, TypeScript,
optimized build and all 3,409 unit/API assertions in 760 files pass. Four replacement
storefront admin browser assertions cover canonical collection/synonym authoring,
review/activation/retirement, unsupported projection overrides and role/explicit
DENY checks. Activation is exercised through the existing authenticated API; the
current UI offers review and retirement only. The new assertions require execution.
Discovery reports 57 assertions in fifteen files; the active placeholder inventory
is seventeen in 82 marked files. Full directed functionality remains open.
