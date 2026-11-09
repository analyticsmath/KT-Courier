/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 20 delegates remain dynamic. */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { centsToZar, parseZarToCents } from "@/lib/marketplace-checkout/policy";
import { resolveAndAssertMarketplaceCheckoutOperation } from "@/lib/marketplace-checkout/composition-root";
import { withSerializableRetry } from "@/lib/db/serializable-retry";
import type { CheckoutOwner, CheckoutOperation } from "@/lib/marketplace-checkout/checkout.service";
import { getMarketplaceCheckoutForOwner } from "@/lib/marketplace-checkout/checkout.service";

/**
 * Monetary values from authoritative quotes or Prisma DECIMAL(18, 2) fields.
 * Never convert to IEEE-754 Number while calculating payable checkout totals.
 */
export function sumMarketplaceDeliveryAmounts(amounts: readonly (string | Prisma.Decimal)[]): string {
  const cents = amounts.reduce<bigint>((total, amount) => {
    const value = typeof amount === "string" ? amount : amount instanceof Prisma.Decimal && amount.decimalPlaces() <= 2 ? amount.toFixed(2) : "";
    if (!/^(?:0|[1-9]\d*)\.\d{2}$/.test(value)) {
      throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "An authoritative checkout amount is invalid.");
    }
    const next = total + BigInt(parseZarToCents(value));
    if (next > 999999999999999999n) {
      throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "An authoritative checkout amount exceeds the supported ZAR limit.");
    }
    return next;
  }, 0n);
  return centsToZar(cents.toString());
}

export type DeliverySelectionInput = {
  reference: string;
  owner: CheckoutOwner;
  operation: CheckoutOperation;
  courierServiceKey?: string;
  selections?: Array<{
    storeReference: string;
    quoteReference: string;
    fulfilmentMode?: string;
  }>;
};

/** Generate network-bound route quotes before opening a short database transaction.
 * The subsequent row lock and optimistic version check prevent partially saved
 * multi-store selections, and the operation receipt commits with the totals.
 */
