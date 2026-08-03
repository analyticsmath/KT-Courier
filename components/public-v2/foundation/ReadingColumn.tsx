import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type ReadingColumnProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

/** A bounded text measure with intentionally limited local text rhythm. */
export function ReadingColumn({ children, className, ...props }: ReadingColumnProps) {
  return (
    <div className={cn("kt-public-reading-column", className)} {...props}>
      {children}
    </div>
  );
}
