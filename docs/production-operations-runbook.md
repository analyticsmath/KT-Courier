# Production Operations Runbook — Phase 5 Operational Governance

## 1. Executive Summary

This runbook documents operational procedures, processor execution rules, cross-domain reconciliation protocols, data retention hold management, and incident command workflows for KT Couriers Phase 5 Operational Governance.

---

## 2. Processor Inventory & Operational Cron Schedules

All background tasks are registered in `lib/processors/processor-registry.ts` and managed by the lease authority (`lib/processors/lease-authority.ts`).

| Processor Name | Classification | Default Batch | Required Permission | Internal Cron Endpoint |
| :--- | :--- | :--- | :--- | :--- |
| `consume-verified-payment-events` | `MUTATING_RECOVERY` | 100 | `payments.reconcile` | `POST /api/jobs/consume-verified-payment-events` |
| `finalize-paid-marketplace-checkouts` | `MUTATING_RECOVERY` | 50 | `marketplace_checkout.reconcile` | `POST /api/jobs/finalize-paid-marketplace-checkouts` |
| `process-subscription-renewals` | `MUTATING_RECOVERY` | 50 | `subscription_contracts.reconcile` | `POST /api/jobs/process-subscription-renewals` |
| `scan-refund-reconciliation` | `READ_ONLY_AUDIT` | 100 | `refunds.reconcile` | `POST /api/jobs/scan-refund-reconciliation` |
| `scan-withdrawal-reconciliation` | `READ_ONLY_AUDIT` | 100 | `withdrawals.reconcile` | `POST /api/jobs/scan-withdrawal-reconciliation` |
| `release-mature-store-earnings` | `MUTATING_RECOVERY` | 100 | `store_earnings.reconcile` | `POST /api/jobs/release-mature-store-earnings` |
| `release-mature-driver-earnings` | `MUTATING_RECOVERY` | 100 | `driver_earnings.reconcile` | `POST /api/jobs/release-mature-driver-earnings` |
| `process-promoter-qualifications` | `MUTATING_RECOVERY` | 50 | `promoters.read` | `POST /api/jobs/process-promoter-qualifications` |
| `end-expired-promotions` | `MUTATING_RECOVERY` | 100 | `promotions.manage` | `POST /api/jobs/end-expired-promotions` |
| `process-valid-click-charges` | `MUTATING_RECOVERY` | 200 | `advertising.manage` | `POST /api/jobs/process-valid-click-charges` |
| `deliver-notifications` | `MUTATING_RECOVERY` | 100 | `notifications.read` | `POST /api/jobs/deliver-notifications` |
| `deliver-developer-webhooks` | `MUTATING_RECOVERY` | 100 | `developer_application.read` | `POST /api/jobs/deliver-developer-webhooks` |
| `generate-report-jobs` | `MUTATING_RECOVERY` | 10 | `reports.read` | `POST /api/jobs/generate-report-jobs` |
| `expire-report-artifacts` | `CLEANUP_DESTRUCTION` | 100 | `reports.read` | `POST /api/jobs/expire-report-artifacts` |
| `process-privacy-requests` | `MUTATING_RECOVERY` | 10 | `privacy_requests.read` | `POST /api/jobs/process-privacy-requests` |
| `process-data-retention` | `CLEANUP_DESTRUCTION` | 200 | `data_retention.manage` | `POST /api/jobs/process-data-retention` |
| `expire-developer-api-credentials` | `MUTATING_RECOVERY` | 50 | `developer_application.manage` | `POST /api/jobs/expire-developer-api-credentials` |
| `scan-payment-reconciliation` | `READ_ONLY_AUDIT` | 100 | `payment_reconciliation.read` | `POST /api/jobs/scan-payment-reconciliation` |

### Internal Cron Authentication

Internal cron triggers require a Bearer token matching the `CRON_SECRET` environment variable:

```bash
curl -X POST https://api.ktcouriers.co.za/api/jobs/process-data-retention \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"mode": "DRY_RUN", "batchSize": 100}'
```

---

## 3. Unified Cross-Domain Reconciliation Protocol

Operators access reconciliation cases via `/admin/reconciliation`.

1. **Inspection:** Select domain filter (e.g., `payments`, `refunds`, `withdrawals`).
2. **Permission Scoping:** Operators only see cases for domains where they possess read permissions (`payment_reconciliation.read`, `refunds.reconcile`, etc.).
3. **Recovery Execution:** Select case, inspect evidence timeline, choose an authorized recovery action (e.g., `MARK_RECONCILED`), provide reason code, and execute.
4. **Bulk Recovery:** Select up to 50 cases for bulk retry/reconciliation with attributable operation ID logging.

---

## 4. Data Retention & Hold Evaluation Procedures

1. **Policy Execution:** `process-data-retention` evaluates 8 data categories (`EXPIRED_SESSIONS`, `EXPIRED_EMAIL_OTPS`, `EXPIRED_DELIVERY_OTPS`, `EXPIRED_PASSWORD_RESET_TOKENS`, `EXPIRED_REPORT_ARTIFACTS`, `PRECISE_DRIVER_LOCATIONS`, `NOTIFICATION_PROVIDER_PAYLOADS`, `SECURITY_NETWORK_METADATA`).
2. **Hold Verification:** Before any record is deleted or minimized, `evaluateRetentionHolds` checks for active `RetentionHold` records on the subject (`User`, `Order`, `Driver`, `Store`).
3. **Active Hold Action:** If a hold is present, deletion is overridden and logged.
4. **Hold Release:** Active holds are released via `releaseRetentionHold` with mandatory actor attribution.

---

## 5. Operational Incident Command

1. **Declaration:** Operators declare incidents via `/admin/incidents` with severity (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), category, and affected capabilities.
2. **Timeline:** All status transitions (`INVESTIGATING`, `CONTAINED`, `MITIGATED`, `RESOLVED`, `POST_MORTEM_COMPLETED`) append immutable timeline entries.
3. **Commander Assignment:** Assign incident commanders and attach operational notes during state transitions.

---

## 6. Legal Document & Privacy Request Governance

1. **Legal Documents (`/admin/legal-documents`):** Author draft legal document versions, compute SHA-256 content hashes on draft text, and publish versions. Published versions are immutable.
2. **Privacy Requests (`/admin/privacy-requests`):** Track Subject Access and Erasure requests with identity verification status checks and active hold evaluation summaries.
