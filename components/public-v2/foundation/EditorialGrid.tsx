import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type EditorialGridProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

/** Four, eight, and twelve-column grid for future editorial placement. */
export function EditorialGrid({ children, className, ...props }: EditorialGridProps) {
  return (
    <div className={cn("kt-public-editorial-grid", className)} {...props}>
      {children}
    </div>
  );
}
