# Catalog moderation

Product/offer submissions open reason-coded cases with priority and safe summaries. Review actions are explicit: approve, request changes, reject where supported, or suspend. There is no generic arbitrary-status endpoint and no hard-validation override.

Each action updates the aggregate optimistically and appends `CatalogModerationHistory`, `CatalogAuditHistory`, and a catalog event in one transaction. History is update/delete protected. Private notes are bounded and excluded from publication snapshots.

Approval is evidence of review; it does not bypass the Phase 26.5 activation lock.

