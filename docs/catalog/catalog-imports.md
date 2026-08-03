# Catalog imports

Imports accept UTF-8 CSV metadata only: template v1, maximum 5 MB and 5,000 rows. Cells reject spreadsheet-formula prefixes, HTML, oversized content, and remote URLs. Raw files are not copied into audit metadata.

Jobs are store-owned and idempotent by `(storeId, operationId)` plus request hash. Validation records normalized row payloads and error-code arrays. A clean dry-run is required before apply. Apply is draft-only and cannot create active products, offers, price versions, inventory, or publication.

