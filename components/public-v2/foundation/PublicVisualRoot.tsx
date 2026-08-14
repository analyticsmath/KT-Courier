import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type PublicVisualRootProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "main";
};

/**
 * Establishes the Editorial Freight token boundary for public and auth routes.
 * It intentionally applies no visual styles to existing route content.
 */
export function PublicVisualRoot({
  children,
  className,
  as = "div",
}: PublicVisualRootProps) {
  const Component: ElementType = as;

  return (
    <Component
      className={cn(className)}
      data-kt-signature="v2"
      data-kt-visual-system="editorial-freight-v1"
    >
      {children}
    </Component>
  );
}
