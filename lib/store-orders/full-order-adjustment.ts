import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { frozenRefundAllocation, cents, money } from "./allocation";
import { assertStoreOrder } from "./errors";

/** Only an unaccepted, unstarted child with no courier obligation has an
 * automatic full cancellation boundary. Later stages require policy review. */
export function unearnedStoreOrderCancellation(order: { acceptanceStatus: string; preparationStatus: string; deliveryBridge: unknown }) {
  return order.preparationStatus === "NOT_STARTED" && !["ACCEPTED", "REJECTED", "TIMED_OUT"].includes(order.acceptanceStatus) && !order.deliveryBridge;
}

export async function createUnstartedFullAdjustment(tx: Prisma.TransactionClient, input: { storeOrderId: string; adjustmentType: "FULL_STORE_REJECTION" | "CUSTOMER_CANCELLATION"; actorUserId?: string; reasonCode: string; operationId: string; requestHash: string; publicReference: string }) {
  const order = await tx.marketplaceStoreOrder.findUniqueOrThrow({ where: { id: input.storeOrderId }, include: { store: { select: { ownerUserId: true } }, marketplaceOrder: true, deliveryBridge: true, settlementSnapshots: { orderBy: { createdAt: "asc" } }, lines: { include: { financialAllocations: true, fulfilment: true, issues: true } } } });
  assertStoreOrder(unearnedStoreOrderCancellation(order), "STORE_ORDER_CANCELLATION_TOO_LATE", "Automatic full cancellation requires unaccepted, unstarted goods and no courier obligation.");
  const snapshot = order.settlementSnapshots[0];
  assertStoreOrder(snapshot && snapshot.sourcePaymentId === order.marketplaceOrder.paymentId && snapshot.sourceCheckoutId === order.marketplaceOrder.checkoutId && snapshot.deliveryFeeResidual.equals(order.deliveryFee), "STORE_ORDER_FINANCIAL_ALLOCATION_INVALID", "Exact frozen settlement evidence is required.");
  const previous = await tx.marketplaceStoreOrderAdjustment.findMany({ where: { marketplaceStoreOrderId: order.id, status: { not: "REJECTED" } }, include: { allocations: true } });
  const priorFee = previous.reduce((total, item) => total.add(item.deliveryFeeAmount), new Prisma.Decimal(0));
  const fee = snapshot.deliveryFeeResidual.sub(priorFee);
  assertStoreOrder(fee.greaterThanOrEqualTo(0), "STORE_ORDER_FINANCIAL_ALLOCATION_INVALID", "Prior delivery refunds exceed the frozen fee.");
  const allocations = order.lines.flatMap(line => {
    const source = Object.fromEntries(line.financialAllocations.map(item => [item.type, item.amount.toFixed(2)]));
    assertStoreOrder(line.financialAllocations.length === 3 && Object.keys(source).length === 3, "STORE_ORDER_FINANCIAL_ALLOCATION_INVALID", "All immutable line allocations are required.");
    const prior = money(previous.flatMap(item => item.allocations).filter(item => item.marketplaceOrderLineId === line.id && item.allocationType === "SELLER_BASIS").reduce((total, item) => total + cents(item.amount.toFixed(2)), BigInt(0)));
    const remaining = money(cents(source.SELLER_BASIS) - cents(prior));
    const values = frozenRefundAllocation({ sellerBasis: source.SELLER_BASIS, commission: source.COMMISSION, storeEarning: source.STORE_EARNING, includedTax: line.includedTaxAmount?.toFixed(2) ?? "0.00", priorRefund: prior, refund: remaining });
    return line.financialAllocations.map(item => ({ marketplaceOrderLineId: line.id, allocationType: item.type, amount: values[item.type], taxAmount: item.type === "SELLER_BASIS" ? values.taxAmount : null, originalQuantity: line.quantity, resolvedQuantityBefore: line.fulfilment?.resolvedFulfilmentQuantity ?? 0, resolvedQuantityAfter: line.quantity, sourceAllocationVersion: item.allocationVersion, roundingSequence: item.roundingSequence, finalCentRecipient: item.finalCentRecipient }));
  });
  const refund = allocations.filter(item => item.allocationType === "SELLER_BASIS").reduce((total, item) => total.add(item.amount), fee);
  const issues = order.lines.flatMap(line => line.issues).filter(issue => ["OPEN", "CUSTOMER_ACTION_REQUIRED"].includes(issue.status));
  const inventory = await reverseUnstartedGoodsCommitments(tx, order, input);
  const adjustment = await tx.marketplaceStoreOrderAdjustment.create({ data: { publicReference: input.publicReference, marketplaceStoreOrderId: order.id, adjustmentType: input.adjustmentType, status: "APPROVED", reasonCode: input.reasonCode, sourceVersion: snapshot.settlementVersion, operationId: input.operationId, requestHash: input.requestHash, refundAmount: refund, deliveryFeeAmount: fee, financialEvidence: { settlementSnapshotReference: snapshot.publicReference, sourceCommercialFingerprint: snapshot.sourceCommercialFingerprint, refundMethod: "ORIGINAL_PAYMENT_METHOD", inventory, issueReferences: issues.map(issue => issue.publicReference), unearnedDeliveryFee: { settlementSnapshotReference: snapshot.publicReference, amount: fee.toFixed(2), preparationStatus: "NOT_STARTED", bridgeAbsent: true } }, allocations: { create: allocations } } });
  await tx.marketplaceStoreOrderIssue.updateMany({ where: { id: { in: issues.map(issue => issue.id) } }, data: { status: "REFUND_PENDING", version: { increment: 1 } } });
  return adjustment.publicReference;
}

