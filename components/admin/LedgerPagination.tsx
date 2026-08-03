import Link from "next/link";

function hrefWithPage(
  pathname: string,
  searchParams: Record<string, string | string[] | undefined>,
  pageParameter: string,
  page: number
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string" && value) query.set(key, value);
    else if (Array.isArray(value) && value[0]) query.set(key, value[0]);
  }
  query.set(pageParameter, String(page));
  return `${pathname}?${query.toString()}`;
}

export function LedgerPagination({
  pathname,
  searchParams,
  pageParameter,
  page,
  totalPages,
  label,
}: {
  pathname: string;
  searchParams: Record<string, string | string[] | undefined>;
  pageParameter: string;
  page: number;
  totalPages: number;
  label: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-4 text-sm">
      {page > 1 ? (
        <Link className="font-semibold text-[var(--kt-signal-cobalt)]" href={hrefWithPage(pathname, searchParams, pageParameter, page - 1)}>
          Previous page
        </Link>
      ) : <span className="text-[var(--kt-text-muted)]" aria-disabled="true">Previous page</span>}
      <span className="text-[var(--kt-text-muted)]">Page {page} of {totalPages}</span>
      {page < totalPages ? (
        <Link className="font-semibold text-[var(--kt-signal-cobalt)]" href={hrefWithPage(pathname, searchParams, pageParameter, page + 1)}>
          Next page
        </Link>
      ) : <span className="text-[var(--kt-text-muted)]" aria-disabled="true">Next page</span>}
    </nav>
  );
}

