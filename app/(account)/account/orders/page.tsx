import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const query = await searchParams;
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
