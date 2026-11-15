import { createHash, randomUUID } from "node:crypto";
import {
  OrderAssignmentEventType,
  OrderAssignmentStatus,
  OrderOperationalEventType,
  Prisma,
} from "@prisma/client";
import type { WalletOwner } from "@/lib/services/wallet-spending.service";
import { createRefundRequestInTransaction } from "@/lib/services/refund-request.service";
import { restoreConsumedParcelWalletWithinTransaction } from "@/lib/services/wallet-spending.service";

export const UNRESOLVED_PAYMENT_STATUSES = [
  "PROVIDER_PENDING",
  "REQUIRES_ACTION",
  "PROCESSING",
] as const;

export const UNRESOLVED_ATTEMPT_STATUSES = [
  "RESERVED",
  "REQUESTING",
  "REQUIRES_ACTION",
  "PROCESSING",
  "UNKNOWN",
] as const;

export interface CancellationResolutionSummaryDto {
  id: string;
  publicReference: string;
  status: string;
  paymentId: string | null;
  paymentRefundId: string | null;
  walletRefundJournalId: string | null;
  reconciliationCaseId: string | null;
  reason: string;
}

export interface PaymentCancellationInspection {
  id: string;
  publicReference: string;
  userId: string | null;
  provider: string | null;
  status: string;
  amount: Prisma.Decimal;
  totalRefundedAmount: Prisma.Decimal;
  totalRefundReservedAmount: Prisma.Decimal;
  version: number;
  metadata: unknown;
  attempts: Array<{ id: string; status: string }>;
}

export function cancellationRequestHash(input: {
  orderId: string;
  requestedByUserId: string;
  actorRole: string;
  reason: string;
}): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function toCancellationResolutionSummary(
  row: {
    id: string;
    publicReference: string;
    status: string;
    paymentId: string | null;
    paymentRefundId: string | null;
    walletRefundJournalId: string | null;
    reconciliationCaseId: string | null;
    reason: string;
  },
): CancellationResolutionSummaryDto {
  return {
    id: row.id,
    publicReference: row.publicReference,
    status: row.status,
    paymentId: row.paymentId,
    paymentRefundId: row.paymentRefundId,
    walletRefundJournalId: row.walletRefundJournalId,
    reconciliationCaseId: row.reconciliationCaseId,
    reason: row.reason,
  };
}

export function hasUnresolvedProviderActivity(
  payment: Pick<PaymentCancellationInspection, "status" | "attempts"> | null,
): boolean {
  if (!payment) return false;
  if ((UNRESOLVED_PAYMENT_STATUSES as readonly string[]).includes(payment.status)) {
    return true;
  }
  return payment.attempts.some((a) =>
    (UNRESOLVED_ATTEMPT_STATUSES as readonly string[]).includes(a.status),
  );
}

export function extractParcelWalletSplit(
  payment: Pick<PaymentCancellationInspection, "userId" | "metadata">,
  order: { storeId: string | null; customerId: string | null },
): { walletSplit: boolean; walletAmount: string | null; owner: WalletOwner | null } {
  const meta =
    payment.metadata &&
    typeof payment.metadata === "object" &&
    !Array.isArray(payment.metadata)
      ? (payment.metadata as Record<string, unknown>)
      : null;
  if (!meta || meta.walletSplit !== true || typeof meta.walletAmount !== "string") {
    return { walletSplit: false, walletAmount: null, owner: null };
  }
  const amountDec = new Prisma.Decimal(meta.walletAmount);
  if (amountDec.lessThanOrEqualTo(0)) {
    return { walletSplit: false, walletAmount: null, owner: null };
  }

  const ownerType: "STORE" | "CUSTOMER" =
    order.storeId || meta.walletOwnerType === "STORE" ? "STORE" : "CUSTOMER";
  const ownerId =
    ownerType === "STORE"
      ? String(order.storeId || meta.walletOwnerId || "")
      : String(meta.walletOwnerId || payment.userId || order.customerId || "");
  if (!ownerId) {
    return { walletSplit: false, walletAmount: null, owner: null };
  }

  return {
    walletSplit: true,
    walletAmount: amountDec.toFixed(2),
    owner: { ownerType, ownerId },
  };
}

