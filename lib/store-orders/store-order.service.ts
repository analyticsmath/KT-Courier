/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 21 Prisma delegates are intentionally dynamic until Phase 26.5 permits generation. */
import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resolveMarketplaceCartLine } from "@/lib/marketplace-checkout/cart.service";
import { hashMarketplaceGuestSecret, verifyMarketplaceGuestSecret } from "@/lib/marketplace-checkout/tokens";
import { cumulativeLineAllocation, assertSubstitutionPriceCap, cents, money } from "@/lib/store-orders/allocation";
import { type StoreOrderDependencies } from "@/lib/store-orders/contracts";
import { resolveStoreOrderProductionComposition } from "@/lib/store-orders/composition-root";
import { StoreOrderError, assertStoreOrder } from "@/lib/store-orders/errors";
import { assertStoreOrderProductionReady } from "@/lib/store-orders/production-lock";
import { requireStoreOrderActor, type StoreOrderPermission } from "@/lib/store-orders/store-order-auth";
import { assertAcceptanceTransition, assertFinancialTransition, assertPreparationTransition, deriveStoreOrderStatus } from "@/lib/store-orders/state-machine";

type Delegate = { findUnique: (args: unknown) => Promise<any>; findFirst: (args: unknown) => Promise<any>; findMany: (args: unknown) => Promise<any[]>; create: (args: unknown) => Promise<any>; update: (args: unknown) => Promise<any>; updateMany: (args: unknown) => Promise<{ count: number }>; upsert: (args: unknown) => Promise<any> };
type Phase21Database = Record<string, Delegate>;
type TestApproval = { approved: true } | undefined;

