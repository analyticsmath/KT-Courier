# Store, employee and catalog acceptance

The source has owner-scoped store actions, employee membership and permission checks, catalog drafts, inventory, media, publication snapshots and store order workflows. Relevant disposable PostgreSQL selections include `test:integration:catalog`, `test:integration:store-orders`, the employee/catalog tests in `test:integration:closure`, and the store order and catalog browser cases listed in `.github/workflows/production-certification.yml`.

Phase 3 added durable status notification intake for store order events. Notifications resolve current store ownership from the canonical store row; employee-supplied recipients and client facts cannot select the destination. New templates and routes remain drafts until an independent communications owner reviews and activates them. Exact-source CI [38246653617](https://github.com/analyticsmath/KT-Courier/actions/runs/38246653617) passed its 10 applicable jobs (18 conditional jobs skipped); all 24 component jobs in [manual certification](https://github.com/analyticsmath/KT-Courier/actions/runs/38247409666) passed. The disposable closure run had 179 passing tests on the pre-commit working tree; it is not represented as an exact-SHA receipt.

No human store-owner acceptance, live catalog moderation review, real upload provider lifecycle test, or production data inspection is claimed here.
