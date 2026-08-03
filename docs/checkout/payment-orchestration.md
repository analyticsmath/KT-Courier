# Payment orchestration

Phase 20 reuses existing Phase 10–12 `Payment`, preparation, PayFast and ITN
authority. The courier `Payment.orderId` is optional for marketplace payments;
explicit unique marketplace checkout/order bindings replace fake courier orders.
Browser return is never payment confirmation or order-finalisation authority.
