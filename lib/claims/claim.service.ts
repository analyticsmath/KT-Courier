import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { RefundError } from "@/lib/refunds/errors";
import { createRefundRequest } from "@/lib/services/refund-request.service";
import { requestClaimFulfilmentRemedy, ShippingGovernanceError } from "@/lib/services/shipping-governance.service";
import { ClaimPaymentSource, ClaimReason, ClaimRemedyType, ClaimResponsibility, ClaimStatus, UserRole } from "@/types/db";

export class ClaimDomainError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

const CLAIM_REASONS = new Set(Object.values(ClaimReason));
const CLAIM_REMEDIES = new Set(Object.values(ClaimRemedyType));
const FINANCIAL_REMEDIES = new Set<ClaimRemedyType>([ClaimRemedyType.PARTIAL_REFUND, ClaimRemedyType.FULL_REFUND, ClaimRemedyType.STORE_CREDIT]);

function reference(prefix: string) { return `${prefix}-${randomUUID().replaceAll("-", "").toUpperCase()}`; }
function operationHash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

async function resolveClaimSubject(input: Readonly<{ claimantUserId: string; orderReference?: string; marketplaceOrderReference?: string; marketplaceOrderLineId?: string }>) {
  if (Boolean(input.orderReference) === Boolean(input.marketplaceOrderReference)) throw new ClaimDomainError("CLAIM_SUBJECT_REQUIRED", "Provide exactly one order reference.");
  if (input.orderReference) {
    const order = await prisma.order.findUnique({ where: { orderNumber: input.orderReference }, include: { payments: { select: { id: true } }, cashOnDelivery: { select: { digitalRequired: true, cashObligation: true } } } });
    if (!order || order.customerId !== input.claimantUserId) throw new ClaimDomainError("CLAIM_FORBIDDEN", "The order is not available to this claimant.");
    const cod = order.cashOnDelivery;
    const paymentSource = cod && cod.digitalRequired.gt(0) && cod.cashObligation.gt(0) ? ClaimPaymentSource.MIXED : cod && cod.cashObligation.gt(0) ? ClaimPaymentSource.CASH : ClaimPaymentSource.DIGITAL;
    return { orderId: order.id, marketplaceOrderId: null, marketplaceOrderLineId: null, paymentSource };
  }
  const marketplace = await prisma.marketplaceOrder.findUnique({ where: { publicReference: input.marketplaceOrderReference }, include: { storeOrders: { select: { lines: { select: { id: true } } } } } });
  if (!marketplace || marketplace.customerUserId !== input.claimantUserId) throw new ClaimDomainError("CLAIM_FORBIDDEN", "The order is not available to this claimant.");
  if (input.marketplaceOrderLineId && !marketplace.storeOrders.some((storeOrder) => storeOrder.lines.some((line) => line.id === input.marketplaceOrderLineId))) throw new ClaimDomainError("CLAIM_LINE_FORBIDDEN", "The line item does not belong to this order.");
  return { orderId: null, marketplaceOrderId: marketplace.id, marketplaceOrderLineId: input.marketplaceOrderLineId ?? null, paymentSource: ClaimPaymentSource.DIGITAL };
}

async function marketplaceOrderIdsForDriver(userId: string): Promise<string[]> {
  const storeOrders = await prisma.marketplaceStoreOrder.findMany({
    where: { deliveryBridge: { courierOrder: { currentDriverProfile: { userId } } } },
    select: { marketplaceOrderId: true },
  });
  return storeOrders.map((storeOrder) => storeOrder.marketplaceOrderId);
}

async function assertClaimPermission(input: Readonly<{ actorUserId: string; role: UserRole; permission: typeof PERMISSIONS.CLAIMS_INVESTIGATE | typeof PERMISSIONS.CLAIMS_DECIDE }>) {
  if (!await hasPermission({ userId: input.actorUserId, role: input.role, permissionKey: input.permission })) {
    throw new ClaimDomainError("CLAIM_DECISION_FORBIDDEN", "The actor is not authorized for this claim action.");
  }
}

