import { cn } from "@/lib/utils/cn";

type OperationalPanelProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  tone?: "default" | "subtle" | "dark";
  padding?: "compact" | "default" | "spacious";
  className?: string;
};

export function OperationalPanel({
  children,
  title,
  description,
  action,
  tone = "default",
  padding = "default",
  className,
}: OperationalPanelProps) {
  return (
    <section className={cn("eo-panel", `eo-panel--${tone}`, `eo-panel--${padding}`, className)}>
      {title || description || action ? (
        <header className="eo-panel__header">
          <div className="min-w-0">{title ? <h2 className="eo-panel__title">{title}</h2> : null}{description ? <p className="eo-panel__description">{description}</p> : null}</div>
          {action ? <div className="eo-panel__action">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function MetricTile({
  label,
  value,
  description,
  icon,
  className,
}: {
  label: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("eo-metric-tile", className)}>
      <div className="eo-metric-tile__head"><p>{label}</p>{icon ? <span aria-hidden="true" className="eo-metric-tile__icon">{icon}</span> : null}</div>
      <strong className="eo-metric-tile__value">{value}</strong>
      {description ? <p className="eo-metric-tile__description">{description}</p> : null}
    </section>
  );
}
