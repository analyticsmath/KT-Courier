# Production read-only and backup register

| Scope | Observed/authorized status | Required operator decision |
|---|---|---|
| Project, deployment, redacted service config and variable names | Read-only observed | No secret values exported |
| Public non-sensitive route GETs | Read-only 200 on existing old build | Does not prove new source |
| Protected rows, funds, migration history and drift | NOT_AUTHORIZED / NOT_RUN | DBA-approved query list, role, tenant bounds, redaction and retention |
| Encrypted production backup | NOT_AUTHORIZED / NOT_RUN | Data-owner approval, encryption/key custody, expiry and access |
| Isolated restore of approved production backup | NOT_AUTHORIZED / NOT_RUN | Owned local/approved target, privacy controls and measured restore verification |
| Production migration/initialization/demo tenant | NOT_AUTHORIZED / NOT_RUN | Exact write set/SHA, window, approved data scope and recovery outcome |

Proposed audit reads: migration names/checksums/errors; aggregate counts by source/status without PII; unresolved payment/refund/payout amounts and immutable journal imbalance counts; orphan source references; active worker lease/queue metadata; stored policy/version activation and data-preservation constraints. No raw account emails, bank details, tokens or private media are needed for this first pass. Stop on unknown existing customer/funds exposure. Production is not classified empty from the owner's prelaunch description.

Synthetic dump/restore proves the harness only. Named approver, approved query scope, backup hash/key custody, restored-row invariants, RTO/RPO and review date remain null.