export async function selectMarketplaceCheckoutDeliveryOptions(input: DeliverySelectionInput): Promise<any> {
  const composition = resolveAndAssertMarketplaceCheckoutOperation("DELIVERY_QUOTE");
  const ownerWhere = input.owner.type === "CUSTOMER"
    ? { customerUserId: input.owner.userId }
    : { guestAccessTokenHash: input.owner.guestTokenHash };
  const checkout = await prisma.marketplaceCheckout.findFirst({
    where: { publicReference: input.reference, ...ownerWhere },
    include: { storeGroups: { include: { lines: true } }, addressSnapshot: true },
  });
  if (!checkout) throw new MarketplaceCheckoutError("CHECKOUT_ACCESS_DENIED", "Checkout is unavailable.");

  // Replay checks precede the version check: a successful command increments
  // that version and must still replay safely after a lost HTTP response.
  const previous = await prisma.marketplaceCheckoutOperation.findUnique({
    where: { checkoutId_operationId: { checkoutId: checkout.id, operationId: input.operation.operationId } },
  });
  if (previous) {
    if (previous.requestHash !== input.operation.requestHash || previous.type !== "DELIVERY_OPTIONS") {
      throw new MarketplaceCheckoutError("CHECKOUT_OPERATION_CONFLICT", "Operation ID reused with different checkout evidence.");
    }
    return getMarketplaceCheckoutForOwner(input.reference, input.owner);
  }
  if (checkout.version !== input.operation.expectedVersion) {
    throw new MarketplaceCheckoutError("CHECKOUT_VERSION_CONFLICT", "Checkout changed. Refresh and try again.");
  }
  const editable = ["CREATED", "VALIDATING", "CHANGES_REQUIRED", "READY_FOR_REVIEW"];
  if (!editable.includes(checkout.status)) {
    throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Checkout is not in an editable delivery selection state.");
  }
  const serviceArea = checkout.addressSnapshot?.serviceAreaReference;
  if (!serviceArea) {
    throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "A validated delivery destination address is required before selecting delivery options.");
  }

  const selectionsMap = new Map((input.selections ?? []).map(selection => [selection.storeReference, selection]));
  const quoted: Array<{
    id: string;
    storeId: string;
    data: {
      deliveryQuoteReference: string;
      deliveryQuoteVersion: string;
      deliveryQuoteExpiresAt: Date;
      serviceabilityReference: string;
      deliveryFee: string;
      groupTotal: string;
      status: "READY";
    };
  }> = [];
  for (const group of checkout.storeGroups) {
    const selection = selectionsMap.get(group.storeId);
    const quote = await composition.deliveryQuotes.quoteStoreGroup({
      checkoutReference: checkout.publicReference,
      storeReference: group.storeId,
      pickupLocationReference: group.pickupLocationReference ?? group.storeId,
      serviceAreaReference: serviceArea,
      fulfilmentMode: selection?.fulfilmentMode ?? group.fulfilmentMode,
      lineCount: group.lines.length,
      courierServiceKey: input.courierServiceKey,
    });
    if (!quote || quote.currency !== "ZAR" || !quote.publicReference || !quote.version
      || quote.serviceabilityReference !== serviceArea || !(quote.expiresAt instanceof Date)
      || !Number.isFinite(quote.expiresAt.getTime()) || quote.expiresAt <= new Date()) {
      throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", `Delivery quote is unavailable for store ${group.storeId}.`);
    }
    if (selection && selection.quoteReference !== quote.publicReference) {
      throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "The selected delivery quote is stale or does not match authoritative evidence.");
    }
    quoted.push({
      id: group.id,
      storeId: group.storeId,
      data: {
        deliveryQuoteReference: quote.publicReference,
        deliveryQuoteVersion: quote.version,
        deliveryQuoteExpiresAt: quote.expiresAt,
        serviceabilityReference: quote.serviceabilityReference,
        deliveryFee: quote.fee,
        groupTotal: sumMarketplaceDeliveryAmounts([
          group.merchandiseSubtotal ?? "0.00",
          group.modifierSubtotal ?? "0.00",
          quote.fee,
        ]),
        status: "READY",
      },
    });
  }

  await withSerializableRetry(() => prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceCheckout" WHERE "id" = ${checkout.id} FOR UPDATE`);
    const current = await tx.marketplaceCheckout.findFirst({
      where: { id: checkout.id, ...ownerWhere },
      include: { storeGroups: true, addressSnapshot: true },
    });
    if (!current) throw new MarketplaceCheckoutError("CHECKOUT_ACCESS_DENIED", "Checkout is unavailable.");
    const replay = await tx.marketplaceCheckoutOperation.findUnique({
      where: { checkoutId_operationId: { checkoutId: checkout.id, operationId: input.operation.operationId } },
    });
    if (replay) {
      if (replay.requestHash !== input.operation.requestHash || replay.type !== "DELIVERY_OPTIONS") {
        throw new MarketplaceCheckoutError("CHECKOUT_OPERATION_CONFLICT", "Operation ID reused with different checkout evidence.");
      }
      return;
    }
    if (current.version !== input.operation.expectedVersion) {
      throw new MarketplaceCheckoutError("CHECKOUT_VERSION_CONFLICT", "Checkout changed. Refresh and try again.");
    }
    if (!editable.includes(current.status)) {
      throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Checkout is not in an editable delivery selection state.");
    }
    const currentArea = current.addressSnapshot?.serviceAreaReference;
    if (currentArea !== serviceArea
      || current.storeGroups.length !== quoted.length
      || current.storeGroups.some(group => !quoted.some(item => item.id === group.id && item.storeId === group.storeId))) {
      throw new MarketplaceCheckoutError("CHECKOUT_VERSION_CONFLICT", "Checkout groups or destination changed. Refresh and try again.");
    }

    if (quoted.some(item => item.data.deliveryQuoteExpiresAt <= new Date())) {
      throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "A delivery quote expired before its selection could be saved. Refresh and try again.");
    }
    for (const item of quoted) {
      await tx.marketplaceCheckoutStoreGroup.update({ where: { id: item.id }, data: item.data });
    }
    const updatedGroups = await tx.marketplaceCheckoutStoreGroup.findMany({
      where: { checkoutId: checkout.id },
    });
    const feeTotal = sumMarketplaceDeliveryAmounts(updatedGroups.map(group => group.deliveryFee ?? "0.00"));
    const merchTotal = sumMarketplaceDeliveryAmounts(updatedGroups.map(group => group.merchandiseSubtotal ?? "0.00"));
    const modTotal = sumMarketplaceDeliveryAmounts(updatedGroups.map(group => group.modifierSubtotal ?? "0.00"));
    const grandTotal = sumMarketplaceDeliveryAmounts([merchTotal, modTotal, feeTotal]);
    const updated = await tx.marketplaceCheckout.update({
      where: { id: checkout.id },
      data: {
        deliveryFeeTotal: feeTotal,
        grandTotal,
        digitalRequired: null,
        cashRequired: "0.00",
        status: "VALIDATING",
        version: { increment: 1 },
      },
    });
    await tx.marketplaceCheckoutOperation.create({
      data: {
        checkoutId: checkout.id,
        operationId: input.operation.operationId,
        requestHash: input.operation.requestHash,
        type: "DELIVERY_OPTIONS",
        response: { selected: true, version: updated.version },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

  return getMarketplaceCheckoutForOwner(input.reference, input.owner);
}
