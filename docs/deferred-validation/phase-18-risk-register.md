# Phase 18 deferred validation risk register

| Area | Deferred proof |
| --- | --- |
| Migration | Clean bootstrap and deployment |
| Prisma | Generation, typecheck and drift |
| Taxonomy | Live cycle and path triggers |
| Product schemas | JSON validation and versioning |
| Variants | Concurrent fingerprint uniqueness |
| Identifiers | GTIN correctness and duplicate races |
| Prices | Effective-period and activation concurrency |
| Inventory | Movement locking and projections |
| Imports | Large-file and row transaction behavior |
| Moderation | Permission and publication races |
| Media provider | No production object-storage provider has been selected; production adapter remains locked |
| Media scanning | Signature/container/privacy inspection exists, but malware/content scanning and full decoder proof remain deferred |
| Media metadata | Known EXIF/XMP/text metadata is rejected; transformation and broader metadata fixtures need live validation |
| Media delivery | Public delivery is source-locked; cache, disposition and publication behavior need PostgreSQL/browser proof |
| Media concurrency | Concurrent completion, archive/attachment races and stored-byte rollback need integration proof |
| Media UX | Progress, retry, mobile/keyboard ordering, alt text, variants and quarantine need browser validation |
| Accessibility | Full WCAG browser validation |
| Search readiness | Publication snapshot consistency |
| Marketplace | Phase 19–21 compatibility |
| Production lock | Runtime fail-closed behavior |

Carried Phase 10–17 risks remain open: clean migration chain/drift, payment/refund/commission/earning transaction isolation, webhook/reconciliation evidence, ledger immutability, release/reversal concurrency, permission seed application, safe admin rendering, and disposable integration-environment isolation. Phase 18 does not resolve or weaken those boundaries.

Additional review items: selection/configuration of the reviewed media storage provider and malware/content scanner remains an infrastructure decision; legal classification requires reviewed production taxonomy; variable-weight checkout semantics belong to Phase 20; legacy cart/order/advertising references remain on legacy products until their owning phases migrate them.
