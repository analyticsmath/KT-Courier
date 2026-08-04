# 06 — Cart and Checkout State Machines

## Overview

This document specifies the formal state transitions, allowed mutations, terminal states, and invariant guards for the Marketplace Cart and Marketplace Checkout aggregates.

## Cart State Machine

```mermaid
stateDiagram-v2
    [*] --> GUEST_ACTIVE: Create Guest Cart (Cookie Secret Hash)
    [*] --> CUSTOMER_ACTIVE: Create Customer Cart (User ID)
    
    GUEST_ACTIVE --> GUEST_ACTIVE: ADD_LINE / UPDATE_QUANTITY / REPLACE_MODIFIERS / REMOVE_LINE / CLEAR
    CUSTOMER_ACTIVE --> CUSTOMER_ACTIVE: ADD_LINE / UPDATE_QUANTITY / REPLACE_MODIFIERS / REMOVE_LINE / CLEAR
    
    GUEST_ACTIVE --> CUSTOMER_ACTIVE: CLAIM (No existing Customer Cart)
    GUEST_ACTIVE --> MERGED: CLAIM / MERGE (Merged into existing Customer Cart)
    
    GUEST_ACTIVE --> EXPIRED: TTL Expiry (30 days inactivity)
    CUSTOMER_ACTIVE --> CHECKOUT_LOCKED: Reservation Created
    
    CHECKOUT_LOCKED --> CUSTOMER_ACTIVE: Reservation Expired / Cancelled
    CHECKOUT_LOCKED --> CONVERTED: Paid Order Finalized
    
    MERGED --> [*]: Terminal State
    EXPIRED --> [*]: Terminal State
    CONVERTED --> [*]: Terminal State
```

### Cart Transitions

| Source State | Target State | Trigger Operation | Mutation Allowed? | Invariants Enforced |
| --- | --- | --- | --- | --- |
| `ACTIVE` (Guest/Customer) | `ACTIVE` | `ADD_LINE`, `UPDATE_QUANTITY`, `REPLACE_MODIFIERS`, `REMOVE_LINE`, `CLEAR` | Yes | Owner matching, max store limit (3), max line limit (50), quantity bounds (1-99), version increment |
| `GUEST_ACTIVE` | `CUSTOMER_ACTIVE` | `CLAIM` | Yes | Guest secret token hash verification, server-side line revalidation, owner updated to customer |
| `GUEST_ACTIVE` | `MERGED` | `CLAIM` / `MERGE` | No (Guest cart locked) | Atomic single-transaction merge, duplicate lines quantity capped at 99, receipt recorded as `MERGE` |
| `CUSTOMER_ACTIVE` | `CHECKOUT_LOCKED` | `RESERVATION` | No | Inventory reservation bound, cart locked against direct mutations during checkout review |
| `CHECKOUT_LOCKED` | `CUSTOMER_ACTIVE` | Expiry / Release | Yes | Unlocks cart when reservation expires or is abandoned |
| `CHECKOUT_LOCKED` | `CONVERTED` | Order Finalization | No (Terminal) | Marks cart converted upon verified payment confirmation |

## Checkout State Machine

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Cart Selected
    DRAFT --> QUOTED: Delivery Address & Quote Calculated
    QUOTED --> REVIEWED: Customer Acknowledged Terms & Prices
    REVIEWED --> RESERVED: Inventory & Promotion Reserved
    RESERVED --> PAYMENT_PREPARED: PayFast Checkout Session Created
    PAYMENT_PREPARED --> FINALIZED: Authoritative Provider ITN Confirmed
    PAYMENT_PREPARED --> EXPIRED: Payment Window Expired
    RESERVED --> EXPIRED: Reservation Expired
    FINALIZED --> [*]: Terminal State (Immutable Store Orders Created)
    EXPIRED --> [*]: Terminal State
```

### Checkout Transitions

| Source State | Target State | Operation | Invariants & Evidence |
| --- | --- | --- | --- |
| `DRAFT` | `QUOTED` | `DELIVERY_QUOTE` | Validates fulfillment address within courier coverage bounds |
| `QUOTED` | `REVIEWED` | `CHECKOUT_REVIEW` | Captures itemized subtotal, delivery fee, promotion discount, and customer acknowledgements |
| `REVIEWED` | `RESERVED` | `RESERVATION` | Holds inventory balances and promotion allocations; assigns reservation expiry timer |
| `RESERVED` | `PAYMENT_PREPARED` | `PAYMENT` | Generates deterministic PayFast payload & ITN callback signature |
| `PAYMENT_PREPARED` | `FINALIZED` | Verified Provider ITN | Verifies payment amount & signature; creates immutable `MarketplaceStoreOrder` records |
| Any non-finalized | `EXPIRED` | Timeout / Cancellation | Releases reserved inventory and promotion allocations |
