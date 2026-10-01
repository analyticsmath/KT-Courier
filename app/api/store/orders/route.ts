import { storeAccess } from "@/lib/client-platform/store-access";
import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { getCurrentUser } from "@/lib/auth/current-user";

import { listStoreOrderQueue } from "@/lib/store-orders/store-order.service";
import { storeOrderError, storeOrderJson } from "@/lib/store-orders/api-policy";

export async function GET() {
  const workspaceDenied = await requireBusinessApi("/api/store/orders");
  if (workspaceDenied) return workspaceDenied;
  try {
    const user = await getCurrentUser();
    if (!user)
      return storeOrderJson({ error: "Authentication is required." }, 401);
    const store = (await storeAccess(user.id, "orders")).store;
    if (!store)
      return storeOrderJson(
        { error: "An active owned store is required." },
        403,
      );
    return storeOrderJson({ queue: await listStoreOrderQueue(store.id) });
  } catch (error) {
    return storeOrderError(error);
  }
}
