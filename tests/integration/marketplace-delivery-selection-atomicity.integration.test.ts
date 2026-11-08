import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";

const quoteStoreGroup = vi.hoisted(() => vi.fn());
vi.mock("@/lib/marketplace-checkout/composition-root", () => ({
  resolveAndAssertMarketplaceCheckoutOperation: () => ({ deliveryQuotes: { quoteStoreGroup } }),
}));
vi.mock("@/lib/marketplace-checkout/checkout.service", () => ({
  getMarketplaceCheckoutForOwner: vi.fn(async (reference: string) => ({ publicReference: reference })),
}));
import { selectMarketplaceCheckoutDeliveryOptions } from "@/lib/marketplace-checkout/delivery-selection.service";

describe("marketplace delivery selection serializable PostgreSQL commit", () => {
  const ids: Record<string, string> = {};
  beforeAll(async () => {
    requireDisposableStoreSettlementDatabase();
    const nonce = randomUUID();
    const owner = await prisma.user.create({ data: { email: "deliveries-" + nonce + "@example.test", role: "CUSTOMER", status: "ACTIVE" } });
    ids.user = owner.id;
    const store = await prisma.store.create({ data: { ownerUserId: owner.id, name: "Disposable quote merchant", slug: "delivery-test-" + nonce, status: "ACTIVE" } });
    ids.store = store.id;
    const cart = await prisma.marketplaceCart.create({ data: { publicReference: "CART-" + nonce, ownerType: "CUSTOMER", customerUserId: owner.id } });
    ids.cart = cart.id;
    const address = await prisma.marketplaceCheckoutAddressSnapshot.create({
      data: { recipientName: "Disposable Receiver", line1: "45 Commission St", suburb: "Central", city: "Johannesburg", province: "Gauteng", postalCode: "2001", serviceAreaReference: "disposable-region" },
    });
    ids.address = address.id;
    const checkout = await prisma.marketplaceCheckout.create({
      data: { publicReference: "CHK-" + nonce, cartId: cart.id, customerUserId: owner.id, addressSnapshotId: address.id, status: "VALIDATING", version: 2, merchandiseSubtotal: new Prisma.Decimal("100.10"), modifierSubtotal: new Prisma.Decimal("0.20"), grandTotal: new Prisma.Decimal("100.30") },
    });
    ids.checkout = checkout.id;
    ids.reference = checkout.publicReference;
    const group = await prisma.marketplaceCheckoutStoreGroup.create({
      data: { checkoutId: checkout.id, storeId: store.id, fulfilmentMode: "PICKUP_AND_DELIVERY", merchandiseSubtotal: new Prisma.Decimal("100.10"), modifierSubtotal: new Prisma.Decimal("0.20"), groupTotal: new Prisma.Decimal("100.30") },
    });
    ids.group = group.id;
    quoteStoreGroup.mockResolvedValue({
      publicReference: "QUOTE-" + nonce, version: "v1", currency: "ZAR", fee: "35.70",
      expiresAt: new Date("2030-01-01T00:00:00Z"), serviceabilityReference: "disposable-region",
    });
  });

  afterAll(async () => {
    if (!ids.checkout) return;
    await prisma.$transaction(async tx => {
      await tx.marketplaceCheckoutOperation.deleteMany({ where: { checkoutId: ids.checkout } });
      await tx.marketplaceCheckoutStoreGroup.deleteMany({ where: { checkoutId: ids.checkout } });
      await tx.marketplaceCheckout.delete({ where: { id: ids.checkout } });
      await tx.marketplaceCheckoutAddressSnapshot.delete({ where: { id: ids.address } });
      await tx.marketplaceCart.delete({ where: { id: ids.cart } });
      await tx.store.delete({ where: { id: ids.store } });
      await tx.user.delete({ where: { id: ids.user } });
    });
    await prisma.$disconnect();
  });

  it("persists quote, exact totals, version and idempotency receipt together, then replays safely", async () => {
    const command = {
      reference: ids.reference,
      owner: { type: "CUSTOMER" as const, userId: ids.user },
      operation: { operationId: "delivery-" + ids.checkout, requestHash: "hash-disposable-persist", expectedVersion: 2 },
    };
    await expect(selectMarketplaceCheckoutDeliveryOptions(command)).resolves.toMatchObject({ publicReference: ids.reference });
    const [group, checkout, operation] = await Promise.all([
      prisma.marketplaceCheckoutStoreGroup.findUniqueOrThrow({ where: { id: ids.group } }),
      prisma.marketplaceCheckout.findUniqueOrThrow({ where: { id: ids.checkout } }),
      prisma.marketplaceCheckoutOperation.findUniqueOrThrow({ where: { checkoutId_operationId: { checkoutId: ids.checkout, operationId: command.operation.operationId } } }),
    ]);
    expect(group.deliveryFee.toFixed(2)).toBe("35.70");
    expect(group.groupTotal.toFixed(2)).toBe("136.00");
    expect(group.serviceabilityReference).toBe("disposable-region");
    expect(checkout.grandTotal.toFixed(2)).toBe("136.00");
    expect(checkout.version).toBe(3);
    expect(operation).toMatchObject({ type: "DELIVERY_OPTIONS", requestHash: command.operation.requestHash });
    expect(quoteStoreGroup).toHaveBeenCalledTimes(1);
    await expect(selectMarketplaceCheckoutDeliveryOptions(command)).resolves.toMatchObject({ publicReference: ids.reference });
    expect(quoteStoreGroup).toHaveBeenCalledTimes(1);
    expect(await prisma.marketplaceCheckoutOperation.count({ where: { checkoutId: ids.checkout } })).toBe(1);
    expect((await prisma.marketplaceCheckout.findUniqueOrThrow({ where: { id: ids.checkout } })).version).toBe(3);
  });
});
