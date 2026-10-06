"use client";

import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils/cn";

/** A native, keyboard-accessible picker with a visible Choose File control. */
export function FileInput({ className, ref, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { ref?: Ref<HTMLInputElement> }) {
  return <input {...props} ref={ref} type="file" className={cn(
    "block min-h-12 w-full max-w-full rounded-xl border border-[var(--kt-border-strong)] bg-white p-2 text-sm text-[var(--kt-text-soft)] file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[var(--kt-brand-blue)] file:px-4 file:py-2 file:font-bold file:text-white hover:file:bg-[var(--kt-brand-blue-hover)] disabled:cursor-not-allowed disabled:bg-[var(--kt-surface-muted)] disabled:file:bg-[var(--kt-border-strong)] disabled:file:text-[var(--kt-text-soft)]",
    className,
  )} />;
}
