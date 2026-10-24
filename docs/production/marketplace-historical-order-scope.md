# Historical marketplace orders and the rebuilt delivery workflow

On 25 October 2026 the project owner clarified that previous-site data is retained for historical reference. It must not be replayed as newly purchased goods, trigger new deliveries or settlements, or prevent new orders using the rebuilt system. Records must remain available; no cancellation, refund, deletion or invented delivery evidence is authorized by this separation.

## Source identification

The currently blocked `MSO-2026-000…` format also exists in `scripts/seed-full-demo.ts`. This is a historical simulation, distinct from the previous-site import. The catalog importer protects order/payment tables. A store's imported origin does not make its future orders historical.

The additive migration classifies only the exact historical simulation signature: bounded references, linked checkout and payment, matching immutable payment idempotency/hash and provider-attempt references, the source simulation window, and no started operational workflow. Completed migration mappings qualify only when they explicitly designate the target order `HISTORICAL_READ_ONLY`. Missing pickup/quote data, age, provider or a reference prefix alone never qualifies.

## Runtime behavior

`MarketplaceStoreOrder.operationalScope` defaults to `LIVE`. Historical rows carry `historySourceReference`; database constraints require a source and prohibit later origin changes. The migration preserves original statuses, reconciliation cases, financial amounts, journals, payments and all relationships.

Automatic initialization, its readiness reconciliation probe, merchant operational queues and automatic settlements select `LIVE` orders. Canonical operational and settlement commands reject historical records. Historical cases remain visible with an explicit read-only label. New orders with missing evidence still enter the existing reconciliation workflow and block readiness.

Future historical order imports must supply explicit historical scope and source provenance when inserting the order; importing a catalog or store never exempts that store's new sales. This policy does not approve commission/COD terms, payout or settlement evidence, or certify a physical delivery.

## Verification

The regression test executes the actual migration in isolated PostgreSQL via PGlite. It checks exact seed classification; nonmatching, Paystack, unapproved, catalog-only and already-started records remaining live; qualified historical migration mappings; unchanged original order/payment data; immutable origin; required historical provenance; and live-by-default new orders. Existing lifecycle tests retain native missing-evidence escalation and settlement protections.