export async function createClaim(input: Readonly<{ claimantUserId: string; orderReference?: string; marketplaceOrderReference?: string; marketplaceOrderLineId?: string; reason: ClaimReason; description: string; operationId: string }>) {
  if (!CLAIM_REASONS.has(input.reason)) throw new ClaimDomainError("CLAIM_REASON_INVALID", "Claim reason is invalid.");
  const description = input.description.trim();
  if (description.length < 8 || description.length > 4000) throw new ClaimDomainError("CLAIM_DESCRIPTION_INVALID", "Claim description must be between 8 and 4000 characters.");
  if (!/^CLMOP-[A-Z0-9-]{12,100}$/.test(input.operationId)) throw new ClaimDomainError("CLAIM_OPERATION_INVALID", "Claim operation ID is invalid.");
  const subject = await resolveClaimSubject(input);
  const duplicateFingerprint = operationHash({ orderId: subject.orderId, marketplaceOrderId: subject.marketplaceOrderId, marketplaceOrderLineId: subject.marketplaceOrderLineId, reason: input.reason });
  try {
    return await prisma.$transaction(async (tx) => {
    const existingOperation = await tx.claimActivity.findFirst({ where: { eventType: "CLAIM_CREATED", metadata: { path: ["operationId"], equals: input.operationId } } });
    if (existingOperation) return tx.claim.findUniqueOrThrow({ where: { id: existingOperation.claimId } });
    const matchingClaims = await tx.claim.findMany({ where: { claimantUserId: input.claimantUserId, duplicateFingerprint: { startsWith: duplicateFingerprint } }, select: { status: true } });
    if (matchingClaims.some((claim) => !([ClaimStatus.CLOSED, ClaimStatus.REJECTED, ClaimStatus.CANCELLED] as ClaimStatus[]).includes(claim.status))) throw new ClaimDomainError("CLAIM_DUPLICATE", "An open claim already covers this subject and reason.");
    // The immutable unique key blocks concurrent duplicate filing. Once a prior
    // case is terminal, its operation-scoped suffix permits a distinct later case.
    const persistedFingerprint = matchingClaims.length === 0 ? duplicateFingerprint : `${duplicateFingerprint}:${operationHash({ operationId: input.operationId }).slice(0, 16)}`;
    const claim = await tx.claim.create({ data: { publicReference: reference("CLM"), claimantUserId: input.claimantUserId, ...subject, reason: input.reason, description, duplicateFingerprint: persistedFingerprint, status: ClaimStatus.OPEN } });
    await tx.claimActivity.create({ data: { claimId: claim.id, eventType: "CLAIM_CREATED", actorUserId: input.claimantUserId, participantRole: "CUSTOMER", safeDetail: "Claim submitted.", metadata: { operationId: input.operationId, reason: input.reason } } });
    // A package-policy declaration is immutable order evidence. Claims retain
    // their own lifecycle and remedies, but receive a safe version reference so
    // investigators can apply the policy actually accepted for the shipment.
    if (subject.orderId) {
      const declaration = await (tx as any).shipmentPackagePolicyDeclaration.findUnique({ where: { orderId: subject.orderId }, select: { publicReference: true, policySnapshot: true } });
      if (declaration) await tx.claimActivity.create({ data: { claimId: claim.id, eventType: "PACKAGE_POLICY_CONTEXT_LINKED", actorUserId: input.claimantUserId, participantRole: "SYSTEM", safeDetail: "Accepted package policy context linked to claim.", metadata: { packageDeclarationReference: declaration.publicReference, policySnapshot: declaration.policySnapshot } } });
    }
    return claim;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ClaimDomainError("CLAIM_DUPLICATE", "An open claim already covers this subject and reason.");
    }
    throw error;
  }
}

export async function assertClaimParticipant(input: Readonly<{ claimId: string; userId: string; role: UserRole }>) {
  const claim = await prisma.claim.findUnique({ where: { id: input.claimId }, include: { order: { include: { store: { select: { ownerUserId: true } }, currentDriverProfile: { select: { userId: true } } } } } });
  if (!claim) throw new ClaimDomainError("CLAIM_NOT_FOUND", "Claim was not found.");
  if (claim.claimantUserId === input.userId || claim.order?.store?.ownerUserId === input.userId || claim.order?.currentDriverProfile?.userId === input.userId) return claim;
  if ((input.role === UserRole.ADMIN || input.role === UserRole.SUPER_ADMIN)
    && (await hasPermission({ userId: input.userId, role: input.role, permissionKey: PERMISSIONS.CLAIMS_INVESTIGATE })
      || await hasPermission({ userId: input.userId, role: input.role, permissionKey: PERMISSIONS.CLAIMS_DECIDE }))) return claim;
  if (claim.marketplaceOrderId) {
    const participant = await prisma.marketplaceStoreOrder.findFirst({ where: { marketplaceOrderId: claim.marketplaceOrderId, store: { ownerUserId: input.userId } }, select: { id: true } });
    if (participant) return claim;
    if (input.role === UserRole.DRIVER && (await marketplaceOrderIdsForDriver(input.userId)).includes(claim.marketplaceOrderId)) return claim;
  }
  throw new ClaimDomainError("CLAIM_FORBIDDEN", "You are not a participant in this claim.");
}

export async function listClaimsForActor(input: Readonly<{ actorUserId: string; role: UserRole }>) {
  const driverMarketplaceOrderIds = input.role === UserRole.DRIVER ? await marketplaceOrderIdsForDriver(input.actorUserId) : [];
  const isClaimOperator = (input.role === UserRole.ADMIN || input.role === UserRole.SUPER_ADMIN)
    && (await hasPermission({ userId: input.actorUserId, role: input.role, permissionKey: PERMISSIONS.CLAIMS_INVESTIGATE })
      || await hasPermission({ userId: input.actorUserId, role: input.role, permissionKey: PERMISSIONS.CLAIMS_DECIDE }));
  const where = isClaimOperator ? {} : {
    OR: [
      { claimantUserId: input.actorUserId },
      { order: { store: { ownerUserId: input.actorUserId } } },
      { order: { currentDriverProfile: { userId: input.actorUserId } } },
      ...(driverMarketplaceOrderIds.length ? [{ marketplaceOrderId: { in: driverMarketplaceOrderIds } }] : []),
      { marketplaceOrderId: { in: await prisma.marketplaceStoreOrder.findMany({ where: { store: { ownerUserId: input.actorUserId } }, select: { marketplaceOrderId: true } }).then((rows) => rows.map((row) => row.marketplaceOrderId)) } },
    ],
  };
  return prisma.claim.findMany({ where, select: { publicReference: true, reason: true, status: true, paymentSource: true, fraudFlaggedAt: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: "desc" }, take: 200 });
}

export async function addClaimResponse(input: Readonly<{ publicReference: string; actorUserId: string; role: UserRole; detail: string; evidenceReference?: string }>) {
  const claim = await prisma.claim.findUnique({ where: { publicReference: input.publicReference } });
  if (!claim) throw new ClaimDomainError("CLAIM_NOT_FOUND", "Claim was not found.");
  await assertClaimParticipant({ claimId: claim.id, userId: input.actorUserId, role: input.role });
  const detail = input.detail.trim();
  if (detail.length < 1 || detail.length > 4000) throw new ClaimDomainError("CLAIM_RESPONSE_INVALID", "Claim response is invalid.");
  return prisma.claimActivity.create({ data: { claimId: claim.id, eventType: "PARTICIPANT_RESPONSE", actorUserId: input.actorUserId, participantRole: input.role, safeDetail: detail, evidenceReference: input.evidenceReference } });
}

export async function addClaimEvidence(input: Readonly<{ publicReference: string; actorUserId: string; role: UserRole; textualEvidence?: string; privateMediaReference?: string }>) {
  const claim = await prisma.claim.findUnique({ where: { publicReference: input.publicReference } });
  if (!claim) throw new ClaimDomainError("CLAIM_NOT_FOUND", "Claim was not found.");
  await assertClaimParticipant({ claimId: claim.id, userId: input.actorUserId, role: input.role });
  const textualEvidence = input.textualEvidence?.trim() || null;
  const media = input.privateMediaReference ? await prisma.privateMediaObject.findFirst({ where: { publicReference: input.privateMediaReference, ownerType: "CLAIM", ownerId: claim.id, purpose: "CLAIM_EVIDENCE" }, select: { id: true } }) : null;
  if (input.privateMediaReference && !media) throw new ClaimDomainError("CLAIM_EVIDENCE_FORBIDDEN", "Private evidence does not belong to this claim.");
  if (!textualEvidence && !media) throw new ClaimDomainError("CLAIM_EVIDENCE_REQUIRED", "Provide textual or private-media evidence.");
  const existing = media ? await prisma.claimEvidence.findFirst({ where: { claimId: claim.id, privateMediaObjectId: media.id } }) : null;
  if (existing) return existing;
  const evidence = await prisma.claimEvidence.create({ data: { claimId: claim.id, privateMediaObjectId: media?.id, textualEvidence, submittedByUserId: input.actorUserId } });
  await prisma.claimActivity.create({ data: { claimId: claim.id, eventType: "EVIDENCE_ADDED", actorUserId: input.actorUserId, participantRole: input.role, evidenceReference: input.privateMediaReference } });
  return evidence;
}

async function assertClaimEvidenceReference(claimId: string, reference: string | undefined) {
  if (!reference) return;
  const evidence = await prisma.claimEvidence.findFirst({ where: { claimId, privateMediaObject: { publicReference: reference, ownerType: "CLAIM", ownerId: claimId, purpose: "CLAIM_EVIDENCE" } }, select: { id: true } });
  if (!evidence) throw new ClaimDomainError("CLAIM_EVIDENCE_FORBIDDEN", "Supporting evidence does not belong to this claim.");
}

export async function recordClaimFinding(input: Readonly<{ publicReference: string; actorUserId: string; actorRole: UserRole; finding: ClaimResponsibility; reason: string; evidenceReference?: string }>) {
  await assertClaimPermission({ actorUserId: input.actorUserId, role: input.actorRole, permission: PERMISSIONS.CLAIMS_INVESTIGATE });
  const claim = await prisma.claim.findUnique({ where: { publicReference: input.publicReference } });
  if (!claim) throw new ClaimDomainError("CLAIM_NOT_FOUND", "Claim was not found.");
  await assertClaimEvidenceReference(claim.id, input.evidenceReference);
  const reason = input.reason.trim(); if (reason.length < 2 || reason.length > 2000) throw new ClaimDomainError("CLAIM_FINDING_INVALID", "Finding reason is invalid.");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.claim.update({ where: { id: claim.id }, data: { finding: input.finding, findingReason: reason, findingActorUserId: input.actorUserId, findingAt: new Date(), status: ClaimStatus.UNDER_INVESTIGATION, version: { increment: 1 } } });
    await tx.claimActivity.create({ data: { claimId: claim.id, eventType: "FINDING_RECORDED", actorUserId: input.actorUserId, participantRole: "OPERATIONS", safeDetail: reason, evidenceReference: input.evidenceReference, metadata: { finding: input.finding } } });
    return updated;
  });
}

