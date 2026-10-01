import { prisma } from "@/lib/db/prisma";
import { PlatformError } from "./contracts";
import { membershipAllows, type StoreModule } from "./store-permissions";
export async function storeAccess(userId: string, section?: StoreModule) {
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
    take: 2,
  });
  if (owned.length === 1)
    return { store: owned[0], owner: true, permissions: ["*"] };
  if (owned.length > 1)
    throw new PlatformError(
      "STORE_CONTEXT_AMBIGUOUS",
      "Select a business before continuing.",
      409,
    );
  const members = await prisma.storeEmployeeMembership.findMany({
    where: { userId, status: "ACTIVE", store: { status: "ACTIVE" } },
    include: { store: true },
    take: 2,
  });
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
