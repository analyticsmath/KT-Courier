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