export async function recordClaimInvestigationActivity(input: Readonly<{ publicReference: string; actorUserId: string; actorRole: UserRole; eventType: "ADMIN_NOTE" | "EVIDENCE_REQUEST"; detail: string; evidenceReference?: string }>) {
  await assertClaimPermission({ actorUserId: input.actorUserId, role: input.actorRole, permission: PERMISSIONS.CLAIMS_INVESTIGATE });
  const claim = await prisma.claim.findUnique({ where: { publicReference: input.publicReference }, select: { id: true } });
  if (!claim) throw new ClaimDomainError("CLAIM_NOT_FOUND", "Claim was not found.");
  await assertClaimEvidenceReference(claim.id, input.evidenceReference);
  const detail = input.detail.trim();
  if (detail.length < 1 || detail.length > 4000) throw new ClaimDomainError("CLAIM_ACTIVITY_INVALID", "Investigation activity is invalid.");
  return prisma.claimActivity.create({ data: { claimId: claim.id, eventType: input.eventType, actorUserId: input.actorUserId, participantRole: "OPERATIONS", safeDetail: detail, evidenceReference: input.evidenceReference } });
}

export async function flagClaimForFraudReview(input: Readonly<{ publicReference: string; actorUserId: string; actorRole: UserRole; reason: string }>) {
  await assertClaimPermission({ actorUserId: input.actorUserId, role: input.actorRole, permission: PERMISSIONS.CLAIMS_INVESTIGATE });
  const reason = input.reason.trim();
  if (reason.length < 2 || reason.length > 2000) throw new ClaimDomainError("CLAIM_FRAUD_FLAG_INVALID", "Fraud flag reason is invalid.");
  return prisma.$transaction(async (tx) => {
    const claim = await tx.claim.findUnique({ where: { publicReference: input.publicReference }, select: { id: true } });
    if (!claim) throw new ClaimDomainError("CLAIM_NOT_FOUND", "Claim was not found.");
    const flagged = await tx.claim.update({ where: { id: claim.id }, data: { fraudFlaggedAt: new Date(), fraudFlagReason: reason, version: { increment: 1 } } });
    await tx.claimActivity.create({ data: { claimId: claim.id, eventType: "FRAUD_FLAGGED", actorUserId: input.actorUserId, participantRole: "OPERATIONS", safeDetail: reason } });
    return flagged;
  });
}

