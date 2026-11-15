import { prisma } from "@/lib/db/prisma";
import { PlatformError } from "./contracts";
import { membershipAllows, type StoreModule } from "./store-permissions";
export async function storeAccess(
  userId: string,
  section?: StoreModule,
  explicitStoreId?: string | null,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, role: true },
  });
  if (
    !user ||
    user.status !== "ACTIVE" ||
    !["CUSTOMER", "STORE"].includes(user.role)
  )
    throw new PlatformError(
      "STORE_ACCESS_DENIED",
      "An active customer or business account is required.",
      403,
    );
  const owned = await prisma.store.findMany({
    where: { ownerUserId: userId },
    take: 10,
  });

  if (explicitStoreId) {
    const ownedMatch = owned.find((s) => s.id === explicitStoreId);
    if (ownedMatch) {
      if (ownedMatch.status === "SUSPENDED" || ownedMatch.status === "DISABLED") {
        throw new PlatformError(
          "STORE_SUSPENDED",
          "This store is suspended or disabled. Contact KT Couriers support to request a review.",
          403,
        );
      }
      return { store: ownedMatch, owner: true, permissions: ["*"] };
    }
    const activeMembers =
      (await prisma.storeEmployeeMembership.findMany({
        where: { userId, status: "ACTIVE", store: { status: "ACTIVE" } },
        include: { store: true },
        take: 10,
      })) ?? [];
    const memberMatch = activeMembers.find(
      (m) => (m.storeId ?? m.store?.id) === explicitStoreId,
    );
    if (memberMatch && (!section || membershipAllows(memberMatch.permissions, section))) {
      return {
        store: memberMatch.store,
        owner: false,
        permissions: memberMatch.permissions as string[],
      };
    }
    throw new PlatformError(
      "STORE_ACCESS_DENIED",
      "You do not have permission to access this business section.",
      403,
    );
  }

  // Ownership never bypasses a suspension; pending stores retain onboarding access.
  if (owned.length === 1) {
    if (owned[0].status === "SUSPENDED" || owned[0].status === "DISABLED")
      throw new PlatformError("STORE_SUSPENDED", "This store is suspended or disabled. Contact KT Couriers support to request a review.", 403);
    const activeMembers =
      (await prisma.storeEmployeeMembership.findMany({
        where: { userId, status: "ACTIVE", store: { status: "ACTIVE" } },
        include: { store: true },
        take: 10,
      })) ?? [];
    const distinctMembers = activeMembers.filter(
      (m) => (m.storeId ?? m.store?.id) !== owned[0].id,
    );
    if (distinctMembers.length > 0) {
      throw new PlatformError(
        "STORE_CONTEXT_AMBIGUOUS",
        "Select a business before continuing.",
        409,
      );
    }
    return { store: owned[0], owner: true, permissions: ["*"] };
  }
  if (owned.length > 1)
    throw new PlatformError(
      "STORE_CONTEXT_AMBIGUOUS",
      "Select a business before continuing.",
      409,
    );
  const members =
    (await prisma.storeEmployeeMembership.findMany({
      where: { userId, status: "ACTIVE", store: { status: "ACTIVE" } },
      include: { store: true },
      take: 2,
    })) ?? [];
  if (
    members.length !== 1 ||
    (section && !membershipAllows(members[0].permissions, section))
  )
    throw new PlatformError(
      "STORE_ACCESS_DENIED",
      "You do not have permission to access this business section.",
      403,
    );
  return {
    store: members[0].store,
    owner: false,
    permissions: members[0].permissions as string[],
  };
}
export async function ownedBusiness(userId: string) {
  const a = await storeAccess(userId);
  if (!a.owner)
    throw new PlatformError(
      "STORE_OWNER_REQUIRED",
      "Only the business owner can manage employees.",
      403,
    );
  return a.store;
}
