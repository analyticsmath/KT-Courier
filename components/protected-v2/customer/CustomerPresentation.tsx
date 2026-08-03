import Link from "next/link";
import type { OrderDetailDto, OrderSummaryDto } from "@/lib/dto/order.dto";
import {
  ActivityTimeline,
  EditorialTable,
  OperationalPanel,
  ProtectedPageFrame,
  ProtectedPageHeader,
  ProtectedState,
  ProtectedStatus,
} from "@/components/protected-v2";
import { ParcelDeskIllustration } from "@/components/protected-v2/illustrations/ParcelDeskIllustration";
import { formatCustomerDateTime, getCustomerOrderStatus } from "@/lib/customer-presentation/customer-order-presentation";
import styles from "./CustomerPresentation.module.css";

type CustomerActionProps = {
  href: string;
  children: React.ReactNode;
  tone?: "primary" | "default" | "quiet";
};

export function CustomerAction({ href, children, tone = "default" }: CustomerActionProps) {
  const toneClass = tone === "primary" ? styles.primaryAction : tone === "quiet" ? styles.quietAction : "";
  return <Link className={`${styles.action} ${toneClass}`} href={href}>{children}</Link>;
}

export function CustomerPage({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <ProtectedPageFrame>
      <div className={styles.stack}>
        <ProtectedPageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
        {children}
      </div>
    </ProtectedPageFrame>
  );
}

export function CustomerUnavailablePage({
  eyebrow,
  title,
  description,
  stateTitle,
  stateDescription,
  backHref = "/account",
  backLabel = "Back to overview",
}: {
  eyebrow: string;
  title: string;
  description: string;
  stateTitle: string;
  stateDescription: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <CustomerPage eyebrow={eyebrow} title={title} description={description}>
      <ProtectedState
        kind="unavailable"
        title={stateTitle}
        description={stateDescription}
        action={<CustomerAction href={backHref}>{backLabel}</CustomerAction>}
      />
    </CustomerPage>
  );
}

export function CustomerActiveDelivery({ order }: { order: OrderSummaryDto }) {
  const status = getCustomerOrderStatus(order.status);
  const scheduledFor = formatCustomerDateTime(order.scheduledFor);
  return (
    <OperationalPanel title="Active delivery" description="Your most recently updated delivery that is still in progress." action={<CustomerAction href="/account/orders">View all deliveries</CustomerAction>}>
      <div className={styles.activeDelivery}>
        <div className={styles.activeDeliveryHead}>
          <div>
            <p className={styles.eyebrow}>{order.deliveryType.replaceAll("_", " ")}</p>
            <Link className={styles.reference} href={`/account/orders/${order.id}`}>{order.orderNumber}</Link>
            <p className={styles.statusCopy}>{status.description}</p>
          </div>
          <ProtectedStatus label={status.label} tone={status.tone} />
        </div>
        <dl className={styles.routeGrid}>
          <div><dt>Pickup</dt><dd>{order.pickupSummary}</dd></div>
          <div><dt>Destination</dt><dd>{order.dropoffSummary}</dd></div>
          {scheduledFor ? <div><dt>Scheduled</dt><dd>{scheduledFor}</dd></div> : null}
        </dl>
      </div>
    </OperationalPanel>
  );
}

export function CustomerEmptyDeliveryState() {
  return <ProtectedState kind="empty" title="No active deliveries" description="When you request a delivery, its customer-safe progress will appear here." illustration={<ParcelDeskIllustration />} action={<CustomerAction href="/account/request-delivery" tone="primary">Request delivery</CustomerAction>} />;
}

export function CustomerOrderRecords({ orders }: { orders: readonly OrderSummaryDto[] }) {
  if (!orders.length) return <CustomerEmptyDeliveryState />;
  return (
    <>
      <div className={styles.recordsDesktop}>
        <EditorialTable
          caption="Your delivery records"
          rows={orders}
          mobileMode="priority"
          columns={[
            { id: "reference", header: "Delivery", priority: "primary", cell: (order) => <Link className={styles.reference} href={`/account/orders/${order.id}`}>{order.orderNumber}</Link> },
            { id: "status", header: "Status", priority: "primary", cell: (order) => { const status = getCustomerOrderStatus(order.status); return <ProtectedStatus label={status.label} tone={status.tone} />; } },
            { id: "route", header: "Route", priority: "secondary", cell: (order) => `${order.pickupCity ?? order.pickupSummary} to ${order.dropoffCity ?? order.dropoffSummary}` },
            { id: "date", header: "Updated", priority: "secondary", cell: (order) => formatCustomerDateTime(order.updatedAt) ?? "—" },
            { id: "action", header: "", align: "end", priority: "optional", cell: (order) => <CustomerAction href={`/account/orders/${order.id}`} tone="quiet">View details</CustomerAction> },
          ]}
        />
      </div>
      <ul aria-label="Your delivery records" className={styles.recordsMobile}>
        {orders.map((order) => {
          const status = getCustomerOrderStatus(order.status);
          return <li className={styles.record} key={order.id}>
            <div className={styles.recordHead}><Link className={styles.reference} href={`/account/orders/${order.id}`}>{order.orderNumber}</Link><ProtectedStatus label={status.label} tone={status.tone} /></div>
            <p className={styles.recordRoute}>{order.pickupCity ?? order.pickupSummary} to {order.dropoffCity ?? order.dropoffSummary}</p>
            <p className={styles.recordMeta}>Updated {formatCustomerDateTime(order.updatedAt) ?? "—"}</p>
            <div><CustomerAction href={`/account/orders/${order.id}`}>View delivery</CustomerAction></div>
          </li>;
        })}
      </ul>
    </>
  );
}

