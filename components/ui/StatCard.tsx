import { cn } from "@/lib/utils/cn";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  accent?: "blue" | "amber" | "green" | "red" | "cyan" | "violet";
  className?: string;
}

const accentConfig = {
  blue: {
    icon: "bg-[var(--kt-cloud-blue)] text-[var(--kt-signal-cobalt)]",
    value: "text-[var(--kt-ink-navy)]",
    border: "border-l-[var(--kt-signal-cobalt)]",
  },
  amber: {
    icon: "bg-[var(--kt-amber-wash)] text-[var(--kt-solar-amber)]",
    value: "text-[var(--kt-ink-navy)]",
    border: "border-l-[var(--kt-solar-amber)]",
  },
  green: {
    icon: "bg-[var(--kt-mint-wash)] text-[var(--kt-teal-emerald)]",
    value: "text-[var(--kt-ink-navy)]",
    border: "border-l-[var(--kt-teal-emerald)]",
  },
  red: {
    icon: "bg-[rgba(220,38,38,0.08)] text-[var(--kt-signal-red)]",
    value: "text-[var(--kt-ink-navy)]",
    border: "border-l-[var(--kt-signal-red)]",
  },
  cyan: {
    icon: "bg-[var(--kt-cloud-blue)] text-[var(--kt-sky-cyan)]",
    value: "text-[var(--kt-ink-navy)]",
    border: "border-l-[var(--kt-sky-cyan)]",
  },
  violet: {
    icon: "bg-[var(--kt-lavender-haze)] text-[var(--kt-digital-indigo)]",
    value: "text-[var(--kt-ink-navy)]",
    border: "border-l-[var(--kt-digital-indigo)]",
  },
};

export function StatCard({
  label,
  value,
  icon,
  trend,
  trendUp,
  accent = "blue",
  className,
}: StatCardProps) {
  const config = accentConfig[accent];

  return (
    <div
      className={cn(
        "bg-[var(--kt-studio-white)] rounded-2xl border border-[var(--kt-soft-border)] border-l-4 p-5 shadow-[0_1px_8px_rgba(7,17,31,0.05)]",
        config.border,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--kt-text-muted)] mb-2">
            {label}
          </p>
          <p
            className={cn(
              "text-3xl font-black tabular-nums leading-none",
              config.value
            )}
          >
            {value}
          </p>
          {trend && (
            <p
              className={cn(
                "text-xs mt-2 font-semibold",
                trendUp
                  ? "text-[var(--kt-teal-emerald)]"
                  : "text-[var(--kt-text-muted)]"
              )}
            >
              {trend}
            </p>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              "p-3 rounded-xl flex-shrink-0",
              config.icon
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
