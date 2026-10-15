import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { CLEARANCE_POLICY_KEY, resolveEarningClearance } from "@/lib/earnings/clearance-policy";
import { assertAuthoritativeAssignment } from "@/lib/driver-earnings/driver-earning-assignment-policy";
import { assignmentPublicReference } from "@/lib/driver-earnings/driver-earning-subject";

/** Establishes clearance dates, never moves funds. Actual delivery proof is
 * required; marketplace warehouse-to-driver pickup is not customer fulfilment. */
export async function assignEarningClearance(kind: "STORE" | "DRIVER", earningId: string, now = new Date()) {
  return withLedgerRetry(() => prisma.$transaction(async tx => {
    const table = kind === "STORE" ? Prisma.sql`"StoreEarning"` : Prisma.sql`"DriverEarning"`;
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${table} WHERE "id"=${earningId} FOR UPDATE`);
    const earning = kind === "STORE" ? await tx.storeEarning.findUnique({ where: { id: earningId } }) : await tx.driverEarning.findUnique({ where: { id: earningId } });
    if (!earning || earning.status !== "ACCRUED" || earning.releaseEligibleAt) return false;
    const policy = await tx.systemSetting.findUnique({ where: { key: CLEARANCE_POLICY_KEY } });
    let orderId: string | null = null;
    if (kind === "DRIVER") orderId = (earning as { orderId: string }).orderId;
    else {
      const bridge = await tx.marketplaceStoreOrderDeliveryBridge.findUnique({ where: { marketplaceStoreOrderId: earning.subjectId } });
      orderId = bridge?.courierOrderId ?? null;
    }
    if (!orderId) return false;
    const assignments = await tx.orderAssignment.findMany({ where: { orderId, status: "COMPLETED" }, include: { proofOfDelivery: true, operationalEvents: true, events: true }, take: 2 });
    if (assignments.length !== 1 || !assignments[0].completedAt) return false;
    const a = assignments[0], ref = assignmentPublicReference(a.id), completed = a.completedAt!.toISOString();
    assertAuthoritativeAssignment({ id: a.id, publicReference: ref, version: String(a.version), driverId: a.driverProfileId, orderId, status: a.status, completedAt: completed, podAssignmentId: a.proofOfDelivery?.assignmentId ?? null, podDriverId: a.proofOfDelivery?.driverProfileId ?? null, podOrderId: a.proofOfDelivery?.orderId ?? null, podDeliveredAt: a.proofOfDelivery?.deliveredAt.toISOString() ?? null, hasDeliveryCompletedEvent: a.operationalEvents.some(e => e.eventType === "DELIVERY_COMPLETED"), hasAssignmentCompletedEvent: a.events.some(e => e.eventType === "ASSIGNMENT_COMPLETED") }, { assignmentId: a.id, assignmentPublicReference: ref, assignmentVersion: String(a.version), driverId: a.driverProfileId, orderId, serviceCompletedAt: completed });
    if (kind === "DRIVER" && ((earning as { assignmentId: string }).assignmentId !== a.id || (earning as { driverId: string }).driverId !== a.driverProfileId)) return false;
    const clearance = resolveEarningClearance({ policy: policy?.value, kind, completedAt: a.completedAt!, now });
    if (!clearance) return false;
    const metadata = { policyVersion: clearance.policyVersion, reviewedByUserId: clearance.reviewedByUserId, reviewedAt: clearance.reviewedAt, completedAt: clearance.completedAt, holdHours: clearance.holdHours, releaseEligibleAt: clearance.eligibleAt.toISOString() };
    if (kind === "STORE") {
      const changed = await tx.storeEarning.updateMany({ where: { id: earningId, status: "ACCRUED", releaseEligibleAt: null }, data: { releaseEligibleAt: clearance.eligibleAt } });
      if (!changed.count) return false;
      await tx.storeEarningStatusHistory.create({ data: { storeEarningId: earningId, fromStatus: "ACCRUED", toStatus: "ACCRUED", actorType: "SYSTEM", reasonCode: "CLEARANCE_POLICY_ASSIGNED", safeMetadata: metadata } });
    } else {
      const changed = await tx.driverEarning.updateMany({ where: { id: earningId, status: "ACCRUED", releaseEligibleAt: null }, data: { releaseEligibleAt: clearance.eligibleAt } });
      if (!changed.count) return false;
      await tx.driverEarningStatusHistory.create({ data: { driverEarningId: earningId, fromStatus: "ACCRUED", toStatus: "ACCRUED", actorType: "SYSTEM", reasonCode: "CLEARANCE_POLICY_ASSIGNED", safeMetadata: metadata } });
    }
    return true;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function assignEarningClearancesBatch(input: { kind: "STORE" | "DRIVER"; limit?: number; afterId?: string; now?: Date }) {
  const limit = Math.min(100, Math.max(1, Math.floor(input.limit ?? 25)));
  const args = { where: { status: "ACCRUED" as const, releaseEligibleAt: null, id: input.afterId ? { gt: input.afterId } : undefined }, orderBy: { id: "asc" as const }, select: { id: true }, take: limit };
  const rows = input.kind === "STORE" ? await prisma.storeEarning.findMany(args) : await prisma.driverEarning.findMany(args);
  const results: { id: string; assigned: boolean; reviewRequired?: boolean }[] = [];
  for (const row of rows) {
    try { results.push({ id: row.id, assigned: await assignEarningClearance(input.kind, row.id, input.now) }); }
    catch { results.push({ id: row.id, assigned: false, reviewRequired: true }); }
  }
  return { results, nextCursor: rows.length === limit ? rows.at(-1)!.id : null };
}
