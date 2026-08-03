import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { listStoreOrderQueue } from "@/lib/store-orders/store-order.service";
import { storeOrderError, storeOrderJson } from "@/lib/store-orders/api-policy";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "STORE") return storeOrderJson({ error: "Authentication is required." }, 401);
    const store = await prisma.store.findFirst({ where: { ownerUserId: user.id, status: "ACTIVE" }, select: { id: true } });
    if (!store) return storeOrderJson({ error: "An active owned store is required." }, 403);
    return storeOrderJson({ queue: await listStoreOrderQueue(store.id) });
  } catch (error) { return storeOrderError(error); }
}
