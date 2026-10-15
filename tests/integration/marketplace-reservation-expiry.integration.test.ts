import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createPrismaMarketplaceReservationRepository } from "@/lib/marketplace-checkout/prisma-marketplace-reservation.repository";
import { expireMarketplaceCheckoutReservation, reserveMarketplaceCheckoutInventory } from "@/lib/marketplace-checkout/inventory-reservation.service";
import { createGate4Store, createGate4ActiveProductScenario, gate4Prisma } from "./gate4/fixtures";

describe("reservation expiry payment race on disposable PostgreSQL", () => {
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.NODE_ENV === "production" || process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || !["/kt_launch_test", "/kt_courier_test"].includes(url.pathname) || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Disposable reservation expiry database required.");
  });
  afterAll(async () => { await gate4Prisma.$disconnect(); });
  async function fixture() {
    const nonce = randomUUID();
    const { store } = await createGate4Store("expiry", nonce);
    const product = await createGate4ActiveProductScenario("expiry", nonce, store.id, { available: 2 });
    const cart = await prisma.marketplaceCart.create({ data: { publicReference: `expiry-cart-${nonce}`, ownerType: "GUEST", guestTokenHash: nonce } });
    const checkout = await prisma.marketplaceCheckout.create({ data: { publicReference: `expiry-checkout-${nonce}`, cartId: cart.id, guestAccessTokenHash: nonce, status: "READY_FOR_REVIEW", acceptedFingerprint: "f".repeat(64), reviewAcceptedAt: new Date() } });
    const repository = createPrismaMarketplaceReservationRepository();
    const reservation = await reserveMarketplaceCheckoutInventory(repository, { checkoutId: checkout.id, publicReference: `expiry-reservation-${nonce}`, commercialFingerprint: "f".repeat(64), expiresAt: new Date(Date.now() + 60_000), operationId: `reserve-${nonce}`, lines: [{ lineReference: `line-${nonce}`, inventoryLevelId: product.level!.id, inventoryItemReference: product.inventoryItem!.publicReference, locationReference: product.location.publicReference, quantity: 1 }] });
    await prisma.marketplaceInventoryReservation.update({ where: { id: reservation.id }, data: { expiresAt: new Date(0) } });
    return { checkout, repository, candidate: { ...reservation, expiresAt: new Date(0) }, levelId: product.level!.id };
  }
  it("does not release inventory from a stale ACTIVE candidate after payment preparation commits", async () => {
    const { checkout, repository, candidate, levelId } = await fixture();
    // A CREATED payment is a pending obligation, never fabricated paid evidence.
    await prisma.payment.create({ data: { publicReference: `pay_${randomUUID()}`, subjectType: "MARKETPLACE_CHECKOUT", marketplaceCheckoutId: checkout.id, amount: "1.00", creationIdempotencyKey: randomUUID(), creationRequestHash: "a".repeat(64), status: "CREATED" } });
    expect(await expireMarketplaceCheckoutReservation(repository, candidate, new Date(), `expiry-${randomUUID()}`)).toBeNull();
    expect(await prisma.catalogInventoryLevel.findUniqueOrThrow({ where: { id: levelId } })).toMatchObject({ onHand: 2, reserved: 1, available: 1 });
    expect(await prisma.marketplaceInventoryReservation.findUniqueOrThrow({ where: { id: candidate.id } })).toMatchObject({ status: "ACTIVE" });
  });
  it("waits for the checkout/payment transaction and preserves its in-flight hold", async () => {
    const { checkout, repository, candidate, levelId } = await fixture();
    let announce!: () => void, release!: () => void;
    const locked = new Promise<void>(resolve => { announce = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const preparing = prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceCheckout" WHERE "id" = ${checkout.id} FOR UPDATE`);
      const payment = await tx.payment.create({ data: { publicReference: `pay_${randomUUID()}`, subjectType: "MARKETPLACE_CHECKOUT", marketplaceCheckoutId: checkout.id, amount: "1.00", creationIdempotencyKey: randomUUID(), creationRequestHash: "a".repeat(64), status: "CREATED" } });
      await tx.marketplaceInventoryReservation.update({ where: { id: candidate.id }, data: { status: "PAYMENT_PENDING_HOLD", paymentId: payment.id } });
      await tx.marketplaceCheckout.update({ where: { id: checkout.id }, data: { status: "PAYMENT_PENDING" } });
      announce(); await gate;
    });
    await locked;
    const expiring = expireMarketplaceCheckoutReservation(repository, candidate, new Date(), `expiry-${randomUUID()}`);
    release(); await preparing;
    expect(await expiring).toBeNull();
    expect(await prisma.catalogInventoryLevel.findUniqueOrThrow({ where: { id: levelId } })).toMatchObject({ onHand: 2, reserved: 1, available: 1 });
    expect(await prisma.marketplaceInventoryReservation.findUniqueOrThrow({ where: { id: candidate.id } })).toMatchObject({ status: "PAYMENT_PENDING_HOLD" });
  });
  it("expires an abandoned reservation exactly once under simultaneous expiry attempts", async () => {
    const { repository, candidate, levelId } = await fixture(); const operationId = `expiry-${randomUUID()}`;
    const results = await Promise.all([expireMarketplaceCheckoutReservation(repository, candidate, new Date(), operationId), expireMarketplaceCheckoutReservation(repository, candidate, new Date(), operationId)]);
    expect(results.every(result => result?.status === "EXPIRED")).toBe(true);
    expect(await prisma.catalogInventoryLevel.findUniqueOrThrow({ where: { id: levelId } })).toMatchObject({ onHand: 2, reserved: 0, available: 2 });
    expect(await prisma.catalogInventoryMovement.count({ where: { operationId: `${operationId}:${levelId}`, type: "RESERVATION_RELEASE" } })).toBe(1);
  });
});
