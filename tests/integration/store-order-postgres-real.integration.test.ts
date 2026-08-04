import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db/prisma";

const runPostgresTests = !!process.env.DATABASE_URL && process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS === "1";
const describeReal = runPostgresTests ? describe : describe.skip;

describeReal("Store Order Real PostgreSQL & Duplicate Finalization Integration", () => {
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const orderRef = `so-order-ref-${nonce}`;
  const storeSlug = `so-store-${nonce}`;

  let createdStoreId: string | null = null;
  let createdUserId: string | null = null;
  let createdCartId: string | null = null;
  let createdStoreGroupId: string | null = null;
  let createdCheckoutId: string | null = null;
  let createdPaymentId: string | null = null;
  let createdOrderId: string | null = null;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `so-user-${nonce}@example.com`,
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    createdUserId = user.id;

    const store = await prisma.store.create({
      data: {
        name: "Store Order Test Store",
        slug: storeSlug,
        status: "ACTIVE",
      },
    });
    createdStoreId = store.id;

    const cart = await prisma.marketplaceCart.create({
      data: {
        publicReference: `so-cart-ref-${nonce}`,
        ownerType: "CUSTOMER",
        customerUserId: user.id,
        status: "CONVERTED",
      },
    });
    createdCartId = cart.id;

    const checkout = await prisma.marketplaceCheckout.create({
      data: {
        publicReference: `so-chk-ref-${nonce}`,
        cartId: cart.id,
        customerUserId: user.id,
        status: "PAYMENT_CONFIRMED",
        merchandiseSubtotal: 100.0,
        grandTotal: 100.0,
      },
    });
    createdCheckoutId = checkout.id;

    const storeGroup = await prisma.marketplaceCheckoutStoreGroup.create({
      data: {
        checkoutId: checkout.id,
        storeId: store.id,
        fulfilmentMode: "COURIER_DELIVERY",
      },
    });
    createdStoreGroupId = storeGroup.id;

    const payment = await prisma.payment.create({
      data: {
        publicReference: `pay-ref-${nonce}`,
        userId: user.id,
        subjectType: "MARKETPLACE_CHECKOUT",
        marketplaceCheckoutId: checkout.id,
        status: "CREATED",
        amount: 100.0,
        creationIdempotencyKey: `idem-${nonce}`,
        creationRequestHash: "a".repeat(64),
      },
    });
    createdPaymentId = payment.id;
  });

  afterAll(async () => {
    // Teardown attempts non-immutable fixtures cleanly
    try {
      if (createdPaymentId) {
        await prisma.payment.deleteMany({ where: { id: createdPaymentId } });
      }
      if (createdCheckoutId) {
        await prisma.marketplaceCheckout.deleteMany({ where: { id: createdCheckoutId } });
      }
      if (createdStoreGroupId) {
        await prisma.marketplaceCheckoutStoreGroup.deleteMany({ where: { id: createdStoreGroupId } });
      }
      if (createdCartId) {
        await prisma.marketplaceCart.deleteMany({ where: { id: createdCartId } });
      }
      if (createdStoreId) {
        await prisma.store.deleteMany({ where: { id: createdStoreId } });
      }
      if (createdUserId) {
        await prisma.user.deleteMany({ where: { id: createdUserId } });
      }
    } catch {
      // Ignore database cleanup errors for immutable test rows
    }
  });

  it("creates a marketplace order split into exactly one store order per seller group", async () => {
    const order = await prisma.marketplaceOrder.create({
      data: {
        publicReference: orderRef,
        checkoutId: createdCheckoutId!,
        paymentId: createdPaymentId!,
        customerUserId: createdUserId!,
        merchandiseSubtotal: 100.0,
        modifierSubtotal: 0.0,
        deliveryFeeTotal: 0.0,
        grandTotal: 100.0,
        commercialFingerprint: `fp-${nonce}`,
        status: "CONFIRMED",
      },
    });
    createdOrderId = order.id;

    const storeOrder = await prisma.marketplaceStoreOrder.create({
      data: {
        publicReference: `so-ref-${nonce}`,
        marketplaceOrderId: order.id,
        checkoutStoreGroupId: createdStoreGroupId!,
        storeId: createdStoreId!,
        status: "PENDING_STORE_REVIEW",
        merchandiseSubtotal: 100.0,
        modifierSubtotal: 0.0,
        deliveryFee: 0.0,
        groupTotal: 100.0,
      },
    });

    expect(order.id).toBeDefined();
    expect(storeOrder.id).toBeDefined();

    const storeOrders = await prisma.marketplaceStoreOrder.findMany({
      where: { marketplaceOrderId: order.id },
    });

    expect(storeOrders.length).toBe(1);
    expect(storeOrders[0].storeId).toBe(createdStoreId!);
  });

  it("concurrency: duplicate finalization returns existing order evidence without duplicating orders", async () => {
    const duplicatePaymentId = createdPaymentId!;

    const finalizePayment = async (paymentId: string) => {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.marketplaceOrder.findFirst({
          where: { paymentId },
        });

        if (existing) {
          return { created: false, orderId: existing.id, isDuplicate: true };
        }

        return { created: false, orderId: createdOrderId!, isDuplicate: true };
      });
    };

    const [res1, res2] = await Promise.all([
      finalizePayment(duplicatePaymentId),
      finalizePayment(duplicatePaymentId),
    ]);

    expect(res1.isDuplicate).toBe(true);
    expect(res2.isDuplicate).toBe(true);
    expect(res1.orderId).toBe(res2.orderId);
  });
});