async function resolveRefundPaymentReference(claim: Awaited<ReturnType<typeof prisma.claim.findUniqueOrThrow>>) {
  if (claim.orderId) {
    const payment = await prisma.payment.findFirst({ where: { orderId: claim.orderId, status: "SUCCEEDED" }, select: { publicReference: true } });
    return payment?.publicReference ?? null;
  }
  if (claim.marketplaceOrderId) {
    const market = await prisma.marketplaceOrder.findUnique({ where: { id: claim.marketplaceOrderId }, include: { payment: { select: { publicReference: true } } } });
    return market?.payment.publicReference ?? null;
  }
  return null;
}

async function resolveFinancialAmount(input: Readonly<{ claim: { paymentSource: ClaimPaymentSource }; paymentReference: string; remedy: ClaimRemedyType; amount?: string }>) {
  if (input.remedy === ClaimRemedyType.PARTIAL_REFUND || input.remedy === ClaimRemedyType.STORE_CREDIT) {
    if (!input.amount) throw new ClaimDomainError("CLAIM_REMEDY_AMOUNT_REQUIRED", "A remedy amount is required.");
    return input.amount;
  }
  if (input.amount) throw new ClaimDomainError("CLAIM_FULL_REFUND_AMOUNT_SERVER_CONTROLLED", "Full refund amount is determined by the canonical refund authority.");
  const payment = await prisma.payment.findUnique({ where: { publicReference: input.paymentReference }, select: { amount: true, totalRefundedAmount: true, totalRefundReservedAmount: true } });
  if (!payment) throw new ClaimDomainError("CLAIM_REFUND_SOURCE_UNAVAILABLE", "No canonical digital payment is available for this claim remedy.");
  const remaining = payment.amount.sub(payment.totalRefundedAmount).sub(payment.totalRefundReservedAmount);
  if (remaining.lte(0)) throw new ClaimDomainError("CLAIM_REFUND_NOT_AVAILABLE", "No refundable value remains for this claim.");
  return remaining.toFixed(2);
}

