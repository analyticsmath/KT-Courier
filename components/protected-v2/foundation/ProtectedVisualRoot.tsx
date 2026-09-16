import { protectedFontVariables } from "@/app/fonts/protected-fonts";
import { cn } from "@/lib/utils/cn";

type ProtectedVisualRootProps = {
  children: React.ReactNode;
  className?: string;
};

/** Server boundary for KT Control Desk; the eo namespace is retained in place. */
export function ProtectedVisualRoot({ children, className }: ProtectedVisualRootProps) {
  return (
    <div
      className={cn("eo-root", protectedFontVariables, className)}
      data-kt-protected-system="editorial-operations-v1"
    >
      {children}
    </div>
  );
}
