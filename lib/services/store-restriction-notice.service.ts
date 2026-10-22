import { prisma } from "@/lib/db/prisma";

export function vendorVisibleStatusReason(
  status: string,
  metadata: unknown,
): string | null {
  if (!["SUSPENDED", "DISABLED"].includes(status)) return null;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata as Record<string, unknown>;
  if (value.to !== status || typeof value.reason !== "string") return null;
  const reason = value.reason.trim();
  return reason.length >= 12 && reason.length <= 500 ? reason : null;
}

/** Only the authenticated owning user can resolve this message. No private
 * seller evidence, staff notes or unrelated business activity is exposed. */
export async function getOwnedStoreRestriction(userId: string) {
  const store = await prisma.store.findFirst({
    where: { ownerUserId: userId, status: { in: ["SUSPENDED", "DISABLED"] } },
    select: { id: true, name: true, status: true, updatedAt: true },
  });
  if (!store) return null;

  const change = await prisma.adminActivityLog.findFirst({
    where: { entityType: "Store", entityId: store.id, action: "STATUS_CHANGE" },
    select: { metadata: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  // Never show a historical reason from a different state transition.
  const reason = vendorVisibleStatusReason(store.status, change?.metadata);
  return {
    name: store.name,
    status: store.status,
    reason,
    recordedAt: reason ? change?.createdAt.toISOString() ?? null : null,
  };
}
