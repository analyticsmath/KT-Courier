import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { ParcelDeskIllustration } from "@/components/protected-v2/illustrations/ParcelDeskIllustration";
import styles from "./store-pages.module.css";

export type StoreCourierOrderRecord = Readonly<{
  id: string;
  orderNumber: string;
  status: string;
  deliveryType: string;
  dropoffCity: string | null;
  createdAt: Date;
}>;

function displayStatus(value: string) {
  return value.replaceAll("_", " ");
}

export function StoreCourierOrderList({ orders, compact = false }: { orders: readonly StoreCourierOrderRecord[]; compact?: boolean }) {
  if (!orders.length) return <div className={styles.scope}><ProtectedState kind="empty" title="No store delivery requests" description="Create a courier delivery when a store-owned parcel needs collection." illustration={<ParcelDeskIllustration className="h-24 w-32" />} action={<Link className="eo-button eo-button--primary" href="/store/new-delivery">New delivery</Link>} /></div>;
  if (compact) return <div className={styles.scope}><ul aria-label="Recent store delivery requests" className="eo-store-record-list">{orders.map((order) => <li className="eo-store-record-list__item" key={order.id}><Link className="eo-store-record-list__link" href={`/store/orders/${order.id}`}><div><p className="font-mono text-sm font-semibold">{order.orderNumber}</p><p className="eo-store-record-list__meta">{order.deliveryType.replaceAll("_", " ")}{order.dropoffCity ? ` · ${order.dropoffCity}` : ""}</p></div><ProtectedStatus label={displayStatus(order.status)} /></Link></li>)}</ul></div>;
  return <div className={styles.scope}><EditorialTable
    caption="Store-created courier delivery requests"
    mobileMode="stack"
    rows={orders}
    emptyState={null}
    columns={[
      { id: "reference", header: "Request", priority: "primary", cell: (order) => <Link className="font-mono font-semibold" href={`/store/orders/${order.id}`}>{order.orderNumber}</Link> },
      { id: "type", header: "Service", priority: "secondary", cell: (order) => order.deliveryType.replaceAll("_", " ") },
      { id: "destination", header: "Destination", priority: "optional", cell: (order) => order.dropoffCity ?? "Destination details on record" },
      { id: "status", header: "Status", priority: "secondary", cell: (order) => <ProtectedStatus label={displayStatus(order.status)} /> },
    ]}
  /></div>;
}
