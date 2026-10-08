# Recovery, rollback and disposable restore proof

## Current proof status

The initial local attempt timed out on Docker readiness. Isolated GitHub execution has since passed: source `98cdd293bd1e8a18093cdc8f5a8d7c2a21666601`, certification [37820077771](https://github.com/analyticsmath/KT-Courier/actions/runs/37820077771), recovery job `113458537130`. Actual receipt: dumpRestore PASS, historicalUpgrade PASS, fixtureCountsAndHashes MATCH, ledgerInvariants PASS, protectedProductionDataTouched false. The complete workflow remains failed on browser acceptance at that source; this recovery result does not promote the release gate or establish production backup readiness.

## Reproducible disposable drill

Run on a host with a healthy Docker engine:

```powershell
npm ci
npx prisma generate
npm run recovery:drill
```

`scripts/recovery-drill.mjs` constructs a unique `kt-couriers-recovery-*` Compose project and its own loopback database URL. It ignores a caller-supplied database URL. It deploys current migrations into `kt_recovery_source_test`, inserts an explicitly disposable user and balanced opening journal with two accounts and two entries, runs `pg_dump --format=custom`, creates `kt_recovery_restored_test`, and runs `pg_restore --exit-on-error --no-owner` into that empty database. It checks `prisma migrate status`, representative row preservation, incomplete migrations, source/restore fixture counts and full-row hashes, and the existing complete ledger invariant script. It separately applies the earliest checked-in baseline to `kt_recovery_historical_test`, inserts the representative user, resolves that baseline, applies current incremental migrations and checks row preservation. The report is `output/production-closure/recovery.json`. Cleanup removes only the unique disposable project/volumes. These commands have passed in isolated CI. Local Docker remains unsuitable for the heavy drill; use the disposable CI evidence and separately authorized operator infrastructure.

The drill proves restore mechanics and migration compatibility on fixtures. It does not prove Railway's production backup freshness, recovery time objective or recovery point objective. Operations must verify provider backup retention, restore permissions and latest successful backup separately.

## Application rollback

1. Freeze promotion and additional financial actions; retain webhook ingress and durable receipts where operationally safe.
2. Record failed/current and last healthy SHAs and all three deployment IDs. Preserve processor logs and restricted reconciliation evidence.
3. Roll Vercel edge, Railway web and the existing operations service to the same previously healthy source/image. Preserve the server origin, secret bindings and existing operations service identity. Never apply the obsolete staged patch.
4. Confirm schema compatibility before rollback. Database changes are forward-fixed; never run down/reset/dev migrations in production. If old code cannot read the deployed schema, deploy a reviewed compatibility forward fix.
5. Verify health, ready, operations heartbeat, protected-row audit and safe reconciliation counts before resuming normal operations.

## Database restore

Obtain explicit operations authorization and a provider-approved backup. Restore into a new isolated recovery PostgreSQL instance first; never overwrite live production for a rehearsal. Verify migration status, protected-table counts/hashes, ledger/payment/COD/refund/earning invariants and representative ownership reads. Finance determines duplicate-provider and reconciliation risk before cutover. Preserve the original database, backup timestamps and audit trail until recovery is signed off. Credentials and raw dumps stay in approved restricted storage.

## Redis failure

Distributed controls must remain fail-closed where their contracts require Redis. `/api/ready` reports the outage; do not substitute an in-memory production origin/rate/lease bypass. Recover Redis with the approved provider procedure, verify distributed lease/rate controls, and inspect interrupted payment/notification work before resuming.

## Object storage and Cloudinary

New private raster intake decodes and re-encodes JPEG/PNG/WebP while retaining
full image content and dimensions (orientation may swap width/height). Embedded
upload metadata is removed. The stored checksum describes the normalized object;
`PRIVATE_RASTER_V1` metadata records the source byte checksum and size. The raw
source bytes are not separately retained by this new intake path. Existing media
objects and catalogue mirrors are untouched. Recovery must distinguish old
original objects from new normalized objects when verifying checksums.

A failed storage/READY-finalization attempt deletes its own generated provider
key and marks the database record QUARANTINED. If provider cleanup fails, use the
existing provider-aware deletion path for that quarantined record after storage
recovers. Never mark it READY merely because a provider object exists.

Preserve private media access controls, checksum declarations and provider keys. Recover private report/document objects from approved storage backups and verify ownership and checksum before access. Cloudinary raster mirrors retain original/source declarations where designed; PDFs remain private. Do not rerun wholesale migration or expose private originals to work around a failed mirror. Use the existing provider-aware delete/reconciliation tools and restricted evidence.

## Operations processor recovery

Restart/redeploy the existing repository-backed `Dockerfile.operations` service at the web SHA. Its allowed jobs remain webhook application, verified payment consumption and notification delivery. Leases, durable receipts and idempotency control retries; never reset a receipt or mark an unknown provider result successful. Verify `/health`, current heartbeat and retry/reconciliation counts. Do not activate subscription, promoter, advertising, payout or retention jobs during recovery.

## Prepared incident triage and observability

Production execution of these checks requires the infrastructure/operator authorization recorded in the final external-actions ledger. Source diagnostics are prepared here; no production monitor, alert integration or processor was enabled.

| Symptom / actual source signal | Safe first action and desk | Preserved invariant / responsible role |
|---|---|---|
| Web `/api/ready` reports unreachable database or disconnected Redis | Retain status/time and redacted reason codes, confirm provider health through the approved operator path. Database readiness is bounded at 1500ms; Redis connect/command limits are 3000/2000ms | Infrastructure restores connectivity; no default production DB, URL/credential logging or in-memory security bypass |
| Operations `/health` is 503 or `production_processor_heartbeat` is unhealthy/stale | Compare three approved processor names, heartbeat `releaseSha`, last cycle timestamp and masked counts. The source returns unhealthy after 420 seconds without a healthy cycle; a failed job or nonzero retries also prevents healthy status | Infrastructure/on-call; retain original service identity and exact source parity before approved restart |
| `production_processors.heartbeat_failed` / `DATABASE_UNAVAILABLE` | Retain safe category/time, diagnose database availability, retain durable inbox and operation receipts | Infrastructure; never report a failed heartbeat as successful or delete run history |
| Lease contention versus `PROCESSOR_LEASE_LOST` | A peer lease may be legitimate; inspect exact partition/run/expiry in restricted operator tooling. Expired/reclaimed/completed runs cannot be renewed or rewritten as successful. Use normal canonical reclamation after expiry | Infrastructure; do not reset a lease, rerun a completed operation or broaden the approved scheduler list |
| Payment inbox/event unknown outcome or reconciliation | Use `/admin/payment-reconciliation` with actual permission and finance evidence. Reapply only replay-safe inbox/consumer work through its existing receipts; provider verification is separate from signing | Finance/payments; one financial success effect, no second charge or manual mark-paid |
| Refund/provider pending, unknown or failed / held funds | Use `/admin/refund-reconciliation` and the original-method provider contract. Preserve funding reserves until definitive reviewed outcome | Finance; no bank-detail form, forced success or refund above verified remaining captured money |
| Store/driver earning or withdrawal exception | Use `/admin/store-earning-reconciliation`, `/admin/driver-earning-reconciliation`, `/admin/withdrawal-reconciliation`; compare canonical amount/source/allocation receipts | Finance; no available unpaid earning, duplicate reversal, arbitrary journal or lost reserve |
| Notification delivery failure / required event awaiting governance | Use `/admin/notifications/deliveries` and `/admin/notifications/reconciliation`. Inspect reason/state and approved recipient/template/route versions; respect preferences/suppression/current verified contact before retry | Messaging + independent approver; encrypted secrets/private destination values stay restricted; no console output treated as live delivery |
| COD shortage, cash failure or pending bank receipt | Use the existing COD reconciliation action with an independent bank-receipt reviewer. Retain collection/deposit/custody and distinct suspense receipts | Finance/logistics; do not manufacture physical cash, forgive via an unauthorized account or bypass the digital-deposit prerequisite |
| Private raster QUARANTINED / provider cleanup failure | Use existing provider-aware cleanup on the exact owned quarantined object after storage recovers; retain checksum and denial audit | Media/security; do not make a failed or removed object READY or expose storage keys |

The domain reconciliation desks are the durable exception path; this task does not introduce or activate an independent dead-letter queue. Configure actual alert destinations, recipients, escalation windows and retention through approved infrastructure governance. Review the real source failure/lease/retry evidence before enabling any automatic operator action. Unknown provider outcomes and protected-row differences require finance/data-owner decisions.
