# No cloud staging decision

Owner direction: **“NO staging environment, no new Vercel project, no new Railway environment, no new cloud database, no surprise paid resources.”** Recorded decision: `NO_CLOUD_STAGING_BY_OWNER_DIRECTION`. No persistent cloud staging resource was created.

Compensating controls are exact-source CI, fresh owned disposable PostgreSQL/Redis containers, blocked external provider egress, genuine UI/API/database/worker acceptance, synthetic recovery/historical migration upgrade, redacted read-only infrastructure inventory and retained deployment freezes. These do not prove deployed configuration parity or recovery of protected production data.

Single-environment release has a larger blast radius: web predeploy migrates/initializes persistent production data, workers may process old/new sources concurrently, and Vercel edge/API/cookies can route to mismatched sources. An old binary rollback does not undo migrations. Protected-row audit, approved encrypted backup plus isolated restore, selective patch disposition, explicit release window and coordinated exact-SHA web/worker/edge approval are required.

Operator risk acceptance: **null**. Release window: **null**. Production backup/restore approval: **null**. RTO/RPO: **unknown**. No-staging direction is not a substitute for these approvals. Abort on private-data leakage, wrong recipient, payment/journal mismatch, lost worker, unknown schema drift or unsafe migration. Preserve evidence, stop newly enabled transactional writes and follow the approved incident/forward-repair plan.