export async function revokePendingDispatchOffersInTx(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    actorUserId?: string | null;
    actorSystemIdentity?: string;
    actorRole: string;
    note: string;
  },
): Promise<string[]> {
  if (typeof tx.orderAssignment?.findMany !== "function") return [];

  if (typeof tx.$queryRaw === "function") {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "OrderAssignment" WHERE "orderId" = ${input.orderId} AND "status" = 'ASSIGNED' ORDER BY "id" ASC FOR UPDATE`,
    );
  }

  const pendingOffers = await tx.orderAssignment.findMany({
    where: { orderId: input.orderId, status: OrderAssignmentStatus.ASSIGNED },
    select: {
      id: true,
      driverProfileId: true,
      status: true,
      version: true,
    },
    orderBy: { id: "asc" },
  });

  const revokedIds: string[] = [];
  const now = new Date();
  const hasHumanActor =
    typeof input.actorUserId === "string" && input.actorUserId.length > 0;
  const systemIdentity = input.actorSystemIdentity ?? "SYSTEM:PARCEL_CANCELLATION";

  for (const offer of pendingOffers) {
    const changed = await tx.orderAssignment.updateMany({
      where: {
        id: offer.id,
        status: OrderAssignmentStatus.ASSIGNED,
        version: offer.version,
      },
      data: {
        status: OrderAssignmentStatus.REVOKED,
        activeOrderGuard: null,
        revokedAt: now,
        reasonCode: "ORDER_CANCELLED",
        reasonNote: input.note,
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) continue;
    revokedIds.push(offer.id);

    if (typeof tx.orderAssignmentEvent?.create === "function") {
      await tx.orderAssignmentEvent.create({
        data: {
          assignmentId: offer.id,
          orderId: input.orderId,
          driverProfileId: offer.driverProfileId,
          actorUserId: hasHumanActor ? input.actorUserId! : null,
          actorSystemIdentity: hasHumanActor ? null : systemIdentity,
          actorRole: input.actorRole,
          eventType: OrderAssignmentEventType.ASSIGNMENT_REVOKED,
          previousStatus: offer.status,
          newStatus: OrderAssignmentStatus.REVOKED,
          reasonCode: "ORDER_CANCELLED",
          note: input.note,
          metadata: { policy: "parcel-cancellation-coordinator-v1" },
        },
      });
    }

    if (hasHumanActor && typeof tx.orderOperationalEvent?.create === "function") {
      await tx.orderOperationalEvent.create({
        data: {
          orderId: input.orderId,
          assignmentId: offer.id,
          driverProfileId: offer.driverProfileId,
          actorUserId: input.actorUserId!,
          actorRole: input.actorRole,
          eventType: OrderOperationalEventType.ASSIGNMENT_REVOKED,
          publicNote: null,
          internalNote: input.note,
          metadata: { reasonCode: "ORDER_CANCELLED" },
        },
      });
    }
  }

  return revokedIds;
}

export async function cancelUncollectedCodObligationInTx(
  tx: Prisma.TransactionClient,
  input: { orderId: string; actorUserId?: string | null; reason: string },
): Promise<boolean> {
  if (typeof tx.cashOnDelivery?.findUnique !== "function") return false;

  if (typeof tx.$queryRaw === "function") {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "CashOnDelivery" WHERE "orderId" = ${input.orderId} FOR UPDATE`,
    );
  }

  const cod = await tx.cashOnDelivery.findUnique({
    where: { orderId: input.orderId },
    select: { id: true, status: true },
  });
  if (!cod) return false;
  if (!["PENDING", "READY_FOR_COLLECTION", "COLLECTION_FAILED"].includes(cod.status)) {
    return false;
  }

  const operationId = `cancel:${cod.id}`;
  const requestHash = createHash("sha256")
    .update(JSON.stringify({ cashOnDeliveryId: cod.id, orderId: input.orderId, status: "CANCELLED" }))
    .digest("hex");

  await tx.cashOnDelivery.update({
    where: { id: cod.id },
    data: {
      status: "CANCELLED",
      version: { increment: 1 },
      events: {
        create: {
          operationId,
          requestHash,
          eventType: "CANCELLED",
          actorUserId: input.actorUserId ?? null,
          safeReasonCode: "ORDER_CANCELLED",
          safeEvidence: { reason: input.reason.slice(0, 200) },
        },
      },
    },
  });

  return true;
}

async function resolveCancelActorUserIdInTx(
  tx: Prisma.TransactionClient,
  input: {
    preferredUserId?: string | null;
    paymentUserId?: string | null;
    orderCustomerId?: string | null;
    storeId?: string | null;
  },
): Promise<string> {
  const candidate =
    input.preferredUserId || input.paymentUserId || input.orderCustomerId;
  if (candidate) return candidate;

  if (input.storeId && typeof tx.store?.findUnique === "function") {
    const store = await tx.store.findUnique({
      where: { id: input.storeId },
      select: { ownerUserId: true },
    });
    if (store?.ownerUserId) return store.ownerUserId;
  }

  throw new Error(
    "Unable to resolve human requester user for cancellation refund reservation.",
  );
}

