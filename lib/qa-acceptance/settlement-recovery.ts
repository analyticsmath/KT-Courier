import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resolveQaAcceptanceLaneConfig } from "./config";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";

export const QA_SETTLEMENT_RECOVERY_PREFIX = "qa_settlement_recovery:" as const;

export const QaSettlementRecoveryRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    orderId: z.string().min(1).max(100),
    orderNumber: z.string().min(1).max(100),
    qaAcceptanceRunId: z.string().min(1).max(100).nullable(),
    planPublicReference: z.string().min(4).max(100),
    planScopeKey: z.enum(["GLOBAL:COURIER_ORDER", "QA:COURIER_ORDER"]),
    planVersionNumber: z.number().int().positive(),
    status: z.enum(["PENDING_REVIEW", "APPROVED", "REVOKED", "CONSUMED"]),
    version: z.number().int().positive(),
    preparedByUserId: z.string().min(1).max(100),
    preparedAt: z.iso.datetime(),
    approvedByUserId: z.string().min(1).max(100).nullable(),
    approvedAt: z.iso.datetime().nullable(),
    consumedAt: z.iso.datetime().nullable(),
    driverEarningPublicReference: z.string().min(1).max(100).nullable(),
    commissionAccrualPublicReference: z.string().min(1).max(100).nullable(),
    reason: z.string().trim().min(10).max(500),
  })
  .strict();

export type QaSettlementRecoveryRecord = z.infer<typeof QaSettlementRecoveryRecordSchema>;

export class QaSettlementRecoveryError extends Error {
  constructor(
    readonly code:
      | "QA_RECOVERY_INVALID_INPUT"
      | "QA_RECOVERY_NOT_FOUND"
      | "QA_RECOVERY_CONFLICT"
      | "QA_RECOVERY_CONFIG_UNAVAILABLE"
      | "QA_RECOVERY_ISOLATION_VIOLATION"
      | "QA_RECOVERY_INDEPENDENT_REVIEW_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "QaSettlementRecoveryError";
  }
}

export function qaSettlementRecoveryKey(orderId: string): string {
  return `${QA_SETTLEMENT_RECOVERY_PREFIX}${orderId}`;
}

export async function readQaSettlementRecoveryInTx(
  tx: Pick<Prisma.TransactionClient, "systemSetting">,
  orderId: string,
): Promise<{ rowId: string; updatedAt: Date; record: QaSettlementRecoveryRecord } | null> {
  const row = await tx.systemSetting.findUnique({
    where: { key: qaSettlementRecoveryKey(orderId) },
    select: { id: true, updatedAt: true, value: true },
  });
  if (!row) return null;
  const parsed = QaSettlementRecoveryRecordSchema.safeParse(row.value);
  if (!parsed.success) return null;
  return { rowId: row.id, updatedAt: row.updatedAt, record: parsed.data };
}

export async function listAllQaSettlementRecoveries(): Promise<QaSettlementRecoveryRecord[]> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { startsWith: QA_SETTLEMENT_RECOVERY_PREFIX } },
    orderBy: { updatedAt: "desc" },
  });
  const records: QaSettlementRecoveryRecord[] = [];
  for (const row of rows) {
    const parsed = QaSettlementRecoveryRecordSchema.safeParse(row.value);
    if (parsed.success) records.push(parsed.data);
  }
  return records;
}

