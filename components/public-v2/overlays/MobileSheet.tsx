"use client";

import { AccessibleDialog, type AccessibleDialogProps } from "./AccessibleDialog";
import { cn } from "@/lib/utils/cn";

export type MobileSheetProps = AccessibleDialogProps;

/**
 * A public-only responsive adapter: a keyboard-accessible bottom sheet on
 * small screens and the same dialog treatment at larger screen sizes.
 */
export function MobileSheet({ className, ...props }: MobileSheetProps) {
  return <AccessibleDialog {...props} className={cn("kt-public-mobile-sheet", className)} />;
}