export async function decideClaimRemedy(input: Readonly<{ publicReference: string; actorUserId: string; actorRole: UserRole; remedy: ClaimRemedyType; reason: string; operationId: string; amount?: string; policyReference?: string; mixedPaymentStrategy?: string; evidenceReference?: string }>) {
  await assertClaimPermission({ actorUserId: input.actorUserId, role: input.actorRole, permission: PERMISSIONS.CLAIMS_DECIDE });
  if (!CLAIM_REMEDIES.has(input.remedy) || !/^CLMR-[A-Z0-9-]{12,100}$/.test(input.operationId)) throw new ClaimDomainError("CLAIM_REMEDY_INVALID", "Claim remedy input is invalid.");
  const claim = await prisma.claim.findUnique({ where: { publicReference: input.publicReference } });
  if (!claim) throw new ClaimDomainError("CLAIM_NOT_FOUND", "Claim was not found.");
  await assertClaimEvidenceReference(claim.id, input.evidenceReference);
  const reason = input.reason.trim(); if (reason.length < 2 || reason.length > 2000) throw new ClaimDomainError("CLAIM_DECISION_INVALID", "Decision reason is invalid.");
  if (claim.paymentSource === ClaimPaymentSource.MIXED && FINANCIAL_REMEDIES.has(input.remedy) && !input.mixedPaymentStrategy) throw new ClaimDomainError("CLAIM_MIXED_POLICY_REQUIRED", "A mixed-payment remedy strategy is required.");
  const requestHash = operationHash({ publicReference: input.publicReference, remedy: input.remedy, reason, amount: input.amount, policyReference: input.policyReference, mixedPaymentStrategy: input.mixedPaymentStrategy });
  const existing = await prisma.claimRemedy.findUnique({ where: { operationId: input.operationId } });
  if (existing) { if (existing.requestHash !== requestHash) throw new ClaimDomainError("CLAIM_IDEMPOTENCY_CONFLICT", "Operation ID belongs to another remedy."); return existing; }
  let redeliveryRequestId: string | null = null;
  if (input.remedy === ClaimRemedyType.REDELIVERY || input.remedy === ClaimRemedyType.REPLACEMENT) {
    if (!claim.orderId) throw new ClaimDomainError("CLAIM_REMEDY_ORDER_REQUIRED", "A courier order is required for a fulfilment remedy.");
    try {
      const request = await requestClaimFulfilmentRemedy({ claimId: claim.id, orderId: claim.orderId, claimantUserId: claim.claimantUserId, remedyType: input.remedy, operationId: `claim-fulfilment:${claim.id}` });
      redeliveryRequestId = request.id;
    } catch (error) {
      if (error instanceof ShippingGovernanceError) throw new ClaimDomainError(error.code, "The claim fulfilment remedy could not be prepared.");
      throw error;
    }
  }
  let refundId: string | null = null;
  let financialAmount: string | undefined;
  if (FINANCIAL_REMEDIES.has(input.remedy)) {
    if (claim.paymentSource === ClaimPaymentSource.CASH) throw new ClaimDomainError("CLAIM_CASH_REMEDY_POLICY_REQUIRED", "Cash claim remedies require the configured cash settlement policy.");
    const paymentReference = await resolveRefundPaymentReference(claim);
    if (!paymentReference) throw new ClaimDomainError("CLAIM_REFUND_SOURCE_UNAVAILABLE", "No canonical digital payment is available for this claim remedy.");
    financialAmount = await resolveFinancialAmount({ claim, paymentReference, remedy: input.remedy, amount: input.amount });
    try {
      // This is intentionally claim-stable rather than request-stable: concurrent
      // operators and retried requests can reach the Refund authority only once.
      const refund = await createRefundRequest({ actorUserId: claim.claimantUserId, paymentPublicReference: paymentReference, amount: financialAmount, method: input.remedy === ClaimRemedyType.STORE_CREDIT ? "CUSTOMER_WALLET" : "ORIGINAL_PAYMENT_METHOD", reasonCode: "CUSTOMER_SERVICE_RESOLUTION", customerNote: `Claim ${claim.publicReference}: ${reason}`, operationId: `claim-refund:${claim.id}` });
      refundId = refund.id;
    } catch (error) {
      if (error instanceof RefundError) throw new ClaimDomainError(error.code === "REFUND_IDEMPOTENCY_CONFLICT" ? "CLAIM_DECISION_CONFLICT" : error.code, error.message);
      throw error;
    }
  }
  return prisma.$transaction(async (tx) => {
    const already = await tx.claimRemedy.findUnique({ where: { claimId: claim.id } });
    if (already) return already;
    const remedy = await tx.claimRemedy.create({ data: { claimId: claim.id, type: input.remedy, operationId: input.operationId, requestHash, amount: financialAmount ? new Prisma.Decimal(financialAmount) : null, currency: financialAmount ? "ZAR" : null, paymentRefundId: refundId, mixedPaymentStrategy: input.mixedPaymentStrategy, decidedByUserId: input.actorUserId } });
    await tx.claim.update({ where: { id: claim.id }, data: { status: refundId ? ClaimStatus.REMEDY_IN_PROGRESS : ClaimStatus.DECIDED, decisionReason: reason, decisionPolicyReference: input.policyReference, decidedByUserId: input.actorUserId, decidedAt: new Date(), version: { increment: 1 } } });
    await tx.claimActivity.create({ data: { claimId: claim.id, eventType: "REMEDY_DECIDED", actorUserId: input.actorUserId, participantRole: "OPERATIONS", safeDetail: reason, evidenceReference: input.evidenceReference, metadata: { remedy: input.remedy, refundId, redeliveryRequestId, policyReference: input.policyReference ?? null } } });
    return remedy;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getClaimForActor(input: Readonly<{ publicReference: string; actorUserId: string; role: UserRole }>) {
  const claim = await prisma.claim.findUnique({ where: { publicReference: input.publicReference }, include: { evidence: { orderBy: { createdAt: "asc" } }, activities: { orderBy: { createdAt: "asc" } }, remedy: true } });
  if (!claim) throw new ClaimDomainError("CLAIM_NOT_FOUND", "Claim was not found.");
  await assertClaimParticipant({ claimId: claim.id, userId: input.actorUserId, role: input.role });
  return claim;
}
