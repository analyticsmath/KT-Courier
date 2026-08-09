import { describe, it, expect, beforeAll } from "vitest";
import { validateGate4DatabaseSafety } from "./harness-safety";
import { runConcurrentRace } from "./barrier";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { createGate4CheckoutScenario, createGate4Store, createGate4CatalogueProduct, createGate4InventoryLevel, requireGate4Fixture } from "./fixtures";

describe("Gate 4 — Catalogue, Inventory and Checkout Concurrency Suite", () => {
  let safety: ReturnType<typeof validateGate4DatabaseSafety>;

  beforeAll(() => {
    safety = validateGate4DatabaseSafety();
  });

  it("G4-CAT-001 [Concurrency & Oversell]: 5 concurrent checkouts for 1 available item yield exactly 1 winner", async () => {
    if (!safety.ok) {
      console.warn(`[SKIP_DB_EXECUTION] ${safety.reason}`);
      return;
    }

    const { store } = await createGate4Store("checkout-conc", "oversell-store");
    const { product } = await createGate4CatalogueProduct("checkout-conc", "oversell-prod", store.id);
    const { level } = await createGate4InventoryLevel("checkout-conc", "oversell-inv", product.id, store.id, { available: 1, reserved: 0 });
    requireGate4Fixture(level, "Inventory level fixture required");

    const levelId = level.id;
    const initialAvailable = level.available;
    const initialReserved = level.reserved;

    const results = await runConcurrentRace(5, async (client, index, barrier) => {
      await barrier.wait();

      return client.$transaction(
        async (tx) => {
          const [locked] = await tx.$queryRaw<Array<{ id: string; available: number; reserved: number }>>(
            Prisma.sql`SELECT "id", "available", "reserved" FROM "CatalogInventoryLevel" WHERE "id" = ${levelId} FOR UPDATE`
          );

          if (!locked || locked.available < 1) {
            throw new Error("INSUFFICIENT_STOCK: Stock has been exhausted by another concurrent checkout.");
          }

          await tx.catalogInventoryLevel.update({
            where: { id: levelId },
            data: {
              available: { decrement: 1 },
              reserved: { increment: 1 },
              version: { increment: 1 },
            },
          });

          return { checkoutIndex: index, levelId };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    });

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(4);

    const updatedLevel = await prisma.catalogInventoryLevel.findUnique({ where: { id: levelId } });
    expect(updatedLevel?.available).toBe(initialAvailable - 1);
    expect(updatedLevel?.reserved).toBe(initialReserved + 1);
  });

  it("G4-CAT-002 [Idempotency]: Concurrent duplicate checkout submissions produce exactly 1 MarketplaceCheckout row", async () => {
    if (!safety.ok) return;

    const { cart } = await createGate4CheckoutScenario("checkout-conc", "idempotency");
    requireGate4Fixture(cart, "Cart fixture required");

    const publicRef = `chk_g4_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const results = await runConcurrentRace(5, async (client, _index, barrier) => {
      await barrier.wait();

      try {
        return await client.$transaction(async (tx) => {
          const existing = await tx.marketplaceCheckout.findFirst({
            where: { publicReference: publicRef },
          });

          if (existing) {
            return existing;
          }

          return await tx.marketplaceCheckout.create({
            data: {
              publicReference: publicRef,
              cartId: cart.id,
              status: "READY_FOR_REVIEW",
              acceptedFingerprint: "fp_test_123",
              merchandiseSubtotal: new Prisma.Decimal("100.00"),
              deliveryFeeTotal: new Prisma.Decimal("25.00"),
              grandTotal: new Prisma.Decimal("125.00"),
              currency: "ZAR",
            },
          });
        });
      } catch (e: unknown) {
        const row = await client.marketplaceCheckout.findFirst({ where: { publicReference: publicRef } });
        if (row) return row;
        throw e;
      }
    });

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBe(5);

    const countInDb = await prisma.marketplaceCheckout.count({ where: { publicReference: publicRef } });
    expect(countInDb).toBe(1);
  });

  it("G4-CAT-001 [Rollback]: Failure after inventory decrement rolls back stock level change completely", async () => {
    if (!safety.ok) return;

    const { store } = await createGate4Store("checkout-conc", "rollback-store");
    const { product } = await createGate4CatalogueProduct("checkout-conc", "rollback-prod", store.id);
    const { level } = await createGate4InventoryLevel("checkout-conc", "rollback-inv", product.id, store.id, { available: 5, reserved: 0 });
    requireGate4Fixture(level, "Inventory level fixture required");

    const levelId = level.id;
    const origAvailable = level.available;
    const origReserved = level.reserved;

    const failedTx = prisma.$transaction(async (tx) => {
      await tx.catalogInventoryLevel.update({
        where: { id: levelId },
        data: {
          available: { decrement: 1 },
          reserved: { increment: 1 },
        },
      });

      throw new Error("INJECTED_CHECKOUT_FAILURE_AFTER_RESERVATION");
    });

    await expect(failedTx).rejects.toThrow("INJECTED_CHECKOUT_FAILURE_AFTER_RESERVATION");

    const finalLevel = await prisma.catalogInventoryLevel.findUnique({ where: { id: levelId } });
    expect(finalLevel?.available).toBe(origAvailable);
    expect(finalLevel?.reserved).toBe(origReserved);
  });
});