export async function prepareQaSettlementRecovery(input: Readonly<{
  actorUserId: string;
  orderId: string;
  planPublicReference: string;
  reason: string;
}>): Promise<QaSettlementRecoveryRecord> {
  const config = resolveQaAcceptanceLaneConfig();
  if (!config.eligible) {
    throw new QaSettlementRecoveryError("QA_RECOVERY_CONFIG_UNAVAILABLE", config.reason);
  }
  const reason = input.reason.trim();
  if (reason.length < 10 || reason.length > 500) {
    throw new QaSettlementRecoveryError(
      "QA_RECOVERY_INVALID_INPUT",
      "Provide a descriptive reason (10-500 chars) explaining why historical QA recovery applies.",
    );
  }

  const saved = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id"=${input.orderId} FOR UPDATE`);
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: {
          assignments: { where: { status: "COMPLETED" }, include: { proofOfDelivery: true } },
          driverEarnings: { select: { id: true }, take: 1 },
        },
      });
      if (!order) {
        throw new QaSettlementRecoveryError("QA_RECOVERY_NOT_FOUND", "Target order not found.");
      }
      if (!order.isQaAcceptance) {
        throw new QaSettlementRecoveryError(
          "QA_RECOVERY_ISOLATION_VIOLATION",
          "Commercial orders may NEVER use the QA historical settlement recovery path.",
        );
      }
      if (order.driverEarnings.length > 0) {
        throw new QaSettlementRecoveryError(
          "QA_RECOVERY_CONFLICT",
          "Order already has a canonical driver earning accrued.",
        );
      }
      if (order.assignments.length !== 1 || !order.assignments[0].completedAt || !order.assignments[0].proofOfDelivery) {
        throw new QaSettlementRecoveryError(
          "QA_RECOVERY_CONFLICT",
          "Order must have a single COMPLETED delivery assignment and ProofOfDelivery before settlement recovery.",
        );
      }
      if (order.qaAcceptanceRunId) {
        const run = await tx.qaAcceptanceRun.findUnique({
          where: { id: order.qaAcceptanceRunId },
          select: { status: true },
        });
        if (!run || run.status === "ARCHIVED") {
          throw new QaSettlementRecoveryError(
            "QA_RECOVERY_ISOLATION_VIOLATION",
            "Cannot prepare QA recovery for an archived QA run.",
          );
        }
      }

      const plan = await tx.commissionPlan.findUnique({
        where: { publicReference: input.planPublicReference },
      });
      if (
        !plan ||
        plan.status !== "ACTIVE" ||
        plan.subjectType !== "COURIER_ORDER" ||
        (plan.scopeKey !== "GLOBAL:COURIER_ORDER" && plan.scopeKey !== "QA:COURIER_ORDER") ||
        plan.currency !== "ZAR" ||
        !plan.approvedAt ||
        !plan.approvedByUserId ||
        plan.approvedByUserId === plan.createdByUserId ||
        (plan.effectiveUntil && plan.effectiveUntil <= new Date())
      ) {
        throw new QaSettlementRecoveryError(
          "QA_RECOVERY_INVALID_INPUT",
          "Select a currently active, independently approved GLOBAL:COURIER_ORDER or QA:COURIER_ORDER commission plan.",
        );
      }

      const key = qaSettlementRecoveryKey(order.id);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      const prior = await readQaSettlementRecoveryInTx(tx, order.id);
      if (prior && prior.record.status === "CONSUMED") {
        throw new QaSettlementRecoveryError("QA_RECOVERY_CONFLICT", "QA settlement recovery was already consumed.");
      }

      const nextRecord: QaSettlementRecoveryRecord = {
        schemaVersion: 1,
        orderId: order.id,
        orderNumber: order.orderNumber,
        qaAcceptanceRunId: order.qaAcceptanceRunId ?? null,
        planPublicReference: plan.publicReference,
        planScopeKey: plan.scopeKey as "GLOBAL:COURIER_ORDER" | "QA:COURIER_ORDER",
        planVersionNumber: plan.versionNumber,
        status: "PENDING_REVIEW",
        version: (prior?.record.version ?? 0) + 1,
        preparedByUserId: input.actorUserId,
        preparedAt: new Date().toISOString(),
        approvedByUserId: null,
        approvedAt: null,
        consumedAt: null,
        driverEarningPublicReference: null,
        commissionAccrualPublicReference: null,
        reason,
      };

      await tx.systemSetting.upsert({
        where: { key },
        create: {
          key,
          type: "JSON",
          label: "QA historical courier settlement recovery authorization",
          value: nextRecord as unknown as Prisma.InputJsonValue,
        },
        update: {
          value: nextRecord as unknown as Prisma.InputJsonValue,
        },
      });
      return nextRecord;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await recordAdminActivity({
    actorUserId: input.actorUserId,
    action: "CREATE",
    entityType: "QaSettlementRecovery",
    entityId: saved.orderId,
    message: `Prepared QA settlement recovery v${saved.version} for ${saved.orderNumber} using ${saved.planPublicReference}`,
    metadata: saved as unknown as Record<string, unknown>,
  });

  return saved;
}

