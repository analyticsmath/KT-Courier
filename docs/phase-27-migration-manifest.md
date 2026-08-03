# Phase 27 migration manifest

| Field | Verified evidence |
|---|---|
| Exact preceding migration | `20260722000000_phase26_recruitment` |
| Repository-wide migration count | `24` directories under `prisma/migrations` |
| Phase 27 migration folder count | `1` |
| Phase 27 migration path | `prisma/migrations/20260726000000_phase27_notifications/migration.sql` |
| Initial foundation SHA-256 | `2C02A28B544ADA495FA363353A863D2ECA993F62622D9D125FD3141DD8CC11FE` |
| Previously reported SHA-256 | `0812D49D90CD0A9017FD510EC43DD7B083EC3224E597E8380D55F42F6A1EA30C` |
| Final SHA-256 | `78DB687E9FA72E5476F1FB275C00908DD88433CA148835E10A38519828B49F90` |
| Why the Phase 27 SQL changed | The final additive SQL was aligned with the accepted frozen-message design: `NotificationEventRouteVersion.templateVersionId`, `NotificationMessage.routeVersionId`, and the encrypted `NotificationSecurePayload` table are represented by the one Phase 27 migration. No prior migration was reordered or rewritten. |
| Final SQL schema additions | Phase 27 enums plus additive category, versioned template/variable, route/route-version, recipient-policy, source-receipt, logical-message, recipient, delivery/attempt/receipt, inbox, preference, consent, endpoint, suppression, digest, audit, reconciliation, event-intent, and secure-payload tables and indexes. |
| Applied by this worktree | No. This verification task did not run `prisma migrate deploy`, `prisma migrate reset`, or any data migration command. Production database state was intentionally not queried. |
| Phase 26 or earlier migration changed | No. The repository migration inventory shows the Phase 26 folder immediately preceding the single Phase 27 folder; no Phase 26-or-earlier migration was edited by this task. |
| Live notification data inserted | No. The migration is DDL-only. |
| Provider credentials inserted | No. |
| Templates inserted | No. |
| Consent records inserted | No. |
| Endpoints inserted | No. |

The historical `Notification` table and its legacy enum remain untouched. This worktree has exactly one Phase 27 migration folder and no seed/data insertion in the Phase 27 SQL.
