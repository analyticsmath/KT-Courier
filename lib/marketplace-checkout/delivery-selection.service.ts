/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 20 delegates remain dynamic. */
import { prisma } from "@/lib/db/prisma";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { resolveAndAssertMarketplaceCheckoutOperation } from "@/lib/marketplace-checkout/composition-root";
import { withSerializableRetry } from "@/lib/db/serializable-retry";
import type { CheckoutOwner, CheckoutOperation } from "@/lib/marketplace-checkout/checkout.service";
import { getMarketplaceCheckoutForOwner } from "@/lib/marketplace-checkout/checkout.service";

export type DeliverySelectionInput = {
  reference: string;
  owner: CheckoutOwner;
  operation: CheckoutOperation;
  selections?: Array<{
    storeReference: string;
    quoteReference: string;
    fulfilmentMode?: string;
  }>;
};

export async function selectMarketplaceCheckoutDeliveryOptions(input: DeliverySelectionInput): Promise<any> {
  const composition = resolveAndAssertMarketplaceCheckoutOperation("DELIVERY_QUOTE");

  return withSerializableRetry(async () => {
    const checkouts = (prisma as any).marketplaceCheckout;
    const checkout = await checkouts.findFirst({
      where: {
        publicReference: input.reference,
        ...(input.owner.type === "CUSTOMER" ? { customerUserId: input.owner.userId } : { guestAccessTokenHash: input.owner.guestTokenHash }),
      },
      include: {
        storeGroups: {
          include: { lines: true },
        },
        addressSnapshot: true,
      },
    });

    if (!checkout) throw new MarketplaceCheckoutError("CHECKOUT_ACCESS_DENIED", "Checkout is unavailable.");
    if (checkout.version !== input.operation.expectedVersion) {
      throw new MarketplaceCheckoutError("CHECKOUT_VERSION_CONFLICT", "Checkout changed. Refresh and try again.");
    }
    if (!["CREATED", "VALIDATING", "CHANGES_REQUIRED", "READY_FOR_REVIEW"].includes(checkout.status)) {
      throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Checkout is not in an editable delivery selection state.");
    }

    // Check operation replay
    const op = await (prisma as any).marketplaceCheckoutOperation.findUnique({
      where: { checkoutId_operationId: { checkoutId: checkout.id, operationId: input.operation.operationId } },
    });
    if (op) {
      if (op.requestHash !== input.operation.requestHash) {
        throw new MarketplaceCheckoutError("CHECKOUT_OPERATION_CONFLICT", "Operation ID reused with different request hash.");
      }
      return getMarketplaceCheckoutForOwner(input.reference, input.owner);
    }

    const serviceArea = checkout.addressSnapshot?.serviceAreaReference ?? checkout.addressServiceAreaReference;
    if (!serviceArea) {
      throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "A validated delivery destination address is required before selecting delivery options.");
    }

    const selectionsMap = new Map((input.selections ?? []).map((s) => [s.storeReference, s]));

    // Generate/verify quotes for each store group
    for (const group of checkout.storeGroups) {
      const selection = selectionsMap.get(group.storeId);
      const quote = await composition.deliveryQuotes.quoteStoreGroup({
        checkoutReference: checkout.publicReference,
        storeReference: group.storeId,
        pickupLocationReference: group.pickupLocationReference ?? group.storeId,
        serviceAreaReference: serviceArea,
        fulfilmentMode: selection?.fulfilmentMode ?? group.fulfilmentMode,
        lineCount: group.lines.length,
      });

      if (!quote || quote.currency !== "ZAR" || !quote.publicReference) {
        throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", `Delivery quote is unavailable for store ${group.storeId}.`);
      }

      if (selection && selection.quoteReference !== quote.publicReference) {
        throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "The selected delivery quote is stale or does not match authoritative evidence.");
      }

      const merchandise = Number(group.merchandiseSubtotal ?? 0);
      const modifiers = Number(group.modifierSubtotal ?? 0);
      const fee = Number(quote.fee);
      const groupTotal = (merchandise + modifiers + fee).toFixed(2);

      await (prisma as any).marketplaceCheckoutStoreGroup.update({
        where: { id: group.id },
        data: {
          deliveryQuoteReference: quote.publicReference,
          deliveryQuoteVersion: quote.version,
          deliveryQuoteExpiresAt: quote.expiresAt,
          serviceabilityReference: quote.serviceabilityReference,
          deliveryFee: quote.fee,
          groupTotal,
          status: "READY",
        },
      });
    }

    // Refresh groups to compute totals
    const updatedGroups = await (prisma as any).marketplaceCheckoutStoreGroup.findMany({
      where: { checkoutId: checkout.id },
    });

    const feeTotal = updatedGroups.reduce((acc: number, g: any) => acc + Number(g.deliveryFee ?? 0), 0).toFixed(2);
    const merchTotal = updatedGroups.reduce((acc: number, g: any) => acc + Number(g.merchandiseSubtotal ?? 0), 0).toFixed(2);
    const modTotal = updatedGroups.reduce((acc: number, g: any) => acc + Number(g.modifierSubtotal ?? 0), 0).toFixed(2);
    const grandTotal = (Number(merchTotal) + Number(modTotal) + Number(feeTotal)).toFixed(2);

    const updatedCheckout = await checkouts.update({
      where: { id: checkout.id },
      data: {
        deliveryFeeTotal: feeTotal,
        grandTotal,
        status: "VALIDATING",
        version: { increment: 1 },
      },
    });

    await (prisma as any).marketplaceCheckoutOperation.create({
      data: {
        checkoutId: checkout.id,
        operationId: input.operation.operationId,
        requestHash: input.operation.requestHash,
        type: "DELIVERY_OPTIONS",
        response: { selected: true, version: updatedCheckout.version },
      },
    });

    return getMarketplaceCheckoutForOwner(input.reference, input.owner);
  });
}
