import { useId } from "react";
import { cn } from "@/lib/utils/cn";

/** A data-free frame. Chart libraries and fixture series remain out of R13. */
export function ChartContainer({
  title,
  description,
  children,
  dataAlternative,
  className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  dataAlternative?: React.ReactNode;
  className?: string;
}) {
  const titleId = useId();
  return <section aria-labelledby={titleId} className={cn("eo-chart-container", className)}><header><h2 id={titleId}>{title}</h2>{description ? <p>{description}</p> : null}</header><div className="eo-chart-container__plot">{children ?? <p role="status">Source-backed visualisation will appear here when available.</p>}</div>{dataAlternative ? <div className="eo-chart-container__alternative"><h3>Data summary</h3>{dataAlternative}</div> : null}</section>;
}
