import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StoreOverviewPage } from "@/components/protected-v2/store/StoreOverviewPage";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreDashboardData } from "@/lib/services/stores.service";
import { getStorePickupAddress } from "@/lib/services/store-addresses.service";
import { listOrders } from "@/lib/services/orders.service";
import { listStoreOrderQueue } from "@/lib/store-orders/store-order.service";
import { getStoreEarningSummaryForOwner } from "@/lib/services/store-earning-summary.service";
import type { StoreFulfilmentQueue } from "@/lib/store-presentation/store-fulfilment-priority";

export const metadata: Metadata = { title: "Store operations" };

export default async function StoreDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const { store, user: storeUser } = await getStoreDashboardData(user.id);
  const [pickupState, courierRequests, marketplaceQueue, earnings] = await Promise.all([
    getStorePickupAddress(user.id),
    listOrders(user, { page: 1, pageSize: 5 }),
    store ? listStoreOrderQueue(store.id) : Promise.resolve({
      needsReview: [], customerActionRequired: [], accepted: [], preparing: [], readyForPickup: [], handoffInProgress: [], completedHandoff: [], rejectedOrCancelled: [], reconciliationRequired: [],
    }),
    store?.status === "ACTIVE" ? getStoreEarningSummaryForOwner(user.id).catch(() => null) : Promise.resolve(null),
  ]);

  const queue = marketplaceQueue as StoreFulfilmentQueue;
  return <StoreOverviewPage
    storeName={store?.name ?? storeUser?.name ?? user.name ?? "Store"}
    storeStatus={store?.status ?? null}
    queue={queue}
    recentCourierOrders={courierRequests.data.map((order) => ({ id: order.id, orderNumber: order.orderNumber, status: order.status, deliveryType: order.deliveryType, dropoffCity: order.dropoffCity, createdAt: order.createdAt }))}
    pickupConfigured={Boolean(pickupState?.pickupAddress ?? pickupState?.store?.addressLine1)}
    payableBalance={earnings?.payableBalance ?? null}
  />;
}
