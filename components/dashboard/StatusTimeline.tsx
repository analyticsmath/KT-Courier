import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/formatters";
import type { TimelineEvent } from "@/types/order";

interface StatusTimelineProps {
  events: TimelineEvent[];
}

export function StatusTimeline({ events }: StatusTimelineProps) {
  return (
    <ol className="space-y-4" aria-label="Delivery timeline">
      {events.map((event, index) => (
        <li key={index} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5",
                event.completed
                  ? "bg-[--kt-brand-blue]"
                  : event.current
                  ? "border-2 border-[--kt-amber] bg-[--kt-amber-soft]"
                  : "border-2 border-[--kt-border] bg-white"
              )}
              aria-hidden="true"
            >
              {event.completed && (
                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </span>
            {index < events.length - 1 && (
              <span
                className={cn(
                  "w-px flex-1 mt-1",
                  event.completed ? "bg-[--kt-brand-blue]" : "bg-[--kt-border]"
                )}
                style={{ minHeight: 20 }}
                aria-hidden="true"
              />
            )}
          </div>
          <div className="pb-4 flex-1">
            <p
              className={cn(
                "text-sm font-semibold",
                event.completed || event.current ? "text-[--kt-text]" : "text-[--kt-text-muted]"
              )}
            >
              {event.label}
              {event.current && (
                <span className="ml-2 text-xs text-[var(--kt-copper-flame)] font-semibold">(Current)</span>
              )}
            </p>
            {event.timestamp && (
              <p className="text-xs text-[--kt-text-muted] mt-0.5">
                {formatDateTime(event.timestamp)}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
