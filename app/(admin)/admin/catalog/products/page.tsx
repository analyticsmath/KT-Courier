import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedFilterBar, ProtectedPagination } from "@/components/protected-v2/data/FilterAndPagination";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { CatalogAdministrationNav } from "@/components/protected-v2/commerce-admin/CommerceAdminNavigation";
import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { listCatalogAdminProducts } from "@/lib/services/catalog-query.service";
import { formatDateTime } from "@/lib/utils/formatters";

const PAGE_SIZE = 25;
const PRODUCT_FILTERS = ["", "DRAFT", "SUBMITTED", "NEEDS_CHANGES", "APPROVED", "ACTIVE", "SUSPENDED", "ARCHIVED"] as const;

function buildHref(input: { search?: string; status?: string; page?: number }) {
  const params = new URLSearchParams();
  if (input.search) params.set("search", input.search);
  if (input.status) params.set("status", input.status);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/admin/catalog/products?${query}` : "/admin/catalog/products";
}

export default async function AdminCatalogProductsPage({ searchParams }: { searchParams: Promise<{ search?: string; status?: string; page?: string }> }) {
  await requireAdminPagePermission(PERMISSIONS.CATALOG_MODERATION_READ);
  const input = await searchParams;
  const search = input.search?.trim().slice(0, 80) || "";
  const status = PRODUCT_FILTERS.includes(input.status as typeof PRODUCT_FILTERS[number]) ? input.status : undefined;
  const page = Math.max(1, Number(input.page) || 1);
  const where = { ...(status ? { status: status as never } : {}), ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}) };
  const [products, total] = await Promise.all([listCatalogAdminProducts({ page, pageSize: PAGE_SIZE, status, search: search || undefined }), prisma.catalogProduct.count({ where })]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilterCount = Number(Boolean(search)) + Number(Boolean(status));
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Catalog administration" title="Products" description={`${total} canonical product record${total === 1 ? "" : "s"}. Product search, state filters, and pagination are resolved on the server.`} />
    <CatalogAdministrationNav currentPath="/admin/catalog/products" />
    <ProtectedFilterBar activeFilterCount={activeFilterCount} clearHref={activeFilterCount ? "/admin/catalog/products" : undefined}>
      <form action="/admin/catalog/products" className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
        {status ? <input name="status" type="hidden" value={status} /> : null}
        <label className="eo-filter-label" htmlFor="catalog-product-search">Search products<input defaultValue={search} id="catalog-product-search" name="search" placeholder="Product title" /></label>
        <button className="eo-filter-submit" type="submit">Search</button>
      </form>
    </ProtectedFilterBar>
    <div aria-label="Product status filters" className="eo-filter-chips">{PRODUCT_FILTERS.map((filter) => <Link aria-current={(status ?? "") === filter ? "page" : undefined} className={(status ?? "") === filter ? "is-active" : undefined} href={buildHref({ search, status: filter || undefined })} key={filter || "all"}>{filter ? presentCommerceStatus(filter).label : "All states"}</Link>)}</div>
    <OperationalPanel title="Product records" description="Store ownership, category, canonical states, authoritative price evidence, media evidence, and modification time remain source-backed.">
      <EditorialTable caption="Catalog product records" mobileMode="stack" rows={products} emptyState={<ProtectedState kind="empty" title="No product records match this view" description="Adjust or clear the current server-backed filters." />} columns={[
        { id: "product", header: "Product", priority: "primary", cell: (product) => <div><Link className="eo-table-link" href={`/admin/catalog/products/${product.id}`}>{product.title}</Link><small>{product.publicReference}</small></div> },
        { id: "stores", header: "Store ownership", priority: "secondary", cell: (product) => product.offers.length ? product.offers.map((offer) => offer.store.name).join(", ") : "No store offer" },
        { id: "category", header: "Category", priority: "secondary", cell: (product) => product.primaryCategory.path },
        { id: "state", header: "Product state", priority: "primary", cell: (product) => { const state = presentCommerceStatus(product.status); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
        { id: "moderation", header: "Moderation", priority: "secondary", cell: (product) => { const state = presentCommerceStatus(product.moderationStatus); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
        { id: "price", header: "Price evidence", priority: "optional", cell: (product) => product.offers.find((offer) => offer.priceVersions[0])?.priceVersions[0] ? `${product.offers.find((offer) => offer.priceVersions[0])?.priceVersions[0]?.amount.toString()} ${product.offers.find((offer) => offer.priceVersions[0])?.priceVersions[0]?.currency}` : "No current record" },
        { id: "variants", header: "Variants", priority: "optional", align: "end", cell: (product) => product.variants.length },
        { id: "updated", header: "Modified", priority: "secondary", cell: (product) => <time>{formatDateTime(product.updatedAt)}</time> },
        { id: "open", header: "", priority: "optional", cell: (product) => <Link className="eo-table-action" href={`/admin/catalog/products/${product.id}`}>Open<span className="sr-only"> {product.title}</span></Link> },
      ]} />
    </OperationalPanel>
    <ProtectedPagination currentPage={page} pageCount={pageCount} hrefForPage={(nextPage) => buildHref({ search, status, page: nextPage })} />
  </ProtectedPageFrame>;
}
