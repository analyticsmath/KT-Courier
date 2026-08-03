"use client";

import { cn } from "@/lib/utils/cn";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  filters: FilterOption[];
  active: string;
  onChange: (value: string) => void;
  className?: string;
}

export function FilterBar({ filters, active, onChange, className }: FilterBarProps) {
  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)} role="group" aria-label="Filter options">
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onChange(filter.value)}
          className={cn(
            "h-8 px-3.5 rounded-xl text-sm font-medium transition-colors",
            active === filter.value
              ? "bg-[--kt-brand-blue] text-white"
              : "bg-[--kt-surface] border border-[--kt-border] text-[--kt-text-soft] hover:border-[--kt-border-strong] hover:text-[--kt-text]"
          )}
          aria-pressed={active === filter.value}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
