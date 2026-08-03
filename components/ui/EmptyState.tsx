import { Button } from "./Button";
import { cn } from "@/lib/utils/cn";
import type { EmptyStateProps } from "@/types/ui";

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps & { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-14 px-6",
        className
      )}
    >
      {icon ? (
        <div className="mb-5 text-[var(--kt-text-muted)] opacity-50">{icon}</div>
      ) : (
        <div className="mb-5 w-14 h-14 rounded-2xl bg-[var(--kt-cool-gray)] flex items-center justify-center mx-auto">
          <svg
            className="w-7 h-7 text-[var(--kt-text-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        </div>
      )}
      <h3 className="text-base font-bold text-[var(--kt-ink-navy)] mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--kt-text-muted)] max-w-xs mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {action &&
        (action.href ? (
          <Button href={action.href} variant="primary" size="sm">
            {action.label}
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
