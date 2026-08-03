# Catalog publication

Publication snapshots are immutable internal JSON documents containing stable product/variant/offer/store references, product-type version, category path, descriptive facts, identifiers, attributes/options, exact VAT-inclusive price evidence, availability, public media, compliance, and a content hash.

Snapshots exclude user/account IDs, contact details, moderation-private notes, operation IDs, and request hashes. Compliance documents are not consumer media. Only `PUBLISHED` snapshots may be returned by the internal Phase 19/20 query service.

Before Phase 26.5 all rebuilt snapshots are `BLOCKED`; publication requests throw `CONSOLIDATED_VALIDATION_NOT_APPROVED`.

