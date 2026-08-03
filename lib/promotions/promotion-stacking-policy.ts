import { Decimal } from "@prisma/client/runtime/library";
import { DiscountScope } from "./promotion-discount-policy";

export type PromotionCategory = "SUBSCRIPTION_BENEFIT" | "AUTOMATIC_MERCHANDISE" | "COUPON" | "DELIVERY_PROMO";

export interface StackablePromotion {
  id: string;
  category: PromotionCategory;
  scope: DiscountScope;
  calculatedDiscount: Decimal;
}

export interface StackingEvidence {
  selectedPromotionIds: string[];
  rejectedPromotionIds: string[];
  rejectionReasons: Record<string, string>;
}

export function evaluateStackingPolicy(promotions: StackablePromotion[]): {
  selected: StackablePromotion[];
  evidence: StackingEvidence;
} {
  const selected: StackablePromotion[] = [];
  const rejectedIds: string[] = [];
  const rejectionReasons: Record<string, string> = {};

  const byCategory = new Map<PromotionCategory, StackablePromotion[]>();
  for (const promo of promotions) {
    const list = byCategory.get(promo.category) || [];
    list.push(promo);
    byCategory.set(promo.category, list);
  }

  for (const [category, list] of byCategory.entries()) {
    // Sort by calculated discount descending
    list.sort((a, b) => b.calculatedDiscount.comparedTo(a.calculatedDiscount));
    
    // Select the highest value in this category
    const winner = list[0];
    selected.push(winner);

    // Reject the rest
    for (let i = 1; i < list.length; i++) {
      const loser = list[i];
      rejectedIds.push(loser.id);
      rejectionReasons[loser.id] = `Outcompeted by promotion ${winner.id} in category ${category}`;
    }
  }

  return {
    selected,
    evidence: {
      selectedPromotionIds: selected.map(p => p.id),
      rejectedPromotionIds: rejectedIds,
      rejectionReasons,
    }
  };
}
