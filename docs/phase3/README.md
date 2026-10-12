# KT Couriers Phase 3 evidence register

**Current state: ENGINEERING_INCOMPLETE, NO_GO.** The tested application candidate is `main` commit `f30d2feb2172c32c709b4f0e173595eabe138d00` (tree `09dbf37cae3ba22b7a9468e6a69b473f6dbbb92e`). Exact-source CI [38246653617](https://github.com/analyticsmath/KT-Courier/actions/runs/38246653617) passed all 10 applicable jobs; 18 conditional jobs were skipped and none failed. Manual certification [38247409666](https://github.com/analyticsmath/KT-Courier/actions/runs/38247409666) passed all 24 component jobs. The terminal gate checker returned `NOT_READY` because the nine launch gates remain unresolved. Its browser selections passed directed 43/43, finance 3/3, Paystack 9/9, full Chromium 140/140 and canonical PostgreSQL 41/41, with zero test failures, skips or flakes. The earlier B04 canonical run had one failed driver-chat visibility assertion (40/41); f30 adds POST-response and refreshed-history diagnostics, and current canonical passed. The full test inventory and hash-verified receipts are bound to f30. No staging resources or production changes were made.

## Source, infrastructure and routing

- [Baseline and source authority](BASELINE_AND_SOURCE_AUTHORITY.md)
- [Infrastructure inventory](INFRASTRUCTURE_INVENTORY.md) and [redacted control-plane receipt](infra-baseline.json)
- [Vercel/Railway routing isolation proof](VERCEL_RAILWAY_ROUTING_PROOF.md)
- [Railway staged patch disposition](RAILWAY_STAGED_PATCH_DECISION.md)
- [Staging preflight and acceptance boundary](STAGING_ISOLATION_AND_ACCEPTANCE.md)
- [Production deployment and rollback](PRODUCTION_DEPLOYMENT_AND_ROLLBACK.md)

## Product and operations evidence

- [Customer journeys](CUSTOMER_JOURNEYS_MATRIX.md)
- [Store, employee and catalog acceptance](STORE_EMPLOYEE_AND_CATALOG_ACCEPTANCE.md)
- [Driver, dispatch, POD and COD acceptance](DRIVER_DISPATCH_POD_COD_ACCEPTANCE.md)
- [Finance and provider certification](FINANCE_AND_PROVIDER_CERTIFICATION.md), with [financial invariants](FINANCIAL_INVARIANTS.json)
- [Notification and message recipient matrix](NOTIFICATION_AND_MESSAGE_RECIPIENT_MATRIX.md)
- [Media classification and lifecycle](MEDIA_ASSET_CLASSIFICATION_AND_LIFECYCLE.md)

## Security, quality and recovery

- [Security and access audit](SECURITY_AND_ACCESS_AUDIT.md)
- [POPIA, CPA and legal approvals](POPIA_CPA_LEGAL_APPROVAL_REGISTER.md)
- [Visual/accessibility acceptance](VISUAL_ACCESSIBILITY_ACCEPTANCE.md) and [physical device acceptance](DEVICE_ACCEPTANCE.md)
- [Performance report](PERFORMANCE_REPORT.md)
- [Recovery and RTO/RPO](RECOVERY_AND_RTO_RPO.md)
- [Dependency security disposition](DEPENDENCY_SECURITY_DISPOSITION.md)
- [Required test selections and deferrals](REQUIRED_TEST_SELECTIONS_AND_DEFERRALS.md)

## Gate decisions and handoff

- [Engineering versus launch gate reconciliation](ENGINEERING_GATE_RECONCILIATION.md)
- [Operator signoff register](OPERATOR_SIGNOFF_REGISTER.md)
- [GO/NO-GO](GO_NO_GO.md)
- [Final Phase 3 closure](FINAL_PHASE3_CLOSURE.md)
- `final-certification.json` records the exact-source test inventory, nine open/blocked launch gates and NO_GO decision.
- `receipts/` contains 32 compact exact-source receipts: 31 test-selection receipts and one normalized disposable-recovery artifact receipt. Large browser artifacts stay in GitHub Actions storage.

No status in this dossier substitutes for the independent operator, client, finance, privacy, communications, product, device or release approvals named in the linked registers.
