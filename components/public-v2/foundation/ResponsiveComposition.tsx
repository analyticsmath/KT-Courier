import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type ResponsiveCompositionPurpose = "decorative" | "editorial";

export type ResponsiveCompositionProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  purpose: ResponsiveCompositionPurpose;
};

/**
 * Groups an intentional desktop/mobile editorial treatment. It is not suitable
 * for duplicate forms, mutations, or other critical interactive workflows.
 */
export function ResponsiveComposition({
  children,
  className,
  purpose,
  ...props
}: ResponsiveCompositionProps) {
  return (
    <div
      className={cn("kt-public-responsive-composition", className)}
      data-kt-public-composition-purpose={purpose}
      {...props}
    >
      {children}
    </div>
  );
}
