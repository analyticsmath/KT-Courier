import { cn } from "@/lib/utils/cn";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  helpText?: string;
}

export function Input({ className, error, helpText, ...props }: InputProps) {
  return (
    <div className="w-full">
      <input
        className={cn(
          "w-full h-12 px-3 rounded-xl border bg-white text-[--kt-text] placeholder:text-[--kt-text-muted] text-sm transition-colors duration-150",
          "border-[--kt-border] focus:border-[--kt-brand-blue] focus:outline-none focus:ring-2 focus:ring-[--kt-brand-blue]/20",
          error && "border-[--kt-red] focus:border-[--kt-red] focus:ring-[--kt-red]/20",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[--kt-surface-muted]",
          className
        )}
        aria-invalid={!!error}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-[--kt-red]" role="alert">
          {error}
        </p>
      )}
      {helpText && !error && (
        <p className="mt-1 text-xs text-[--kt-text-muted]">{helpText}</p>
      )}
    </div>
  );
}
