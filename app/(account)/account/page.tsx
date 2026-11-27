import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/current-user";
import { CUSTOMER_ACTIVE_ORDER_STATUSES } from "@/lib/customer-presentation/customer-order-presentation";
import { toOrderSummaryDto } from "@/lib/dto/order.dto";
import { prisma } from "@/lib/db/prisma";
import {
  getCustomerDashboardInsights,
  getCustomerDashboardBreakdown,
} from "@/lib/dashboard-insights/customer-dashboard-insights";
import { parseDashboardPeriod } from "@/lib/dashboard-insights/dashboard-period";
import { CustomerDashboardHome } from "@/components/protected-v2/customer/CustomerDashboardHome";
import { QaSandboxBanner } from "@/components/qa-acceptance/QaSandboxBanner";
import { resolveQaAcceptanceSessionContext, resolveQaPrincipalForUser } from "@/lib/qa-acceptance/access";

export const metadata: Metadata = { title: "My delivery desk" };

const ORDER_INCLUDE = {
  pickupAddress: true,
  dropoffAddress: true,
  deliveryRegion: { select: { name: true } },
} as const;

function firstName(nameOrEmail: string): string {
  return nameOrEmail.split(" ")[0]?.split("@")[0] ?? nameOrEmail;
}

export default async function AccountDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  const userId = user!.id;
  const activeStatuses = [...CUSTOMER_ACTIVE_ORDER_STATUSES];
  const period = parseDashboardPeriod((await searchParams).period);

  const [latestActiveRaw, recentRaw, activeCount, attentionCount, insight, breakdown, qaPrincipal, qaContext] =
    await Promise.all([
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
      prisma.order.count({
        where: { customerId: userId, status: { in: ["PENDING", "DELIVERY_ATTEMPTED"] } },
      }),
      getCustomerDashboardInsights(period),
      getCustomerDashboardBreakdown(),
      resolveQaPrincipalForUser(userId).catch(() => null),
      resolveQaAcceptanceSessionContext(userId).catch(() => null),
    ]);

  const latestActive = latestActiveRaw ? toOrderSummaryDto(latestActiveRaw) : null;
  const recentOrders = recentRaw.map(toOrderSummaryDto);

  return (
    <>
      {qaPrincipal ? (
        <QaSandboxBanner
          persona="QA Customer"
          ctaHref={qaContext ? "/shop/qa" : undefined}
          ctaLabel={qaContext ? "Open Private QA Storefront" : undefined}
          nonWithdrawable
        />
      ) : null}
      <CustomerDashboardHome
        firstName={firstName(user!.name ?? user!.email)}
        latestActive={latestActive}
        recentOrders={recentOrders}
        activeCount={activeCount}
        attentionCount={attentionCount}
        insight={insight}
        breakdown={breakdown}
        period={period}
      />
    </>
  );
}
