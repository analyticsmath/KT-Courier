import { ActivityTimeline } from "@/components/protected-v2/feedback/ActivityTimeline";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { StoreFulfilmentActions } from "./StoreFulfilmentActions";
import styles from "./store-pages.module.css";

export type StoreFulfilmentDetailModel = Readonly<{
  reference: string;
  acceptanceStatus: string;
  preparationStatus: string;
  resolutionStatus: string;
  reviewDeadlineAt: Date | null;
  lines: readonly Readonly<{ id: string; title: string; variantTitle: string | null; quantity: number; fulfilmentStatus: string | null; confirmedAvailableQuantity: number | null; issues: readonly Readonly<{ id: string; issueType: string; affectedQuantity: number }>[] }>[];
  history: readonly Readonly<{ id: string; eventType: string; createdAt: Date }>[];
}>;

export function StoreFulfilmentDetail({ order }: { order: StoreFulfilmentDetailModel }) {
  const dateTimeFormat = new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className={`${styles.scope} space-y-5`}>
      <OperationalPanel title="Store-facing status" padding="compact">
        <div className="flex flex-wrap gap-2">
          <ProtectedStatus label={order.acceptanceStatus.replaceAll("_", " ")} />
          <ProtectedStatus label={order.preparationStatus.replaceAll("_", " ")} />
          <ProtectedStatus label={order.resolutionStatus.replaceAll("_", " ")} tone={order.resolutionStatus === "CLEAR" ? "neutral" : "warning"} />
        </div>
        {order.reviewDeadlineAt ? <p className="mt-3 text-sm text-[var(--eo-text-secondary)]">Review deadline: <time>{dateTimeFormat.format(order.reviewDeadlineAt)}</time></p> : null}
      </OperationalPanel>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <OperationalPanel title="Order items" description="Only store-owned fulfilment fields are shown." padding="compact">
          <ul className="eo-store-line-list">
            {order.lines.map((line) => <li key={line.id}>
              <div><h3>{line.title}</h3><p>{line.variantTitle ?? "Standard item"} · quantity {line.quantity}</p></div>
              <div><ProtectedStatus label={(line.fulfilmentStatus ?? "PENDING").replaceAll("_", " ")} />{line.confirmedAvailableQuantity !== null ? <p className="mt-2 text-xs text-[var(--eo-text-secondary)]">Confirmed available: {line.confirmedAvailableQuantity}</p> : null}</div>
              {line.issues.length ? <ul className="eo-store-issue-list">{line.issues.map((issue) => <li key={issue.id}>{issue.issueType.replaceAll("_", " ")} · {issue.affectedQuantity} affected</li>)}</ul> : null}
            </li>)}
          </ul>
        </OperationalPanel>
        <StoreFulfilmentActions reference={order.reference} acceptanceStatus={order.acceptanceStatus} preparationStatus={order.preparationStatus} />
      </div>
      <OperationalPanel title="Operational activity" padding="compact">
        {order.history.length ? <ActivityTimeline ariaLabel="Store-order operational activity" items={order.history.map((event) => ({ id: event.id, title: event.eventType.replaceAll("_", " "), timestamp: dateTimeFormat.format(event.createdAt) }))} /> : <p className="text-sm text-[var(--eo-text-secondary)]" role="status">No store-safe activity is available.</p>}
      </OperationalPanel>
    </div>
  );
}
