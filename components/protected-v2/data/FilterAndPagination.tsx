import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export function ProtectedFilterBar({ children, activeFilterCount = 0, clearHref, className }: { children: React.ReactNode; activeFilterCount?: number; clearHref?: string; className?: string }) {
  return <div className={cn("eo-filter-bar", className)}><div className="eo-filter-bar__controls">{children}</div>{activeFilterCount > 0 ? <span className="eo-filter-bar__count">{activeFilterCount} active {activeFilterCount === 1 ? "filter" : "filters"}</span> : null}{clearHref ? <Link className="eo-filter-bar__clear" href={clearHref}>Clear filters</Link> : null}</div>;
}

export type PaginationItem = number | "ellipsis";

/** Bounded pagination avoids rendering hundreds of page links for large directories. */
export function getVisiblePaginationItems(currentPage: number, pageCount: number): PaginationItem[] {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) return [];
  const current = Math.max(1, Math.min(pageCount, Number.isSafeInteger(currentPage) ? currentPage : 1));
  const selected = new Set([1, pageCount, current - 1, current, current + 1].filter((page) => page >= 1 && page <= pageCount));
  const ordered = [...selected].sort((a, b) => a - b);
  const visible: PaginationItem[] = [];
  for (const page of ordered) {
    const previous = visible.at(-1);
    if (typeof previous === "number" && page - previous === 2) visible.push(previous + 1);
    else if (typeof previous === "number" && page - previous > 2) visible.push("ellipsis");
    visible.push(page);
  }
  return visible;
}

export function ProtectedPagination({ currentPage, pageCount, hrefForPage, className }: { currentPage: number; pageCount: number; hrefForPage: (page: number) => string; className?: string }) {
  if (pageCount <= 1) return null;
  const page = Math.max(1, Math.min(pageCount, currentPage));
  const pages = getVisiblePaginationItems(page, pageCount);
  return (
    <nav aria-label="Pagination" className={cn("eo-pagination", className)}>
      <span className="eo-pagination__summary">Page {page} of {pageCount}</span>
      <div className="eo-pagination__links">
        {page > 1 ? <Link aria-label="Previous page" href={hrefForPage(page - 1)}>Previous</Link> : <span aria-disabled="true">Previous</span>}
        {pages.map((item, index) => item === "ellipsis"
          ? <span aria-hidden="true" className="eo-pagination__ellipsis" key={`ellipsis-${index}`}>…</span>
          : <Link aria-label={`Page ${item}`} aria-current={item === page ? "page" : undefined} className={item === page ? "is-current" : undefined} href={hrefForPage(item)} key={item}>{item}</Link>)}
        {page < pageCount ? <Link aria-label="Next page" href={hrefForPage(page + 1)}>Next</Link> : <span aria-disabled="true">Next</span>}
      </div>
    </nav>
  );
}
