# Owner withdrawal evidence

Status: implemented candidate; browser/full financial acceptance remains open.
Production approval is still false in reviewed source. A payout environment flag
or an e2e runtime label cannot activate production withdrawal commands.

Store and driver owners now have contextual withdrawal/history/detail/destination
pages. Unsupported customer pages explain eligible owner access. Server pages and
queries resolve the canonical owner using the same role policy as request creation;
balances no longer sum unrelated wallets owned by the same user. Destination reads
select masked fields only. Existing foreign detail responses remain indistinguishable
from absent records. Store employees do not gain owner finance access.

The request form prevents two synchronous submissions and preserves the operation
identity for an unchanged request after a lost response. Server ledger reservation
and cancellation remain canonical. Driver earnings and withdrawals previously issued
different names for the same account purpose. Both now use one provisioner that
preserves either issued identity, and refuses arbitrary account definitions. No
existing ledger account is renamed, reset or credited by this compatibility change.

Local round 30 closure validation passes 132 actual PostgreSQL assertions across
seventeen files, zero skipped. Eight new cases exercise canonical masked projections,
co-owned wallet isolation, driver reserve/cancel, preservation of a prior generic
account identity, arbitrary-code refusal, inactive owner denial, concurrent exact
reservation/replay conflict, foreign destination/record refusal and exact cancellation
release without payout. Earlier failed attempts exposed account-code mismatch,
shared fixture policy assumptions and a missing driver policy; those are failed
attempts, not acceptance. Fixtures now supply their complete isolated prerequisites.

Synthetic policy values, finance actors, opaque destinations, driver approval/delivery
facts and provider-success source facts exist only in strictly guarded disposable
infrastructure. Actual canonical journals fund the tested reserves and releases.
These prerequisites do not represent business approval, real delivery, a provider
payment, external destination verification or a payout. Guards refuse production
before fixture writes. No production seed, reset or external payment was performed.

Five executable Chromium assertions replace the owner placeholder: desktop/phone
store and driver request/retry/cancel/destination inspection, plus role/foreign/
ineligible/anonymous denial. The lost-response test sends the actual request to the
server before aborting the browser response, then requires the same operation and
record on retry. Discovery selects 79 assertions across 21 files; discovery is not
execution. These assertions and the corrected phone document badge require fresh
exact-commit browser proof. Withdrawal finance administration and real payout,
refund/dispute recovery, policy approval and complete financial acceptance stay open.

Round 30 full unit/API validation passes 3,471 assertions across 765 files, zero
skipped. Fifty-five focused service/boundary/readiness assertions and nineteen
native certification/ingress/deferral/launcher checks pass. Lint, including fixture
scripts, and TypeScript pass. The optimized build and fresh browser execution are
still pending at this evidence update.

Final round 30 optimized build passes with the new store/driver withdrawal routes.
Production readiness source remains false. The latest read-only Railway check at
2026-10-07 17:48:31 UTC found four services online with one healthy replica each,
zero issues/recent failures. The destructive five-change patch remains STAGED;
it was not applied. This is health evidence, not candidate deployment parity or
protected-row integrity proof.

At `82a31f1355fab95c5a6dd1528d13d1936b9640bd`, main CI `37662108498`
passed. Certification `37662108487` passed all 24 component jobs, including twenty
PostgreSQL jobs and browser job `112931971781`: 79 assertions passed in 2.1
minutes, zero skipped or flaky. The final certified job failed only the recorded
open engineering/production gates. All five new owner withdrawal assertions passed,
including actual lost-response replay and cancellation.

All twelve store/driver desktop/phone reserved/cancelled/destination captures were
actually inspected. Exact ZAR 20.30/5.10 balances, cancellation, masked references
and accessible controls are readable. Some driver full-page captures retain fixed
navigation at the captured viewport position; they do not prove all scroll states.
The select repeats an already-masked last four and the history has distinct canonical
events with indistinguishable labels. The next candidate removes the repeated suffix
and supplies plain event descriptions; fresh capture validation remains required.

The finance follow-up now cancels earning allocations and transitions dispute holds
inside rejection's release transaction. Actual PostgreSQL checks prove complete
store/driver earning capacity can be reused and allocation failure rolls back the
rejection, release journal, balances and history. A payout-start replay now reads its
matching receipt before checking the advanced state. No external payout is invoked.
Three new finance browser assertions cover queue/detail, review/rejection, lost start
response, unknown outcome/reconciliation, masked destinations and authorization.
They are newly executable and pending. Complete separate-processor/live payout,
financial provider and policy approval acceptance remains open.

Round 31 actual closure PostgreSQL validation passes 136 assertions across
seventeen files, zero skipped. Four added finance cases prove rejection/reallocation
for both owner types, rollback on allocation-write failure, concurrent payout-start
replay and reserve preservation on unknown outcome. Twenty-six focused existing
finance/transfer/UI assertions pass. An earlier full-unit attempt failed because a
mock returned the unknown attempt for every operation lookup; its new-operation
fixture now returns no receipt and still requires state refusal with no writes.
The corrected full suite passes all 3,471 assertions in 765 files, zero skipped,
in 61.07 seconds. Lint, TypeScript and the optimized production build pass.
Eleven critical placeholders remain in 76 marked files;
82 Chromium assertions in 22 files are selected, with three new finance cases
pending actual execution and capture inspection.

At `e63a1f3501b367b8debcff33007c734345e3f0eb`, main CI `37665349612`
passes and certification `37665349760` passes all 24 component jobs. Browser job
`112943037079` passes 82 assertions in 3.5 minutes, zero skipped/flaky, including
the three finance cases. Final certified job `112947307352` fails the remaining
engineering/production gates. No live payout or separate human approval is claimed.

All twelve new finance captures and eight updated reserved/cancelled owner captures
were actually inspected. Money, masked destinations, refusal recovery, rejected
release evidence and unknown-outcome reconciliation are readable. Owner selects no
longer repeat the last four, and distinct history events have plain descriptions.
Full-page driver captures still retain fixed navigation at the captured viewport
position and do not prove every scroll/focus state. A phone finance destination's
withdrawal-reference row splits its amount; the next candidate separates reference,
state and an unbroken amount. Its new capture remains required.
At f45c3186084cc90b1a841f648137aba282d941a3, the updated phone payout-destination
capture was actually inspected. Withdrawal references wrap independently, both
status badges remain intact, and each ZAR 5.10 amount stays on one line. The three
finance browser assertions pass among 82 existing browser cases; two new catalog
cases fail, so this run does not certify the entire browser suite.
