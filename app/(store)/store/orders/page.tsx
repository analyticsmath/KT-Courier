import s from "@/components/protected-v2/studio/workspaceStudio.module.css";
import { getStoreFulfilmentSummary } from "@/lib/store-presentation/store-fulfilment-priority";
import { storeAccess } from "@/lib/client-platform/store-access";
import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { StoreCourierOrderList } from "@/components/protected-v2/store/StoreCourierOrderList";
import { StoreFulfilmentQueue } from "@/components/protected-v2/store/StoreFulfilmentQueue";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listOrders } from "@/lib/services/orders.service";

import { listStoreOrderQueue } from "@/lib/store-orders/store-order.service";
import type { StoreFulfilmentQueue as StoreFulfilmentQueueModel } from "@/lib/store-presentation/store-fulfilment-priority";

export const metadata: Metadata = { title: "Store orders" };

export default async function StoreOrdersPage() {
  await requireBusinessPage("/store/orders");
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const [courierRequests, ownedStore] = await Promise.all([
    listOrders(user, { page: 1, pageSize: 50 }, true),
    storeAccess(user.id, "orders").then((a) => a.store),
  ]);
  const marketplaceQueue = ownedStore
    ? await listStoreOrderQueue(ownedStore.id)
    : null;

  const summary = marketplaceQueue ? getStoreFulfilmentSummary(marketplaceQueue as unknown as StoreFulfilmentQueueModel) : null;
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Operations"
        title="Orders"
        description="Track your delivery requests and prepare marketplace orders for collection."
        actions={
          <Link
            className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] bg-[var(--eo-signal)] px-4 text-sm font-semibold text-white"
            href="/store/new-delivery"
          >
            New delivery
          </Link>
        }
      />
      <section className={s.storeStats} aria-label="Order overview"><article className={`${s.panel} ${s.bluePanel}`}><h2>Courier requests</h2><p className={s.balance}>{courierRequests.total}</p><p className={s.notice}>Delivery requests created by your store</p></article><article className={s.panel}><h2>Marketplace work</h2><div className={s.metricPair} style={{marginTop:22}}><div><strong>{summary?.needsPreparation??"—"}</strong><span>In preparation</span></div><div><strong>{summary?.readyForCollection??"—"}</strong><span>Ready for collection</span></div></div></article></section>
      <OperationalPanel
        title="Courier delivery requests"
        description="Open a reference to review its route and delivery progress."
        padding="compact"
      >
        <StoreCourierOrderList
          orders={courierRequests.data.map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            deliveryType: order.deliveryType,
            dropoffCity: order.dropoffCity,
            createdAt: order.createdAt,
          }))}
        />
      </OperationalPanel>      {marketplaceQueue ? (
        <StoreFulfilmentQueue
          queue={marketplaceQueue as unknown as StoreFulfilmentQueueModel}
          title="Marketplace fulfilment"
          description="Review orders and prepare them for courier collection."
        />
      ) : (
        <OperationalPanel
          title="Marketplace fulfilment"
          description="An active owned store is required before marketplace operations can be shown."
          padding="compact"
        >
          <p className="text-sm text-[var(--eo-text-secondary)]" role="status">
            Marketplace fulfilment is not available for this store state.
          </p>
        </OperationalPanel>
      )}

    </ProtectedPageFrame>
  );
}
