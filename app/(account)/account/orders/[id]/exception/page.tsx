import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CustomerUnavailablePage } from "@/components/protected-v2/customer/CustomerPresentation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getOrder } from "@/lib/services/orders.service";

export const metadata: Metadata = { title: "Delivery exception" };

export default async function OrderExceptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const order = await getOrder(user, id);
  if (!order) notFound();
  return <CustomerUnavailablePage eyebrow="Delivery support" title="Delivery exception" description={`Support options for ${order.orderNumber}.`} stateTitle="Self-service exception handling is unavailable" stateDescription="This route has no connected customer rescheduling or exception-resolution authority. Contact support for help with this delivery." backHref={`/account/orders/${order.id}`} backLabel="Back to delivery" />;
}
