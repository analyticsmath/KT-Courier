# Storefront projections

The projection service checks immutable snapshot status/version, active product,
variant, offer, price, store, taxonomy and READY privacy-inspected media before
writing. Replays retain the public document reference; superseded offer evidence
is withdrawn, not deleted. Projection history, event-processing attempts,
cache-invalidation intent and reconciliation cases retain audit evidence.

