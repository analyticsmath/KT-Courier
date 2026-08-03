import { cn } from "@/lib/utils/cn";
import type { SelectOption } from "@/types/ui";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  helpText?: string;
}

export function Select({
  options,
  placeholder,
  className,
  error,
  helpText,
  ...props
}: SelectProps) {
  return (
    <div className="w-full">
      <select
        className={cn(
          "w-full h-12 px-3 rounded-xl border bg-white text-[--kt-text] text-sm transition-colors duration-150 appearance-none",
          "border-[--kt-border] focus:border-[--kt-brand-blue] focus:outline-none focus:ring-2 focus:ring-[--kt-brand-blue]/20",
          error && "border-[--kt-red]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        aria-invalid={!!error}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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
