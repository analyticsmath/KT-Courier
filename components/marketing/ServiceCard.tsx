import Link from "next/link";
import { cn } from "@/lib/utils/cn";

interface ServiceCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  bestFor?: string;
  cta?: string;
  href?: string;
  className?: string;
}

export function ServiceCard({
  icon,
  title,
  description,
  bestFor,
  cta = "Learn more",
  href = "/services",
  className,
}: ServiceCardProps) {
  return (
    <div className={cn(
      "bg-[var(--kt-surface)] border border-[var(--kt-border)] rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-[var(--kt-border-strong)] transition-all duration-150 flex flex-col",
      className
    )}>
      <div className="w-10 h-10 rounded-xl bg-[var(--kt-blue-soft)] flex items-center justify-center text-[var(--kt-brand-blue)] mb-4 flex-shrink-0">
        {icon}
      </div>
      {bestFor && (
        <p className="text-xs font-semibold text-[var(--kt-text-muted)] uppercase tracking-wider mb-1">
          Best for: {bestFor}
        </p>
      )}
      <h3 className="text-base font-bold text-[var(--kt-text)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--kt-text-muted)] leading-relaxed flex-1">{description}</p>
      {cta && (
        <Link
          href={href}
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--kt-brand-blue)] hover:text-[var(--kt-brand-blue-hover)] transition-colors"
        >
          {cta}
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  );
}
