import { cn } from "@/lib/utils/cn";

export type ProtectedStatusTone = "success" | "warning" | "danger" | "information" | "neutral" | "locked";

export function ProtectedStatus({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: ProtectedStatusTone;
  className?: string;
}) {
  return <span className={cn("eo-status", `eo-status--${tone}`, className)}>{label}</span>;
}