type GoodsOrder = Prisma.MarketplaceStoreOrderGetPayload<{ include: { store: { select: { ownerUserId: true } }; marketplaceOrder: true; deliveryBridge: true; settlementSnapshots: true; lines: { include: { financialAllocations: true; fulfilment: true; issues: true } } } }>;
async function reverseUnstartedGoodsCommitments(tx: Prisma.TransactionClient, order: GoodsOrder, input: { actorUserId?: string; operationId: string; requestHash: string }) {
  const job = await tx.marketplaceStoreSettlementJob.findFirstOrThrow({ where: { marketplaceStoreOrderId: order.id }, orderBy: { createdAt: "asc" } });
  const suffix = `:settlement:${order.id}`;
  assertStoreOrder(job.operationId.endsWith(suffix), "STORE_ORDER_INVENTORY_INCOHERENT", "Canonical order finalization identity is required.");
  const finalizationOperation = job.operationId.slice(0, -suffix.length);
  const actorUserId = input.actorUserId ?? order.store.ownerUserId;
  assertStoreOrder(actorUserId, "STORE_ORDER_INVENTORY_INCOHERENT", "Canonical inventory actor is required.");
  const reservation = await tx.marketplaceInventoryReservation.findFirstOrThrow({ where: { checkoutId: order.marketplaceOrder.checkoutId, paymentId: order.marketplaceOrder.paymentId, status: "CONSUMED" }, include: { items: { include: { inventoryLevel: { include: { inventoryItem: { include: { offer: true } } } } } } } });
  const sources = await tx.marketplaceCheckoutLineSnapshot.findMany({ where: { id: { in: order.lines.map(line => line.checkoutLineSnapshotId) }, checkoutId: order.marketplaceOrder.checkoutId } });
  const restore = new Map<string, number>();
  const sourceQuantities = new Map<string, number>();
  const withheld: Array<{ lineId: string; quantity: number; disposition: string }> = [];
  for (const line of order.lines) {
    const source = sources.find(item => item.id === line.checkoutLineSnapshotId);
    assertStoreOrder(source && source.quantity === line.quantity && source.offerReference === line.offerReference, "STORE_ORDER_INVENTORY_INCOHERENT", "Frozen line inventory identity is required.");
    // Historical checkout snapshots can lack inventory IDs. The payment-bound
    // consumed reservation is the immutable authority for the actual sale,
    // never a fresh search for available stock or a mutable primary location.
    const candidates = reservation.items.filter(item => {
      const level = item.inventoryLevel;
      return level.inventoryItem.offer.publicReference === source.offerReference &&
        level.inventoryItem.offer.storeId === order.storeId &&
        (!source.inventoryItemId || level.inventoryItemId === source.inventoryItemId) &&
        (!source.inventoryLocationId || level.locationId === source.inventoryLocationId);
    });
    assertStoreOrder(candidates.length === 1, "STORE_ORDER_INVENTORY_INCOHERENT", "One exact consumed source inventory binding is required.");
    const reservedItem = candidates[0];
    const level = reservedItem.inventoryLevel;
    assertStoreOrder(reservedItem.inventoryItemReference === level.inventoryItem.publicReference && reservedItem.locationReference === level.locationId, "STORE_ORDER_INVENTORY_INCOHERENT", "Consumed reservation item and location must match its level.");
    const sourceQuantity = (sourceQuantities.get(level.id) ?? 0) + line.quantity;
    assertStoreOrder(sourceQuantity <= reservedItem.quantity, "STORE_ORDER_INVENTORY_INCOHERENT", "Frozen line quantities exceed their consumed reservation.");
    sourceQuantities.set(level.id, sourceQuantity);
    const commit = await tx.catalogInventoryMovement.findUnique({ where: { inventoryItemId_operationId: { inventoryItemId: level.inventoryItemId, operationId: `${finalizationOperation}:${level.id}` } } });
    assertStoreOrder(commit?.type === "SALE_COMMITMENT" && commit.locationId === level.locationId && commit.quantityDelta === -reservedItem.quantity, "STORE_ORDER_INVENTORY_INCOHERENT", "Exact sale commitment is required before reversal.");
    // Shortages/damage never turn into invented physical stock. ORDERED goods
    // have not been touched; reviewed goods restore only confirmed availability.
    const quantity = line.fulfilment?.status === "ORDERED" ? line.quantity : line.fulfilment?.confirmedAvailableQuantity ?? 0;
    assertStoreOrder(quantity >= 0 && quantity <= line.quantity && !line.fulfilment?.handedOffQuantity, "STORE_ORDER_INVENTORY_INCOHERENT", "Only unhanded confirmed goods can be restored.");
    restore.set(level.id, (restore.get(level.id) ?? 0) + quantity);
    if (quantity < line.quantity) withheld.push({ lineId: line.id, quantity: line.quantity - quantity, disposition: line.issues.some(issue => issue.issueType === "DAMAGED") ? "QUARANTINE" : "SHORTAGE_NO_RESTOCK" });
  }
  const substitutions = await tx.marketplaceStoreOrderSubstitutionReservation.findMany({ where: { marketplaceStoreOrderId: order.id, status: { in: ["ACTIVE", "CONSUMED"] } }, include: { proposal: { include: { decision: true } } } });
  const levelIds = [...new Set([...restore.keys(), ...substitutions.map(item => item.inventoryLevelId)])].sort();
  if (levelIds.length) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "CatalogInventoryLevel" WHERE "id" IN (${Prisma.join(levelIds)}) ORDER BY "id" FOR UPDATE`);
  for (const sub of substitutions) {
    const level = await tx.catalogInventoryLevel.findUniqueOrThrow({ where: { id: sub.inventoryLevelId } });
    if (sub.status === "CONSUMED") {
      const decision = sub.proposal.decision;
      assertStoreOrder(decision, "STORE_ORDER_INVENTORY_INCOHERENT", "Approved replacement decision is required.");
      const commit = await tx.catalogInventoryMovement.findUnique({ where: { inventoryItemId_operationId: { inventoryItemId: sub.inventoryItemId, operationId: `${decision.operationId}:commit` } } });
      assertStoreOrder(commit?.type === "ORDER_SUBSTITUTION_COMMITMENT" && commit.quantityDelta === -sub.quantity && commit.locationId === level.locationId, "STORE_ORDER_INVENTORY_INCOHERENT", "Exact replacement consumption is required.");
      restore.set(level.id, (restore.get(level.id) ?? 0) + sub.quantity);
    } else {
      assertStoreOrder(level.reserved >= sub.quantity, "STORE_ORDER_INVENTORY_INCOHERENT", "Active replacement reservation is incoherent.");
      await tx.catalogInventoryLevel.update({ where: { id: level.id }, data: { reserved: { decrement: sub.quantity }, available: { increment: sub.quantity }, version: { increment: 1 } } });
      await tx.catalogInventoryMovement.create({ data: { publicReference: `CIM-${randomUUID().replaceAll("-", "").toUpperCase()}`, inventoryItemId: level.inventoryItemId, locationId: level.locationId, type: "ORDER_SUBSTITUTION_RELEASE", quantityDelta: 0, operationId: `${input.operationId}:release:${sub.id}`, requestHash: input.requestHash, reasonCode: "UNSTARTED_FULL_CANCELLATION", actorUserId, resultingOnHand: level.onHand } });
      await tx.marketplaceStoreOrderSubstitutionReservation.update({ where: { id: sub.id }, data: { status: "RELEASED", releasedAt: new Date() } });
      await tx.marketplaceStoreOrderSubstitutionProposal.update({ where: { id: sub.proposalId }, data: { status: "REJECTED", decidedAt: new Date() } });
    }
  }
  const restored = [];
  for (const [id, quantity] of [...restore.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (!quantity) continue;
    const level = await tx.catalogInventoryLevel.findUniqueOrThrow({ where: { id } });
    const updated = await tx.catalogInventoryLevel.update({ where: { id }, data: { onHand: { increment: quantity }, available: { increment: quantity }, version: { increment: 1 } } });
    const movement = await tx.catalogInventoryMovement.create({ data: { publicReference: `CIM-${randomUUID().replaceAll("-", "").toUpperCase()}`, inventoryItemId: level.inventoryItemId, locationId: level.locationId, type: "ORDER_CANCELLATION_RESTOCK", quantityDelta: quantity, operationId: `${input.operationId}:restore:${id}`, requestHash: input.requestHash, reasonCode: "UNSTARTED_FULL_CANCELLATION", actorUserId, resultingOnHand: updated.onHand } });
    restored.push({ levelId: id, quantity, movementReference: movement.publicReference });
  }
  return { restored, withheld };
}
