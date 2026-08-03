# Catalog media operations

## Upload operations

Store upload intent creation requires `catalog.manage`, an active exactly-owned store, same origin, rate limiting, a strict JSON schema and an operation ID. Same actor/operation/request replays; changed input conflicts. Intents expire after 15 minutes.

The application content endpoint accepts `application/octet-stream` only, requires `X-Catalog-Operation-Id`, and reads no more than 8 MiB. Completion is a separate idempotent JSON operation. Assets become READY only after storage confirmation and server inspection.

Lifecycle: `PENDING_UPLOAD → UPLOADED → VALIDATING → READY`. Definite validation failures become `REJECTED`; uncertain storage/scanning failures become `QUARANTINED`. READY and other eligible records may become `ARCHIVED`. Completion count is at most one.

## Review operations

Admin metadata/detail reads require `catalog_moderation.read`. Approval, quarantine and rejection use exact approve/suspend/review permissions, same-origin/rate/body protections, operation IDs and reviewed reason codes. Approval can move a quarantined asset to READY only when mandatory evidence is complete. Review never changes ownership.

## Cleanup

`scan-catalog-media-integrity.mjs` reports owner, READY evidence, checksum, reason, intent, completion, publication attachment, cross-owner, variant, primary and platform-reference inconsistencies.

`cleanup-expired-catalog-media.mjs` is dry-run by default, caps batches at 500 and reports expired intents, rejected unattached assets, orphan metadata and missing storage evidence. It never deletes attached assets or history. Execute mode is source-locked and no production storage adapter exists, so it changes nothing before Phase 26.5.
