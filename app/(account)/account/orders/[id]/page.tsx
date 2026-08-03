import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CustomerAction, CustomerOrderDetail } from "@/components/protected-v2/customer/CustomerPresentation";
import { CancelOrderButton } from "@/components/orders/CancelOrderButton";
import { getCurrentUser } from "@/lib/auth/current-user";
import { CUSTOMER_CANCELLABLE_STATUSES } from "@/lib/constants/order-status";
import { getPublicPodForOrder } from "@/lib/services/proof-of-delivery.service";
import { getOrder } from "@/lib/services/orders.service";

export const metadata: Metadata = { title: "Delivery details" };

export default async function AccountOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const order = await getOrder(user, id);
  if (!order) notFound();

  const pod = order.status === "DELIVERED" ? await getPublicPodForOrder(order.id) : null;
  const canCancel = CUSTOMER_CANCELLABLE_STATUSES.includes(order.status);

  return (
    <CustomerOrderDetail
      cancelAction={canCancel ? <CancelOrderButton orderId={order.id} redirectTo="/account/orders" /> : undefined}
      order={order}
      paymentAction={<CustomerAction href={`/orders/${encodeURIComponent(order.orderNumber)}/payment`} tone="primary">Payment</CustomerAction>}
      proof={pod}
    />
  );
}