export function CustomerOrderDetail({
  order,
  paymentAction,
  cancelAction,
  proof,
}: {
  order: OrderDetailDto;
  paymentAction?: React.ReactNode;
  cancelAction?: React.ReactNode;
  proof: { methodLabel: string; deliveredAt: Date | string; recipientName: string; publicNote?: string | null } | null;
}) {
  const status = getCustomerOrderStatus(order.status);
  const deliveryType = order.deliveryType.replaceAll("_", " ");
  const price = order.priceEstimate === null || !Number.isFinite(order.priceEstimate) ? null : `${order.currency} ${order.priceEstimate.toFixed(2)}`;
  const scheduled = formatCustomerDateTime(order.scheduledFor);
  const timeline = order.statusHistory.map((event) => {
    const presentation = getCustomerOrderStatus(event.status);
    return { id: event.id, title: presentation.label, description: event.note ?? presentation.description, timestamp: formatCustomerDateTime(event.createdAt) ?? undefined, tone: presentation.tone };
  });
  return (
    <CustomerPage eyebrow="Delivery" title={order.orderNumber} description={`${deliveryType} · Requested ${formatCustomerDateTime(order.createdAt) ?? "—"}`} actions={<div className={styles.actions}><CustomerAction href="/account/orders">Back to deliveries</CustomerAction><CustomerAction href={`/account/request-delivery?repeatFrom=${order.id}`}>Create similar</CustomerAction>{paymentAction}</div>}>
      <OperationalPanel title="Current progress">
        <div className={styles.activeDelivery}>
          <div className={styles.activeDeliveryHead}><div><ProtectedStatus label={status.label} tone={status.tone} /><p className={styles.statusCopy}>{status.description}</p></div>{cancelAction}</div>
          {price ? <p className={styles.financialValue}>{price}</p> : null}
        </div>
      </OperationalPanel>
      <div className={styles.detailGrid}>
        <OperationalPanel title="Pickup"><p className={styles.recordRoute}>{formatAddress(order.pickupAddress, order.pickupSummary)}</p></OperationalPanel>
        <OperationalPanel title="Destination"><p className={styles.recordRoute}>{formatAddress(order.dropoffAddress, order.dropoffSummary)}</p></OperationalPanel>
      </div>
      <OperationalPanel title="Delivery details">
        <dl className={styles.details}>
          <div><dt>Service</dt><dd>{deliveryType}</dd></div>
          <div><dt>Parcels</dt><dd>{order.parcelCount}</dd></div>
          {order.parcelDescription ? <div><dt>Description</dt><dd>{order.parcelDescription}</dd></div> : null}
          {scheduled ? <div><dt>Scheduled</dt><dd>{scheduled}</dd></div> : null}
          {order.customerNote ? <div><dt>Your note</dt><dd>{order.customerNote}</dd></div> : null}
        </dl>
      </OperationalPanel>
      {proof ? <OperationalPanel title="Delivery confirmation" description={`${proof.methodLabel} · ${formatCustomerDateTime(proof.deliveredAt) ?? "—"}`}><dl className={styles.details}><div><dt>Received by</dt><dd>{proof.recipientName}</dd></div>{proof.publicNote ? <div><dt>Note</dt><dd>{proof.publicNote}</dd></div> : null}</dl></OperationalPanel> : null}
      {timeline.length ? <OperationalPanel title="Status history" description="Customer-safe updates for this delivery."><ActivityTimeline ariaLabel="Delivery status history" items={timeline} /></OperationalPanel> : null}
      <OperationalPanel title="Need help?"><p className={styles.notice}>For questions about this delivery, contact KT Couriers and include the delivery reference.</p><div className={styles.actions}><CustomerAction href="/account/support">Get support</CustomerAction></div></OperationalPanel>
    </CustomerPage>
  );
}

function formatAddress(address: OrderDetailDto["pickupAddress"], fallback: string): string {
  if (!address) return fallback;
  return [address.line1, address.line2, address.city, address.province, address.postalCode].filter(Boolean).join(", ") || fallback;
}
