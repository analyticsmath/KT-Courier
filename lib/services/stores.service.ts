import { prisma } from "@/lib/db/prisma";

export async function getStoreByOwner(userId: string) {
  return prisma.store.findFirst({
    where: { ownerUserId: userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getStoreDashboardData(userId: string) {
  const [user, store, orderCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { storeProfile: true },
    }),
    prisma.store.findFirst({
      where: { ownerUserId: userId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.count({
      where: { store: { ownerUserId: userId } },
    }),
  ]);

  return { user, store, orderCount };
}
