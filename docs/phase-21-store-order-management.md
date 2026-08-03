# Phase 21: Store Order Management

Phase 21 turns each paid Phase 20 `MarketplaceStoreOrder` into a bounded store operation. It freezes an active operational policy and checkout evidence, then supports review, line resolution, customer-authorised substitution, preparation, one courier-order bridge, and verified store-to-driver handoff. The existing courier `Order` still owns dispatch, pickup progression and customer delivery.

Production operations remain source-locked until Phase 26.5. No Phase 22 behaviour, second Payment, direct driver assignment, balance mutation or mark-delivered endpoint was introduced.
