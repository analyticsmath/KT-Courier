import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { PlatformError } from "@/lib/client-platform/contracts";
import { MarketplaceDeliveryMatrixSchema, DeliveryPolicyVersionSchema, type DeliveryPolicyVersion } from "./delivery-policy";

const prefix = "production_marketplace_delivery_matrix_v";
export const DeliveryMatrixDraftSchema = MarketplaceDeliveryMatrixSchema.safeExtend({ expectedVersion: z.number().int().nonnegative(), reason: z.string().trim().min(10).max(500) });
export const DeliveryMatrixActionSchema = z.object({ version: z.number().int().positive(), expectedUpdatedAt: z.iso.datetime(), action: z.enum(["APPROVE", "ACTIVATE", "RETIRE"]), reason: z.string().trim().min(10).max(500) }).strict();

export async function listDeliveryMatrices(db = prisma) {
  const rows = await db.systemSetting.findMany({ where: { key: { startsWith: prefix } }, orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({ ...DeliveryPolicyVersionSchema.parse(r.value), updatedAt: r.updatedAt.toISOString() }));
}
export async function saveDeliveryMatrix(actorId: string, input: z.infer<typeof DeliveryMatrixDraftSchema>) {
  const data = DeliveryMatrixDraftSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;
    const rows = await tx.systemSetting.findMany({ where: { key: { startsWith: prefix } } });
    const latest = Math.max(0, ...rows.map((r) => Number((r.value as { version?: number }).version ?? 0)));
    if (latest !== data.expectedVersion) throw new PlatformError("VERSION_CONFLICT", "Marketplace matrix changed. Refresh before saving.", 409);
    const { expectedVersion, reason, ...matrix } = data;
    const value: DeliveryPolicyVersion = { ...matrix, version: expectedVersion + 1, status: "DRAFT", createdByUserId: actorId, approvedByUserId: null, approvedAt: null };
    const row = await tx.systemSetting.create({ data: { key: prefix + value.version, label: "Marketplace delivery matrix", type: "JSON", value: value as unknown as Prisma.InputJsonValue } });
    await tx.adminActivityLog.create({ data: { actorUserId: actorId, action: "CREATE", entityType: "MarketplaceDeliveryMatrix", entityId: row.id, message: reason, metadata: { version: value.version, status: "DRAFT" } } });
    return value;
  });
}
export async function actOnDeliveryMatrix(actorId: string, input: z.infer<typeof DeliveryMatrixActionSchema>) {
  const data = DeliveryMatrixActionSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;
    const row = await tx.systemSetting.findUnique({ where: { key: prefix + data.version } });
    if (!row || row.updatedAt.toISOString() !== data.expectedUpdatedAt) throw new PlatformError("VERSION_CONFLICT", "Matrix changed. Refresh before reviewing.", 409);
    const prior = DeliveryPolicyVersionSchema.parse(row.value);
    const next = { ...prior };
    if (data.action === "APPROVE") {
      if (prior.status !== "DRAFT" || prior.createdByUserId === actorId) throw new PlatformError("INDEPENDENT_REVIEW_REQUIRED", "A different authorized administrator must review this draft.", 403);
      next.status = "APPROVED"; next.approvedByUserId = actorId; next.approvedAt = new Date().toISOString();
    } else if (data.action === "ACTIVATE") {
      if (prior.status !== "APPROVED" || !prior.approvedByUserId || !prior.approvedAt) throw new PlatformError("APPROVAL_REQUIRED", "Approve this version before activation.", 409);
      next.status = "ACTIVE";
    } else { next.status = "RETIRED"; }
    await tx.systemSetting.update({ where: { id: row.id, updatedAt: row.updatedAt }, data: { value: next as unknown as Prisma.InputJsonValue } });
    await tx.adminActivityLog.create({ data: { actorUserId: actorId, action: "UPDATE", entityType: "MarketplaceDeliveryMatrix", entityId: row.id, message: data.reason, metadata: { version: prior.version, beforeStatus: prior.status, afterStatus: next.status } } });
    return next;
  });
}
