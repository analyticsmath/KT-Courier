import { cn } from "@/lib/utils/cn";
import type { BadgeVariant } from "@/types/ui";
import type { OrderStatus, PaymentStatus } from "@/types/order";
import { getOrderStatusConfig, getPaymentStatusConfig } from "@/lib/constants/statuses";

const variantClasses: Record<BadgeVariant, string> = {
  slate: "bg-[var(--kt-cool-gray)] text-[var(--kt-text-muted)]",
  amber: "bg-[var(--kt-amber-wash)] text-[var(--kt-copper-flame)]",
  blue: "bg-[var(--kt-cloud-blue)] text-[var(--kt-signal-cobalt)]",
  cyan: "bg-[var(--kt-cloud-blue)] text-[var(--kt-sky-cyan)]",
  green: "bg-[var(--kt-mint-wash)] text-[var(--kt-teal-emerald)]",
  red: "bg-[rgba(220,38,38,0.08)] text-[var(--kt-signal-red)]",
  gray: "bg-[var(--kt-cool-gray)] text-[var(--kt-text-muted)]",
  purple: "bg-[var(--kt-lavender-haze)] text-[var(--kt-digital-indigo)]",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "slate", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "badge-base",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = getOrderStatusConfig(status);
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  className?: string;
}

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  const config = getPaymentStatusConfig(status);
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
