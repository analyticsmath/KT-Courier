/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma generation is deferred to Phase 26.5. */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import type { MarketplaceReservationRepository, MarketplaceReservationState, ReservationLine } from "@/lib/marketplace-checkout/inventory-reservation.service";

const reference = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "")}`;

function state(row: any): MarketplaceReservationState {
  return Object.freeze({ id: row.id, checkoutId: row.checkoutId, status: row.status, commercialFingerprint: row.commercialFingerprint, expiresAt: row.expiresAt, paymentId: row.paymentId, items: Object.freeze(row.items.map((item: any) => Object.freeze({ lineReference: item.id, inventoryLevelId: item.inventoryLevelId, inventoryItemReference: item.inventoryItemReference, locationReference: item.locationReference, quantity: item.quantity }))) });
}

/** Concrete stable-order reservation repository shared by customer and recovery paths. */
export function createPrismaMarketplaceReservationRepository(database: any = prisma): MarketplaceReservationRepository {
  let db = database;
  return Object.freeze({
    transaction: async <T>(work: () => Promise<T>) => database.$transaction(async (tx: any) => { const previous = db; db = tx; try { return await work(); } finally { db = previous; } }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
    lockCheckout: async (checkoutId) => {
      await db.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceCheckout" WHERE "id" = ${checkoutId} FOR UPDATE`);
      const checkout = await db.marketplaceCheckout.findUnique({ where: { id: checkoutId } });
      return checkout ? { id: checkout.id, status: checkout.status, acceptedFingerprint: checkout.acceptedFingerprint, reviewAcceptedAt: checkout.reviewAcceptedAt } : null;
    },
    lockLevelsInStableOrder: async (levelIds) => {
      const ordered = [...new Set(levelIds)].sort();
      if (!ordered.length) return Object.freeze([]);
      await db.$queryRaw(Prisma.sql`SELECT "id" FROM "CatalogInventoryLevel" WHERE "id" IN (${Prisma.join(ordered)}) ORDER BY "id" ASC FOR UPDATE`);
      const rows = await db.catalogInventoryLevel.findMany({ where: { id: { in: ordered } }, orderBy: { id: "asc" } });
      return Object.freeze(rows.map((row: any) => Object.freeze({ id: row.id, onHand: row.onHand, reserved: row.reserved, available: row.available })));
    },
    findActiveReservation: async (checkoutId) => {
      const row = await db.marketplaceInventoryReservation.findFirst({ where: { checkoutId, status: { in: ["ACTIVE", "PAYMENT_PENDING_HOLD", "PAYMENT_UNCERTAIN", "RECONCILIATION_REQUIRED"] } }, include: { items: true }, orderBy: { createdAt: "asc" } });
      if (!row) return null;
      await db.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceInventoryReservation" WHERE "id" = ${row.id} FOR UPDATE`);
      return state(row);
    },
    createReservation: async (input) => state(await db.marketplaceInventoryReservation.create({ data: { publicReference: input.id, checkoutId: input.checkoutId, status: input.status, commercialFingerprint: input.commercialFingerprint, expiresAt: input.expiresAt, paymentId: input.paymentId ?? null, items: { create: input.items.map((item: ReservationLine) => ({ inventoryLevelId: item.inventoryLevelId, inventoryItemReference: item.inventoryItemReference, locationReference: item.locationReference, quantity: item.quantity })) } }, include: { items: true } })),
    updateReservation: async (id, patch) => state(await db.marketplaceInventoryReservation.update({ where: { id }, data: { status: patch.status, paymentId: patch.paymentId, consumedAt: patch.status === "CONSUMED" ? new Date() : undefined, releasedAt: ["RELEASED", "EXPIRED"].includes(patch.status ?? "") ? new Date() : undefined, releaseReason: patch.status === "EXPIRED" ? "CHECKOUT_EXPIRED" : undefined }, include: { items: true } })),
    applyLevelReservation: async (levelId, quantityDelta) => {
      const level = await db.catalogInventoryLevel.findUnique({ where: { id: levelId } });
      if (!level || level.reserved + quantityDelta < 0 || level.available - quantityDelta < 0) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Locked inventory level cannot apply the requested reservation change.");
      await db.catalogInventoryLevel.update({ where: { id: levelId }, data: { reserved: { increment: quantityDelta }, available: { decrement: quantityDelta }, version: { increment: 1 } } });
    },
    applyLevelCommitment: async (levelId, quantity) => {
      const level = await db.catalogInventoryLevel.findUnique({ where: { id: levelId } });
      if (!level || level.reserved < quantity || level.onHand < quantity) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Locked inventory level cannot be committed.");
      await db.catalogInventoryLevel.update({ where: { id: levelId }, data: { reserved: { decrement: quantity }, onHand: { decrement: quantity }, version: { increment: 1 } } });
    },
    appendMovement: async ({ levelId, type, quantityDelta, operationId, reasonCode }) => {
      const level = await db.catalogInventoryLevel.findUnique({ where: { id: levelId }, include: { inventoryItem: { include: { offer: { include: { store: true } } } } } });
      const actorUserId = level?.inventoryItem.offer.store.ownerUserId;
      if (!level || !actorUserId) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Inventory movement lacks canonical store owner evidence.");
      await db.catalogInventoryMovement.create({ data: { publicReference: reference("cim"), inventoryItemId: level.inventoryItemId, locationId: level.locationId, type, quantityDelta, operationId, requestHash: operationId, reasonCode, actorUserId, resultingOnHand: level.onHand } });
    },
    updateCheckout: async (checkoutId, patch) => { await db.marketplaceCheckout.update({ where: { id: checkoutId }, data: { status: patch.status, reservationExpiresAt: patch.reservationExpiresAt, version: { increment: 1 } } }); },
    completeOperation: async ({ checkoutId, operationId, requestHash, type, response }) => {
      const prior = await db.marketplaceCheckoutOperation.findUnique({ where: { checkoutId_operationId: { checkoutId, operationId } } });
      if (prior && prior.requestHash !== requestHash) throw new MarketplaceCheckoutError("CHECKOUT_OPERATION_CONFLICT", "Reservation operation ID is bound to different immutable checkout evidence.");
      if (!prior) await db.marketplaceCheckoutOperation.create({ data: { checkoutId, operationId, requestHash, type, response } });
    },
  });
}
