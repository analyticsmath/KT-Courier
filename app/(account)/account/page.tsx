import type { Metadata } from "next";
import { MetricTile, OperationalPanel } from "@/components/protected-v2";
import {
  CustomerActiveDelivery,
  CustomerAction,
  CustomerEmptyDeliveryState,
  CustomerOrderRecords,
  CustomerPage,
} from "@/components/protected-v2/customer/CustomerPresentation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { CUSTOMER_ACTIVE_ORDER_STATUSES } from "@/lib/customer-presentation/customer-order-presentation";
import { toOrderSummaryDto } from "@/lib/dto/order.dto";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "My delivery desk" };

const ORDER_INCLUDE = {
  pickupAddress: true,
  dropoffAddress: true,
  deliveryRegion: { select: { name: true } },
} as const;

function firstName(nameOrEmail: string): string {
  return nameOrEmail.split(" ")[0]?.split("@")[0] ?? nameOrEmail;
}

export default async function AccountDashboardPage() {
  const user = await getCurrentUser();
  const userId = user!.id;
  const activeStatuses = [...CUSTOMER_ACTIVE_ORDER_STATUSES];

  const [latestActiveRaw, recentRaw, activeCount, attentionCount] = await Promise.all([
    prisma.order.findFirst({
      where: { customerId: userId, status: { in: activeStatuses } },
      include: ORDER_INCLUDE,
      // A stable tie-breaker makes the one displayed active delivery deterministic.
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    }),
    prisma.order.findMany({
      where: { customerId: userId },
      include: ORDER_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 5,
    }),
    prisma.order.count({ where: { customerId: userId, status: { in: activeStatuses } } }),
    prisma.order.count({ where: { customerId: userId, status: { in: ["PENDING", "DELIVERY_ATTEMPTED"] } } }),
  ]);

  const latestActive = latestActiveRaw ? toOrderSummaryDto(latestActiveRaw) : null;
  const recentOrders = recentRaw.map(toOrderSummaryDto);

  return (
    <CustomerPage
      eyebrow="My delivery desk"
      title={`Welcome back, ${firstName(user!.name ?? user!.email)}`}
      description="See the delivery that needs your attention and start the next request."
      actions={<CustomerAction href="/account/request-delivery" tone="primary">Request delivery</CustomerAction>}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetricTile label="Active deliveries" value={activeCount} description="Current customer deliveries" />
        <MetricTile label="Needs attention" value={attentionCount} description="Requests or attempts to review" />
      </div>
      {latestActive ? <CustomerActiveDelivery order={latestActive} /> : <CustomerEmptyDeliveryState />}
      <OperationalPanel title="Recent deliveries" description="Your five most recently requested deliveries." action={<CustomerAction href="/account/orders">View all deliveries</CustomerAction>}>
        <CustomerOrderRecords orders={recentOrders} />
      </OperationalPanel>
      <OperationalPanel title="Account help" description="Saved addresses, notifications, and support remain available when you need them.">
        <div className="flex flex-wrap gap-2"><CustomerAction href="/account/addresses">Saved addresses</CustomerAction><CustomerAction href="/account/notifications">Notifications</CustomerAction><CustomerAction href="/account/support">Support</CustomerAction></div>
      </OperationalPanel>
    </CustomerPage>
  );
}
