import Link from "next/link";
import { MetricTile, OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedContentGrid, ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { StoreCourierOrderList, type StoreCourierOrderRecord } from "./StoreCourierOrderList";
import { StoreFulfilmentQueue as StoreFulfilmentQueueComponent } from "./StoreFulfilmentQueue";
import type { StoreFulfilmentQueue } from "@/lib/store-presentation/store-fulfilment-priority";
import { getStoreFulfilmentSummary } from "@/lib/store-presentation/store-fulfilment-priority";
import { storeAccountState } from "@/lib/store-presentation/store-status";
import styles from "./store-pages.module.css";

export function StoreOverviewPage({ storeName, storeStatus, queue, recentCourierOrders, pickupConfigured, payableBalance }: { storeName: string; storeStatus: string | null; queue: StoreFulfilmentQueue; recentCourierOrders: readonly StoreCourierOrderRecord[]; pickupConfigured: boolean; payableBalance: string | null }) {
  const summary = getStoreFulfilmentSummary(queue);
  const state = storeAccountState(storeStatus);
  return <div className={styles.scope}><ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Store operations" title={storeName} description="Fulfilment, courier delivery requests, catalog readiness, and confirmed store records." actions={<Link className="eo-button eo-button--primary" href="/store/new-delivery">New delivery</Link>} />
    <ProtectedContentGrid contextRail={<div className="space-y-4"><OperationalPanel title="Store state" padding="compact"><ProtectedStatus label={state.label} tone={state.tone} /><p className="mt-3 text-sm text-[var(--eo-text-secondary)]">{state.description}</p><Link className="eo-text-link mt-3 inline-flex" href="/store/profile">Review store details</Link></OperationalPanel><OperationalPanel title="Collection point" padding="compact"><p className="text-sm text-[var(--eo-text-secondary)]">{pickupConfigured ? "A saved pickup address is available for new delivery requests." : "A saved pickup address has not been configured."}</p><Link className="eo-text-link mt-3 inline-flex" href="/store/profile">{pickupConfigured ? "Manage pickup address" : "Add pickup address"}</Link></OperationalPanel>{payableBalance !== null ? <OperationalPanel title="Confirmed store balance" padding="compact"><p className="eo-store-money">ZAR {payableBalance}</p><p className="mt-2 text-sm text-[var(--eo-text-secondary)]">This is a server-authoritative balance projection. Financial execution remains subject to its existing controls.</p><Link className="eo-text-link mt-3 inline-flex" href="/store/earnings">View earnings</Link></OperationalPanel> : null}</div>}>
      <div className="space-y-6">
        <div className="eo-metric-grid" aria-label="Store fulfilment summary">
          <MetricTile label="Needs attention" value={summary.needsAttention} description="Review, customer action, or reconciliation" />
          <MetricTile label="Needs preparation" value={summary.needsPreparation} description="Accepted or already preparing" />
          <MetricTile label="Ready for collection" value={summary.readyForCollection} description="Awaiting the next collection stage" />
          {payableBalance !== null ? <MetricTile label="Confirmed balance" value={`ZAR ${payableBalance}`} description="Authoritative store balance projection" /> : null}
        </div>
        <StoreFulfilmentQueueComponent queue={queue} limit={8} />
        <OperationalPanel title="Recent courier delivery requests" description="Store-created courier requests remain separate from marketplace fulfilment." action={<Link className="eo-text-link" href="/store/orders">View all orders</Link>} padding="compact"><StoreCourierOrderList compact orders={recentCourierOrders} /></OperationalPanel>
      </div>
    </ProtectedContentGrid>
  </ProtectedPageFrame></div>;
}
