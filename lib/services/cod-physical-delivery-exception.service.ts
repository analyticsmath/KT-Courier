import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { recordAdminAlertIntentInTx } from "@/lib/notifications/admin-alert-dispatch.service";
import { sanitizeLogContext } from "@/lib/observability/logger";
import type { AuthenticatedUser } from "@/types/domain";

export class CodPhysicalDeliveryExceptionError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
const PENDING = "PHYSICAL_DELIVERY_REVIEW_PENDING";
const VERIFIED = "PHYSICAL_DELIVERY_VERIFIED";
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function authorize(actor: AuthenticatedUser, operational: boolean) {
  if (actor.status !== "ACTIVE" || !["ADMIN", "SUPER_ADMIN"].includes(actor.role) ||
      !await hasPermission({ userId: actor.id, role: actor.role, permissionKey: PERMISSIONS.COD_OPERATIONS_MANAGE }) ||
      (operational && !await hasPermission({ userId: actor.id, role: actor.role, permissionKey: PERMISSIONS.ORDERS_STATUS_MANAGE }))) {
    throw new CodPhysicalDeliveryExceptionError("FORBIDDEN", "Cash operations authority is required.");
  }
}
function validate(input: { operationId: string; reason: string }) {
  if (!/^[A-Za-z0-9:_-]{8,120}$/.test(input.operationId) || !input.reason.trim() || input.reason.trim().length > 1000)
    throw new CodPhysicalDeliveryExceptionError("INVALID_INPUT", "A valid operation reference and reason are required.");
}
function response(status: string, cod: { cashObligation: Prisma.Decimal; cashCollected: Prisma.Decimal }) {
  return { status, cashOutstanding: Prisma.Decimal.max(cod.cashObligation.sub(cod.cashCollected), 0).toFixed(2) };
}

async function assertOrderEvidence(tx: Prisma.TransactionClient, orderId: string, reference: string | undefined) {
  if (!reference || reference.length > 160) throw new CodPhysicalDeliveryExceptionError("EVIDENCE_REQUIRED", "Order-owned private delivery evidence is required.");
  const proof = await tx.deliveryProofEvidence.findFirst({ where: { publicReference: reference, orderId, status: "READY", privateVisibility: true, validatedAt: { not: null }, assignment: { status: "ACCEPTED" } }, select: { storageReference: true, driverProfileId: true, assignment: { select: { driverProfileId: true } } } });
  const media = proof && await tx.privateMediaObject.findFirst({ where: { publicReference: proof.storageReference, ownerType: "PROOF_OF_DELIVERY", ownerId: orderId, purpose: "POD_EVIDENCE", status: { in: ["READY", "RETAINED"] }, detectedMimeType: { in: ["image/jpeg", "image/png", "image/webp"] } }, select: { id: true } });
  if (!proof || !media || proof.driverProfileId !== proof.assignment.driverProfileId) throw new CodPhysicalDeliveryExceptionError("EVIDENCE_REQUIRED", "Order-owned private delivery evidence is required.");
  return proof;
}

/** A report records an operational allegation. It never records cash, proof of
 * collection, delivery completion, financial settlement, or driver liability. */
