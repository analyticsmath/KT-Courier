import { cn } from "@/lib/utils/cn";
import type { ProtectedStatusTone } from "@/components/protected-v2/feedback/ProtectedStatus";

export type AgendaItem = { id: string; time?: string; title: string; description?: string; tone?: ProtectedStatusTone; action?: React.ReactNode };

export function AgendaList({ items, emptyMessage = "No scheduled items.", className }: { items: readonly AgendaItem[]; emptyMessage?: string; className?: string }) {
  if (!items.length) return <p className={cn("eo-agenda-empty", className)} role="status">{emptyMessage}</p>;
  return <ol className={cn("eo-agenda-list", className)}>{items.map((item) => <li key={item.id}><span aria-hidden="true" className={cn("eo-agenda-list__marker", `eo-agenda-list__marker--${item.tone ?? "neutral"}`)} /><div className="eo-agenda-list__time">{item.time ?? "—"}</div><div className="eo-agenda-list__copy"><h3>{item.title}</h3>{item.description ? <p>{item.description}</p> : null}</div>{item.action ? <div className="eo-agenda-list__action">{item.action}</div> : null}</li>)}</ol>;
}
