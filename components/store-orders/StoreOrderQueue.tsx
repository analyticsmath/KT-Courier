import Link from "next/link";

type QueueRow = Readonly<{ publicReference: string; acceptanceStatus: string; preparationStatus: string; resolutionStatus: string; deliveryBridgeStatus: string; reviewDeadlineAt: Date | null; createdAt: Date }>;

const sections: ReadonlyArray<readonly [keyof StoreOrderQueueProps["queue"], string]> = [
  ["needsReview", "Needs review"], ["customerActionRequired", "Customer action required"], ["accepted", "Accepted"], ["preparing", "Preparing"], ["readyForPickup", "Ready for pickup"], ["handoffInProgress", "Handoff in progress"], ["completedHandoff", "Completed handoff"], ["rejectedOrCancelled", "Rejected / cancelled"], ["reconciliationRequired", "Reconciliation required"],
];

export type StoreOrderQueueProps = { queue: Record<string, QueueRow[]> };

export function StoreOrderQueue({ queue }: StoreOrderQueueProps) {
  return <div className="grid gap-4 lg:grid-cols-2" aria-label="Marketplace store-order work queue">
    {sections.map(([key, title]) => {
      const items = queue[key] ?? [];
      return <section key={key} className="rounded-2xl border border-[var(--kt-soft-border)] bg-white p-4" aria-labelledby={`queue-${key}`}>
        <div className="mb-3 flex items-center justify-between gap-3"><h2 id={`queue-${key}`} className="text-sm font-extrabold text-[var(--kt-ink-navy)]">{title}</h2><span className="rounded-full bg-[var(--kt-signal-cobalt)]/10 px-2 py-0.5 text-xs font-bold text-[var(--kt-signal-cobalt)]">{items.length}</span></div>
        {items.length === 0 ? <p className="text-sm text-[var(--kt-text-muted)]">No orders in this stage.</p> : <ul className="space-y-2">
          {items.map((order) => <li key={order.publicReference}><Link className="block rounded-xl border border-[var(--kt-soft-border)] p-3 outline-offset-2 hover:border-[var(--kt-signal-cobalt)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--kt-signal-cobalt)]" href={`/store/marketplace-orders/${order.publicReference}`}>
            <div className="flex items-start justify-between gap-2"><span className="font-mono text-xs font-bold text-[var(--kt-ink-navy)]">{order.publicReference}</span><span className="text-xs text-[var(--kt-text-muted)]">{order.preparationStatus.replaceAll("_", " ")}</span></div>
            <p className="mt-1 text-xs text-[var(--kt-text-muted)]">{order.reviewDeadlineAt ? `Review deadline: ${new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(order.reviewDeadlineAt)}` : "Operational evidence pending"}</p>
          </Link></li>)}
        </ul>}
      </section>;
    })}
  </div>;
}
