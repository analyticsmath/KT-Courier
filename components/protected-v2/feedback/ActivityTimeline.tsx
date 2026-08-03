import { cn } from "@/lib/utils/cn";
import type { ProtectedStatusTone } from "./ProtectedStatus";

export type ActivityTimelineItem = {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
  tone?: ProtectedStatusTone;
};

export function ActivityTimeline({ items, ariaLabel = "Activity timeline", className }: { items: readonly ActivityTimelineItem[]; ariaLabel?: string; className?: string }) {
  return (
    <ol aria-label={ariaLabel} className={cn("eo-timeline", className)}>
      {items.map((item) => <li className="eo-timeline__item" key={item.id}><span aria-hidden="true" className={cn("eo-timeline__marker", `eo-timeline__marker--${item.tone ?? "neutral"}`)} /><div><h3>{item.title}</h3>{item.description ? <p>{item.description}</p> : null}{item.timestamp ? <time>{item.timestamp}</time> : null}</div></li>)}
    </ol>
  );
}
