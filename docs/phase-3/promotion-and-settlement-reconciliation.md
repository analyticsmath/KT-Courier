# Promotion & Settlement Accounting Reconciliation

**Phase**: Phase 3 Final Production Certification  
**Repository**: `analyticsmath/KT-Courier`  
**Domain**: Marketplace Financial Architecture, Promotional Subsidies, Multi-Store Allocation, and Seller Settlement  
**Status**: VERIFIED & RECONCILED  

---

## 1. Accounting Invariants and Check Constraints

### 1.1. Order Grand Total Equation
With forward migration [`20261111000000_marketplace_promotion_discount`](file:///d:/KT-Courier/prisma/migrations/20261111000000_marketplace_promotion_discount/migration.sql), both `MarketplaceCheckout` and `MarketplaceOrder` enforce the following strict invariant at the PostgreSQL level:

$$\text{grandTotal} = \text{merchandiseSubtotal} + \text{modifierSubtotal} + \text{deliveryFeeTotal} - \text{promotionDiscount}$$

Subject to:
- $\text{merchandiseSubtotal} \ge 0$
- $\text{modifierSubtotal} \ge 0$
- $\text{deliveryFeeTotal} \ge 0$
- $\text{promotionDiscount} \ge 0$
- $\text{grandTotal} \ge 0$
- $\text{currency} = \text{'ZAR'}$

### 1.2. Payment Split Invariant
In addition, `MarketplaceCheckout_payment_split` and `MarketplaceOrder_payment_split` guarantee that customer liabilities reconcile exactly:

$$\text{digitalRequired} + \text{cashRequired} = \text{grandTotal}$$

Where:
- $\text{cashRequired} \ge 0$
- $\text{digitalRequired} \ge 0$ (or null during initial draft before review)

---

## 2. Multi-Store Discount Cent Allocation Arithmetic

When a multi-store basket receives a promotional discount (e.g. welcome coupon or platform campaign), the discount must be apportioned across participating store groups without floating-point inaccuracies.

### 2.1. Integer Allocation Algorithm
All monetary conversions use string-based cent representations (`parseZarToCents` and `centsToZar`) and JavaScript `BigInt`:

```ts
const totalDiscountCents = BigInt(parseZarToCents(totalPromoDiscount.toFixed(2)));
const grossCentsList = authority.map(({ group }) => {
  const reviewedQuote = result.quotes.find(q => q.storeReference === group.storeReference);
  const feeCents = reviewedQuote ? BigInt(parseZarToCents(new Prisma.Decimal(reviewedQuote.deliveryFee).toFixed(2))) : 0n;
  const linesTotalCents = group.lines.reduce((acc, l) => acc + BigInt(parseZarToCents(new Prisma.Decimal(l.lineTotal).toFixed(2))), 0n);
  return linesTotalCents + feeCents;
});
const totalGrossCents = grossCentsList.reduce((acc, c) => acc + c, 0n);

let distributed = 0n;
authority.forEach(({ group }, idx) => {
  let allocated = 0n;
  if (idx === authority.length - 1) {
    // Final cent remainder allocated to last store group
    allocated = totalDiscountCents - distributed;
  } else if (totalGrossCents > 0n) {
    allocated = (totalDiscountCents * grossCentsList[idx]) / totalGrossCents;
    distributed += allocated;
  }
  groupDiscounts.set(group.storeReference, new Prisma.Decimal(centsToZar(allocated.toString())));
});
```

### 2.2. Guarantees
1. **Zero Cent Leakage**: $\sum_{i} \text{allocated}_i = \text{totalDiscountCents}$ exactly.
2. **Deterministic Rounding**: Integer truncation on intermediate divisions, with the exact remainder assigned to the final group.
3. **No Float Imprecision**: No usage of `Math.round(float * 100)` or IEEE 754 binary floating-point representation.

---

## 3. Seller Basis, Commission, and Net Store Earnings

Each store group in a finalized order generates immutable financial records in `MarketplaceCheckoutStoreSettlementEvidence` and `MarketplaceSettlementSnapshot`:

### 3.1. Settlement Equations per Store Order
1. **Gross Seller Basis**:
   $$\text{sellerBasis} = \text{merchandiseBasisAmount} + \text{modifierBasisAmount}$$
2. **Attributed Platform Commission**:
   $$\text{commissionAmount} = \text{sellerBasis} \times \text{commissionRate}$$
   (Calculated according to the active, versioned `CommissionPlan` rules).
3. **Net Merchant Earning**:
   $$\text{storeEarningAmount} = \text{sellerBasis} - \text{commissionAmount}$$
4. **Delivery Fee Residual**:
   $$\text{deliveryFeeResidual} = \text{groupDeliveryFee}$$
   (Passed directly to logistics fulfillment and driver payouts).

---

## 4. Platform Subsidy Journals & Double-Entry Ledger

### 4.1. Platform-Funded Promotions (e.g. First-Store Welcome)
When a discount is funded by KT Couriers (platform subsidy), the customer pays less, but the merchant receives their full contractual settlement basis. The difference is funded from the platform's marketing budget via double-entry journals:

| Journal ID / Line | Account Code | Account Category | Debit (ZAR) | Credit (ZAR) | Memo / Narrative |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Line 1 (Expense)** | `PLATFORM-PROMOTION-EXPENSE-ZAR` | Expense / Marketing | $D$ | — | Debit platform promotion subsidy |
| **Line 2 (Liability)** | `PLATFORM-CUSTOMER-FUNDS-HELD-ZAR` | Liability / Custody | — | $D$ | Credit customer funds held on behalf of store |

This ensures:
- The customer ledger deposit ($P = G - D$) plus platform subsidy ($D$) equals the full gross funds held ($G$).
- When merchant settlement executes, the merchant receives their full net earning ($G - \text{commission}$), funded jointly by customer cash/digital payment and platform marketing expense.

### 4.2. Store-Funded Promotions
When a merchant funds a discount (e.g., store-specific promotional sale):
- $\text{sellerSettlementBasis} = \text{gross} - \text{storeDiscount}$
- The merchant absorbs the discount directly in their earnings.
- Platform promotion expense is unaffected.

---

## 5. Refund & Reversal Proportionality

When an item from a discounted order is refunded:
1. The customer refund is capped at the actual amount paid by the customer for that item:
   $$\text{customerRefund} = \text{lineTotal} - \text{platformDiscountAllocation}$$
2. The platform subsidy is proportionally reversed:
   - Debit: `PLATFORM-CUSTOMER-FUNDS-HELD-ZAR`
   - Credit: `PLATFORM-PROMOTION-EXPENSE-ZAR`
3. Campaign budget commitment is unreserved and restored to the active campaign version.
