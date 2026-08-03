# Canonical products and store offers

Canonical products carry reviewed title, descriptions, brand, product type/version, category, condition, attributes, compliance, quality, moderation, and publication state. Offers carry store SKU, optional merchant additions, fulfilment/selling-unit policy, inventory mode, current price reference, and store ownership.

Merchant fields cannot alter product type, brand, identifiers, category, condition, dimensions, or compliance. A store-private product can only be edited or offered by its source store. Global canonical products may receive multiple store offers but their common facts remain platform-controlled. Unique `(storeId, variantId)` and `(storeId, storeSku)` constraints prevent duplicate active identities.

Offer approval is a reviewed action, not a compliance override. Active/public state remains locked.

