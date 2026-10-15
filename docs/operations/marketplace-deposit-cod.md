# Marketplace deposit and cash on delivery

The first cash workflow supports one store with `COURIER_DELIVERY`. An applicable, active, approved store/service payment policy supplies the deposit split and cash ceiling. Ordinary multi-store checkout remains fully digital. Cash pickup, multi-store cash checkout and discounted cash baskets are rejected during review before a provider charge.

For a R200 order under a 50/50 policy, the immutable commercial total stays R200, Paystack receives R100, and the courier collects R100. A reviewed group payment plan binds the policy identity/version, full value and both allocations into the accepted commercial fingerprint. Changing a policy requires another review before payment; changing policy settings after purchase does not rewrite the purchase.

Verified online payment posts only the actual digital receipt. Finalization consumes the real inventory reservation and creates the marketplace order before cash receipt. Merchant review and preparation can start from the verified deposit and frozen source evidence. This does not accrue a seller or driver entitlement against another customer's held balance.

The courier bridge creates the full-value cash obligation using that same deposit receipt. Collection remains restricted to the assigned courier during delivery. Collection posts driver cash custody and customer funds held; it does not claim that the platform received a bank remittance. Drivers submit deposit evidence through the existing cash dashboard. An authorized finance actor confirms actual bank receipt through the existing reconciliation authority.

Seller settlement waits for the exact source cash obligation to be collected and reconciled, with no unresolved shortage. Both custody and bank journals must match the original COD reference, collector, accounts and amounts. Driver earning accrual uses the canonical marketplace courier bridge and delivery fee allocation, with the same cash funding requirement. The marketplace payment retains its marketplace subject; it is never rebound as a courier payment.

An unaccepted, unstarted order can be fully rejected or cancelled. The original digital deposit is refunded through the existing refund request/review/provider workflow; uncollected cash is cancelled; confirmed unhanded inventory is restored. Unaccrued commissions and earnings have no invented reversal journals. Cash baskets with stock shortages require full rejection and a new checkout for replacements, preserving the accepted cash amount. Later changes or cash refunds require finance review; automated partial cash adjustments are outside this initial workflow.

The database migration backfills historical purchases as fully digital. It protects committed payment plans, successful-payment parent binding and funded COD obligation identity. It activates no cash policy and supplies no business approval, banking instructions or production provider configuration.

Focused regression commands:

```sh
npx vitest run tests/marketplace-checkout/deposit-cod-flow.test.ts tests/services/marketplace-cod-courier-bridge.test.ts tests/services/marketplace-deposit-initialization.test.ts tests/payments/marketplace-reservation-payment.test.ts tests/driver-earnings/marketplace-funding.test.ts tests/services/marketplace-cod-cancellation.test.ts
npm run typecheck
```

The real PostgreSQL COD integration fixture must also pass in the isolated predeployment database. Unit tests do not establish that migration triggers or real transaction interleavings work.
