import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db/prisma";
import { clearCart } from "@/lib/marketplace-checkout/cart-mutation.service";
import { createPrismaMarketplaceCartRepository } from "@/lib/marketplace-checkout/prisma-cart-repository";
import { createPrismaMarketplaceReservationRepository } from "@/lib/marketplace-checkout/prisma-marketplace-reservation.repository";
import { reserveMarketplaceCheckoutInventory, releaseMarketplaceCheckoutReservation } from "@/lib/marketplace-checkout/inventory-reservation.service";
import { createGate4Store, createGate4ActiveProductScenario } from "./gate4/fixtures";
import { validateGate4DatabaseSafety } from "./gate4/harness-safety";

const runPostgresTests = !!process.env.DATABASE_URL && process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS === "1";
const describeReal = runPostgresTests ? describe : describe.skip;

describeReal("Marketplace Checkout Real PostgreSQL & Concurrency Integration", () => {
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const cartRef = `mc-cart-ref-${nonce}`;
  const opId1 = `op-1-${nonce}`;

  let createdCartId: string | null = null;
  let createdUserId: string | null = null;

  beforeAll(async () => {
    const safety = validateGate4DatabaseSafety();
    if (!safety.ok) throw new Error(safety.reason);
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

  it("concurrent canonical cart mutations commit one receipt and reject the stale writer", async () => {
    const raceCart = await prisma.marketplaceCart.create({ data: {
      publicReference: `race-cart-${nonce}`, ownerType: "GUEST",
      guestTokenHash: `race-hash-${nonce}`, status: "ACTIVE", version: 1,
    } });
    const owner = { type: "GUEST" as const, guestTokenHash: raceCart.guestTokenHash! };
    const repository = createPrismaMarketplaceCartRepository(prisma);
    const mutations = [0, 1].map(i => ({ operationId: `race-${nonce}-${i}`, requestHash: String(i).repeat(64), expectedVersion: 1 }));
    try {
      const results = await Promise.allSettled(mutations.map(mutation => clearCart(repository, { cartId: raceCart.id, owner, mutation })));
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      const loser = results.find(r => r.status === "rejected") as PromiseRejectedResult;
      expect(loser.reason).toMatchObject({ code: "CART_VERSION_CONFLICT" });
      expect((await prisma.marketplaceCart.findUniqueOrThrow({ where: { id: raceCart.id } })).version).toBe(2);
      expect(await prisma.marketplaceCartOperation.count({ where: { cartId: raceCart.id } })).toBe(1);
      const winningMutation = mutations[results.findIndex(r => r.status === "fulfilled")];
      const replay = await clearCart(repository, { cartId: raceCart.id, owner, mutation: winningMutation });
      expect(replay.replayed).toBe(true);
      await expect(clearCart(repository, { cartId: raceCart.id, owner: { type: "GUEST", guestTokenHash: "foreign-owner" }, mutation: winningMutation })).rejects.toMatchObject({ code: "CART_ACCESS_DENIED" });
      expect((await prisma.marketplaceCart.findUniqueOrThrow({ where: { id: raceCart.id } })).version).toBe(2);
    } finally {
      await prisma.marketplaceCartOperation.deleteMany({ where: { cartId: raceCart.id } });
      await prisma.marketplaceCart.delete({ where: { id: raceCart.id } });
    }
  });

  it("canonical reservation races for the final database unit, then releases durable stock", async () => {
    const { store } = await createGate4Store("mc-real", "stock-race");
    const source = await createGate4ActiveProductScenario("mc-real", "stock-race", store.id, { available: 1 });
    const level = source.level!;
    // Reservation evidence does not change physical stock. Physical movements
    // still cannot record a zero delta after the forward-only constraint repair.
    await expect(prisma.catalogInventoryMovement.create({ data: {
      publicReference: `invalid-physical-${nonce}`, inventoryItemId: source.inventoryItem!.id,
      locationId: source.location.id, type: "MANUAL_CORRECTION", quantityDelta: 0,
      resultingOnHand: 1, operationId: `physical-zero-${nonce}`, requestHash: "a".repeat(64),
      reasonCode: "TEST_ZERO_PHYSICAL", actorUserId: createdUserId!,
    } })).rejects.toThrow();
    const fingerprint = "c".repeat(64);
    const carts = await Promise.all([0, 1].map(i => prisma.marketplaceCart.create({ data: {
      publicReference: `inventory-cart-${nonce}-${i}`, ownerType: "GUEST", guestTokenHash: `inventory-hash-${nonce}-${i}`, status: "ACTIVE",
    } })));
    const checkouts = await Promise.all([0, 1].map(i => prisma.marketplaceCheckout.create({ data: {
      publicReference: `inventory-checkout-${nonce}-${i}`, cartId: carts[i].id,
      status: "READY_FOR_REVIEW", acceptedFingerprint: fingerprint, reviewAcceptedAt: new Date(),
    } })));
    const repository = createPrismaMarketplaceReservationRepository(prisma);
    const results = await Promise.allSettled(checkouts.map((checkout, i) => reserveMarketplaceCheckoutInventory(repository, {
      checkoutId: checkout.id, publicReference: `reservation-${nonce}-${i}`, commercialFingerprint: fingerprint,
      lines: [{ lineReference: `line-${nonce}-${i}`, inventoryLevelId: level.id, inventoryItemReference: source.inventoryItem!.publicReference, locationReference: source.location.publicReference, quantity: 1 }],
      expiresAt: new Date(Date.now() + 60_000), operationId: `reserve-${nonce}-${i}`,
    })));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((results.find(r => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "CHECKOUT_REVIEW_REQUIRED" });
    expect(await prisma.catalogInventoryLevel.findUniqueOrThrow({ where: { id: level.id } })).toMatchObject({ onHand: 1, reserved: 1, available: 0 });
    expect(await prisma.marketplaceInventoryReservation.count({ where: { checkoutId: { in: checkouts.map(c => c.id) } } })).toBe(1);
    expect(await prisma.catalogInventoryMovement.count({ where: { inventoryItemId: source.inventoryItem!.id, type: "RESERVATION" } })).toBe(1);
    expect(await prisma.catalogInventoryMovement.findFirst({ where: { inventoryItemId: source.inventoryItem!.id, type: "RESERVATION" } })).toMatchObject({ quantityDelta: 0, resultingOnHand: 1 });
    const winner = results.find(r => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof reserveMarketplaceCheckoutInventory>>>;
    await releaseMarketplaceCheckoutReservation(repository, { reservation: winner.value, operationId: `release-${nonce}`, reason: "CHECKOUT_CANCELLED", paymentOutcomeKnown: true });
    expect(await prisma.catalogInventoryLevel.findUniqueOrThrow({ where: { id: level.id } })).toMatchObject({ onHand: 1, reserved: 0, available: 1 });
    expect(await prisma.catalogInventoryMovement.count({ where: { inventoryItemId: source.inventoryItem!.id, type: "RESERVATION_RELEASE" } })).toBe(1);
    await prisma.marketplaceInventoryReservationItem.deleteMany({ where: { reservationId: winner.value.id } });
    await prisma.marketplaceInventoryReservation.delete({ where: { id: winner.value.id } });
    await prisma.marketplaceCheckoutOperation.deleteMany({ where: { checkoutId: { in: checkouts.map(c => c.id) } } });
    await prisma.marketplaceCheckout.deleteMany({ where: { id: { in: checkouts.map(c => c.id) } } });
    await prisma.marketplaceCart.deleteMany({ where: { id: { in: carts.map(c => c.id) } } });
  });
});
