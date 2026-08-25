# KT-Courier — Rollback Runbook

## 1. Application vs Database Rollback

### Application Rollback
- Application rollbacks are non-destructive and should be executed immediately if a high severity defect or regression is detected post-deployment.
- Switch the traffic router / container image tag back to the previous stable release artifact.
- Re-evaluate `/api/health` and `/api/ready`.

### Database Schema Rollback Policy
- **Never execute automatic down-migrations against a production database.**
- Database migrations in KT-Courier are strictly forward-compatible:
  - Additive changes (new tables, nullable columns) do not break previous application versions.
  - Destructive schema rollbacks (`DROP COLUMN`, `DROP TABLE`) risk permanent data loss.
- If a migration error occurs:
  1. Freeze application writes by toggling `CHECKOUT_PUBLIC_ENABLED="false"`.
  2. Perform forward fix migration if schema is functional.
  3. If catastrophic schema corruption occurs, restore from pre-deployment snapshot into an isolated recovery instance before promoting.

---

## 2. Step-by-Step Application Rollback

1. **Identify Rollback Target**: Retrieve the last known healthy deployment tag (e.g. `v1.0.0`).
2. **Re-deploy Previous Image**:
   ```bash
   docker compose pull app worker scheduler
   docker compose up -d app worker scheduler
   ```
3. **Verify Liveness & Readiness**:
   ```bash
   curl -f http://127.0.0.1:3000/api/health
   curl -f http://127.0.0.1:3000/api/ready
   ```
4. **Reconcile In-Flight Work**:
   - Check `PaymentVerifiedEventConsumerReceipt` for any `PROCESSING` locks older than 5 minutes.
   - Run manual reconciliation scan: `npm run payments:reconciliation:scan -- --apply`.
