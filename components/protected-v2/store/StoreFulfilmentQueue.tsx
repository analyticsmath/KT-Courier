import Link from "next/link";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { ParcelDeskIllustration } from "@/components/protected-v2/illustrations/ParcelDeskIllustration";
import { getPrioritisedStoreFulfilmentRows, STORE_FULFILMENT_SECTIONS, type StoreFulfilmentQueue } from "@/lib/store-presentation/store-fulfilment-priority";
import styles from "./store-pages.module.css";

function formatTimestamp(value: Date | null) {
  if (!value) return "Timing not available";
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function nextAction(row: StoreFulfilmentQueue["needsReview"][number]) {
  if (row.resolutionStatus === "RECONCILIATION_REQUIRED") return "Review reconciliation status";
  if (row.acceptanceStatus === "CUSTOMER_ACTION_REQUIRED" || row.resolutionStatus === "ISSUE_OPEN") return "Review fulfilment issue";
  if (["PENDING_STORE_REVIEW", "REVIEWING"].includes(row.acceptanceStatus)) return "Review order";
  if (row.preparationStatus === "PREPARING") return "Continue preparation";
  if (row.preparationStatus === "READY_FOR_HANDOFF") return "Ready for collection";
  if (row.acceptanceStatus === "ACCEPTED") return "Start preparation";
  return "View operational record";
}

export function StoreFulfilmentQueue({ queue, limit, title = "Fulfilment queue", description = "Ordered by the server within each operational stage. Attention and review work is shown first." }: { queue: StoreFulfilmentQueue; limit?: number; title?: string; description?: string }) {
  const rows = getPrioritisedStoreFulfilmentRows(queue, limit);

  return <div className={styles.scope}>
    <OperationalPanel title={title} description={description} padding="compact">
      {!rows.length ? (
        <ProtectedState
          kind="empty"
          title="No marketplace orders need fulfilment"
          description="Orders will appear here only after the marketplace order workflow creates a store-owned operational record."
          illustration={<ParcelDeskIllustration className="h-24 w-32" />}
        />
      ) : (
        <ol aria-label="Marketplace fulfilment queue" className="eo-store-record-list">
          {rows.map((row) => (
            <li key={row.publicReference} className="eo-store-record-list__item">
              <Link href={`/store/marketplace-orders/${row.publicReference}`} className="eo-store-record-list__link">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold">{row.publicReference}</p>
                  <p className="eo-store-record-list__meta">{nextAction(row)}{row.reviewDeadlineAt ? ` · review deadline ${formatTimestamp(row.reviewDeadlineAt)}` : ""}</p>
                </div>
                <ProtectedStatus label={row.preparationStatus.replaceAll("_", " ")} tone={row.resolutionStatus === "RECONCILIATION_REQUIRED" ? "danger" : row.acceptanceStatus === "CUSTOMER_ACTION_REQUIRED" ? "warning" : "information"} />
              </Link>
            </li>
          ))}
        </ol>
      )}
      <details className="eo-store-queue-stages">
        <summary>Queue stage counts</summary>
        <ul>
          {STORE_FULFILMENT_SECTIONS.map(([key, label]) => <li key={key}><span>{label}</span><strong>{queue[key].length}</strong></li>)}
        </ul>
      </details>
    </OperationalPanel>
  </div>;
}
