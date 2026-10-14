import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { OperationalPanel, ProtectedFilterBar, ProtectedPagination } from "@/components/protected-v2";
import { CustomerAction, CustomerOrderRecords, CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";
import { CustomerOrderFilters } from "@/components/protected-v2/customer/CustomerOrderFilters";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCustomerOrderStatus } from "@/lib/customer-presentation/customer-order-presentation";
import { listOrders } from "@/lib/services/orders.service";
import type { OrderStatus } from "@/types/order";

export const metadata: Metadata = { title: "My deliveries" };

const PAGE_SIZE = 20;
const FILTER_OPTIONS = [
  { value: "", label: "All deliveries" },
  ...(["DRAFT", "PENDING", "CONFIRMED", "PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "IN_PROGRESS", "DELIVERY_ATTEMPTED", "DELIVERED", "COMPLETED", "CANCELLED", "FAILED"] as const).map((status) => ({ value: status, label: getCustomerOrderStatus(status).label })),
];
const FILTERABLE_STATUSES = new Set(FILTER_OPTIONS.map((option) => option.value));

function positivePage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; tracking?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const query = await searchParams;
  const tracking = typeof query.tracking === "string" ? query.tracking.trim().toUpperCase() : "";
  if (tracking) {
    // Never look up a reference globally: a tracking number is an identifier,
    // not a bearer token granting private delivery details.
    const match = tracking.length <= 24 && /^KT-[0-9]{4}-[A-Z0-9]{6,14}$/.test(tracking)
      ? await prisma.order.findFirst({
          where: { customerId: user.id, orderNumber: tracking },
          select: { id: true },
        })
      : null;
    if (match) redirect(`/account/orders/${match.id}`);
  }
  const status = query.status && FILTERABLE_STATUSES.has(query.status) ? query.status as OrderStatus : undefined;
  const page = positivePage(query.page);
  const { data: orders, total } = await listOrders(user, { status, page, pageSize: PAGE_SIZE });
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const hrefForPage = (nextPage: number) => {
    const params = new URLSearchParams({ page: String(nextPage) });
    if (status) params.set("status", status);
    return `/account/orders?${params.toString()}`;
  };

  return (
    <CustomerPage
      eyebrow="Delivery records"
      title="My deliveries"
      description="Review customer-safe delivery status, routes, and request history."
      actions={<CustomerAction href="/account/request-delivery" tone="primary">Request delivery</CustomerAction>}
    >
      <OperationalPanel title="Track by delivery number" description="Your delivery number is the short KT-YYYY-XXXXXX reference shown in your booking and delivery history. Only deliveries belonging to your account are accessible.">
        <form action="/account/orders" method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1">
            <label htmlFor="tracking-number" className="mb-1 block text-sm font-semibold">Delivery tracking number</label>
            <input id="tracking-number" name="tracking" type="search" maxLength={24}
              placeholder="KT-2026-123456" defaultValue={tracking}
              className="w-full rounded-lg border border-[var(--eo-line-strong)] bg-white px-3 py-3 text-sm uppercase text-[var(--eo-text)]"
              autoComplete="off" required />
          </div>
          <button type="submit" className="rounded-lg bg-[var(--eo-signal)] px-5 py-3 text-sm font-semibold text-white">Track delivery</button>
        </form>
        {tracking && <p role="status" className="mt-3 text-sm text-[var(--eo-text-secondary)]">No delivery with this reference was found in your account. Check the number in your confirmation and try again.</p>}
      </OperationalPanel>
      <ProtectedFilterBar activeFilterCount={status ? 1 : 0} clearHref={status ? "/account/orders" : undefined}>
        <CustomerOrderFilters activeStatus={status ?? ""} options={FILTER_OPTIONS} />
      </ProtectedFilterBar>
      <OperationalPanel title="Deliveries" description={total ? `${total} delivery record${total === 1 ? "" : "s"}.` : "Your delivery history will appear here."}>
        <CustomerOrderRecords orders={orders} />
      </OperationalPanel>
      <ProtectedPagination currentPage={page} pageCount={pageCount} hrefForPage={hrefForPage} />
    </CustomerPage>
  );
}