export async function reviewQaSettlementRecovery(input: Readonly<{
  actorUserId: string;
  orderId: string;
  expectedVersion: number;
  action: "APPROVE" | "REVOKE";
  reason: string;
  settleImmediately?: boolean;
}>): Promise<{
  recovery: QaSettlementRecoveryRecord;
  settlement?: { publicReference: string; commissionReference?: string; settlementVersion?: string; replayed: boolean } | null;
}> {
  const config = resolveQaAcceptanceLaneConfig();
  if (!config.eligible) {
    throw new QaSettlementRecoveryError("QA_RECOVERY_CONFIG_UNAVAILABLE", config.reason);
  }
  const reason = input.reason.trim();
  if (reason.length < 10 || reason.length > 500) {
    throw new QaSettlementRecoveryError("QA_RECOVERY_INVALID_INPUT", "Review reason must be 10-500 characters.");
  }

  const reviewed = await prisma.$transaction(
    async (tx) => {
      const key = qaSettlementRecoveryKey(input.orderId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      const existing = await readQaSettlementRecoveryInTx(tx, input.orderId);
      if (!existing || existing.record.version !== input.expectedVersion) {
        throw new QaSettlementRecoveryError("QA_RECOVERY_CONFLICT", "Refresh QA settlement recovery state before reviewing.");
      }
      if (existing.record.status === "CONSUMED") {
        throw new QaSettlementRecoveryError("QA_RECOVERY_CONFLICT", "QA settlement recovery was already consumed.");
      }
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        select: { id: true, isQaAcceptance: true, qaAcceptanceRunId: true },
      });
      if (!order?.isQaAcceptance) {
        throw new QaSettlementRecoveryError(
          "QA_RECOVERY_ISOLATION_VIOLATION",
          "Commercial orders cannot use QA settlement recovery.",
        );
      }

      if (input.action === "APPROVE") {
        if (existing.record.status !== "PENDING_REVIEW") {
          throw new QaSettlementRecoveryError("QA_RECOVERY_CONFLICT", "Only PENDING_REVIEW recovery drafts can be approved.");
        }
        if (existing.record.preparedByUserId === input.actorUserId) {
          throw new QaSettlementRecoveryError(
            "QA_RECOVERY_INDEPENDENT_REVIEW_REQUIRED",
            "Dual control requires a different authorized administrator to approve this QA settlement recovery.",
          );
        }
        const plan = await tx.commissionPlan.findUnique({
          where: { publicReference: existing.record.planPublicReference },
        });
        if (
          !plan ||
          plan.status !== "ACTIVE" ||
          !plan.approvedAt ||
          !plan.approvedByUserId ||
          plan.approvedByUserId === plan.createdByUserId
        ) {
          throw new QaSettlementRecoveryError("QA_RECOVERY_CONFLICT", "Referenced commission plan is no longer active and independently approved.");
        }
      }

      const nextRecord: QaSettlementRecoveryRecord = {
        ...existing.record,
        status: input.action === "APPROVE" ? "APPROVED" : "REVOKED",
        version: existing.record.version + 1,
        approvedByUserId: input.action === "APPROVE" ? input.actorUserId : existing.record.approvedByUserId,
        approvedAt: input.action === "APPROVE" ? new Date().toISOString() : existing.record.approvedAt,
        reason,
      };

      await tx.systemSetting.update({
        where: { id: existing.rowId, updatedAt: existing.updatedAt },
        data: { value: nextRecord as unknown as Prisma.InputJsonValue },
      });
      return nextRecord;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await recordAdminActivity({
    actorUserId: input.actorUserId,
    action: "STATUS_CHANGE",
    entityType: "QaSettlementRecovery",
    entityId: reviewed.orderId,
    message: `${input.action === "APPROVE" ? "Approved" : "Revoked"} QA settlement recovery v${reviewed.version} for ${reviewed.orderNumber}`,
    metadata: reviewed as unknown as Record<string, unknown>,
  });

  if (input.action === "APPROVE" && input.settleImmediately !== false) {
    const { produceDriverSettlement } = await import("@/lib/services/driver-settlement-producer.service");
    const settlement = await produceDriverSettlement(reviewed.orderId);
    const refreshed = await readQaSettlementRecoveryInTx(prisma, reviewed.orderId);
    return {
      recovery: refreshed?.record ?? reviewed,
      settlement,
    };
  }

  return { recovery: reviewed, settlement: null };
}
