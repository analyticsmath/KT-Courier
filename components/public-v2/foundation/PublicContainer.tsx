import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type PublicContainerVariant = "content" | "visual" | "reading" | "full";

export type PublicContainerProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: "div" | "main" | "article";
  variant?: PublicContainerVariant;
};

/** A width and gutter primitive for future public compositions. */
export function PublicContainer({
  children,
  as = "div",
  className,
  variant = "content",
  ...props
}: PublicContainerProps) {
  const Component: ElementType = as;

  return (
    <Component
      className={cn("kt-public-container", className)}
      data-kt-public-container={variant}
      {...props}
    >
      {children}
    </Component>
  );
}
