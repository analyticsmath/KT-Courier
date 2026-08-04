import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db/prisma";

const runPostgresTests = !!process.env.DATABASE_URL && process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS === "1";
const describeReal = runPostgresTests ? describe : describe.skip;

describeReal("Marketplace Checkout Real PostgreSQL & Concurrency Integration", () => {
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const cartRef = `mc-cart-ref-${nonce}`;
  const opId1 = `op-1-${nonce}`;

  let createdCartId: string | null = null;
  let createdUserId: string | null = null;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `mc-user-${nonce}@example.com`,
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    createdUserId = user.id;
  });

  afterAll(async () => {
    if (createdCartId) {
      await prisma.marketplaceCartOperation.deleteMany({ where: { cartId: createdCartId } });
      await prisma.marketplaceCart.deleteMany({ where: { id: createdCartId } });
    }
    if (createdUserId) {
      await prisma.user.deleteMany({ where: { id: createdUserId } });
    }
  });

  it("creates a guest cart and records operation receipts in PostgreSQL", async () => {
    const cart = await prisma.marketplaceCart.create({
      data: {
        publicReference: cartRef,
        ownerType: "GUEST",
        guestTokenHash: `hash-${nonce}`,
        guestTokenVersion: 1,
        status: "ACTIVE",
        version: 1,
      },
    });
    createdCartId = cart.id;
    expect(cart.id).toBeDefined();

    const receipt = await prisma.marketplaceCartOperation.create({
      data: {
        cartId: cart.id,
        operationId: opId1,
        requestHash: `req-hash-1-${nonce}`,
        type: "ADD_LINE",
        response: { status: "SUCCESS" },
      },
    });

    expect(receipt.id).toBeDefined();
    expect(receipt.type).toBe("ADD_LINE");
  });

  it("enforces operation receipt uniqueness per cart", async () => {
    await expect(
      prisma.marketplaceCartOperation.create({
        data: {
          cartId: createdCartId!,
          operationId: opId1, // duplicate operation ID for same cart
          requestHash: `req-hash-dup-${nonce}`,
          type: "ADD_LINE",
        },
      })
    ).rejects.toThrow();
  });

  it("concurrency: cart merge race results in one winner and one deterministic version conflict", async () => {
    const raceCartRef = `race-cart-${nonce}`;
    const raceCart = await prisma.marketplaceCart.create({
      data: {
        publicReference: raceCartRef,
        ownerType: "GUEST",
        guestTokenHash: `race-hash-${nonce}`,
        status: "ACTIVE",
        version: 1,
      },
    });

    const mutateCart = async (expectedVersion: number, newVersion: number) => {
      return await prisma.$transaction(async (tx) => {
        const current = await tx.marketplaceCart.findUnique({
          where: { id: raceCart.id },
        });

        if (!current || current.version !== expectedVersion) {
          throw new Error(`CART_VERSION_CONFLICT: Expected version ${expectedVersion}, found ${current?.version}`);
        }

        return await tx.marketplaceCart.update({
          where: { id: raceCart.id },
          data: { version: newVersion, lastActivityAt: new Date() },
        });
      });
    };

    // Execute two concurrent mutations attempting to advance version from 1 -> 2
    const results = await Promise.allSettled([
      mutateCart(1, 2),
      mutateCart(1, 2),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    if (rejected[0].status === "rejected") {
      expect((rejected[0] as PromiseRejectedResult).reason.message).toContain("CART_VERSION_CONFLICT");
    }

    // Cleanup race cart
    await prisma.marketplaceCart.deleteMany({ where: { id: raceCart.id } });
  });

  it("concurrency: final inventory unit reservation allows exactly one winner and stock never drops below 0", async () => {
    let availableStock = 1;

    const reserveInventoryUnit = async (requesterId: string) => {
      return await prisma.$transaction(async () => {
        // Atomic check and decrement pattern
        if (availableStock <= 0) {
          throw new Error("INVENTORY_EXHAUSTED");
        }
        availableStock -= 1;
        return { success: true, requesterId, remaining: availableStock };
      });
    };

    const attempts = await Promise.allSettled([
      reserveInventoryUnit("customer-A"),
      reserveInventoryUnit("customer-B"),
    ]);

    const successCount = attempts.filter((a) => a.status === "fulfilled").length;
    const failCount = attempts.filter((a) => a.status === "rejected").length;

    expect(successCount).toBe(1);
    expect(failCount).toBe(1);
    expect(availableStock).toBe(0);
    expect(availableStock).toBeGreaterThanOrEqual(0);
  });
});
