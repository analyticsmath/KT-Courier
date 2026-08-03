# Phase 29 Operational Scripts & CLI Tools

## Scripts Inventory

| Script Path | Purpose |
| --- | --- |
| `scripts/phase29-reporting-preflight.mjs` | Audits report definitions, schema integrity, and directory permissions. |
| `scripts/generate-report-jobs.mjs` | Generates sample report jobs for background queue processing. |
| `scripts/retry-report-jobs.mjs` | Retries failed report jobs under retry threshold. |
| `scripts/expire-report-jobs.mjs` | Expire stale or timed-out report generation jobs. |
| `scripts/expire-report-artifacts.mjs` | Deletes expired CSV artifacts from disk and updates DB evidence. |
| `scripts/scan-report-reconciliation.mjs` | Scans reporting system for checksum errors, orphaned files, or missing jobs. |
| `scripts/verify-report-invariants.mjs` | Verifies non-negativity and row count boundaries for all projections. |
| `scripts/reporting-integration-test.mjs` | End-to-end execution of job creation, generation, signing, download, and cleanup. |

## Running Preflight Audit
```bash
node scripts/phase29-reporting-preflight.mjs
```
