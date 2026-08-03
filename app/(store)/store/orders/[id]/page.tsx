import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CancelOrderButton } from "@/components/orders/CancelOrderButton";
import { ActivityTimeline } from "@/components/protected-v2/feedback/ActivityTimeline";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getOrder } from "@/lib/services/orders.service";
import { getDeliveryTypeConfig } from "@/lib/constants/statuses";
import { CUSTOMER_CANCELLABLE_STATUSES } from "@/lib/constants/order-status";
import { formatDate, formatDateTime } from "@/lib/utils/formatters";

export const metadata: Metadata = { title: "Store delivery request" };

export default async function StoreOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const order = await getOrder(user, id);
  if (!order) notFound();
  const canCancel = CUSTOMER_CANCELLABLE_STATUSES.includes(order.status as typeof CUSTOMER_CANCELLABLE_STATUSES[number]);
  return <ProtectedPageFrame>
    <ProtectedPageHeader breadcrumbs={[{ label: "Orders", href: "/store/orders" }, { label: order.orderNumber }]} title={order.orderNumber} description={`${getDeliveryTypeConfig(order.deliveryType).label} · created ${formatDate(order.createdAt)}`} actions={<><Link className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] border border-[var(--eo-line-strong)] px-3 text-sm font-semibold" href="/store/orders">Back to orders</Link><Link className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] bg-[var(--eo-signal)] px-3 text-sm font-semibold text-white" href={`/store/new-delivery?repeatFrom=${order.id}`}>Create similar</Link></>} />
    <OperationalPanel title="Delivery request status" padding="compact"><div className="flex flex-wrap items-center justify-between gap-4"><ProtectedStatus label={order.status.replaceAll("_", " ")} /><p className="text-sm text-[var(--eo-text-secondary)]">This is a store-created courier request, not a marketplace fulfilment order.</p></div>{canCancel ? <div className="mt-4 border-t border-[var(--eo-line-soft)] pt-4"><CancelOrderButton orderId={order.id} redirectTo="/store/orders" /></div> : null}</OperationalPanel>
    <div className="grid gap-5 sm:grid-cols-2"><OperationalPanel title="Collection point" padding="compact"><AddressBlock line1={order.pickupAddress?.line1} city={order.pickupAddress?.city} fallback={order.pickupSummary} /></OperationalPanel><OperationalPanel title="Destination" padding="compact"><AddressBlock line1={order.dropoffAddress?.line1} city={order.dropoffAddress?.city} fallback={order.dropoffSummary} /></OperationalPanel></div>
    <OperationalPanel title="Request details" padding="compact"><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="font-semibold text-[var(--eo-text-muted)]">Service</dt><dd className="mt-1">{getDeliveryTypeConfig(order.deliveryType).label}</dd></div><div><dt className="font-semibold text-[var(--eo-text-muted)]">Parcels</dt><dd className="mt-1">{order.parcelCount}</dd></div>{order.parcelDescription ? <div><dt className="font-semibold text-[var(--eo-text-muted)]">Parcel description</dt><dd className="mt-1">{order.parcelDescription}</dd></div> : null}{order.scheduledFor ? <div><dt className="font-semibold text-[var(--eo-text-muted)]">Scheduled for</dt><dd className="mt-1">{formatDateTime(order.scheduledFor)}</dd></div> : null}</dl></OperationalPanel>
    <OperationalPanel title="Status activity" padding="compact">{order.statusHistory.length ? <ActivityTimeline ariaLabel="Store courier request status activity" items={order.statusHistory.map((event) => ({ id: event.id, title: event.status.replaceAll("_", " "), description: event.note ?? undefined, timestamp: formatDateTime(event.createdAt) }))} /> : <p className="text-sm text-[var(--eo-text-secondary)]" role="status">No status activity is available.</p>}</OperationalPanel>
  </ProtectedPageFrame>;
}

function AddressBlock({ line1, city, fallback }: { line1?: string | null; city?: string | null; fallback: string }) {
  return <p className="text-sm leading-6 text-[var(--eo-text-secondary)]">{line1 ? [line1, city].filter(Boolean).join(", ") : fallback}</p>;
}
