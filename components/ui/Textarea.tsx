import { cn } from "@/lib/utils/cn";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  helpText?: string;
}

export function Textarea({ className, error, helpText, ...props }: TextareaProps) {
  return (
    <div className="w-full">
      <textarea
        className={cn(
          "w-full min-h-[120px] px-3 py-2.5 rounded-xl border bg-white text-[--kt-text] placeholder:text-[--kt-text-muted] text-sm transition-colors duration-150 resize-y",
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
