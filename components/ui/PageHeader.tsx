import { cn } from "@/lib/utils/cn";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 flex-wrap",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--kt-signal-cobalt)] mb-1.5">
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl font-black text-[var(--kt-ink-navy)] tracking-normal leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-[var(--kt-text-muted)] leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  );
}
