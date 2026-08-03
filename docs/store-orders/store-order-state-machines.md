# Store-order state machines

Acceptance (`PENDING_STORE_REVIEW` → review/customer action → `ACCEPTED` or terminal rejection/timeout), preparation, resolution, financial resolution and delivery bridge are independent dimensions. `derivedStatus` is computed from them by `deriveStoreOrderStatus`; routes have no generic status setter.
