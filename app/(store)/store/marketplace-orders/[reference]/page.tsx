import { requireBusinessPage } from "@/lib/client-platform/business-auth";
/* eslint-disable @typescript-eslint/no-explicit-any -- marketplace delegates are runtime-gated until Prisma generation is approved. */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StoreFulfilmentDetail } from "@/components/protected-v2/store/StoreFulfilmentDetail";
import { CourierTrackingMap } from "@/components/maps/CourierTrackingMap";
import { getPublicPodForOrder } from "@/lib/services/proof-of-delivery.service";
import { membershipAllows } from "@/lib/client-platform/store-permissions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";

export default async function MarketplaceStoreOrderPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const access = await requireBusinessPage("/store/marketplace-orders/[reference]");
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const { reference } = await params;
  const order = await (prisma as any).marketplaceStoreOrder.findFirst({
    where: { publicReference: reference, storeId: access.store.id },
    include: {
      lines: {
        include: {
          fulfilment: true,
          issues: { orderBy: { createdAt: "asc" } },
        },
      },
      history: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();
  const bridge = await prisma.marketplaceStoreOrderDeliveryBridge.findUnique({
    where: { marketplaceStoreOrderId: order.id },
    select: { courierOrderId: true, courierOrder: { select: { id: true, storeId: true, status: true, orderNumber: true } } },
  });
  // Only reveal courier evidence when the bridge points back to this verified store.
  const courier = bridge?.courierOrder?.storeId === access.store.id ? bridge.courierOrder : null;
  const canTrack = access.owner || membershipAllows(access.permissions, "deliveries");
  const pod = courier && ["DELIVERED", "COMPLETED"].includes(courier.status)
    ? await getPublicPodForOrder(courier.id)
    : null;
  const replacements = await prisma.storeCatalogOffer.findMany({ where: { storeId: access.store.id, status: "ACTIVE", publicationStatus: "PUBLISHED" }, select: { publicReference: true, product: { select: { title: true } }, variant: { select: { publicReference: true, title: true } } }, orderBy: { publicReference: "asc" }, take: 100 });

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Marketplace fulfilment"
        title={order.publicReference}
        description="Store-safe operational detail. Customer payment, courier dispatch, and driver-private data are not exposed here."
        actions={
          <Link
            className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] border border-[var(--eo-line-strong)] px-3 text-sm font-semibold text-[var(--eo-text)]"
            href="/store/orders"
          >
            Back to orders
          </Link>
        }
      />
      {courier && (
        <section className="mt-6 rounded-xl border border-[var(--eo-line-soft)] p-5" aria-label="Linked courier delivery">
          <h2 className="text-lg font-semibold">Courier delivery</h2>
          <p className="mt-2 text-sm">Delivery {courier.orderNumber} · {courier.status.replaceAll("_", " ")}</p>
          {canTrack && ["PICKED_UP", "IN_TRANSIT", "DELIVERY_ATTEMPTED"].includes(courier.status) && (
            <div className="mt-4"><CourierTrackingMap scope="PARCEL" reference={courier.id} /></div>
          )}
          {pod && <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="font-semibold">Delivery confirmation</dt><dd>{pod.methodLabel}</dd></div>
            <div><dt className="font-semibold">Delivered</dt><dd>{pod.deliveredAt.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}</dd></div>
            <div><dt className="font-semibold">Recipient</dt><dd>{pod.recipientName}</dd></div>
            {pod.publicNote && <div><dt className="font-semibold">Delivery note</dt><dd>{pod.publicNote}</dd></div>}
          </dl>}
        </section>
      )}
      <StoreFulfilmentDetail
        order={{
          reference: order.publicReference,
          acceptanceStatus: order.acceptanceStatus,
          preparationStatus: order.preparationStatus,
          resolutionStatus: order.resolutionStatus,
          reviewDeadlineAt: order.reviewDeadlineAt,
          replacements: replacements.map(item => ({ offerReference: item.publicReference, variantReference: item.variant.publicReference, label: `${item.product.title} — ${item.variant.title}` })),
          lines: order.lines.map((line: any) => ({
            id: line.id,
            title: line.title,
            variantTitle: line.variantTitle,
            quantity: line.quantity,
            fulfilmentStatus: line.fulfilment?.status ?? null,
            confirmedAvailableQuantity:
              line.fulfilment?.confirmedAvailableQuantity ?? null,
            issues: line.issues.map((issue: any) => ({
              id: issue.id,
              publicReference: issue.publicReference,
              status: issue.status,
              issueType: issue.issueType,
              affectedQuantity: issue.affectedQuantity,
            })),
          })),
          history: order.history.map((event: any) => ({
            id: event.id,
            eventType: event.eventType,
            createdAt: event.createdAt,
          })),
        }}
      />
    </ProtectedPageFrame>
  );
}
