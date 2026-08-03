import { cn } from "@/lib/utils/cn";
import { OperationalPanel } from "../surfaces/OperationalPanel";
import { ProtectedPageFrame } from "../surfaces/ProtectedPageFrame";

/**
 * Small protected-v2 adapters for R21 route bodies that already own their
 * server query and action contract. They deliberately contain presentation
 * only: no fetching, permission evaluation, or client-side lifecycle logic.
 */
export function AdministrationRouteFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <ProtectedPageFrame className={cn("space-y-6", className)}>{children}</ProtectedPageFrame>;
}

export function AdministrationPanel({
  children,
  className,
  variant,
  accent,
  padding = "default",
  mobileMode = "BOUNDED_HORIZONTAL_TABLE",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "tinted" | "navy" | "surface" | "outline";
  accent?: "blue" | "amber" | "green" | "violet" | "red" | "cyan";
  padding?: "none" | "sm" | "md" | "lg" | "compact" | "default" | "spacious";
  /** Legacy server tables retain their authority while gaining a bounded mobile overflow policy. */
  mobileMode?: "BOUNDED_HORIZONTAL_TABLE";
}) {
  const tone = variant === "navy" ? "dark" : variant === "surface" || variant === "tinted" ? "subtle" : "default";
  const protectedPadding = padding === "none" || padding === "sm" || padding === "compact" ? "compact" : padding === "lg" || padding === "spacious" ? "spacious" : "default";
  const accentClass = accent ? `administration-panel--${accent}` : undefined;
  return <div data-mobile-mode={mobileMode}><OperationalPanel className={cn(accentClass, className)} padding={protectedPadding} tone={tone}>{children}</OperationalPanel></div>;
}
