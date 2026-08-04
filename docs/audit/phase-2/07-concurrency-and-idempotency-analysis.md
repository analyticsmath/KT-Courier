# 07 — Concurrency and Idempotency Analysis

## Overview

This document analyzes race conditions, concurrency safeguards, idempotency controls, and transaction boundaries across Cart and Checkout operations.

## Race Condition & Conflict Matrix

| Concurrency Scenario | Potential Race / Hazard | Authority & Resolution Mechanism | Expected Behavior / Error Code | Evidence Label |
| --- | --- | --- | --- | --- |
| Concurrent cart updates (Two browser tabs) | Stale cart state overwriting concurrent line additions | Optimistic concurrency via `cart.version`; database row lock during transaction | Loser receives `CART_VERSION_CONFLICT` and must refresh cart state | `BEHAVIORAL_TEST` |
| Duplicate operation submission (Network retry) | Duplicate line addition or double clear | Idempotent receipt lookup by `(cartId, operationId)`; hash match verification | Replays previous operation result with `replayed: true` | `BEHAVIORAL_TEST` |
| Changed-request operation replay | Reusing `operationId` with different `requestHash` | Operation receipt validation in `replayOrConflict()` | Throws `CART_OPERATION_CONFLICT` | `BEHAVIORAL_TEST` |
| Concurrent guest cart claim & merge | Two requests trying to claim the same guest cart | `lockCartByOwner(guestOwner, { includeMerged: true })` inside database transaction | First claim succeeds; second claim gets existing receipt or `CART_MUTATION_NOT_ALLOWED` | `BEHAVIORAL_TEST` |
| Cross-owner cart mutation | Attacker attempting to modify another user's cart | `sameOwner()` assertion checking `userId` or `guestTokenHash` | Throws `CART_ACCESS_DENIED` | `BEHAVIORAL_TEST` |
| Stale offer/price during cart claim | Item price changed or unpublished since added to guest cart | Server-side `revalidate()` callback during claim execution | Invalid item produces structured `CART_LINE_INVALID` conflict | `BEHAVIORAL_TEST` |
| Final inventory unit reservation | Two checkouts reserving the last inventory unit | Database row lock (`FOR UPDATE`) on inventory balance table | Winner reserves unit; loser receives inventory reservation conflict | `STATIC_EVIDENCE`, `DECLARED_POLICY` |
| Duplicate payment provider confirmation | PayFast sending duplicate ITN webhooks for same payment | Transactional lookup on `PaymentAttempt` and `MarketplaceStoreOrder` uniqueness | Idempotently returns existing order finalization receipt without double-creating orders | `STATIC_EVIDENCE`, `DECLARED_POLICY` |

## Idempotency Controls

1. **Operation Identifiers**: Every cart and checkout mutation requires a client-generated UUID `operationId`.
2. **Request Hashes**: Mutation body parameters are hashed (`requestHash`) to detect parameter tampering on retried operation IDs.
3. **Receipt Storage**: `MarketplaceCartOperation` persists `(cartId, operationId, requestHash, response, type)`.
4. **Operation Receipt Typing**: Receipts record exact mutation types (`ADD_LINE`, `UPDATE_QUANTITY`, `REPLACE_MODIFIERS`, `REMOVE_LINE`, `CLEAR`, `CLAIM`, `MERGE`).