const db = prisma as unknown as Phase21Database;
const ref = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "")}`;
const requestHash = (type: string, payload: unknown) => createHash("sha256").update(`${type}:${JSON.stringify(payload)}`).digest("hex");
const safeNote = (value: string | undefined, max = 500) => value?.trim().slice(0, max) || null;

function model(tx: Phase21Database, name: string): Delegate {
  const delegate = tx[name];
  if (!delegate) throw new StoreOrderError("STORE_ORDER_SCHEMA_UNAVAILABLE", "Store-order schema is unavailable in this runtime.");
  return delegate;
}

async function transaction<T>(work: (tx: Phase21Database) => Promise<T>): Promise<T> {
  return prisma.$transaction((tx) => work(tx as unknown as Phase21Database), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function lockOrder(tx: Phase21Database, publicReference: string) {
  const order = await model(tx, "marketplaceStoreOrder").findUnique({
    where: { publicReference },
    include: {
      store: { select: { id: true, status: true } },
      marketplaceOrder: { select: { customerUserId: true, paymentId: true, guestConfirmationHash: true } },
      checkoutStoreGroup: { select: { fulfilmentMode: true, pickupLocationReference: true, deliveryQuoteReference: true, deliveryQuoteVersion: true } },
      lines: { include: { financialAllocations: true, fulfilment: { include: { issues: { where: { status: { in: ["OPEN", "CUSTOMER_ACTION_REQUIRED", "REFUND_PENDING"] } } } } } } },
      settlementSnapshots: { orderBy: { createdAt: "asc" } },
      operationalPolicy: true,
      deliveryBridge: true,
      pickupHandoff: true,
    },
  });
  if (!order) throw new StoreOrderError("STORE_ORDER_NOT_FOUND", "Store order was not found.");
  return order;
}

async function replay(tx: Phase21Database, storeOrderId: string, operationId: string, hash: string) {
  const prior = await model(tx, "marketplaceStoreOrderOperation").findUnique({ where: { marketplaceStoreOrderId_operationId: { marketplaceStoreOrderId: storeOrderId, operationId } } });
  if (!prior) return null;
  if (prior.requestHash !== hash) throw new StoreOrderError("STORE_ORDER_IDEMPOTENCY_CONFLICT", "Operation ID belongs to a different request.");
  return { ...(prior.response as Record<string, unknown>), replayed: true };
}

async function receipt(tx: Phase21Database, input: Readonly<{ storeOrderId: string; operationId: string; hash: string; type: string; response: Record<string, unknown> }>) {
  await model(tx, "marketplaceStoreOrderOperation").create({ data: { marketplaceStoreOrderId: input.storeOrderId, operationId: input.operationId, requestHash: input.hash, operationType: input.type, response: input.response } });
}

async function history(tx: Phase21Database, input: Readonly<{ storeOrderId: string; operationId: string; eventType: string; actorUserId?: string; from?: Record<string, unknown>; to?: Record<string, unknown>; evidence?: Record<string, unknown> }>) {
  await model(tx, "marketplaceStoreOrderHistory").create({ data: { marketplaceStoreOrderId: input.storeOrderId, operationId: input.operationId, eventType: input.eventType, actorUserId: input.actorUserId ?? null, fromEvidence: input.from ?? null, toEvidence: input.to ?? null, safeEvidence: input.evidence ?? null } });
  await model(tx, "marketplaceStoreOrderEventIntent").create({ data: { publicReference: ref("soevt"), marketplaceStoreOrderId: input.storeOrderId, eventType: input.eventType, payload: input.evidence ?? {}, dedupeKey: `${input.storeOrderId}:${input.operationId}:${input.eventType}` } });
}

function checkOperation(input: Readonly<{ operationId: string; hash: string }>) {
  assertStoreOrder(/^[A-Za-z0-9_-]{12,160}$/.test(input.operationId), "STORE_ORDER_OPERATION_INVALID", "A valid operation ID is required.");
  assertStoreOrder(/^[a-f0-9]{64}$/.test(input.hash), "STORE_ORDER_REQUEST_HASH_INVALID", "A request hash is required.");
}

function currentPolicy(order: any) {
  const policy = order.operationalPolicy;
  if (!policy || !["ACTIVE", "RETIRED"].includes(policy.status) || !order.operationalPolicyReference || !order.operationalPolicyVersion || !order.operationalSnapshot || policy.publicReference !== order.operationalPolicyReference || policy.versionNumber !== order.operationalPolicyVersion) throw new StoreOrderError("STORE_ORDER_POLICY_MISSING", "Immutable operational policy evidence is unavailable.");
  return policy;
}

function updateProjection(order: any, patch: Record<string, unknown>) {
  const next = {
    acceptance: String(patch.acceptanceStatus ?? order.acceptanceStatus),
    preparation: String(patch.preparationStatus ?? order.preparationStatus),
    resolution: String(patch.resolutionStatus ?? order.resolutionStatus),
    delivery: String(patch.deliveryBridgeStatus ?? order.deliveryBridgeStatus),
  };
  return { ...patch, derivedStatus: deriveStoreOrderStatus(next as never), operationalVersion: { increment: 1 } };
}

async function updateOrder(tx: Phase21Database, order: any, patch: Record<string, unknown>) {
  const result = await model(tx, "marketplaceStoreOrder").updateMany({ where: { id: order.id, operationalVersion: order.operationalVersion }, data: updateProjection(order, patch) });
  if (result.count !== 1) throw new StoreOrderError("STORE_ORDER_CONCURRENCY_CONFLICT", "Store order changed concurrently.", true);
}

async function authorize(tx: Phase21Database, publicReference: string, actorUserId: string, permission: StoreOrderPermission) {
  const order = await lockOrder(tx, publicReference);
  await requireStoreOrderActor({ actorUserId, storeId: order.storeId, permission });
  return order;
}

export function operationalPolicyBounds(input: Readonly<{ acceptanceWindowSeconds: number; customerDecisionWindowSeconds: number; maximumPrepMinutes: number; maximumPrepExtensionMinutes: number; maximumIssueCount: number; maximumSubstitutionProposalsPerLine: number }>) {
  const bounded = [input.acceptanceWindowSeconds, input.customerDecisionWindowSeconds, input.maximumPrepMinutes, input.maximumPrepExtensionMinutes, input.maximumIssueCount, input.maximumSubstitutionProposalsPerLine].every((value) => Number.isInteger(value) && value > 0);
  assertStoreOrder(bounded && input.acceptanceWindowSeconds <= 86_400 && input.customerDecisionWindowSeconds <= 172_800 && input.maximumPrepMinutes <= 1_440 && input.maximumPrepExtensionMinutes <= 720 && input.maximumIssueCount <= 100 && input.maximumSubstitutionProposalsPerLine <= 5, "STORE_ORDER_POLICY_INVALID", "Operational policy values exceed their bounded range.");
  return input;
}

export async function beginStoreOrderReview(input: Readonly<{ storeOrderReference: string; actorUserId: string; operationId: string; requestHash: string; testApproval?: TestApproval }>) {
  assertStoreOrderProductionReady("REVIEW", input.testApproval); checkOperation({ operationId: input.operationId, hash: input.requestHash });
  return transaction(async (tx) => {
    const order = await authorize(tx, input.storeOrderReference, input.actorUserId, "store_orders.review");
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    currentPolicy(order);
    if (order.reviewDeadlineAt && order.reviewDeadlineAt <= new Date()) throw new StoreOrderError("STORE_ORDER_REVIEW_EXPIRED", "The merchant review deadline has passed.");
    assertAcceptanceTransition(order.acceptanceStatus, "REVIEWING");
    await updateOrder(tx, order, { acceptanceStatus: "REVIEWING", reviewedByUserId: input.actorUserId, reviewedAt: new Date() });
    const response = { storeOrderReference: order.publicReference, acceptanceStatus: "REVIEWING" };
    await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "STORE_ORDER_REVIEW_BEGUN", actorUserId: input.actorUserId, from: { acceptanceStatus: order.acceptanceStatus }, to: response });
    await receipt(tx, { storeOrderId: order.id, operationId: input.operationId, hash: input.requestHash, type: "REVIEW", response });
    return { ...response, replayed: false };
  });
}

export async function confirmStoreOrderLineAvailability(input: Readonly<{ storeOrderReference: string; orderLineId: string; actorUserId: string; availableQuantity: number; reasonCode?: string; operationId: string; requestHash: string; testApproval?: TestApproval }>) {
  assertStoreOrderProductionReady("AVAILABILITY", input.testApproval); checkOperation({ operationId: input.operationId, hash: input.requestHash });
  return transaction(async (tx) => {
    const order = await authorize(tx, input.storeOrderReference, input.actorUserId, "store_orders.availability");
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    assertStoreOrder(["PENDING_STORE_REVIEW", "REVIEWING", "CUSTOMER_ACTION_REQUIRED"].includes(order.acceptanceStatus), "STORE_ORDER_INVALID_STATE", "Availability can only be confirmed before acceptance.");
    const line = order.lines.find((item: any) => item.id === input.orderLineId);
    assertStoreOrder(line, "STORE_ORDER_LINE_NOT_FOUND", "Order line was not found.");
    assertStoreOrder(Number.isSafeInteger(input.availableQuantity) && input.availableQuantity >= 0 && input.availableQuantity <= line.quantity, "STORE_ORDER_QUANTITY_INVALID", "Available quantity must be within the original order quantity.");
    const fulfilment = line.fulfilment;
    assertStoreOrder(fulfilment, "STORE_ORDER_FULFILMENT_MISSING", "Line fulfilment evidence is missing.");
    const status = input.availableQuantity === line.quantity ? "AVAILABLE" : input.availableQuantity === 0 ? "UNAVAILABLE" : "PARTIALLY_AVAILABLE";
    await model(tx, "marketplaceStoreOrderLineFulfilment").updateMany({ where: { id: fulfilment.id, version: fulfilment.version }, data: { confirmedAvailableQuantity: input.availableQuantity, status, version: { increment: 1 } } });
    let issueReference: string | null = null;
    let automaticAdjustmentReference: string | null = null;
    if (input.availableQuantity < line.quantity) {
      const policy = currentPolicy(order);
      const existingIssues = order.lines.flatMap((item: any) => item.fulfilment?.issues ?? []);
      assertStoreOrder(existingIssues.length < policy.maximumIssueCount, "STORE_ORDER_ISSUE_LIMIT", "The immutable policy issue limit has been reached.");
      issueReference = ref("soissue");
      const issue = await model(tx, "marketplaceStoreOrderIssue").create({ data: { publicReference: issueReference, marketplaceStoreOrderId: order.id, marketplaceOrderLineId: line.id, lineFulfilmentId: fulfilment.id, issueType: input.availableQuantity === 0 ? "OUT_OF_STOCK" : "PARTIAL_STOCK", reasonCode: input.reasonCode?.slice(0, 80) || "STORE_REPORTED_AVAILABILITY", affectedQuantity: line.quantity - input.availableQuantity, status: "OPEN", reportedByUserId: input.actorUserId } });
      if (["REFUND_IF_UNAVAILABLE", "NO_SUBSTITUTION"].includes(fulfilment.substitutionPreference)) {
        automaticAdjustmentReference = await createLineAdjustment(tx, order, issue, fulfilment, { type: input.availableQuantity === 0 ? "ITEM_REMOVAL" : "QUANTITY_REDUCTION", reasonCode: "CUSTOMER_SUBSTITUTION_PREFERENCE_REFUND", operationId: `${input.operationId}:automatic-refund`, requestHash: requestHash("automatic-refund", { line: line.id, quantity: line.quantity - input.availableQuantity }), actorUserId: input.actorUserId });
        await updateOrder(tx, order, { resolutionStatus: "ADJUSTMENT_PENDING", financialResolutionStatus: "ADJUSTMENT_CALCULATED", acceptanceStatus: "REVIEWING" });
      } else {
        await updateOrder(tx, order, { resolutionStatus: "ISSUE_OPEN", acceptanceStatus: "CUSTOMER_ACTION_REQUIRED" });
      }
    }
    const response = { storeOrderReference: order.publicReference, lineId: line.id, status, availableQuantity: input.availableQuantity, issueReference, automaticAdjustmentReference };
    await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "LINE_AVAILABILITY_CONFIRMED", actorUserId: input.actorUserId, evidence: response });
    await receipt(tx, { storeOrderId: order.id, operationId: input.operationId, hash: input.requestHash, type: "AVAILABILITY", response });
    return { ...response, replayed: false };
  });
}

export async function acceptMarketplaceStoreOrder(input: Readonly<{ storeOrderReference: string; actorUserId: string; preparationMinutes: number; pickupInstructions: string; operationId: string; requestHash: string; testApproval?: TestApproval }>) {
  assertStoreOrderProductionReady("ACCEPTANCE", input.testApproval); checkOperation({ operationId: input.operationId, hash: input.requestHash });
  return transaction(async (tx) => {
    const order = await authorize(tx, input.storeOrderReference, input.actorUserId, "store_orders.accept");
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    const policy = currentPolicy(order);
    if (order.reviewDeadlineAt && order.reviewDeadlineAt <= new Date()) throw new StoreOrderError("STORE_ORDER_REVIEW_EXPIRED", "The merchant review deadline has passed.");
    assertAcceptanceTransition(order.acceptanceStatus, "ACCEPTED");
    assertStoreOrder(order.store.status === "ACTIVE", "STORE_ORDER_STORE_INACTIVE", "Store is no longer active.");
    assertStoreOrder(Number.isSafeInteger(input.preparationMinutes) && input.preparationMinutes > 0 && input.preparationMinutes <= policy.maximumPrepMinutes, "STORE_ORDER_PREPARATION_INVALID", "Preparation estimate exceeds the frozen policy.");
    assertStoreOrder(input.pickupInstructions.trim().length > 0 && input.pickupInstructions.length <= 500, "STORE_ORDER_PICKUP_INVALID", "Bounded pickup instructions are required.");
    assertStoreOrder(order.lines.every((line: any) => line.fulfilment && line.fulfilment.confirmedAvailableQuantity + line.fulfilment.resolvedFulfilmentQuantity >= line.quantity && line.fulfilment.issues.length === 0), "STORE_ORDER_AVAILABILITY_UNRESOLVED", "Every line must be resolved before acceptance.");
    assertStoreOrder(order.settlementSnapshots.length === 1 && order.settlementSnapshots[0].sourceEvidenceFingerprint, "STORE_ORDER_SETTLEMENT_INVALID", "Frozen settlement evidence is unavailable.");
    const acceptedAt = new Date();
    const scheduledFulfilmentAt = new Date(acceptedAt.getTime() + input.preparationMinutes * 60_000);
    await updateOrder(tx, order, { acceptanceStatus: "ACCEPTED", preparationStatus: "NOT_STARTED", deliveryBridgeStatus: "REQUEST_PENDING", acceptedByUserId: input.actorUserId, acceptedAt, scheduledFulfilmentAt, acceptedPreparationMinutes: input.preparationMinutes, acceptedPickupInstructions: input.pickupInstructions.trim() });
    const snapshot = order.operationalSnapshot as Record<string, unknown>;
    const bridge = await model(tx, "marketplaceStoreOrderDeliveryBridge").create({ data: { publicReference: ref("sobridge"), marketplaceStoreOrderId: order.id, deliveryQuoteReference: String(snapshot.deliveryQuoteReference ?? ""), deliveryQuoteVersion: String(snapshot.deliveryQuoteVersion ?? ""), status: "REQUEST_PENDING", operationId: input.operationId, requestHash: input.requestHash } });
    const response = { storeOrderReference: order.publicReference, acceptanceStatus: "ACCEPTED", deliveryBridgeReference: bridge.publicReference };
    await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "STORE_ORDER_ACCEPTED", actorUserId: input.actorUserId, evidence: response });
    await receipt(tx, { storeOrderId: order.id, operationId: input.operationId, hash: input.requestHash, type: "ACCEPTANCE", response });
    return { ...response, replayed: false };
  });
}

const rejectionReasons = new Set(["STORE_CLOSED", "STORE_CAPACITY_UNAVAILABLE", "STORE_LOCATION_UNAVAILABLE", "ALL_ITEMS_UNAVAILABLE", "COMPLIANCE_RESTRICTION", "SELLER_IDENTITY_INVALID", "OPERATIONAL_EMERGENCY", "STORE_RESPONSE_TIMEOUT", "OTHER_ADMIN_REVIEW_REQUIRED"]);

export async function rejectMarketplaceStoreOrder(input: Readonly<{ storeOrderReference: string; actorUserId?: string; reasonCode: string; note?: string; operationId: string; requestHash: string; timedOut?: boolean; testApproval?: TestApproval }>) {
  assertStoreOrderProductionReady("REJECTION", input.testApproval); checkOperation({ operationId: input.operationId, hash: input.requestHash });
  assertStoreOrder(rejectionReasons.has(input.reasonCode), "STORE_ORDER_REJECTION_REASON_INVALID", "A structured rejection reason is required.");
  return transaction(async (tx) => {
    const order = input.actorUserId ? await authorize(tx, input.storeOrderReference, input.actorUserId, "store_orders.reject") : await lockOrder(tx, input.storeOrderReference);
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    assertStoreOrder(!["ACCEPTED", "REJECTED", "TIMED_OUT"].includes(order.acceptanceStatus), "STORE_ORDER_REJECTION_INVALID", "An accepted or resolved order cannot be rejected.");
    if (input.timedOut) assertAcceptanceTransition(order.acceptanceStatus, "TIMED_OUT"); else assertAcceptanceTransition(order.acceptanceStatus, "REJECTED");
    const adjustmentReference = ref("soadj");
    await model(tx, "marketplaceStoreOrderAdjustment").create({ data: { publicReference: adjustmentReference, marketplaceStoreOrderId: order.id, adjustmentType: "FULL_STORE_REJECTION", status: "APPROVED", reasonCode: input.reasonCode, sourceVersion: "phase20-frozen-v1", operationId: input.operationId, requestHash: input.requestHash, deliveryFeeAmount: order.deliveryFee, refundAmount: order.groupTotal, financialEvidence: { settlementSnapshotReference: order.settlementSnapshots[0]?.publicReference ?? null, refundMethod: "ORIGINAL_PAYMENT_METHOD", inventoryDisposition: "RESTOCK" } } });
    await updateOrder(tx, order, { acceptanceStatus: input.timedOut ? "TIMED_OUT" : "REJECTED", preparationStatus: "ABORTED", resolutionStatus: "ADJUSTMENT_PENDING", financialResolutionStatus: "ADJUSTMENT_CALCULATED" });
    const response = { storeOrderReference: order.publicReference, acceptanceStatus: input.timedOut ? "TIMED_OUT" : "REJECTED", adjustmentReference };
    await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: input.timedOut ? "STORE_ORDER_TIMED_OUT" : "STORE_ORDER_REJECTED", actorUserId: input.actorUserId, evidence: { ...response, reasonCode: input.reasonCode, note: safeNote(input.note) ?? undefined } });
    await receipt(tx, { storeOrderId: order.id, operationId: input.operationId, hash: input.requestHash, type: input.timedOut ? "TIMEOUT" : "REJECTION", response });
    return { ...response, replayed: false };
  });
}

export async function timeoutUnacceptedStoreOrders(input: Readonly<{ now?: Date; operationIdFactory: (reference: string) => string; testApproval?: TestApproval }>) {
  assertStoreOrderProductionReady("REJECTION", input.testApproval);
  const candidates = await model(db, "marketplaceStoreOrder").findMany({ where: { acceptanceStatus: { in: ["PENDING_STORE_REVIEW", "REVIEWING", "CUSTOMER_ACTION_REQUIRED"] }, reviewDeadlineAt: { lte: input.now ?? new Date() } }, select: { publicReference: true } });
  return Promise.all(candidates.map((candidate) => {
    const operationId = input.operationIdFactory(candidate.publicReference);
    return rejectMarketplaceStoreOrder({ storeOrderReference: candidate.publicReference, reasonCode: "STORE_RESPONSE_TIMEOUT", operationId, requestHash: requestHash("timeout", { reference: candidate.publicReference, operationId }), timedOut: true, testApproval: input.testApproval });
  }));
}

export async function updateStoreOrderSubstitutionPreference(input: Readonly<{ storeOrderReference: string; orderLineId: string; customerUserId?: string; guestSecret?: string; preference: "REFUND_IF_UNAVAILABLE" | "NO_SUBSTITUTION" | "CONTACT_ME" | "PREAPPROVED_CHOICES_ONLY"; operationId: string; requestHash: string; testApproval?: TestApproval }>) {
  assertStoreOrderProductionReady("AVAILABILITY", input.testApproval); checkOperation({ operationId: input.operationId, hash: input.requestHash });
  return transaction(async (tx) => {
    const order = await lockOrder(tx, input.storeOrderReference);
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    assertStoreOrder((input.customerUserId && order.marketplaceOrder?.customerUserId === input.customerUserId) || (!input.customerUserId && verifyMarketplaceGuestSecret(input.guestSecret, order.marketplaceOrder?.guestConfirmationHash)), "STORE_ORDER_CUSTOMER_ACCESS_DENIED", "Customer order ownership is required.");
    assertStoreOrder(order.preparationStatus === "NOT_STARTED" && !["HANDED_OFF", "ABORTED"].includes(order.preparationStatus), "STORE_ORDER_PREFERENCE_LOCKED", "Substitution preference can no longer be changed.");
    const line = order.lines.find((item: any) => item.id === input.orderLineId);
    assertStoreOrder(line?.fulfilment && line.fulfilment.issues.length === 0, "STORE_ORDER_PREFERENCE_LOCKED", "Preference can only change before a line issue opens.");
    await model(tx, "marketplaceStoreOrderLineFulfilment").update({ where: { id: line.fulfilment.id }, data: { substitutionPreference: input.preference, preferenceChangedAt: new Date(), preferenceActorUserId: input.customerUserId ?? null, version: { increment: 1 } } });
    const response = { storeOrderReference: order.publicReference, orderLineId: line.id, preference: input.preference };
    await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "SUBSTITUTION_PREFERENCE_UPDATED", actorUserId: input.customerUserId, evidence: response });
    await receipt(tx, { storeOrderId: order.id, operationId: input.operationId, hash: input.requestHash, type: "PREFERENCE", response });
    return { ...response, replayed: false };
  });
}

export async function proposeStoreOrderSubstitution(input: Readonly<{ storeOrderReference: string; issueReference: string; actorUserId: string; substituteOfferReference: string; substituteVariantReference: string; quantity: number; operationId: string; requestHash: string; testApproval?: TestApproval }>) {
  assertStoreOrderProductionReady("SUBSTITUTION", input.testApproval); checkOperation({ operationId: input.operationId, hash: input.requestHash });
  assertStoreOrder(Number.isSafeInteger(input.quantity) && input.quantity > 0, "STORE_ORDER_QUANTITY_INVALID", "Substitute quantity must be a positive integer.");
  return transaction(async (tx) => {
    const order = await authorize(tx, input.storeOrderReference, input.actorUserId, "store_orders.substitutions");
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    const policy = currentPolicy(order);
    const issue = await model(tx, "marketplaceStoreOrderIssue").findUnique({ where: { publicReference: input.issueReference }, include: { lineFulfilment: true, orderLine: true, proposals: { where: { status: "PROPOSED" } } } });
    assertStoreOrder(issue?.marketplaceStoreOrderId === order.id && ["OUT_OF_STOCK", "PARTIAL_STOCK"].includes(issue.issueType) && ["OPEN", "CUSTOMER_ACTION_REQUIRED"].includes(issue.status), "STORE_ORDER_SUBSTITUTION_ISSUE_INVALID", "A current item-unavailable issue is required.");
    assertStoreOrder(issue.lineFulfilment.substitutionPreference === "CONTACT_ME" || issue.lineFulfilment.substitutionPreference === "PREAPPROVED_CHOICES_ONLY", "STORE_ORDER_SUBSTITUTION_NOT_PERMITTED", "Customer preference does not permit a proposal.");
    assertStoreOrder(issue.proposals.length < policy.maximumSubstitutionProposalsPerLine, "STORE_ORDER_SUBSTITUTION_LIMIT", "The frozen policy proposal limit has been reached.");
    assertStoreOrder(input.quantity <= issue.affectedQuantity, "STORE_ORDER_QUANTITY_INVALID", "Substitute quantity exceeds the unavailable quantity.");
    const resolved = await resolveMarketplaceCartLine({ offerReference: input.substituteOfferReference, variantReference: input.substituteVariantReference, quantity: input.quantity, modifiers: [] });
    assertStoreOrder(resolved.storeId === order.storeId, "STORE_ORDER_SUBSTITUTION_CROSS_STORE", "A substitute must belong to the same store.");
    const originalRemainingCharge = money(cents(issue.orderLine.effectiveUnitPrice.toFixed(2)) * BigInt(issue.affectedQuantity));
    const substituteCharge = money(cents(resolved.unitPrice) * BigInt(input.quantity));
    assertSubstitutionPriceCap({ substituteCharge, originalRemainingCharge });
    const inventory = await prisma.catalogInventoryItem.findFirst({ where: { offer: { publicReference: resolved.offerReference, storeId: order.storeId }, variant: { publicReference: resolved.variantReference }, trackingMode: "TRACKED" }, include: { levels: { where: { available: { gte: input.quantity }, location: { status: "ACTIVE" } }, orderBy: { id: "asc" }, take: 1 } } });
    assertStoreOrder(inventory?.levels[0], "STORE_ORDER_SUBSTITUTION_STOCK_UNAVAILABLE", "Substitute stock is unavailable.");
    const level = inventory.levels[0];
    const expiry = new Date(Date.now() + policy.customerDecisionWindowSeconds * 1000);
    const proposalReference = ref("sosub");
    const reservationReference = ref("sores");
    // A conditional update prevents a negative available balance even when two proposals race.
    const reserved = await (tx as unknown as { catalogInventoryLevel: Delegate }).catalogInventoryLevel.updateMany({ where: { id: level.id, version: level.version, available: { gte: input.quantity } }, data: { available: { decrement: input.quantity }, reserved: { increment: input.quantity }, version: { increment: 1 } } });
    if (!reserved.count) throw new StoreOrderError("STORE_ORDER_SUBSTITUTION_STOCK_RACE", "Substitute stock changed; try again.", true);
    await model(tx, "catalogInventoryMovement").create({ data: { publicReference: ref("cim"), inventoryItemId: inventory.id, locationId: level.locationId, type: "ORDER_SUBSTITUTION_RESERVATION", quantityDelta: 0, operationId: `${input.operationId}:reserve`, requestHash: input.requestHash, reasonCode: "STORE_ORDER_SUBSTITUTION", actorUserId: input.actorUserId, resultingOnHand: level.onHand } });
    const proposal = await model(tx, "marketplaceStoreOrderSubstitutionProposal").create({ data: { publicReference: proposalReference, marketplaceStoreOrderId: order.id, issueId: issue.id, lineFulfilmentId: issue.lineFulfilmentId, substituteProductReference: resolved.productReference, substituteVariantReference: resolved.variantReference, substituteOfferReference: resolved.offerReference, substituteInventoryItemId: inventory.id, substituteInventoryLevelId: level.id, substituteQuantity: input.quantity, customerCharge: substituteCharge, originalRemainingCharge, taxEvidence: { taxTreatment: issue.orderLine.taxTreatment, includedTaxAmount: issue.orderLine.includedTaxAmount?.toFixed(2) ?? null }, publicationVersion: resolved.publicationVersion, priceVersion: resolved.priceVersion, sellerIdentityEvidence: order.sellerIdentityEvidence ?? {}, status: "PROPOSED", expiresAt: expiry, proposedByUserId: input.actorUserId, immutableEvidence: { sourceOrderLineId: issue.orderLine.id, issueReference: issue.publicReference, sourceCommercialFingerprint: order.operationalSnapshot?.sourceCommercialFingerprint ?? null } } });
    await model(tx, "marketplaceStoreOrderSubstitutionReservation").create({ data: { publicReference: reservationReference, proposalId: proposal.id, marketplaceStoreOrderId: order.id, inventoryItemId: inventory.id, inventoryLevelId: level.id, quantity: input.quantity, status: "ACTIVE", operationId: input.operationId, requestHash: input.requestHash, expiresAt: expiry } });
    await model(tx, "marketplaceStoreOrderLineFulfilment").update({ where: { id: issue.lineFulfilmentId }, data: { status: "SUBSTITUTION_PROPOSED", version: { increment: 1 } } });
    await model(tx, "marketplaceStoreOrderIssue").update({ where: { id: issue.id }, data: { status: "CUSTOMER_ACTION_REQUIRED", customerActionDeadline: expiry, version: { increment: 1 } } });
    await updateOrder(tx, order, { acceptanceStatus: "CUSTOMER_ACTION_REQUIRED", resolutionStatus: "ISSUE_OPEN" });
    const response = { storeOrderReference: order.publicReference, proposalReference, expiresAt: expiry.toISOString(), customerCharge: substituteCharge, originalRemainingCharge };
    await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "SUBSTITUTION_PROPOSED", actorUserId: input.actorUserId, evidence: response });
    await receipt(tx, { storeOrderId: order.id, operationId: input.operationId, hash: input.requestHash, type: "SUBSTITUTION_PROPOSAL", response });
    return { ...response, replayed: false };
  });
}

async function releaseSubstituteReservation(tx: Phase21Database, reservation: any, actorUserId: string, operationId: string, requestHashValue: string, reason: "REJECTED" | "EXPIRED") {
  if (reservation.status !== "ACTIVE") return;
  const level = await (tx as unknown as { catalogInventoryLevel: Delegate }).catalogInventoryLevel.findUnique({ where: { id: reservation.inventoryLevelId } });
  assertStoreOrder(level && level.reserved >= reservation.quantity, "STORE_ORDER_INVENTORY_INCOHERENT", "Substitute reservation inventory is incoherent.");
  const updated = await (tx as unknown as { catalogInventoryLevel: Delegate }).catalogInventoryLevel.updateMany({ where: { id: level.id, version: level.version, reserved: { gte: reservation.quantity } }, data: { available: { increment: reservation.quantity }, reserved: { decrement: reservation.quantity }, version: { increment: 1 } } });
  if (!updated.count) throw new StoreOrderError("STORE_ORDER_INVENTORY_CONCURRENCY", "Substitute inventory changed concurrently.", true);
  await model(tx, "marketplaceStoreOrderSubstitutionReservation").update({ where: { id: reservation.id }, data: { status: reason === "EXPIRED" ? "EXPIRED" : "RELEASED", releasedAt: new Date() } });
  await model(tx, "catalogInventoryMovement").create({ data: { publicReference: ref("cim"), inventoryItemId: reservation.inventoryItemId, locationId: level.locationId, type: "ORDER_SUBSTITUTION_RELEASE", quantityDelta: 0, operationId: `${operationId}:release`, requestHash: requestHashValue, reasonCode: `SUBSTITUTION_${reason}`, actorUserId, resultingOnHand: level.onHand } });
}

export async function decideStoreOrderSubstitution(input: Readonly<{ storeOrderReference: string; proposalReference: string; customerUserId?: string; guestSecret?: string; decision: "APPROVE" | "REJECT_AND_REFUND"; operationId: string; requestHash: string; testApproval?: TestApproval }>) {
  assertStoreOrderProductionReady("SUBSTITUTION", input.testApproval); checkOperation({ operationId: input.operationId, hash: input.requestHash });
  return transaction(async (tx) => {
    const order = await lockOrder(tx, input.storeOrderReference);
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    assertStoreOrder((input.customerUserId && order.marketplaceOrder.customerUserId === input.customerUserId) || (!input.customerUserId && verifyMarketplaceGuestSecret(input.guestSecret, order.marketplaceOrder.guestConfirmationHash)), "STORE_ORDER_CUSTOMER_ACCESS_DENIED", "Customer order ownership is required.");
    const proposal = await model(tx, "marketplaceStoreOrderSubstitutionProposal").findUnique({ where: { publicReference: input.proposalReference }, include: { reservation: true, issue: true, lineFulfilment: true } });
    assertStoreOrder(proposal?.marketplaceStoreOrderId === order.id && proposal.status === "PROPOSED", "STORE_ORDER_SUBSTITUTION_INVALID", "Substitution proposal is unavailable.");
    assertStoreOrder(proposal.expiresAt > new Date(), "STORE_ORDER_SUBSTITUTION_EXPIRED", "Substitution proposal has expired.");
    const decisionReference = ref("sodecision");
    const evidence = { issueReference: proposal.issue.publicReference, proposalReference: proposal.publicReference, substitute: { productReference: proposal.substituteProductReference, variantReference: proposal.substituteVariantReference, offerReference: proposal.substituteOfferReference }, customerCharge: proposal.customerCharge.toFixed(2), originalRemainingCharge: proposal.originalRemainingCharge.toFixed(2), taxEvidence: proposal.taxEvidence, priceVersion: proposal.priceVersion, publicationVersion: proposal.publicationVersion, proposalVersion: proposal.version, expiresAt: proposal.expiresAt.toISOString() };
    await model(tx, "marketplaceStoreOrderCustomerDecision").create({ data: { publicReference: decisionReference, proposalId: proposal.id, marketplaceStoreOrderId: order.id, decision: input.decision, customerUserId: input.customerUserId ?? null, guestDecisionHash: input.customerUserId ? null : hashMarketplaceGuestSecret(input.guestSecret ?? ""), operationId: input.operationId, requestHash: input.requestHash, evidence } });
    let adjustmentReference: string | null = null;
    if (input.decision === "APPROVE") {
      const level = await (tx as unknown as { catalogInventoryLevel: Delegate }).catalogInventoryLevel.findUnique({ where: { id: proposal.reservation.inventoryLevelId } });
      assertStoreOrder(level && level.reserved >= proposal.reservation.quantity, "STORE_ORDER_INVENTORY_INCOHERENT", "Substitute reservation inventory is incoherent.");
      await (tx as unknown as { catalogInventoryLevel: Delegate }).catalogInventoryLevel.update({ where: { id: level.id }, data: { reserved: { decrement: proposal.reservation.quantity }, onHand: { decrement: proposal.reservation.quantity }, version: { increment: 1 } } });
      await model(tx, "marketplaceStoreOrderSubstitutionReservation").update({ where: { id: proposal.reservation.id }, data: { status: "CONSUMED", consumedAt: new Date() } });
      await model(tx, "catalogInventoryMovement").create({ data: { publicReference: ref("cim"), inventoryItemId: proposal.reservation.inventoryItemId, locationId: proposal.reservation.inventoryLevelId, type: "ORDER_SUBSTITUTION_COMMITMENT", quantityDelta: -proposal.reservation.quantity, operationId: `${input.operationId}:commit`, requestHash: input.requestHash, reasonCode: "SUBSTITUTION_APPROVED", actorUserId: input.customerUserId ?? "system", resultingOnHand: level.onHand - proposal.reservation.quantity } });
      await model(tx, "marketplaceStoreOrderSubstitutionProposal").update({ where: { id: proposal.id }, data: { status: "APPROVED", decidedAt: new Date() } });
      await model(tx, "marketplaceStoreOrderLineFulfilment").update({ where: { id: proposal.lineFulfilmentId }, data: { status: "SUBSTITUTION_APPROVED", resolvedFulfilmentQuantity: { increment: proposal.substituteQuantity }, version: { increment: 1 } } });
      adjustmentReference = await createLineAdjustment(tx, order, proposal.issue, proposal.lineFulfilment, { type: "SUBSTITUTION", reasonCode: "CUSTOMER_APPROVED_SUBSTITUTION", operationId: `${input.operationId}:adjust`, requestHash: requestHash("substitution-adjustment", evidence), decisionReference, replacementCharge: proposal.customerCharge.toFixed(2), actorUserId: input.customerUserId });
    } else {
      await releaseSubstituteReservation(tx, proposal.reservation, input.customerUserId ?? "system", input.operationId, input.requestHash, "REJECTED");
      await model(tx, "marketplaceStoreOrderSubstitutionProposal").update({ where: { id: proposal.id }, data: { status: "REJECTED", decidedAt: new Date() } });
      adjustmentReference = await createLineAdjustment(tx, order, proposal.issue, proposal.lineFulfilment, { type: "ITEM_REMOVAL", reasonCode: "CUSTOMER_REJECTED_SUBSTITUTION", operationId: `${input.operationId}:adjust`, requestHash: requestHash("substitution-refund", evidence), decisionReference, actorUserId: input.customerUserId });
    }
    await updateOrder(tx, order, { resolutionStatus: "ADJUSTMENT_PENDING", financialResolutionStatus: "ADJUSTMENT_CALCULATED", acceptanceStatus: "REVIEWING" });
    const response = { storeOrderReference: order.publicReference, decisionReference, decision: input.decision, adjustmentReference };
    await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "SUBSTITUTION_DECIDED", actorUserId: input.customerUserId, evidence: response });
    await receipt(tx, { storeOrderId: order.id, operationId: input.operationId, hash: input.requestHash, type: "SUBSTITUTION_DECISION", response });
    return { ...response, replayed: false };
  });
}

/** Expiry follows the safe default: release the hold and create a refund-only
 * adjustment. It never silently substitutes an item. */
export async function expireStoreOrderSubstitutions(input: Readonly<{ now?: Date; operationIdFactory: (proposalReference: string) => string; testApproval?: TestApproval }>) {
  assertStoreOrderProductionReady("SUBSTITUTION", input.testApproval);
  const proposals = await model(db, "marketplaceStoreOrderSubstitutionProposal").findMany({ where: { status: "PROPOSED", expiresAt: { lte: input.now ?? new Date() } }, select: { publicReference: true, marketplaceStoreOrder: { select: { publicReference: true } } } });
  return Promise.all(proposals.map(async (candidate) => {
    const operationId = input.operationIdFactory(candidate.publicReference);
    const hash = requestHash("substitution-expiry", { proposal: candidate.publicReference, operationId });
    return transaction(async (tx) => {
      const order = await lockOrder(tx, candidate.marketplaceStoreOrder.publicReference);
      const prior = await replay(tx, order.id, operationId, hash); if (prior) return prior;
      const proposal = await model(tx, "marketplaceStoreOrderSubstitutionProposal").findUnique({ where: { publicReference: candidate.publicReference }, include: { reservation: true, issue: true, lineFulfilment: true } });
      if (!proposal || proposal.status !== "PROPOSED" || proposal.expiresAt > (input.now ?? new Date())) return { proposalReference: candidate.publicReference, skipped: true, replayed: false };
      await releaseSubstituteReservation(tx, proposal.reservation, "system", operationId, hash, "EXPIRED");
      await model(tx, "marketplaceStoreOrderSubstitutionProposal").update({ where: { id: proposal.id }, data: { status: "EXPIRED" } });
      const adjustmentReference = await createLineAdjustment(tx, order, proposal.issue, proposal.lineFulfilment, { type: "ITEM_REMOVAL", reasonCode: "CUSTOMER_DECISION_TIMEOUT", operationId: `${operationId}:adjust`, requestHash: requestHash("substitution-expiry-adjustment", { proposal: proposal.publicReference }), actorUserId: undefined });
      await updateOrder(tx, order, { resolutionStatus: "ADJUSTMENT_PENDING", financialResolutionStatus: "ADJUSTMENT_CALCULATED", acceptanceStatus: "REVIEWING" });
      const response = { proposalReference: proposal.publicReference, adjustmentReference, expired: true };
      await history(tx, { storeOrderId: order.id, operationId, eventType: "SUBSTITUTION_EXPIRED_TO_REFUND", evidence: response });
      await receipt(tx, { storeOrderId: order.id, operationId, hash, type: "SUBSTITUTION_EXPIRY", response });
      return { ...response, replayed: false };
    });
  }));
}

async function createLineAdjustment(tx: Phase21Database, order: any, issue: any, fulfilment: any, input: Readonly<{ type: "QUANTITY_REDUCTION" | "ITEM_REMOVAL" | "SUBSTITUTION"; reasonCode: string; operationId: string; requestHash: string; decisionReference?: string; replacementCharge?: string; actorUserId?: string }>) {
  const sourceLine = order.lines.find((line: any) => line.id === issue.marketplaceOrderLineId);
  assertStoreOrder(sourceLine, "STORE_ORDER_LINE_NOT_FOUND", "Adjustment source line was not found.");
  const before = fulfilment.resolvedFulfilmentQuantity;
  const after = before + issue.affectedQuantity;
  assertStoreOrder(after <= sourceLine.quantity, "STORE_ORDER_QUANTITY_INVALID", "Adjustment would exceed the original line quantity.");
  const adjustmentReference = ref("soadj");
  const originalCharge = money(cents(sourceLine.effectiveUnitPrice.toFixed(2)) * BigInt(issue.affectedQuantity));
  const replacementCharge = input.replacementCharge ?? "0.00";
  const refundAmount = cents(originalCharge) > cents(replacementCharge) ? money(cents(originalCharge) - cents(replacementCharge)) : "0.00";
  const adjustment = await model(tx, "marketplaceStoreOrderAdjustment").create({ data: { publicReference: adjustmentReference, marketplaceStoreOrderId: order.id, adjustmentType: input.type, status: "APPROVED", reasonCode: input.reasonCode, sourceVersion: order.settlementSnapshots[0]?.settlementVersion ?? "phase20-v1", operationId: input.operationId, requestHash: input.requestHash, customerDecisionReference: input.decisionReference ?? null, refundAmount, financialEvidence: { settlementSnapshotReference: order.settlementSnapshots[0]?.publicReference ?? null, originalLineId: sourceLine.id, originalQuantity: sourceLine.quantity, affectedQuantity: issue.affectedQuantity, replacementCharge, sourceCommercialFingerprint: order.operationalSnapshot?.sourceCommercialFingerprint ?? null } } });
  const allocations = sourceLine.financialAllocations ?? [];
  for (const allocation of allocations) {
    const amount = cumulativeLineAllocation({ totalAmount: allocation.amount.toFixed(2), originalQuantity: sourceLine.quantity, previouslyResolvedQuantity: before, resolvedQuantityAfter: after });
    await model(tx, "marketplaceStoreOrderAdjustmentAllocation").create({ data: { adjustmentId: adjustment.id, marketplaceOrderLineId: sourceLine.id, allocationType: allocation.type, resolvedQuantityBefore: before, resolvedQuantityAfter: after, originalQuantity: sourceLine.quantity, amount, taxAmount: allocation.type === "SELLER_BASIS" ? money(cents(sourceLine.includedTaxAmount?.toFixed(2) ?? "0.00") * BigInt(issue.affectedQuantity) / BigInt(sourceLine.quantity)) : null, sourceAllocationVersion: allocation.allocationVersion, roundingSequence: allocation.roundingSequence, finalCentRecipient: allocation.finalCentRecipient } });
  }
  const amendmentVersion = await model(tx, "marketplaceStoreOrderAmendment").findMany({ where: { marketplaceStoreOrderId: order.id }, select: { amendmentVersion: true } }).then((rows) => rows.reduce((max, row) => Math.max(max, row.amendmentVersion), 0) + 1);
  const amendmentEvidence = { original: { lineId: sourceLine.id, title: sourceLine.title, quantity: sourceLine.quantity, affectedQuantity: issue.affectedQuantity, charge: originalCharge }, final: { substituteCharge: replacementCharge, refundAmount, decisionReference: input.decisionReference ?? null }, sellerIdentityEvidence: order.sellerIdentityEvidence, taxEvidence: { taxTreatment: sourceLine.taxTreatment, includedTaxAmount: sourceLine.includedTaxAmount?.toFixed(2) ?? null }, createdBy: input.actorUserId ?? null };
  await model(tx, "marketplaceStoreOrderAmendment").create({ data: { publicReference: ref("soamend"), marketplaceStoreOrderId: order.id, adjustmentId: adjustment.id, marketplaceOrderLineId: sourceLine.id, amendmentVersion, originalEvidence: amendmentEvidence.original, finalEvidence: amendmentEvidence.final, customerDecisionReference: input.decisionReference ?? null, financialEvidence: { allocations, refundAmount }, actorUserId: input.actorUserId ?? null, fingerprint: requestHash("amendment", { order: order.publicReference, adjustment: adjustmentReference, amendmentVersion, amendmentEvidence }) } });
  await model(tx, "marketplaceStoreOrderIssue").update({ where: { id: issue.id }, data: { status: "REFUND_PENDING", resolvedAt: new Date(), version: { increment: 1 } } });
  if (input.type !== "SUBSTITUTION") {
    await model(tx, "marketplaceStoreOrderLineFulfilment").update({ where: { id: fulfilment.id }, data: { resolvedFulfilmentQuantity: after, status: fulfilment.confirmedAvailableQuantity > 0 ? "AVAILABLE" : "RESOLVED", version: { increment: 1 } } });
  }
  return adjustmentReference;
}

export async function applyMarketplaceStoreOrderAdjustment(input: Readonly<{ storeOrderReference: string; adjustmentReference: string; actorUserId: string; operationId: string; requestHash: string; dependencies?: StoreOrderDependencies; testApproval?: TestApproval }>) {
  const dependencies = { ...resolveStoreOrderProductionComposition(), ...input.dependencies };
  assertStoreOrderProductionReady("ADJUSTMENT", input.testApproval); checkOperation({ operationId: input.operationId, hash: input.requestHash });
  assertStoreOrder(dependencies.financialAuthority, "STORE_ORDER_FINANCIAL_AUTHORITY_UNAVAILABLE", "Canonical Phase 14–16 and Phase 15 adjustment authority is unavailable.");
  const staged = await transaction(async (tx) => {
    const order = await lockOrder(tx, input.storeOrderReference);
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    const adjustment = await model(tx, "marketplaceStoreOrderAdjustment").findUnique({ where: { publicReference: input.adjustmentReference }, include: { allocations: true } });
    assertStoreOrder(adjustment?.marketplaceStoreOrderId === order.id && ["APPROVED", "RECONCILIATION_REQUIRED"].includes(adjustment.status), "STORE_ORDER_ADJUSTMENT_INVALID", "Approved or reconciled store-order adjustment is required.");
    const snapshot = order.settlementSnapshots[0];
    assertStoreOrder(snapshot?.sourceEvidenceFingerprint && snapshot.status !== "RECONCILIATION_REQUIRED", "STORE_ORDER_SETTLEMENT_INVALID", "Frozen Phase 20 settlement evidence is not coherent.");
    assertFinancialTransition(order.financialResolutionStatus, "REVERSAL_PENDING");
    const priorFinancialEvidence = adjustment.financialEvidence as Record<string, unknown> | null;
    const authorityOperationId = typeof priorFinancialEvidence?.phase21AuthorityOperationId === "string" ? priorFinancialEvidence.phase21AuthorityOperationId : input.operationId;
    await model(tx, "marketplaceStoreOrderAdjustment").update({ where: { id: adjustment.id }, data: { status: "APPLYING", financialEvidence: { ...(priorFinancialEvidence ?? {}), phase21AuthorityOperationId: authorityOperationId, phase21AuthorityStagedAt: new Date().toISOString() } } });
    await updateOrder(tx, order, { financialResolutionStatus: "REVERSAL_PENDING", resolutionStatus: "ADJUSTMENT_PENDING" });
    return { storeOrderReference: order.publicReference, adjustmentReference: adjustment.publicReference, authorityOperationId, frozenEvidence: { settlementSnapshotReference: snapshot.publicReference, sourceEvidenceFingerprint: snapshot.sourceEvidenceFingerprint, settlementVersion: snapshot.settlementVersion, commissionPlanReference: snapshot.commissionPlanReference, commissionPlanVersion: snapshot.commissionPlanVersion, allocations: adjustment.allocations.map((item: any) => ({ type: item.allocationType, amount: item.amount.toFixed(2), resolvedQuantityBefore: item.resolvedQuantityBefore, resolvedQuantityAfter: item.resolvedQuantityAfter })) } };
  });
  if ("replayed" in staged) return staged;
  let result: Awaited<ReturnType<NonNullable<StoreOrderDependencies["financialAuthority"]>["applyExactAdjustment"]>>;
  try {
    result = await dependencies.financialAuthority.applyExactAdjustment({ adjustmentReference: staged.adjustmentReference, storeOrderReference: staged.storeOrderReference, operationId: staged.authorityOperationId, frozenEvidence: staged.frozenEvidence });
  } catch (error) {
    await transaction(async (tx) => {
      const order = await lockOrder(tx, input.storeOrderReference);
      const adjustment = await model(tx, "marketplaceStoreOrderAdjustment").findUnique({ where: { publicReference: input.adjustmentReference } });
      if (adjustment?.marketplaceStoreOrderId !== order.id || adjustment.status !== "APPLYING") return;
      const safeError = error instanceof Error ? error.message.slice(0, 500) : "Canonical financial authority failed.";
      const reconciliation = await model(tx, "marketplaceStoreOrderReconciliationCase").upsert({ where: { caseKey: `${order.id}:FINANCIAL_COMPOSITION_FAILED:${input.operationId}` }, create: { publicReference: ref("sorec"), caseKey: `${order.id}:FINANCIAL_COMPOSITION_FAILED:${input.operationId}`, marketplaceStoreOrderId: order.id, reasonCode: "FINANCIAL_COMPOSITION_FAILED", priority: "HIGH", safeSummary: safeError, safeEvidence: { adjustmentReference: input.adjustmentReference, operationId: input.operationId }, retryOperationId: input.operationId }, update: { observationCount: { increment: 1 }, safeSummary: safeError } });
      await model(tx, "marketplaceStoreOrderAdjustment").update({ where: { id: adjustment.id }, data: { status: "RECONCILIATION_REQUIRED", reconciliationCaseId: reconciliation.id } });
      await updateOrder(tx, order, { financialResolutionStatus: "RECONCILIATION_REQUIRED", resolutionStatus: "RECONCILIATION_REQUIRED" });
      await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "STORE_ORDER_FINANCIAL_COMPOSITION_FAILED", actorUserId: input.actorUserId, evidence: { adjustmentReference: input.adjustmentReference, reconciliationReference: reconciliation.publicReference } });
    });
    throw error;
  }
  return transaction(async (tx) => {
    const order = await lockOrder(tx, input.storeOrderReference);
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    const adjustment = await model(tx, "marketplaceStoreOrderAdjustment").findUnique({ where: { publicReference: input.adjustmentReference } });
    assertStoreOrder(adjustment?.marketplaceStoreOrderId === order.id && adjustment.status === "APPLYING", "STORE_ORDER_ADJUSTMENT_INVALID", "Staged store-order adjustment is unavailable.");
    const nextResolution = result.financialStatus === "REFUND_COMPLETED" ? "RESOLVED" : "REFUND_PENDING";
    await model(tx, "marketplaceStoreOrderAdjustment").update({ where: { id: adjustment.id }, data: { status: result.financialStatus === "REFUND_COMPLETED" ? "COMPLETED" : "REFUND_PENDING", refundId: result.refundReference ?? null, appliedAt: new Date(), completedAt: result.financialStatus === "REFUND_COMPLETED" ? new Date() : null } });
    await updateOrder(tx, order, { financialResolutionStatus: result.financialStatus, resolutionStatus: nextResolution });
    const response = { storeOrderReference: order.publicReference, adjustmentReference: adjustment.publicReference, refundReference: result.refundReference ?? null, commissionReversalReferences: result.commissionReversalReferences, storeEarningReversalReference: result.storeEarningReversalReference ?? null, financialStatus: result.financialStatus };
    await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "STORE_ORDER_ADJUSTMENT_APPLIED", actorUserId: input.actorUserId, evidence: response });
    await receipt(tx, { storeOrderId: order.id, operationId: input.operationId, hash: input.requestHash, type: "ADJUSTMENT", response });
    return { ...response, replayed: false };
  });
}

export async function requestMarketplaceStoreOrderCancellation(input: Readonly<{ storeOrderReference: string; requesterType: "CUSTOMER" | "STORE"; requesterUserId?: string; guestSecret?: string; reasonCode: string; note?: string; operationId: string; requestHash: string; testApproval?: TestApproval }>) {
  assertStoreOrderProductionReady("ADJUSTMENT", input.testApproval); checkOperation({ operationId: input.operationId, hash: input.requestHash });
  return transaction(async (tx) => {
    const order = await lockOrder(tx, input.storeOrderReference);
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    if (input.requesterType === "STORE") {
      assertStoreOrder(input.requesterUserId, "STORE_ORDER_ACCESS_DENIED", "Store actor is required.");
      await requireStoreOrderActor({ actorUserId: input.requesterUserId, storeId: order.storeId, permission: "store_orders.reject" });
      assertStoreOrder(order.acceptanceStatus === "ACCEPTED", "STORE_ORDER_CANCELLATION_INVALID", "Stores can request cancellation only after acceptance.");
    } else {
      assertStoreOrder((input.requesterUserId && order.marketplaceOrder.customerUserId === input.requesterUserId) || (!input.requesterUserId && verifyMarketplaceGuestSecret(input.guestSecret, order.marketplaceOrder.guestConfirmationHash)), "STORE_ORDER_CUSTOMER_ACCESS_DENIED", "Customer order ownership is required.");
      assertStoreOrder(!["HANDED_OFF", "ABORTED"].includes(order.preparationStatus), "STORE_ORDER_CANCELLATION_TOO_LATE", "Cancellation is unavailable after handoff or abort.");
    }
    const requestReference = ref("socancel");
    await model(tx, "marketplaceStoreOrderCancellationRequest").create({ data: { publicReference: requestReference, marketplaceStoreOrderId: order.id, requesterType: input.requesterType, requesterUserId: input.requesterUserId ?? null, reasonCode: input.reasonCode.slice(0, 80), safeNote: safeNote(input.note), status: order.preparationStatus === "NOT_STARTED" ? "APPROVED" : "REQUESTED", operationId: input.operationId, requestHash: input.requestHash, decisionEvidence: { stage: order.preparationStatus, deliveryBridgeStatus: order.deliveryBridgeStatus } } });
    if (order.preparationStatus === "NOT_STARTED") await updateOrder(tx, order, { resolutionStatus: "ADJUSTMENT_PENDING", financialResolutionStatus: "ADJUSTMENT_CALCULATED" });
    const response = { storeOrderReference: order.publicReference, cancellationRequestReference: requestReference, status: order.preparationStatus === "NOT_STARTED" ? "APPROVED" : "REQUESTED" };
    await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "STORE_ORDER_CANCELLATION_REQUESTED", actorUserId: input.requesterUserId, evidence: response });
    await receipt(tx, { storeOrderId: order.id, operationId: input.operationId, hash: input.requestHash, type: "CANCELLATION_REQUEST", response });
    return { ...response, replayed: false };
  });
}

export async function startStoreOrderPreparation(input: Readonly<{ storeOrderReference: string; actorUserId: string; operationId: string; requestHash: string; testApproval?: TestApproval }>) {
  assertStoreOrderProductionReady("PREPARATION", input.testApproval); checkOperation({ operationId: input.operationId, hash: input.requestHash });
  return transaction(async (tx) => {
    const order = await authorize(tx, input.storeOrderReference, input.actorUserId, "store_orders.prepare");
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    assertStoreOrder(order.acceptanceStatus === "ACCEPTED", "STORE_ORDER_PREPARATION_INVALID", "Preparation requires accepted order evidence.");
    assertPreparationTransition(order.preparationStatus, "PREPARING");
    await updateOrder(tx, order, { preparationStatus: "PREPARING" });
    const response = { storeOrderReference: order.publicReference, preparationStatus: "PREPARING" };
    await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "PREPARATION_STARTED", actorUserId: input.actorUserId, evidence: response });
    await receipt(tx, { storeOrderId: order.id, operationId: input.operationId, hash: input.requestHash, type: "PREPARATION_START", response });
    return { ...response, replayed: false };
  });
}

export async function updateStoreOrderPreparationTime(input: Readonly<{ storeOrderReference: string; actorUserId: string; preparationMinutes: number; reasonCode: string; operationId: string; requestHash: string; testApproval?: TestApproval }>) {
  assertStoreOrderProductionReady("PREPARATION", input.testApproval); checkOperation({ operationId: input.operationId, hash: input.requestHash });
  return transaction(async (tx) => {
    const order = await authorize(tx, input.storeOrderReference, input.actorUserId, "store_orders.prepare");
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    assertStoreOrder(order.preparationStatus === "PREPARING", "STORE_ORDER_PREPARATION_INVALID", "Preparation time can only change while preparing.");
    const policy = currentPolicy(order);
    const original = order.acceptedPreparationMinutes ?? 0;
    assertStoreOrder(Number.isInteger(input.preparationMinutes) && input.preparationMinutes >= original && input.preparationMinutes <= Math.min(policy.maximumPrepMinutes, original + policy.maximumPrepExtensionMinutes), "STORE_ORDER_PREPARATION_INVALID", "Preparation estimate exceeds the frozen bounded extension.");
    await updateOrder(tx, order, { acceptedPreparationMinutes: input.preparationMinutes });
    const response = { storeOrderReference: order.publicReference, preparationMinutes: input.preparationMinutes, reasonCode: input.reasonCode.slice(0, 80) };
    await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "PREPARATION_TIME_UPDATED", actorUserId: input.actorUserId, evidence: response });
    await receipt(tx, { storeOrderId: order.id, operationId: input.operationId, hash: input.requestHash, type: "PREPARATION_UPDATE", response });
    return { ...response, replayed: false };
  });
}

export async function markStoreOrderReadyForHandoff(input: Readonly<{ storeOrderReference: string; actorUserId: string; packageEvidence?: Record<string, unknown>; operationId: string; requestHash: string; testApproval?: TestApproval }>) {
  assertStoreOrderProductionReady("PREPARATION", input.testApproval); checkOperation({ operationId: input.operationId, hash: input.requestHash });
  return transaction(async (tx) => {
    const order = await authorize(tx, input.storeOrderReference, input.actorUserId, "store_orders.prepare");
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    assertPreparationTransition(order.preparationStatus, "READY_FOR_HANDOFF");
    assertStoreOrder(order.lines.every((line: any) => line.fulfilment && line.fulfilment.confirmedAvailableQuantity + line.fulfilment.resolvedFulfilmentQuantity >= line.quantity && !["UNAVAILABLE", "REFUND_PENDING", "SUBSTITUTION_PROPOSED"].includes(line.fulfilment.status)), "STORE_ORDER_NOT_READY", "Unresolved line availability prevents ready-for-handoff.");
    await model(tx, "marketplaceStoreOrderLineFulfilment").updateMany({ where: { marketplaceStoreOrderId: order.id, status: { in: ["AVAILABLE", "SUBSTITUTION_APPROVED"] } }, data: { status: "READY", version: { increment: 1 } } });
    await updateOrder(tx, order, { preparationStatus: "READY_FOR_HANDOFF", deliveryBridgeStatus: order.deliveryBridgeStatus === "DRIVER_ASSIGNED" ? "HANDOFF_READY" : order.deliveryBridgeStatus });
    const response = { storeOrderReference: order.publicReference, preparationStatus: "READY_FOR_HANDOFF", packageEvidenceAttached: Boolean(input.packageEvidence) };
    await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "STORE_ORDER_READY_FOR_HANDOFF", actorUserId: input.actorUserId, evidence: response });
    await receipt(tx, { storeOrderId: order.id, operationId: input.operationId, hash: input.requestHash, type: "READY_FOR_HANDOFF", response });
    return { ...response, replayed: false };
  });
}

export async function createMarketplaceDeliveryBridge(input: Readonly<{ storeOrderReference: string; actorUserId: string; operationId: string; requestHash: string; dependencies?: StoreOrderDependencies; testApproval?: TestApproval }>) {
  const dependencies = { ...resolveStoreOrderProductionComposition(), ...input.dependencies };
  assertStoreOrderProductionReady("DELIVERY_BRIDGE", input.testApproval); checkOperation({ operationId: input.operationId, hash: input.requestHash });
  assertStoreOrder(dependencies.deliveryAuthority, "STORE_ORDER_DELIVERY_AUTHORITY_UNAVAILABLE", "The existing courier-order bridge authority is unavailable.");
  const staged = await transaction(async (tx) => {
    const order = await lockOrder(tx, input.storeOrderReference);
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    assertStoreOrder(order.acceptanceStatus === "ACCEPTED" && ["REQUEST_PENDING", "FAILED"].includes(order.deliveryBridgeStatus) && !order.deliveryBridge?.courierOrderId, "STORE_ORDER_DELIVERY_BRIDGE_INVALID", "Store order is not eligible for a courier bridge.");
    const snapshot = order.operationalSnapshot as Record<string, unknown> | null;
    const deliveryQuoteReference = typeof snapshot?.deliveryQuoteReference === "string" ? snapshot.deliveryQuoteReference : null;
    const deliveryQuoteVersion = typeof snapshot?.deliveryQuoteVersion === "string" ? snapshot.deliveryQuoteVersion : null;
    assertStoreOrder(deliveryQuoteReference && deliveryQuoteVersion, "STORE_ORDER_DELIVERY_QUOTE_MISSING", "Frozen delivery quote evidence is required.");
    await model(tx, "marketplaceStoreOrderDeliveryBridge").update({ where: { marketplaceStoreOrderId: order.id }, data: { status: "REQUEST_PENDING" } });
    if (order.deliveryBridgeStatus === "FAILED") await updateOrder(tx, order, { deliveryBridgeStatus: "REQUEST_PENDING" });
    return { storeOrderReference: order.publicReference, deliveryQuoteReference, deliveryQuoteVersion, expectedReadyAt: order.scheduledFulfilmentAt ?? new Date() };
  });
  if ("replayed" in staged) return staged;
  let courier: Awaited<ReturnType<NonNullable<StoreOrderDependencies["deliveryAuthority"]>["createCourierOrder"]>>;
  let dispatch: Awaited<ReturnType<NonNullable<NonNullable<StoreOrderDependencies["deliveryAuthority"]>["scheduleDispatch"]>>> | null = null;
  try {
    courier = await dependencies.deliveryAuthority.createCourierOrder({ storeOrderReference: staged.storeOrderReference, deliveryQuoteReference: staged.deliveryQuoteReference, deliveryQuoteVersion: staged.deliveryQuoteVersion, operationId: input.operationId });
    dispatch = dependencies.deliveryAuthority.scheduleDispatch ? await dependencies.deliveryAuthority.scheduleDispatch({ storeOrderReference: staged.storeOrderReference, courierOrderId: courier.courierOrderId, expectedReadyAt: staged.expectedReadyAt, operationId: `${input.operationId}:dispatch` }) : null;
  } catch (error) {
    await transaction(async (tx) => {
      const order = await lockOrder(tx, input.storeOrderReference);
      if (order.deliveryBridge?.courierOrderId || order.deliveryBridgeStatus !== "REQUEST_PENDING") return;
      const safeError = error instanceof Error ? error.message.slice(0, 500) : "Canonical courier authority failed.";
      await model(tx, "marketplaceStoreOrderDeliveryBridge").update({ where: { marketplaceStoreOrderId: order.id }, data: { status: "FAILED", dispatchEvidence: { failure: safeError, operationId: input.operationId } } });
      await updateOrder(tx, order, { deliveryBridgeStatus: "FAILED" });
      await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "COURIER_ORDER_BRIDGE_FAILED", actorUserId: input.actorUserId, evidence: { failure: safeError } });
    });
    throw error;
  }
  return transaction(async (tx) => {
    const order = await lockOrder(tx, input.storeOrderReference);
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    assertStoreOrder(order.deliveryBridgeStatus === "REQUEST_PENDING" && !order.deliveryBridge?.courierOrderId, "STORE_ORDER_DELIVERY_BRIDGE_INVALID", "Staged delivery bridge is unavailable.");
    const bridgeStatus = dispatch ? "DISPATCH_PENDING" : "DELIVERY_ORDER_CREATED";
    await model(tx, "marketplaceStoreOrderDeliveryBridge").update({ where: { marketplaceStoreOrderId: order.id }, data: { courierOrderId: courier.courierOrderId, courierOrderReference: courier.courierOrderReference, status: bridgeStatus, dispatchEvidence: dispatch?.dispatchEvidence ?? null } });
    await updateOrder(tx, order, { deliveryBridgeStatus: bridgeStatus });
    const response = { storeOrderReference: order.publicReference, courierOrderReference: courier.courierOrderReference, deliveryBridgeStatus: bridgeStatus, dispatchScheduled: Boolean(dispatch) };
    await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "COURIER_ORDER_BRIDGED", actorUserId: input.actorUserId, evidence: response });
    await receipt(tx, { storeOrderId: order.id, operationId: input.operationId, hash: input.requestHash, type: "DELIVERY_BRIDGE", response });
    return { ...response, replayed: false };
  });
}

export async function refreshStoreOrderDriverAssignment(input: Readonly<{ storeOrderReference: string; actorUserId: string; operationId: string; requestHash: string; testApproval?: TestApproval }>) {
  assertStoreOrderProductionReady("DELIVERY_BRIDGE", input.testApproval); checkOperation({ operationId: input.operationId, hash: input.requestHash });
  return transaction(async (tx) => {
    const order = await lockOrder(tx, input.storeOrderReference);
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    assertStoreOrder(order.deliveryBridge?.courierOrderId, "STORE_ORDER_DELIVERY_BRIDGE_MISSING", "Courier bridge is required before assignment refresh.");
    const assignment = await prisma.orderAssignment.findFirst({ where: { orderId: order.deliveryBridge.courierOrderId, status: "ACCEPTED", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { id: true, driverProfileId: true } });
    if (!assignment) return { storeOrderReference: order.publicReference, assigned: false, replayed: false };
    await updateOrder(tx, order, { deliveryBridgeStatus: order.preparationStatus === "READY_FOR_HANDOFF" ? "HANDOFF_READY" : "DRIVER_ASSIGNED" });
    const response = { storeOrderReference: order.publicReference, assigned: true, assignmentId: assignment.id };
    await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "DRIVER_ASSIGNMENT_VERIFIED", actorUserId: input.actorUserId, evidence: response });
    await receipt(tx, { storeOrderId: order.id, operationId: input.operationId, hash: input.requestHash, type: "ASSIGNMENT_REFRESH", response });
    return { ...response, replayed: false };
  });
}

function challengeCode(): string { return String(randomInt(100_000, 1_000_000)); }
function challengeHash(code: string): string { return createHash("sha256").update(`phase21-pickup:${code}`).digest("hex"); }

export async function generateStoreOrderPickupChallenge(input: Readonly<{ storeOrderReference: string; actorUserId: string; operationId: string; requestHash: string; testApproval?: TestApproval }>) {
  assertStoreOrderProductionReady("HANDOFF", input.testApproval); checkOperation({ operationId: input.operationId, hash: input.requestHash });
  return transaction(async (tx) => {
    const order = await authorize(tx, input.storeOrderReference, input.actorUserId, "store_orders.handoff");
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    assertStoreOrder(order.preparationStatus === "READY_FOR_HANDOFF" && order.deliveryBridge?.courierOrderId, "STORE_ORDER_HANDOFF_NOT_READY", "Ready state and a courier bridge are required.");
    const assignment = await prisma.orderAssignment.findFirst({ where: { orderId: order.deliveryBridge.courierOrderId, status: "ACCEPTED", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { id: true, driverProfileId: true } });
    assertStoreOrder(assignment, "STORE_ORDER_DRIVER_ASSIGNMENT_INVALID", "An active accepted driver assignment is required.");
    const code = challengeCode(); const expiresAt = new Date(Date.now() + 10 * 60_000);
    const handoff = await model(tx, "marketplaceStoreOrderPickupHandoff").upsert({ where: { marketplaceStoreOrderId: order.id }, create: { publicReference: ref("sohandoff"), marketplaceStoreOrderId: order.id, courierOrderId: order.deliveryBridge.courierOrderId, assignmentId: assignment.id, driverProfileId: assignment.driverProfileId, challengeHash: challengeHash(code), expiresAt, status: "CHALLENGE_ACTIVE", storeVerifiedByUserId: input.actorUserId, operationId: input.operationId, requestHash: input.requestHash }, update: { assignmentId: assignment.id, driverProfileId: assignment.driverProfileId, challengeHash: challengeHash(code), challengeVersion: { increment: 1 }, expiresAt, status: "CHALLENGE_ACTIVE", failedAttemptCount: 0, storeVerifiedByUserId: input.actorUserId, operationId: input.operationId, requestHash: input.requestHash } });
    await updateOrder(tx, order, { deliveryBridgeStatus: "HANDOFF_READY" });
    const response = { storeOrderReference: order.publicReference, handoffReference: handoff.publicReference, pickupCode: code, expiresAt: expiresAt.toISOString() };
    await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "PICKUP_CHALLENGE_GENERATED", actorUserId: input.actorUserId, evidence: { handoffReference: handoff.publicReference, expiresAt: expiresAt.toISOString() } });
    await receipt(tx, { storeOrderId: order.id, operationId: input.operationId, hash: input.requestHash, type: "HANDOFF_CHALLENGE", response: { storeOrderReference: order.publicReference, handoffReference: handoff.publicReference, expiresAt: expiresAt.toISOString(), pickupCodeIssued: true } });
    return { ...response, replayed: false };
  });
}

function sameChallenge(candidate: string, expectedHash: string): boolean {
  const actual = Buffer.from(challengeHash(candidate)); const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function verifyStoreOrderPickupHandoff(input: Readonly<{ storeOrderReference: string; driverUserId: string; driverProfileId: string; pickupCode: string; packageEvidence?: Record<string, unknown>; sealEvidence?: Record<string, unknown>; operationId: string; requestHash: string; dependencies?: StoreOrderDependencies; testApproval?: TestApproval }>) {
  const dependencies = { ...resolveStoreOrderProductionComposition(), ...input.dependencies };
  assertStoreOrderProductionReady("HANDOFF", input.testApproval); checkOperation({ operationId: input.operationId, hash: input.requestHash });
  assertStoreOrder(/^\d{6}$/.test(input.pickupCode), "STORE_ORDER_HANDOFF_CODE_INVALID", "Pickup code is invalid.");
  assertStoreOrder(dependencies.pickupAuthority, "STORE_ORDER_PICKUP_AUTHORITY_UNAVAILABLE", "The existing Phase 8 pickup authority is unavailable.");
  const staged = await transaction(async (tx) => {
    const order = await lockOrder(tx, input.storeOrderReference);
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    const handoff = order.pickupHandoff;
    assertStoreOrder(handoff && handoff.status === "CHALLENGE_ACTIVE" && handoff.expiresAt > new Date() && handoff.storeVerifiedByUserId, "STORE_ORDER_HANDOFF_CHALLENGE_INVALID", "A store-verified active pickup challenge is required.");
    const assignment = await prisma.orderAssignment.findFirst({ where: { id: handoff.assignmentId, orderId: handoff.courierOrderId, driverProfileId: input.driverProfileId, status: "ACCEPTED", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, include: { driverProfile: { select: { userId: true, status: true } }, order: { select: { parcelCount: true } } } });
    assertStoreOrder(assignment?.driverProfile.userId === input.driverUserId && assignment.driverProfile.status === "ACTIVE", "STORE_ORDER_DRIVER_ASSIGNMENT_INVALID", "The active assignment does not belong to this driver.");
    const packageCount = input.packageEvidence?.packageCount;
    assertStoreOrder(Number.isInteger(packageCount) && packageCount === assignment.order.parcelCount, "STORE_ORDER_HANDOFF_PACKAGE_MISMATCH", "Package count does not match the canonical courier order.");
    if (!sameChallenge(input.pickupCode, handoff.challengeHash)) {
      const attempts = handoff.failedAttemptCount + 1;
      await model(tx, "marketplaceStoreOrderPickupHandoff").update({ where: { id: handoff.id }, data: { failedAttemptCount: attempts, status: attempts >= 5 ? "EXPIRED" : "CHALLENGE_ACTIVE" } });
      return { invalidCode: true };
    }
    return { storeOrderReference: order.publicReference, handoffReference: handoff.publicReference, handoffId: handoff.id, assignmentId: assignment.id, assignmentVersion: assignment.version, courierOrderReference: order.deliveryBridge?.courierOrderReference ?? null, packageCount };
  });
  if ("replayed" in staged) return staged;
  if ("invalidCode" in staged) throw new StoreOrderError("STORE_ORDER_HANDOFF_CODE_INVALID", "Pickup code is invalid.");
  try {
    // Phase 8 owns this canonical custody mutation. It intentionally occurs
    // outside the local marketplace transaction; the final transaction below
    // persists only Phase 21 evidence after the canonical transition succeeds.
    await dependencies.pickupAuthority.completeCanonicalPickup({ assignmentId: staged.assignmentId, assignmentVersion: staged.assignmentVersion, driverProfileId: input.driverProfileId, driverUserId: input.driverUserId, operationId: `${input.operationId}:phase8-pickup`, packageCount: staged.packageCount });
  } catch (error) {
    await transaction(async (tx) => {
      const order = await lockOrder(tx, input.storeOrderReference);
      if (order.pickupHandoff?.status !== "CHALLENGE_ACTIVE") return;
      const safeError = error instanceof Error ? error.message.slice(0, 500) : "Canonical pickup authority failed.";
      await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "STORE_PICKUP_HANDOFF_CANONICAL_FAILED", actorUserId: input.driverUserId, evidence: { failure: safeError, handoffReference: order.pickupHandoff.publicReference } });
    });
    throw error;
  }
  return transaction(async (tx) => {
    const order = await lockOrder(tx, input.storeOrderReference);
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    const handoff = order.pickupHandoff;
    if (handoff?.id !== staged.handoffId || handoff.status !== "CHALLENGE_ACTIVE" || !sameChallenge(input.pickupCode, handoff.challengeHash)) throw new StoreOrderError("STORE_ORDER_HANDOFF_CONCURRENCY_CONFLICT", "Pickup challenge changed before handoff evidence could be persisted.", true);
    await model(tx, "marketplaceStoreOrderPickupHandoff").update({ where: { id: handoff.id }, data: { status: "VERIFIED", packageEvidence: input.packageEvidence ?? null, sealEvidence: input.sealEvidence ?? null, driverVerifiedAt: new Date(), verifiedAt: new Date() } });
    for (const line of order.lines) {
      if (line.fulfilment?.status !== "READY") continue;
      await model(tx, "marketplaceStoreOrderLineFulfilment").update({ where: { id: line.fulfilment.id }, data: { status: "HANDED_OFF", handedOffQuantity: line.fulfilment.confirmedAvailableQuantity + line.fulfilment.resolvedFulfilmentQuantity, version: { increment: 1 } } });
    }
    assertPreparationTransition(order.preparationStatus, "HANDED_OFF");
    await updateOrder(tx, order, { preparationStatus: "HANDED_OFF", deliveryBridgeStatus: "HANDED_OFF" });
    const response = { storeOrderReference: order.publicReference, handoffReference: handoff.publicReference, handoffStatus: "VERIFIED", courierOrderReference: staged.courierOrderReference };
    await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "STORE_PICKUP_HANDOFF_VERIFIED", actorUserId: input.driverUserId, evidence: response });
    await receipt(tx, { storeOrderId: order.id, operationId: input.operationId, hash: input.requestHash, type: "HANDOFF_VERIFY", response });
    // Phase 8 owns the canonical pickup transition. This function never writes
    // customer-delivery completion or an Order delivery status directly.
    return { ...response, replayed: false };
  });
}

export function projectMarketplaceParentStatus(storeOrders: readonly Readonly<{ acceptanceStatus: string; preparationStatus: string; resolutionStatus: string; deliveryBridgeStatus: string }>[]) {
  assertStoreOrder(storeOrders.length > 0, "STORE_ORDER_PARENT_EMPTY", "Parent order has no store orders.");
  const summary = {
    total: storeOrders.length,
    handedOff: storeOrders.filter((item) => item.preparationStatus === "HANDED_OFF").length,
    rejectedOrCancelled: storeOrders.filter((item) => ["REJECTED", "TIMED_OUT"].includes(item.acceptanceStatus) || item.preparationStatus === "ABORTED").length,
    customerActionRequired: storeOrders.filter((item) => item.acceptanceStatus === "CUSTOMER_ACTION_REQUIRED" || item.resolutionStatus === "ISSUE_OPEN").length,
    reconciliationRequired: storeOrders.filter((item) => item.resolutionStatus === "RECONCILIATION_REQUIRED").length,
  };
  const status = summary.reconciliationRequired > 0 ? "RECONCILIATION_REQUIRED" : summary.handedOff === summary.total ? "ALL_STORES_HANDED_OFF" : summary.rejectedOrCancelled === summary.total ? "ALL_STORES_CANCELLED" : summary.customerActionRequired > 0 ? "CUSTOMER_ACTION_REQUIRED" : "IN_PROGRESS";
  return { status, ...summary } as const;
}

export async function listStoreOrderQueue(storeId: string) {
  const rows = await model(db, "marketplaceStoreOrder").findMany({ where: { storeId }, select: { publicReference: true, acceptanceStatus: true, preparationStatus: true, resolutionStatus: true, deliveryBridgeStatus: true, reviewDeadlineAt: true, scheduledFulfilmentAt: true, createdAt: true, acceptedPreparationMinutes: true }, orderBy: [{ reviewDeadlineAt: "asc" }, { scheduledFulfilmentAt: "asc" }, { createdAt: "asc" }, { publicReference: "asc" }] });
  const sections: Record<string, any[]> = { needsReview: [], customerActionRequired: [], accepted: [], preparing: [], readyForPickup: [], handoffInProgress: [], completedHandoff: [], rejectedOrCancelled: [], reconciliationRequired: [] };
  for (const row of rows) {
    const section = row.resolutionStatus === "RECONCILIATION_REQUIRED" ? "reconciliationRequired"
      : ["REJECTED", "TIMED_OUT"].includes(row.acceptanceStatus) || row.preparationStatus === "ABORTED" ? "rejectedOrCancelled"
      : row.preparationStatus === "HANDED_OFF" ? "completedHandoff"
      : row.preparationStatus === "READY_FOR_HANDOFF" && ["DRIVER_ASSIGNED", "HANDOFF_READY"].includes(row.deliveryBridgeStatus) ? "handoffInProgress"
      : row.preparationStatus === "READY_FOR_HANDOFF" ? "readyForPickup"
      : row.preparationStatus === "PREPARING" ? "preparing"
      : row.acceptanceStatus === "ACCEPTED" ? "accepted"
      : row.acceptanceStatus === "CUSTOMER_ACTION_REQUIRED" || row.resolutionStatus === "ISSUE_OPEN" ? "customerActionRequired" : "needsReview";
    sections[section].push(row);
  }
  return sections;
}

export async function createStoreOrderReconciliationCase(input: Readonly<{ storeOrderReference: string; reasonCode: string; safeSummary: string; operationId: string; evidence?: Record<string, unknown>; testApproval?: TestApproval }>) {
  assertStoreOrderProductionReady("RECONCILIATION", input.testApproval); checkOperation({ operationId: input.operationId, hash: requestHash("reconcile", { reference: input.storeOrderReference, reason: input.reasonCode, operationId: input.operationId }) });
  return transaction(async (tx) => {
    const order = await lockOrder(tx, input.storeOrderReference);
    const caseKey = `${order.id}:${input.reasonCode}:${input.operationId}`;
    const reconciliation = await model(tx, "marketplaceStoreOrderReconciliationCase").upsert({ where: { caseKey }, create: { publicReference: ref("sorec"), caseKey, marketplaceStoreOrderId: order.id, reasonCode: input.reasonCode.slice(0, 80), priority: "HIGH", safeSummary: input.safeSummary.slice(0, 500), safeEvidence: input.evidence ?? null, retryOperationId: input.operationId }, update: { observationCount: { increment: 1 }, safeSummary: input.safeSummary.slice(0, 500), safeEvidence: input.evidence ?? null } });
    if (order.resolutionStatus !== "RECONCILIATION_REQUIRED") await updateOrder(tx, order, { resolutionStatus: "RECONCILIATION_REQUIRED", financialResolutionStatus: "RECONCILIATION_REQUIRED" });
    await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "STORE_ORDER_RECONCILIATION_REQUIRED", evidence: { reconciliationReference: reconciliation.publicReference, reasonCode: input.reasonCode } });
    return { reconciliationReference: reconciliation.publicReference, replayed: false };
  });
}

/** Called by the reviewed settlement-to-operations worker. It freezes the active
 * policy and checkout operational evidence exactly once; it never accepts. */
export async function initializeMarketplaceStoreOrderOperations(input: Readonly<{ storeOrderReference: string; operationId: string; requestHash: string; testApproval?: TestApproval }>) {
  assertStoreOrderProductionReady("OPERATIONAL_SNAPSHOT", input.testApproval); checkOperation({ operationId: input.operationId, hash: input.requestHash });
  return transaction(async (tx) => {
    const order = await lockOrder(tx, input.storeOrderReference);
    const prior = await replay(tx, order.id, input.operationId, input.requestHash); if (prior) return prior;
    assertStoreOrder(order.status === "SETTLED", "STORE_ORDER_SETTLEMENT_PENDING", "Operational review begins only after the Phase 20 store settlement is coherent.");
    assertStoreOrder(!order.operationalPolicyId && !order.operationalSnapshot, "STORE_ORDER_ALREADY_INITIALIZED", "Operational snapshot is already immutable.");
    const policy = await model(tx, "storeOrderOperationalPolicy").findFirst({ where: { status: "ACTIVE", effectiveFrom: { lte: new Date() }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }] }, orderBy: [{ effectiveFrom: "desc" }, { versionNumber: "desc" }] });
    assertStoreOrder(policy, "STORE_ORDER_POLICY_MISSING", "No active bounded operational policy is available.");
    const snapshot = { operationalPolicyReference: policy.publicReference, operationalPolicyVersion: policy.versionNumber, sellerIdentityEvidence: order.sellerIdentityEvidence, storeId: order.storeId, fulfilmentMode: order.checkoutStoreGroup.fulfilmentMode, pickupLocationReference: order.checkoutStoreGroup.pickupLocationReference, deliveryQuoteReference: order.checkoutStoreGroup.deliveryQuoteReference, deliveryQuoteVersion: order.checkoutStoreGroup.deliveryQuoteVersion, expectedPreparationWindowMinutes: policy.maximumPrepMinutes, customerSubstitutionDefault: "REFUND_IF_UNAVAILABLE", contactPrivacyPolicy: "phase21-minimum-necessary-v1", urgencyClass: "STANDARD", sourceCommercialFingerprint: order.settlementSnapshots[0]?.sourceCommercialFingerprint ?? null };
    assertStoreOrder(Boolean(snapshot.pickupLocationReference) && Boolean(snapshot.deliveryQuoteReference) && Boolean(snapshot.deliveryQuoteVersion), "STORE_ORDER_SNAPSHOT_INVALID", "Paid checkout lacks frozen pickup or delivery quote evidence.");
    const deadline = new Date(Date.now() + policy.acceptanceWindowSeconds * 1000);
    // Create each missing real fulfilment record idempotently through its
    // immutable unique order-line key.
    for (const line of order.lines) {
      const existing = line.fulfilment ?? await model(tx, "marketplaceStoreOrderLineFulfilment").findUnique({ where: { marketplaceOrderLineId: line.id } });
      if (!existing) await model(tx, "marketplaceStoreOrderLineFulfilment").create({ data: { publicReference: ref("soline"), marketplaceStoreOrderId: order.id, marketplaceOrderLineId: line.id, orderedQuantity: line.quantity, substitutionPreference: "REFUND_IF_UNAVAILABLE", status: "ORDERED" } });
    }
    await updateOrder(tx, order, { operationalPolicyId: policy.id, operationalPolicyReference: policy.publicReference, operationalPolicyVersion: policy.versionNumber, operationalSnapshot: snapshot, reviewDeadlineAt: deadline, acceptanceStatus: "PENDING_STORE_REVIEW", preparationStatus: "NOT_STARTED", resolutionStatus: "CLEAR", deliveryBridgeStatus: "NOT_REQUESTED", financialResolutionStatus: "UNCHANGED" });
    const response = { storeOrderReference: order.publicReference, operationalPolicyReference: policy.publicReference, operationalPolicyVersion: policy.versionNumber, reviewDeadlineAt: deadline.toISOString() };
    await history(tx, { storeOrderId: order.id, operationId: input.operationId, eventType: "STORE_ORDER_OPERATIONAL_SNAPSHOT_FROZEN", evidence: response });
    await receipt(tx, { storeOrderId: order.id, operationId: input.operationId, hash: input.requestHash, type: "OPERATIONS_INITIALIZATION", response });
    return { ...response, replayed: false };
  });
}
