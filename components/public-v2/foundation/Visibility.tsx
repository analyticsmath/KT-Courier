import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type VisibilityProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: "div" | "span";
};

/**
 * Presentation-only desktop branch. CSS display rules remove hidden content
 * from the accessibility tree; do not use it to duplicate interactive flows.
 */
export function DesktopOnly({ children, as = "div", className, ...props }: VisibilityProps) {
  const Component: ElementType = as;

  return (
    <Component className={cn("kt-public-desktop-only", className)} {...props}>
      {children}
    </Component>
  );
}

/**
 * Presentation-only mobile branch. CSS display rules remove hidden content
 * from the accessibility tree; do not use it to duplicate interactive flows.
 */
export function MobileOnly({ children, as = "div", className, ...props }: VisibilityProps) {
  const Component: ElementType = as;

  return (
    <Component className={cn("kt-public-mobile-only", className)} {...props}>
      {children}
    </Component>
  );
}