export async function settlePaidOrderCancellationInTx(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    orderNumber: string;
    storeId: string | null;
    customerId: string | null;
    payment: PaymentCancellationInspection;
    reason: string;
    preferredActorUserId?: string | null;
    cancellationActorType: "CUSTOMER" | "STORE" | "SYSTEM";
    operationKeyPrefix: string;
  },
): Promise<{
  paymentRefundId: string | null;
  walletRefundJournalId: string | null;
  walletOwnerType: string | null;
  walletOwnerId: string | null;
}> {
  const actorUserId = await resolveCancelActorUserIdInTx(tx, {
    preferredUserId: input.preferredActorUserId,
    paymentUserId: input.payment.userId,
    orderCustomerId: input.customerId,
    storeId: input.storeId,
  });

  let paymentRefundId: string | null = null;
  const remainingRefundable = new Prisma.Decimal(input.payment.amount.toString())
    .sub(input.payment.totalRefundedAmount)
    .sub(input.payment.totalRefundReservedAmount);

  if (remainingRefundable.greaterThan(0)) {
    const refund = await createRefundRequestInTransaction(tx, {
      actorUserId,
      paymentPublicReference: input.payment.publicReference,
      amount: remainingRefundable.toFixed(2),
      method: "CUSTOMER_WALLET",
      reasonCode: "ORDER_CANCELLED",
      customerNote: input.reason.slice(0, 500),
      operationId: `${input.operationKeyPrefix}:refund:${input.payment.id}`,
      explicitStoreId: input.storeId ?? null,
      allowCancellationAuthority: true,
      cancellationActorType:
        input.cancellationActorType === "STORE"
          ? "CUSTOMER"
          : input.cancellationActorType,
    });
    paymentRefundId = refund.id;
  } else if (typeof tx.paymentRefund?.findFirst === "function") {
    const existingRefund = await tx.paymentRefund.findFirst({
      where: { paymentId: input.payment.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    paymentRefundId = existingRefund?.id ?? null;
  }

  let walletRefundJournalId: string | null = null;
  let walletOwnerType: string | null = null;
  let walletOwnerId: string | null = null;

  const split = extractParcelWalletSplit(input.payment, {
    storeId: input.storeId,
    customerId: input.customerId,
  });
  if (split.walletSplit && split.walletAmount && split.owner) {
    const restore = await restoreConsumedParcelWalletWithinTransaction(tx, {
      paymentId: input.payment.id,
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      owner: split.owner,
      amount: split.walletAmount,
      reason: input.reason,
      actorUserId,
    });
    walletRefundJournalId = restore.journalId;
    walletOwnerType = split.owner.ownerType;
    walletOwnerId = split.owner.ownerId;
  } else if (input.payment.provider === "MANUAL") {
    walletOwnerType = input.storeId ? "STORE" : "CUSTOMER";
    walletOwnerId = input.storeId ?? input.customerId ?? input.payment.userId ?? null;
  }

  return {
    paymentRefundId,
    walletRefundJournalId,
    walletOwnerType,
    walletOwnerId,
  };
}

export async function upsertParcelCancellationResolutionInTx(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    paymentId?: string | null;
    status: string;
    operationId: string;
    requestHash: string;
    requestedByUserId: string;
    actorRole: string;
    reason: string;
    walletOwnerType?: string | null;
    walletOwnerId?: string | null;
    walletRefundJournalId?: string | null;
    paymentRefundId?: string | null;
    reconciliationCaseId?: string | null;
    decisionEvidence?: Record<string, unknown>;
    resolved?: boolean;
  },
) {
  if (typeof tx.parcelCancellationResolution?.findUnique !== "function") {
    return null;
  }

  const now = new Date();
  const existing = await tx.parcelCancellationResolution.findUnique({
    where: { orderId: input.orderId },
  });

  if (existing) {
    return tx.parcelCancellationResolution.update({
      where: { id: existing.id },
      data: {
        paymentId: input.paymentId ?? existing.paymentId,
        status: input.status,
        walletOwnerType: input.walletOwnerType ?? existing.walletOwnerType,
        walletOwnerId: input.walletOwnerId ?? existing.walletOwnerId,
        walletRefundJournalId:
          input.walletRefundJournalId ?? existing.walletRefundJournalId,
        paymentRefundId: input.paymentRefundId ?? existing.paymentRefundId,
        reconciliationCaseId:
          input.reconciliationCaseId ?? existing.reconciliationCaseId,
        decisionEvidence: (input.decisionEvidence ??
          existing.decisionEvidence ??
          undefined) as Prisma.InputJsonValue | undefined,
        resolvedAt: input.resolved ? (existing.resolvedAt ?? now) : null,
        version: { increment: 1 },
      },
    });
  }

  return tx.parcelCancellationResolution.create({
    data: {
      publicReference: `CAN-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      orderId: input.orderId,
      paymentId: input.paymentId ?? null,
      status: input.status,
      operationId: input.operationId,
      requestHash: input.requestHash,
      requestedByUserId: input.requestedByUserId,
      actorRole: input.actorRole,
      reason: input.reason,
      walletOwnerType: input.walletOwnerType ?? null,
      walletOwnerId: input.walletOwnerId ?? null,
      walletRefundJournalId: input.walletRefundJournalId ?? null,
      paymentRefundId: input.paymentRefundId ?? null,
      reconciliationCaseId: input.reconciliationCaseId ?? null,
      decisionEvidence: input.decisionEvidence as Prisma.InputJsonValue | undefined,
      resolvedAt: input.resolved ? now : null,
    },
  });
}
