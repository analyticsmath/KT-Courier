import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { CLEARANCE_POLICY_KEY, ClearancePolicyDraftSchema, ClearancePolicySchema } from "@/lib/earnings/clearance-policy";
import { withLedgerRetry } from "@/lib/ledger/retry";

const draftKey = `${CLEARANCE_POLICY_KEY}.pending`;

export async function getEarningClearancePolicy() {
  const row = await prisma.systemSetting.findUnique({ where: { key: CLEARANCE_POLICY_KEY } });
  return row?.value ?? null;
}

export async function submitEarningClearancePolicy(actorUserId: string, value: unknown) {
  const draft = ClearancePolicyDraftSchema.parse(value);
  const now = new Date();
  return withLedgerRetry(() => prisma.$transaction(async tx => {
    const current = await tx.systemSetting.findUnique({ where: { key: draftKey } });
    const reused = await tx.adminActivityLog.findFirst({ where: { entityType: "EarningClearancePolicy", entityId: draft.version } });
    if (reused) throw new Error("Policy versions are immutable and cannot be reused.");
    if (current) throw new Error("An approved or pending policy already exists; submit a new version through review history.");
    const policy = { ...draft, submittedByUserId: actorUserId, submittedAt: now.toISOString(), reviewedByUserId: null, reviewedAt: null };
    await tx.systemSetting.create({ data: { key: draftKey, label: "Earning clearance policy", type: "JSON", value: policy } });
    await tx.adminActivityLog.create({ data: { actorUserId, action: "CREATE", entityType: "EarningClearancePolicy", entityId: draft.version, message: "Submitted earning clearance policy for independent review.", metadata: policy } });
    return policy;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function reviewEarningClearancePolicy(actorUserId: string, version: string) {
  return withLedgerRetry(() => prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "SystemSetting" WHERE "key"=${draftKey} FOR UPDATE`);
    const row = await tx.systemSetting.findUnique({ where: { key: draftKey } });
    const policy = ClearancePolicySchema.parse(row?.value);
    if (policy.version !== version || policy.submittedByUserId === actorUserId || policy.reviewedAt) throw new Error("A different administrator must review the pending policy version.");
    const reviewed = { ...policy, reviewedByUserId: actorUserId, reviewedAt: new Date().toISOString() };
    await tx.systemSetting.upsert({ where: { key: CLEARANCE_POLICY_KEY }, create: { key: CLEARANCE_POLICY_KEY, label: "Earning clearance policy", type: "JSON", value: reviewed }, update: { value: reviewed } });
    await tx.systemSetting.delete({ where: { key: draftKey } });
    await tx.adminActivityLog.create({ data: { actorUserId, action: "STATUS_CHANGE", entityType: "EarningClearancePolicy", entityId: version, message: "Approved earning clearance policy after independent review.", metadata: reviewed } });
    return reviewed;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function getPendingEarningClearancePolicy() {
  const row = await prisma.systemSetting.findUnique({ where: { key: draftKey } });
  return row?.value ?? null;
}
