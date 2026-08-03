"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type { ButtonVariant, ButtonSize } from "@/types/ui";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--kt-brand-blue)] text-white hover:bg-[var(--kt-brand-blue-hover)] active:scale-[0.98] shadow-sm",
  secondary:
    "bg-white text-[var(--kt-brand-navy)] border border-[var(--kt-border-strong)] hover:bg-[var(--kt-surface-muted)] active:scale-[0.98]",
  ghost:
    "bg-transparent text-[var(--kt-text-soft)] hover:bg-[var(--kt-surface-muted)] active:scale-[0.98]",
  danger:
    "bg-[var(--kt-red)] text-white hover:bg-red-700 active:scale-[0.98] shadow-sm",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-12 px-3 text-sm", // 48px target
  md: "h-[52px] px-5 text-sm", // 52px target
  lg: "h-14 px-7 text-base", // 56px target
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  href,
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-extrabold transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--kt-brand-blue)] focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none";

  const classes = cn(
    base,
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-1 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
