import { cn } from "@/lib/utils/cn";

type CardVariant = "default" | "elevated" | "tinted" | "navy" | "surface" | "outline";
type CardAccent = "blue" | "amber" | "green" | "violet" | "red" | "cyan";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: CardVariant;
  accent?: CardAccent;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

const tintedClasses: Record<CardAccent, string> = {
  blue: "bg-[var(--kt-cloud-blue)] border border-[rgba(37,99,235,0.14)]",
  amber: "bg-[var(--kt-amber-wash)] border border-[rgba(245,158,11,0.18)]",
  green: "bg-[var(--kt-mint-wash)] border border-[rgba(5,150,105,0.14)]",
  violet: "bg-[var(--kt-lavender-haze)] border border-[rgba(79,70,229,0.14)]",
  red: "bg-[rgba(220,38,38,0.06)] border border-[rgba(220,38,38,0.14)]",
  cyan: "bg-[var(--kt-cloud-blue)] border border-[rgba(2,132,199,0.14)]",
};

const variantBase: Record<CardVariant, string> = {
  default:
    "bg-[var(--kt-studio-white)] border border-[var(--kt-soft-border)] shadow-[0_1px_8px_rgba(7,17,31,0.06)]",
  elevated:
    "bg-[var(--kt-studio-white)] shadow-[0_8px_32px_rgba(7,17,31,0.09)] ring-1 ring-[var(--kt-soft-border)]/60",
  tinted: "", // filled by accent lookup
  navy:
    "bg-[var(--kt-ink-navy)] text-white border border-white/10",
  surface:
    "bg-[var(--kt-cool-gray)] border border-[var(--kt-soft-border)]",
  outline:
    "bg-transparent border border-[var(--kt-soft-border)]",
};

export function Card({
  children,
  className,
  variant = "default",
  accent = "blue",
  padding = "md",
}: CardProps) {
  const variantClass =
    variant === "tinted" ? tintedClasses[accent] : variantBase[variant];

  return (
    <div
      className={cn(
        "rounded-2xl",
        variantClass,
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
