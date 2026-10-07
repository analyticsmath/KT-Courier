# Recovery, rollback and disposable restore proof

## Current proof status

`npm run recovery:drill` was attempted. Docker's server readiness timed out, so dump/restore and historical-upgrade proof are NOT_RUN. This is an engineering/infrastructure release blocker. No production dump, restore, reset or seed was performed.

## Reproducible disposable drill

Run on a host with a healthy Docker engine:

```powershell
npm ci
npx prisma generate
npm run recovery:drill
```

`scripts/recovery-drill.mjs` constructs a unique `kt-couriers-recovery-*` Compose project and its own loopback database URL. It ignores a caller-supplied database URL. It deploys current migrations into `kt_recovery_source_test`, inserts an explicitly disposable user and balanced opening journal with two accounts and two entries, runs `pg_dump --format=custom`, creates `kt_recovery_restored_test`, and runs `pg_restore --exit-on-error --no-owner` into that empty database. It checks `prisma migrate status`, representative row preservation, incomplete migrations, source/restore fixture counts and full-row hashes, and the existing complete ledger invariant script. It separately applies the earliest checked-in baseline to `kt_recovery_historical_test`, inserts the representative user, resolves that baseline, applies current incremental migrations and checks row preservation. The report is `output/production-closure/recovery.json`. Cleanup removes only the unique disposable project/volumes. These commands are prepared but have not passed execution on this host.

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
