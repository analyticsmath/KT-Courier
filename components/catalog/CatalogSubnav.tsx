import Link from "next/link";

export function CatalogSubnav({ admin = false }: { admin?: boolean }) {
  const items = admin
    ? [["Overview", "/admin/catalog"], ["Categories", "/admin/catalog/categories"], ["Product Types", "/admin/catalog/product-types"], ["Products", "/admin/catalog/products"], ["Offers", "/admin/catalog/offers"], ["Media", "/admin/catalog/media"], ["Moderation", "/admin/catalog/moderation"], ["Duplicates", "/admin/catalog/duplicates"]]
    : [["Overview", "/store/catalog"], ["Products", "/store/catalog/products"], ["Offers", "/store/catalog/offers"], ["Media", "/store/catalog/media"], ["Inventory", "/store/catalog/inventory"], ["Modifiers", "/store/catalog/modifiers"], ["Imports", "/store/catalog/imports"]];
  return <nav aria-label={admin ? "Catalog administration" : "Store catalog"} className="flex gap-2 overflow-x-auto pb-1">{items.map(([label, href]) => <Link key={href} href={href} className="min-h-11 whitespace-nowrap rounded-xl border border-[var(--kt-soft-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--kt-ink-navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kt-brand-blue)]">{label}</Link>)}</nav>;
}

export function CatalogLockBanner() {
  return <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="status"><strong>Publication locked.</strong> Drafting and review are available; public product, offer, price and product-type activation remain blocked until Phase 26.5. <span className="font-mono text-xs">CONSOLIDATED_VALIDATION_NOT_APPROVED</span></div>;
}

export function CatalogStatus({ value }: { value: string }) {
  return <span className="inline-flex min-h-7 items-center rounded-full bg-[var(--kt-surface-muted)] px-3 py-1 text-xs font-extrabold text-[var(--kt-ink-navy)]"><span className="sr-only">Status: </span>{value.replaceAll("_", " ")}</span>;
}
