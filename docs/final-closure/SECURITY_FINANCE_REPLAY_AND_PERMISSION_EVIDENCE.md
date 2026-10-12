# Security and financial evidence

Inventory APIs derive store identity from the current session and require current inventory READ/MANAGE grants; same-origin, bounded body, rate and strict schema deny ownership injection. Publication requires both current MODERATION_APPROVE and PRICING_MANAGE, current active admin, independent maker/checker and exact source versions. Submission/publication operations have durable replay receipts and changed-facts conflicts.

Signup responses hide existing-account identity in production; duplicate signup does not generate a new OTP. Invalid/expired/disabled/replayed verification returns the same refusal and no session. Same normalized store names serialize slug allocation in the signup transaction. Driver profile codes remain unique under concurrent creation.

Strict Redis and PostgreSQL BOLA receipts, full security/payment/refund/processor selections and the 20 PostgreSQL matrix are required. Stock/catalog publication does not activate tariff/commission/COD rules or create a financial journal. PG failures roll back projection, snapshot, audit/event and publication state together. Financial source policies, immutable journals, balance conservation and unknown provider outcomes retain their locks.

Production dependency audit: zero vulnerabilities. Full dev-toolchain audit retains five HIGH chains involving braces/micromatch/fast-glob/eslint-config-next; [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) has no compatible patched braces release at inspection. No forced Next downgrade or untested override was applied. Use bounded trusted build inputs and disposable CI isolation; independent security disposition remains required.
