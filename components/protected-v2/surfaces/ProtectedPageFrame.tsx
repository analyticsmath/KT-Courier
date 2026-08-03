import { cn } from "@/lib/utils/cn";

export function ProtectedPageFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("eo-page-frame", className)}>{children}</div>;
}

export function ProtectedContentGrid({
  children,
  contextRail,
  className,
}: {
  children: React.ReactNode;
  contextRail?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("eo-content-grid", Boolean(contextRail) && "eo-content-grid--with-rail", className)}>
      <div className="eo-content-grid__main">{children}</div>
      {contextRail ? <aside aria-label="Contextual information" className="eo-content-grid__rail">{contextRail}</aside> : null}
    </div>
  );
}