export async function reportCodPhysicalDeliveryException(actor: AuthenticatedUser, orderId: string, input: { operationId: string; reason: string; evidenceReference?: string }) {
  await authorize(actor, true); validate(input);
  if (!input.evidenceReference) throw new CodPhysicalDeliveryExceptionError("EVIDENCE_REQUIRED", "Order-owned private delivery evidence is required.");
  const requestHash = digest({ orderId, reason: input.reason.trim(), evidenceReference: input.evidenceReference, actorId: actor.id });
  return withLedgerRetry(() => prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`);
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "CashOnDelivery" WHERE "orderId" = ${orderId} FOR UPDATE`);
    if (rows.length !== 1) throw new CodPhysicalDeliveryExceptionError("NOT_COD_ORDER", "This order has no cash obligation.");
    const cod = await tx.cashOnDelivery.findUniqueOrThrow({ where: { id: rows[0].id }, include: { order: { select: { status: true, currentDriverProfileId: true } } } });
    const operationId = `physical-report:${input.operationId}`;
    const prior = await tx.cashOnDeliveryEvent.findUnique({ where: { operationId } });
    if (prior) {
      if (prior.cashOnDeliveryId !== cod.id || prior.actorUserId !== actor.id || prior.requestHash !== requestHash || prior.eventType !== "PHYSICAL_DELIVERY_REPORTED") throw new CodPhysicalDeliveryExceptionError("CONFLICT", "The operation reference was already used.");
      const saved = prior.safeEvidence && typeof prior.safeEvidence === "object" && !Array.isArray(prior.safeEvidence) ? prior.safeEvidence as Record<string, unknown> : {};
      if (typeof saved.cashOutstanding !== "string") throw new CodPhysicalDeliveryExceptionError("CONFLICT", "The stored report receipt is incomplete.");
      return { status: "REVIEW_PENDING", cashOutstanding: saved.cashOutstanding };
    }
    if (!["PICKED_UP", "IN_TRANSIT", "DELIVERY_ATTEMPTED"].includes(cod.order.status) || cod.status !== "READY_FOR_COLLECTION" || !cod.order.currentDriverProfileId || !cod.digitalPaid.equals(cod.digitalRequired) || cod.cashCollected.greaterThanOrEqualTo(cod.cashObligation) || cod.reconciliationStatus !== "PENDING") throw new CodPhysicalDeliveryExceptionError("NOT_ELIGIBLE", "An active assigned COD delivery with outstanding cash is required.");
    const proof = await assertOrderEvidence(tx, orderId, input.evidenceReference);
    if (proof.driverProfileId !== cod.order.currentDriverProfileId) throw new CodPhysicalDeliveryExceptionError("EVIDENCE_REQUIRED", "Evidence must belong to the current assigned driver.");
    await tx.cashOnDelivery.update({ where: { id: cod.id }, data: { reconciliationStatus: PENDING, version: { increment: 1 }, events: { create: { operationId, requestHash, eventType: "PHYSICAL_DELIVERY_REPORTED", actorUserId: actor.id, safeReasonCode: "PHYSICAL_DELIVERY_CASH_OUTSTANDING", safeEvidence: { evidenceReference: input.evidenceReference, driverId: cod.order.currentDriverProfileId, cashOutstanding: cod.cashObligation.sub(cod.cashCollected).toFixed(2) } } } } });
    await tx.adminActivityLog.create({ data: { actorUserId: actor.id, action: "CREATE", entityType: "CashOnDelivery", entityId: cod.id, message: "Reported physical delivery with cash outstanding for independent review.", metadata: sanitizeLogContext({ reason: input.reason.trim() }) as Prisma.InputJsonValue } });
    await recordAdminAlertIntentInTx(tx, { eventType: "COD_RECONCILIATION_DISCREPANCY", aggregateReference: operationId, title: "Reported delivery with cash outstanding", summary: "Independent cash review is required; no collection has been recorded by this report.", adminPath: `/admin/orders/${orderId}`, relatedOrderId: orderId, metadata: { codReference: cod.publicReference } });
    return response("REVIEW_PENDING", cod);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

/** Independent review records the reported physical event only. Outstanding
 * cash remains an obligation and cannot fund settlement or earnings. */
export async function reviewCodPhysicalDeliveryException(actor: AuthenticatedUser, orderId: string, input: { operationId: string; decision: "VERIFY" | "REJECT"; reason: string }) {
  await authorize(actor, false); validate(input);
  if (!["VERIFY", "REJECT"].includes(input.decision)) throw new CodPhysicalDeliveryExceptionError("INVALID_INPUT", "A valid review decision is required.");
  const requestHash = digest({ orderId, reason: input.reason.trim(), decision: input.decision, actorId: actor.id });
  return withLedgerRetry(() => prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`);
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "CashOnDelivery" WHERE "orderId" = ${orderId} FOR UPDATE`);
    if (rows.length !== 1) throw new CodPhysicalDeliveryExceptionError("NOT_COD_ORDER", "This order has no cash obligation.");
    const cod = await tx.cashOnDelivery.findUniqueOrThrow({ where: { id: rows[0].id }, include: { order: { select: { currentDriverProfileId: true } } } });
    const operationId = `physical-review:${input.operationId}`;
    const prior = await tx.cashOnDeliveryEvent.findUnique({ where: { operationId } });
    if (prior) {
      if (prior.cashOnDeliveryId !== cod.id || prior.actorUserId !== actor.id || prior.requestHash !== requestHash || prior.eventType !== "PHYSICAL_DELIVERY_REVIEWED") throw new CodPhysicalDeliveryExceptionError("CONFLICT", "The operation reference was already used.");
      const saved = prior.safeEvidence && typeof prior.safeEvidence === "object" && !Array.isArray(prior.safeEvidence) ? prior.safeEvidence as Record<string, unknown> : {};
      if (typeof saved.resultStatus !== "string" || typeof saved.cashOutstanding !== "string") throw new CodPhysicalDeliveryExceptionError("CONFLICT", "The stored review receipt is incomplete.");
      return { status: saved.resultStatus, cashOutstanding: saved.cashOutstanding };
    }
    if (cod.reconciliationStatus !== PENDING) throw new CodPhysicalDeliveryExceptionError("NOT_PENDING", "There is no pending physical-delivery report to review.");
    const report = await tx.cashOnDeliveryEvent.findFirst({ where: { cashOnDeliveryId: cod.id, eventType: "PHYSICAL_DELIVERY_REPORTED" }, orderBy: { createdAt: "desc" } });
    if (!report || !report.actorUserId || report.actorUserId === actor.id) throw new CodPhysicalDeliveryExceptionError("INDEPENDENT_REVIEW_REQUIRED", "A different authorized finance reviewer must review the report.");
    const evidence = report.safeEvidence && typeof report.safeEvidence === "object" && !Array.isArray(report.safeEvidence) ? report.safeEvidence as Record<string, unknown> : {};
    if (input.decision === "VERIFY") {
      const proof = await assertOrderEvidence(tx, orderId, typeof evidence.evidenceReference === "string" ? evidence.evidenceReference : undefined);
      if (proof.driverProfileId !== cod.order.currentDriverProfileId) throw new CodPhysicalDeliveryExceptionError("EVIDENCE_REQUIRED", "Evidence must belong to the current assigned driver.");
    }
    if (!["READY_FOR_COLLECTION", "COLLECTED"].includes(cod.status)) throw new CodPhysicalDeliveryExceptionError("CASH_STATE_CHANGED", "Cash state changed; review the current collection evidence.");
    const resultStatus = input.decision === "REJECT" ? "REJECTED" : cod.cashCollected.greaterThanOrEqualTo(cod.cashObligation) ? "VERIFIED_CASH_COLLECTED" : "VERIFIED_CASH_OUTSTANDING";
    await tx.cashOnDelivery.update({ where: { id: cod.id }, data: { reconciliationStatus: input.decision === "VERIFY" ? VERIFIED : "PENDING", version: { increment: 1 }, events: { create: { operationId, requestHash, eventType: "PHYSICAL_DELIVERY_REVIEWED", actorUserId: actor.id, safeReasonCode: input.decision, safeEvidence: { reportEventId: report.id, resultStatus, cashOutstanding: Prisma.Decimal.max(cod.cashObligation.sub(cod.cashCollected), 0).toFixed(2) } } } } });
    await tx.adminActivityLog.create({ data: { actorUserId: actor.id, action: "STATUS_CHANGE", entityType: "CashOnDelivery", entityId: cod.id, message: "Independently reviewed the physical-delivery report.", metadata: sanitizeLogContext({ decision: input.decision, reason: input.reason.trim() }) as Prisma.InputJsonValue } });
    return response(resultStatus, cod);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}
