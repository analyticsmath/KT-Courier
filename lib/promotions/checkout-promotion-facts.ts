import { Decimal } from "@prisma/client/runtime/library";
import type { PromotionEvaluationInput } from "./promotion-evaluation.service";

/**
 * Project the CURRENT immutable checkout review into promotion inputs.
 *
 * Promotion arithmetic must never read individual unit prices as if they
 * were complete line totals, combine old review versions or invent a
 * JHB/STANDARD delivery route. Route-targeted campaigns remain ineligible
 * without independently proven service/region metadata.
 */
export type CheckoutPromotionSnapshot = Readonly<{
  id: string;
  reviewVersion: number;
  customerUserId: string | null;
  guestAccessTokenHash: string | null;
  storeGroups: readonly Readonly<{
    storeId: string;
    deliveryFee: Decimal;
    deliveryQuoteReference: string | null;
    lines: readonly Readonly<{
      id: string;
      reviewVersion: number;
      quantity: number;
      baseUnitPrice: Decimal;
      modifierUnitTotal: Decimal;
      lineTotal: Decimal;
      productReference: string;
      variantReference: string;
    }>[];
  }>[];
}>;

export function projectCheckoutPromotionFacts(
  checkout: CheckoutPromotionSnapshot,
  now: Date,
): PromotionEvaluationInput {
  if (!Number.isSafeInteger(checkout.reviewVersion) || checkout.reviewVersion < 1
    || !Number.isFinite(now.getTime()) || !checkout.storeGroups.length) {
    throw new Error("Current reviewed marketplace checkout evidence is required.");
  }

  let lineCount = 0;
  const storeGroups = checkout.storeGroups.map(group => {
    const lines = group.lines
      .filter(line => line.reviewVersion === checkout.reviewVersion)
      .map(line => {
        if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0
          || !group.storeId || !line.id || !line.productReference || !line.variantReference
          || line.baseUnitPrice.isNegative() || line.modifierUnitTotal.isNegative()
          || line.lineTotal.isNegative()) {
          throw new Error("Checkout promotion requires nonnegative, source-bound current review lines.");
        }
        const merchandiseSubtotal = line.baseUnitPrice.mul(line.quantity);
        const modifierSubtotal = line.modifierUnitTotal.mul(line.quantity);
        if (!merchandiseSubtotal.plus(modifierSubtotal).equals(line.lineTotal)) {
          throw new Error("Checkout promotion input does not reconcile with the frozen line total.");
        }
        lineCount++;
        return {
          lineReference: line.id,
          merchandiseSubtotal,
          modifierSubtotal,
          productId: line.productReference,
          variantId: line.variantReference,
          // Category is not persisted in the canonical checkout line. Never
          // invent one: category-targeted offers require a verified join.
          categoryId: "",
        };
      });
    if (!lines.length) {
      throw new Error("All checkout store groups require current review lines.");
    }
    return { storeReference: group.storeId, lines };
  });
  if (!lineCount) throw new Error("No currently reviewed checkout lines were found.");

  const deliveryQuotes = checkout.storeGroups
    .filter(group => Boolean(group.deliveryQuoteReference?.trim()))
    .map(group => {
      if (group.deliveryFee.isNegative()) {
        throw new Error("Checkout delivery fee cannot be negative.");
      }
      return {
        storeReference: group.storeId,
        feeAmount: group.deliveryFee,
        // No source-bound service/region is present on these stored group
        // fields; route-specific promotions must not receive fake identities.
        deliveryServiceType: "",
        deliveryRegion: "",
      };
    });

  return {
    checkoutId: checkout.id,
    customerUserId: checkout.customerUserId ?? undefined,
    guestEvidenceReference: checkout.guestAccessTokenHash ?? undefined,
    storeGroups,
    deliveryQuotes,
    now,
  };
}
