/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma generation is deferred to Phase 26.5. */
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { withSerializableRetry } from "@/lib/db/serializable-retry";
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
  const transactions = new AsyncLocalStorage<any>();
  const current = () => transactions.getStore() ?? database;
  return Object.freeze({
    transaction: async <T>(work: () => Promise<T>) => transactions.getStore() ? work() : withSerializableRetry<T>(() => database.$transaction((tx: any) => transactions.run(tx, work), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000, maxWait: 10000 })),
    lockCheckout: async (checkoutId) => {
      await current().$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceCheckout" WHERE "id" = ${checkoutId} FOR UPDATE`);
      const checkout = await current().marketplaceCheckout.findUnique({ where: { id: checkoutId } });
      return checkout ? { id: checkout.id, status: checkout.status, acceptedFingerprint: checkout.acceptedFingerprint, reviewAcceptedAt: checkout.reviewAcceptedAt } : null;
    },
    lockLevelsInStableOrder: async (levelIds) => {
      const ordered = [...new Set(levelIds)].sort();
      if (!ordered.length) return Object.freeze([]);
      await current().$queryRaw(Prisma.sql`SELECT "id" FROM "CatalogInventoryLevel" WHERE "id" IN (${Prisma.join(ordered)}) ORDER BY "id" ASC FOR UPDATE`);
      const rows = await current().catalogInventoryLevel.findMany({ where: { id: { in: ordered } }, orderBy: { id: "asc" } });
      return Object.freeze(rows.map((row: any) => Object.freeze({ id: row.id, onHand: row.onHand, reserved: row.reserved, available: row.available })));
    },
    findActiveReservation: async (checkoutId) => {
      const row = await current().marketplaceInventoryReservation.findFirst({ where: { checkoutId, status: { in: ["ACTIVE", "PAYMENT_PENDING_HOLD", "PAYMENT_UNCERTAIN", "RECONCILIATION_REQUIRED"] } }, include: { items: true }, orderBy: { createdAt: "asc" } });
      if (!row) return null;
      await current().$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceInventoryReservation" WHERE "id" = ${row.id} FOR UPDATE`);
      return state(row);
    },
    lockReservationForRelease: async (checkoutId, reservationId) => {
      const client = transactions.getStore();
      if (!client) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Reservation release requires one active transaction.");
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceCheckout" WHERE "id" = ${checkoutId} FOR UPDATE`);
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceInventoryReservation" WHERE "id" = ${reservationId} AND "checkoutId" = ${checkoutId} FOR UPDATE`);
      const row = await client.marketplaceInventoryReservation.findFirst({ where: { id: reservationId, checkoutId }, include: { items: true } });
      if (!row) return null;
      // Payment may be linked to checkout before the reservation records its ID.
      // Inspect both bindings while checkout + reservation are locked, rather
      // than accepting a caller's old payment status or an ACTIVE snapshot.
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "marketplaceCheckoutId" = ${checkoutId} OR "id" = ${row.paymentId ?? ""} ORDER BY "id" FOR UPDATE`);
      const payments = await client.payment.findMany({ where: { OR: [{ marketplaceCheckoutId: checkoutId }, ...(row.paymentId ? [{ id: row.paymentId }] : [])] }, select: { id: true, status: true } });
      const checkout = await client.marketplaceCheckout.findUnique({ where: { id: checkoutId }, select: { status: true } });
      const terminalFailures = ["FAILED", "CANCELLED", "EXPIRED"];
      const unsafe = payments.find((payment: any) => !terminalFailures.includes(payment.status));
      const paymentStatus = unsafe?.status ?? payments[0]?.status ?? null;
      const noPaymentAuthority = !!checkout && ["READY_FOR_REVIEW", "RESERVED", "CANCELLED", "EXPIRED"].includes(checkout.status) && row.status === "ACTIVE" && !row.paymentId;
      const paymentBindingFound = !row.paymentId || payments.some((payment: any) => payment.id === row.paymentId);
      return { reservation: state(row), paymentStatus, paymentOutcomeKnown: paymentBindingFound && !unsafe && (payments.length > 0 || noPaymentAuthority) };
    },
    createReservation: async (input) => state(await current().marketplaceInventoryReservation.create({ data: { publicReference: input.id, checkoutId: input.checkoutId, status: input.status, commercialFingerprint: input.commercialFingerprint, expiresAt: input.expiresAt, paymentId: input.paymentId ?? null, items: { create: input.items.map((item: ReservationLine) => ({ inventoryLevelId: item.inventoryLevelId, inventoryItemReference: item.inventoryItemReference, locationReference: item.locationReference, quantity: item.quantity })) } }, include: { items: true } })),
    updateReservation: async (id, patch) => state(await current().marketplaceInventoryReservation.update({ where: { id }, data: { status: patch.status, paymentId: patch.paymentId, consumedAt: patch.status === "CONSUMED" ? new Date() : undefined, releasedAt: ["RELEASED", "EXPIRED"].includes(patch.status ?? "") ? new Date() : undefined, releaseReason: patch.status === "EXPIRED" ? "CHECKOUT_EXPIRED" : undefined }, include: { items: true } })),
    applyLevelReservation: async (levelId, quantityDelta) => {
      const level = await current().catalogInventoryLevel.findUnique({ where: { id: levelId } });
      if (!level || level.reserved + quantityDelta < 0 || level.available - quantityDelta < 0) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Locked inventory level cannot apply the requested reservation change.");
      await current().catalogInventoryLevel.update({ where: { id: levelId }, data: { reserved: { increment: quantityDelta }, available: { decrement: quantityDelta }, version: { increment: 1 } } });
    },
    applyLevelCommitment: async (levelId, quantity) => {
      const level = await current().catalogInventoryLevel.findUnique({ where: { id: levelId } });
      if (!level || level.reserved < quantity || level.onHand < quantity) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Locked inventory level cannot be committed.");
      await current().catalogInventoryLevel.update({ where: { id: levelId }, data: { reserved: { decrement: quantity }, onHand: { decrement: quantity }, version: { increment: 1 } } });
    },
    appendMovement: async ({ levelId, type, quantityDelta, operationId, reasonCode }) => {
      const level = await current().catalogInventoryLevel.findUnique({ where: { id: levelId }, include: { inventoryItem: { include: { offer: { include: { store: true } } } } } });
      const actorUserId = level?.inventoryItem.offer.store.ownerUserId;
      if (!level || !actorUserId) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Inventory movement lacks canonical store owner evidence.");
      await current().catalogInventoryMovement.create({ data: { publicReference: reference("cim"), inventoryItemId: level.inventoryItemId, locationId: level.locationId, type, quantityDelta, operationId, requestHash: operationId, reasonCode, actorUserId, resultingOnHand: level.onHand } });
    },
    updateCheckout: async (checkoutId, patch) => { await current().marketplaceCheckout.update({ where: { id: checkoutId }, data: { status: patch.status, reservationExpiresAt: patch.reservationExpiresAt, version: { increment: 1 } } }); },
    completeOperation: async ({ checkoutId, operationId, requestHash, type, response }) => {
      const prior = await current().marketplaceCheckoutOperation.findUnique({ where: { checkoutId_operationId: { checkoutId, operationId } } });
      if (prior && prior.requestHash !== requestHash) throw new MarketplaceCheckoutError("CHECKOUT_OPERATION_CONFLICT", "Reservation operation ID is bound to different immutable checkout evidence.");
      if (!prior) await current().marketplaceCheckoutOperation.create({ data: { checkoutId, operationId, requestHash, type, response } });
    },
  });
}
