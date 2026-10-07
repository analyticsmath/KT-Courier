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
