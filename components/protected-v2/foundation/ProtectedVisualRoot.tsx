import { protectedFontVariables } from "@/app/fonts/protected-fonts";
import { cn } from "@/lib/utils/cn";

type ProtectedVisualRootProps = {
  children: React.ReactNode;
  className?: string;
};

/** Server boundary for the protected Editorial Operations visual system. */
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
