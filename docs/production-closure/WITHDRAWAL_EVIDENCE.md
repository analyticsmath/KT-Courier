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
