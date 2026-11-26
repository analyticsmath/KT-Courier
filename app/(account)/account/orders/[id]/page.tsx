import { LiveDeliveryStatusRefresh } from "@/components/tracking/LiveDeliveryStatusRefresh";
import { shouldRefreshParcelStatus } from "@/lib/tracking/delivery-status-refresh";
import { prisma } from "@/lib/db/prisma";
import { CourierTrackingMap } from "@/components/maps/CourierTrackingMap";
import { Conversations } from "@/components/forms/Conversations";
import { DeliveryReviewForm } from "@/components/forms/DeliveryReviews";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  CustomerAction,
  CustomerOrderDetail,
} from "@/components/protected-v2/customer/CustomerPresentation";
import { CancelOrderButton } from "@/components/orders/CancelOrderButton";
import { getCurrentUser } from "@/lib/auth/current-user";
import { CUSTOMER_CANCELLABLE_STATUSES } from "@/lib/constants/order-status";
import { getPublicPodForOrder } from "@/lib/services/proof-of-delivery.service";
import { getOrder } from "@/lib/services/orders.service";
import { getOrderDocumentAvailability } from "@/lib/shipment-documents/service";
import { listTrackingShareGrants } from "@/lib/tracking/recipient-access.server";
import { OrderShipmentDocumentsPanel } from "@/components/shipment-documents/OrderShipmentDocumentsPanel";

export const metadata: Metadata = { title: "Delivery details" };

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const order = await getOrder(user, id);
  if (!order) notFound();

  const [pod, cod, review, documentAvailability, grantsResult] = await Promise.all([
    ["DELIVERED", "COMPLETED"].includes(order.status) ? getPublicPodForOrder(order.id) : Promise.resolve(null),
    prisma.cashOnDelivery.findUnique({
      where: { orderId: order.id },
      select: { policyMode: true, cashObligation: true, cashCollected: true, status: true },
    }),
    prisma.deliveryReview.findFirst({
      where: { orderId: order.id, authorUserId: user.id },
      select: { rating: true, body: true },
    }),
    getOrderDocumentAvailability(order.id),
    listTrackingShareGrants({ user, orderId: order.id }).catch(() => ({ grants: [] })),
  ]);
  const canCancel = CUSTOMER_CANCELLABLE_STATUSES.includes(order.status);
  return (
    <>
      <LiveDeliveryStatusRefresh active={shouldRefreshParcelStatus(order.status)} />
      <CustomerOrderDetail
        cancelAction={
          canCancel ? (
            <CancelOrderButton
              orderId={order.id}
              redirectTo="/account/orders"
            />
          ) : undefined
        }
        documentsSection={
          <OrderShipmentDocumentsPanel
            orderId={order.id}
            orderNumber={order.orderNumber}
            viewerRole="CUSTOMER"
            availability={documentAvailability}
            initialGrants={grantsResult.grants}
          />
        }
        order={order}
        paymentAction={cod?.policyMode === "FULL_COD" ? (
          <span role="status" className="inline-flex items-center text-sm font-semibold">
            {cod.cashObligation.sub(cod.cashCollected).isZero()
              ? `Cash collected · R ${cod.cashCollected.toFixed(2)}`
              : `Pay R ${cod.cashObligation.sub(cod.cashCollected).toFixed(2)} cash at delivery`}
          </span>
        ) : (
          <CustomerAction
            href={`/orders/${encodeURIComponent(order.orderNumber)}/payment`}
            tone="primary"
          >
            Payment
          </CustomerAction>
        )}
        proof={pod}
      />
      {["PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "DELIVERY_ATTEMPTED"].includes(order.status) && (
        <OperationalPanel title="Delivery map"><CourierTrackingMap scope="PARCEL" reference={order.id} /></OperationalPanel>
      )}
      <OperationalPanel title="Delivery chat">
        <Conversations deliveryOrderId={order.id} />
      </OperationalPanel>
      {["DELIVERED", "COMPLETED"].includes(order.status) && (
        <OperationalPanel title="Review this delivery">
          <DeliveryReviewForm orderId={order.id} existing={review} />
        </OperationalPanel>
      )}
    </>
  );
}
