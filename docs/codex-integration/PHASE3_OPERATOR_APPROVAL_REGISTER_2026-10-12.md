# Phase 3 operator and acceptance register — 12 October 2026

No named approver or external acceptance is inferred. Set each owner and attach a dated, scope-specific record before changing a gate.

| Gate | Current status | Accountable owner | Evidence needed to close |
|---|---|---|---|
| marketplace_parcel_classification | OPEN | Client commercial owner and operations | Signed service, parcel-size, coverage-zone, effective-date, and exception policy; exact approved rates; integrated checkout and dispatch proof. |
| notification_required_domains | OPEN | Client communications owner and product QA | Complete event/recipient/channel/preferences/suppression matrix; isolated provider verification; approved sender/templates and delivery evidence. |
| commercial_financial_certification | VALIDATION_BLOCKED | Client finance owner and independent finance/bank operator | Signed COD and split rules, fees/commission allocation, tax treatment, payout/refund controls, genuine provider and bank evidence. No synthetic receipt substitutes. |
| customer_vendor_driver_full_functional_acceptance | OPEN | Product owner and role-specific QA | Complete supported cross-role journeys, ownership/tenant boundaries, retries/replays, returns and exception handling; recorded client acceptance. |
| visual_acceptance | OPEN | Design/product owner and accessibility QA | Reviewed captures at 320, 390, 768 and 1440 widths, 200% zoom, keyboard/screen-reader checks, and physical-device sign-off. |
| media_full_functional_acceptance | OPEN | Media/platform owner and product QA | Isolated provider lifecycle for capture, upload, owner checks, revocation, replacement, retry and cleanup across roles/devices; no production storage writes. |
| critical_skip_closure | OPEN | Engineering QA owner | The current inventory for candidate 2cd712bbe1aa27717dc78ff732f87b9e8360cafe reports 65 files with markers and zero active release-critical placeholders. Keep OPEN until conditional release-critical selections and their actual zero-skip execution are reconciled on the final source SHA; optional inactive cases remain excluded, not passed. |
| fresh_production_protected_row_audit | VALIDATION_BLOCKED | Authorized production data operator and privacy reviewer | Approved read-only access path, scoped query plan, redacted result, protected-row invariants and independent review. No production row access by this task. |
| github_certification_and_deployment | VALIDATION_BLOCKED | Repository/release owner and Vercel/Railway operators | Independent preview isolation readback, exact-head hosted CI, safe main automation quarantine, source/deployment parity, rollback and monitoring approval. |

Additional Phase 3 owners and decisions:

- Legal/privacy: approve public terms, privacy and regulated-goods wording; confirm registered address only from an authoritative record.
- Commercial/client: resolve the conflict between explicit Express fixed fees in the October authority corpus and the inherited-code note; keep coverage zones and other unapproved commercial rules inactive.
- Infrastructure owner: review the exact Railway staged patch 9a3370a3-8d07-4ef9-9e8d-a57ff488fccb through individual controls. The safe action belongs to the owner; do not accept or blanket-discard it from this task.
- Database/operations owner: provide a production backup/restore rehearsal and RPO/RTO evidence on an isolated environment; this execution took no production backup and made no production data changes.
- Security owner: track the five high development audit reports through braces 3.0.3 in the build/lint tool chain. The production-only audit is clean; do not force an incompatible framework downgrade.

Approver names, dates, signatures, and acceptance links remain blank by design until the relevant humans provide them.
