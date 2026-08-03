# Catalog inventory

Inventory locations belong to one store and are distinct from address records. One active primary location is allowed per store. Each offer has at most one catalog inventory item; tracked items may have a level per location.

For tracked stock: `onHand >= 0`, `reserved >= 0`, `reserved <= onHand`, and `available = onHand - reserved`. Phase 18 requires `reserved = 0` outside isolated future-compatible fixtures. Untracked/made-to-order availability is policy-based and has no fabricated quantity.

All numeric changes use immutable movements with actor, reason, operation ID, request hash, delta, location, and resulting stock. The service uses a serializable transaction, row lock, idempotent replay, optimistic item version, atomic level update, and event/audit write. There is no direct overwrite endpoint and no reservation/sale movement.

