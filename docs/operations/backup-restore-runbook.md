# KT-Courier — Database Backup & Disaster Recovery Runbook

## 1. Backup Policy & Commands

### 1.1 Automated Snapshot Schedule
- **Full Database Dump**: Daily at 02:00 UTC with 30-day retention.
- **WAL / Point-in-Time Recovery**: Continuous WAL archiving for 7-day RPO < 5 minutes.
- **Storage Target**: Encrypted offsite S3-compatible cloud storage bucket.

### 1.2 Manual Pre-Deployment Backup Command
Run before applying any database migration or major deployment:

```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump \
  --dbname="${DATABASE_URL}" \
  --format=custom \
  --file="backup_kt_courier_${TIMESTAMP}.dump" \
  --verbose \
  --no-owner \
  --no-privileges
```

---

## 2. Restore Procedure

### 2.1 Restore into Isolated Target (Recommended for Verification)
1. Provision isolated PostgreSQL test database instance.
2. Restore the backup:
   ```bash
   pg_restore \
     --dbname="${RESTORE_TARGET_DATABASE_URL}" \
     --clean \
     --if-exists \
     --no-owner \
     --no-privileges \
     --verbose \
     "backup_kt_courier_${TIMESTAMP}.dump"
   ```
3. Run post-restore verification:
   ```bash
   node scripts/verify-database-schema.mjs
   npm run db:verify:ledger
   npm run db:verify:payments
   ```

### 2.2 Production Disaster Recovery (RTO / RPO Target)
- **Target RPO**: < 15 minutes.
- **Target RTO**: < 60 minutes.
- After restore, execute schema migration check: `npx prisma migrate deploy`.
- Validate financial ledger invariant checks before opening traffic.
