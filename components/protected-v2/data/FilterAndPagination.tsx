import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export function ProtectedFilterBar({ children, activeFilterCount = 0, clearHref, className }: { children: React.ReactNode; activeFilterCount?: number; clearHref?: string; className?: string }) {
  return <div className={cn("eo-filter-bar", className)}><div className="eo-filter-bar__controls">{children}</div>{activeFilterCount > 0 ? <span className="eo-filter-bar__count">{activeFilterCount} active {activeFilterCount === 1 ? "filter" : "filters"}</span> : null}{clearHref ? <Link className="eo-filter-bar__clear" href={clearHref}>Clear filters</Link> : null}</div>;
}

export function ProtectedPagination({ currentPage, pageCount, hrefForPage, className }: { currentPage: number; pageCount: number; hrefForPage: (page: number) => string; className?: string }) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  return <nav aria-label="Pagination" className={cn("eo-pagination", className)}>{currentPage > 1 ? <Link href={hrefForPage(currentPage - 1)}>Previous</Link> : <span aria-disabled="true">Previous</span>}{pages.map((page) => <Link aria-current={page === currentPage ? "page" : undefined} className={page === currentPage ? "is-current" : undefined} href={hrefForPage(page)} key={page}>{page}</Link>)}{currentPage < pageCount ? <Link href={hrefForPage(currentPage + 1)}>Next</Link> : <span aria-disabled="true">Next</span>}</nav>;
}
