# Store earning evidence

Status: canonical disposable PostgreSQL checks pass; browser execution and full
financial acceptance remain open. Production earning/release locks remain active.

Round 28c `npm run test:integration:closure` passed 122 assertions across sixteen
files, zero skipped. Six new store-earning assertions use actual PostgreSQL and
canonical receipt, accrual and release journals. They exercise concurrent natural
replay, conflicting operation evidence, duplicate settlement refusal, exact owner
projection/foreign denial, maturity gating, concurrent single release, production
lock and suspended-store refusal, and rollback of journal/balances when the earning
write fails. The generated failure trigger targets one disposable earning and is
removed in `finally`. Amounts are exact: 100.25 accrued and released once.

The synthetic source fixture runs only after the existing strong isolated
financial-database guard, additionally restricted to the named closure/browser
databases. It creates canonical checkout/payment/order relations and balanced
receipt journals. It preserves immutable succeeded-payment evidence. Synthetic
webhook verification flags, zero commissions and direct maturity timestamps are
test prerequisites, not proof of provider verification, order finalization,
commercial-policy approval or production hold-policy acceptance.

Three actual browser assertions replace the former store-owner placeholders.
Two dedicated owners at 1440px and 390px inspect 100.25 accrued and 25.40 released,
safe exact summaries, keyboard detail navigation, history, absence of mutation
controls, and foreign/missing parity. Another assertion denies customer, driver,
admin-without-business-context and anonymous API access. Each store has separate
canonical earning/ledger fixtures; no production records are written.

Discovery now selects 71 Chromium assertions in nineteen files. The three new
store-owner assertions require exact-commit execution and actual screenshot review
before they count as acceptance. Refund reserves, commissions, store staff finance
permissions, finance administration, withdrawal and complete merchant/customer
order journeys remain open. Fourteen critical placeholders remain in the audit.

At `9001252c8717474bcdd1ddb3278e55652d8f0a24`, main CI and all three
store-owner browser assertions passed. Browser job `112901353131` had 69 passes
and two failed document-download assertions, zero skipped. All four owner
list/released-detail captures were inspected: desktop and phone show exact
amounts, clear statuses and readable history. The phone full-page detail retains
the fixed header at the captured viewport position; it is not proof of every
focus target or scroll state.

Certification `37653131586` failed browser and the dedicated store-earning job;
nineteen other PostgreSQL jobs, quality, Redis/security and recovery passed.
The dedicated runner selected the new canonical suite, which refused its
unsupported database before executing six assertions. That failed run is not a
zero-skip pass. A separate store fixture guard now supports the named closure/
browser and uniquely generated local store runner, requiring test runtime,
network-disabled flags and, for the dedicated runner, matching database
username/name, isolated-test approval and specific approval/project identity.
Production and foreign/mismatched identities are refused before writes.

Local round 29 closure validation passed 124 assertions in sixteen files, zero
skipped. Eight canonical store checks now include concurrent exact reversal with
one balanced journal and post-release reversal refusal with reconciliation and
unchanged owner funds. The dedicated store runner also executed all eight canonical
checks alongside its eight existing assertions: sixteen passed in eight files,
zero skipped. Thirty-nine focused boundary/routing/UI assertions pass, including
fifteen store fixture guard assertions.

Store finance now retains reason/note on refusal, recovers pending state after
network failure, and uses keyboard-scrollable bounded tables with intact money.
Three new finance browser assertions and ten captures require actual execution
and inspection. They verify locked requests, unchanged evidence, released-record
control absence, safe reconciliation and role/explicit-DENY isolation. Successful
production reversal and real commission/refund attribution are not claimed.
Discovery is now 74 Chromium assertions in twenty files. Thirteen critical
placeholders remain in 78 marked files; complete financial acceptance stays open.

Final round 29 source validation: full unit/API suite passed 3,465 assertions
across 765 files, zero skipped; lint (including ignored fixture/runner scripts),
TypeScript and the final optimized build passed. The first build attempt failed
on an un-narrowed test result union; explicit completion narrowing repaired the
test without altering financial service behavior. Fresh exact-commit CI/browser
execution remains required for the latest candidate.
