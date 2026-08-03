import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";

export type StoreNotificationRecord = Readonly<{ id: string; title: string; body: string; state: string; createdAt: Date }>;

export function StoreNotificationInbox({ notifications }: { notifications: readonly StoreNotificationRecord[] }) {
  if (!notifications.length) return <ProtectedState kind="empty" title="No store notifications" description="Store account and service updates will appear here when the existing notification authority creates an inbox item." />;
  return <OperationalPanel title="Store inbox" description="The most recent store-owned account and service notifications." padding="compact"><ol aria-label="Store notifications" className="grid gap-2 m-0 p-0 list-none">{notifications.map((item) => <li className="rounded-[var(--eo-radius-control)] border border-[var(--eo-line-soft)] p-3" key={item.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="m-0 text-sm font-semibold">{item.title}</h2><p className="mb-0 mt-1 text-sm text-[var(--eo-text-secondary)]">{item.body}</p><time className="mt-2 block text-xs text-[var(--eo-text-muted)]">{new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(item.createdAt)}</time></div><ProtectedStatus label={item.state.replaceAll("_", " ")} tone={item.state === "UNREAD" ? "information" : "neutral"} /></div></li>)}</ol></OperationalPanel>;
}
