# Driver earnings candidate evidence

This candidate remains `NOT_READY`. The source-level financial activation lock
remains enforced. Disposable evidence does not authorize production earnings,
payment verification, delivery confirmation, reversals, refunds or withdrawals.

The closure PostgreSQL runner passed 103 assertions in fifteen files, zero
skipped, at commit `1531c1ce19de479fa72fdd6d1c1ec49f12dd95b1` locally. Six new
assertions exercise actual canonical accrual/release services, balanced journals,
exact balances, concurrent replay, changed-command conflict, foreign-owner and
suspended-driver denial, and rollback after an earning-write failure. Source
payment/POD facts are explicitly synthetic. Calls without the existing test-only
option remain locked.

Exact-commit certification `37629490236` failed before browser assertions because
the fixture container did not receive `KT_NETWORK_DISABLED=true`. Its dedicated
driver PostgreSQL job also rejected the runner's uniquely named disposable
database. Main CI `37629490147` failed at the same browser fixture boundary.
Neither failed run certifies the new driver browser assertions or the projection
error-policy correction.

The follow-up passes the isolation flag to the browser fixture process and
recognizes the dedicated driver runner only when its loopback host, database
name, database user, runner project and explicit isolated/approved flags match.
Production mode, remote hosts and mismatched runner facts remain rejected before
fixture writes. Thirteen boundary assertions pass. The dedicated driver runner
passes fourteen actual PostgreSQL assertions across eight files, zero skipped,
including all six new canonical service assertions (7.38 seconds).

Pending/inactive drivers retain API 403 denial. Their earnings pages now render
an explicit restricted state with an onboarding link and no invented zero
balances. Authentication remains outside the expected-error handler; foreign
records retain the eligible owner's not-found response. Only the typed eligibility
error receives this state; unexpected failures still propagate.

Desktop/phone browser assertions cover exact owner balances/history, genuine
cross-driver denial, record immutability, role/anonymous denial and the pending
driver restricted state, including keyboard navigation and unobscured focus.
Execution of the follow-up is pending. Its local browser runner has not reached
assertions; Docker Desktop returned HTTP 500 to a read-only container listing
during application build. No browser success or cleanup result is inferred from
that infrastructure failure. The shared local database and Redis were not reset
or restarted. Full finance administration, actual
provider verification, physical delivery and complete financial acceptance
remain open.
