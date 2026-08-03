import { cn } from "@/lib/utils/cn";

export type ProtectedStateKind = "empty" | "unavailable" | "restricted" | "locked" | "error";

export function ProtectedState({
  kind,
  title,
  description,
  illustration,
  action,
  className,
}: {
  kind: ProtectedStateKind;
  title: string;
  description?: string;
  illustration?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("eo-state", `eo-state--${kind}`, className)}>
      {illustration ? <div className="eo-state__illustration">{illustration}</div> : null}
      <div className="eo-state__copy"><h2>{title}</h2>{description ? <p>{description}</p> : null}{action ? <div className="eo-state__action">{action}</div> : null}</div>
    </section>
  );
}
