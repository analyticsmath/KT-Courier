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
import { prisma } from "@/lib/db/prisma";
import { listStoreOrderQueue } from "@/lib/store-orders/store-order.service";
import type { StoreFulfilmentQueue as StoreFulfilmentQueueModel } from "@/lib/store-presentation/store-fulfilment-priority";

export const metadata: Metadata = { title: "Store orders" };

export default async function StoreOrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const [courierRequests, ownedStore] = await Promise.all([
    listOrders(user, { page: 1, pageSize: 50 }),
    prisma.store.findFirst({ where: { ownerUserId: user.id, status: "ACTIVE" }, select: { id: true } }),
  ]);
  const marketplaceQueue = ownedStore ? await listStoreOrderQueue(ownedStore.id) : null;

  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Operations" title="Orders" description="Marketplace fulfilment and store-created courier delivery requests have distinct states and actions." actions={<Link className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] bg-[var(--eo-signal)] px-4 text-sm font-semibold text-white" href="/store/new-delivery">New delivery</Link>} />
    {marketplaceQueue ? <StoreFulfilmentQueue queue={(marketplaceQueue as unknown) as StoreFulfilmentQueueModel} title="Marketplace fulfilment" description="Server-ordered marketplace records. Open a record to use its eligible preparation or collection action." /> : <OperationalPanel title="Marketplace fulfilment" description="An active owned store is required before marketplace operations can be shown." padding="compact"><p className="text-sm text-[var(--eo-text-secondary)]" role="status">Marketplace fulfilment is not available for this store state.</p></OperationalPanel>}
    <OperationalPanel title="Courier delivery requests" description="These are delivery requests created by this store. They are not marketplace store orders." padding="compact"><StoreCourierOrderList orders={courierRequests.data.map((order) => ({ id: order.id, orderNumber: order.orderNumber, status: order.status, deliveryType: order.deliveryType, dropoffCity: order.dropoffCity, createdAt: order.createdAt }))} /></OperationalPanel>
  </ProtectedPageFrame>;
}
