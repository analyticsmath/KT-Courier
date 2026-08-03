import { cn } from "@/lib/utils/cn";

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ children, required, className, ...props }: LabelProps) {
  return (
    <label
      className={cn("block text-sm font-medium text-[--kt-text-soft] mb-1.5", className)}
      {...props}
    >
      {children}
      {required && (
        <span className="ml-0.5 text-[--kt-red]" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}
