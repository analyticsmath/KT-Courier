import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type PublicSectionVariant = "default" | "compact" | "spacious" | "fullBleed";
export type PublicSectionTone = "primary" | "secondary" | "dark" | "transparent";

export type PublicSectionProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: "section" | "div";
  variant?: PublicSectionVariant;
  tone?: PublicSectionTone;
};

/**
 * Establishes neutral section rhythm and canvas tone without introducing a card
 * surface or page-specific composition.
 */
export function PublicSection({
  children,
  as = "section",
  className,
  tone = "primary",
  variant = "default",
  ...props
}: PublicSectionProps) {
  const Component: ElementType = as;

  return (
    <Component
      className={cn("kt-public-section", className)}
      data-kt-public-section-tone={tone}
      data-kt-public-section-variant={variant}
      {...props}
    >
      {children}
    </Component>
  );
}
