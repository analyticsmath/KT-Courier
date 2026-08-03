import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { ParcelDeskIllustration } from "@/components/protected-v2/illustrations/ParcelDeskIllustration";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StoreCatalogNavigation } from "@/components/protected-v2/store/StoreCatalogNavigation";
import { getCurrentStoreForCatalogPage } from "@/lib/services/catalog-page.service";
import { listStoreCatalogProducts } from "@/lib/services/catalog-product.service";

export default async function StoreCatalogProductsPage({ searchParams }: { searchParams: Promise<{ search?: string; status?: string }> }) {
  const { store } = await getCurrentStoreForCatalogPage();
  const filters = await searchParams;
  const products = await listStoreCatalogProducts(store.id, { page: 1, pageSize: 100, search: filters.search, status: filters.status });
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Catalog" title="Products" description="Canonical, store-owned product records. Product publication and public storefront availability are not inferred here." actions={<Link className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] bg-[var(--eo-signal)] px-4 text-sm font-semibold text-white" href="/store/catalog/products/new">New product</Link>} />
    <StoreCatalogNavigation />
    <OperationalPanel title="Find products" padding="compact"><form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]" role="search"><label className="sr-only" htmlFor="catalog-search">Search products</label><input className="min-h-11 rounded-[var(--eo-radius-control)] border border-[var(--eo-line-strong)] bg-white px-3 text-sm" defaultValue={filters.search} id="catalog-search" name="search" placeholder="Title or product reference" /><label className="sr-only" htmlFor="catalog-status">Filter by moderation status</label><select className="min-h-11 rounded-[var(--eo-radius-control)] border border-[var(--eo-line-strong)] bg-white px-3 text-sm" defaultValue={filters.status ?? ""} id="catalog-status" name="status"><option value="">All statuses</option>{["DRAFT", "SUBMITTED", "NEEDS_CHANGES", "APPROVED", "SUSPENDED", "ARCHIVED"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select><button className="min-h-11 rounded-[var(--eo-radius-control)] border border-[var(--eo-line-strong)] px-4 text-sm font-semibold" type="submit">Apply filters</button></form></OperationalPanel>
    {products.length ? <EditorialTable caption="Store catalog products" mobileMode="stack" rows={products.map((product) => ({ id: product.id, product }))} columns={[
      { id: "product", header: "Product", priority: "primary", cell: ({ product }) => <div><Link className="font-semibold text-[var(--eo-text)]" href={`/store/catalog/products/${product.publicReference}`}>{product.title}</Link><p className="mt-1 font-mono text-xs text-[var(--eo-text-muted)]">{product.publicReference}</p></div> },
      { id: "category", header: "Category", priority: "secondary", cell: ({ product }) => product.primaryCategory.name },
      { id: "variants", header: "Variants", align: "end", priority: "optional", cell: ({ product }) => product.variants.length },
      { id: "state", header: "State", priority: "secondary", cell: ({ product }) => <ProtectedStatus label={product.moderationStatus.replaceAll("_", " ")} /> },
    ]} /> : <ProtectedState kind="empty" title="No catalog products match these filters" description="Create a product draft only when the required catalog type and category are available." illustration={<ParcelDeskIllustration className="h-24 w-32" />} action={<Link className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] bg-[var(--eo-signal)] px-4 text-sm font-semibold text-white" href="/store/catalog/products/new">New product</Link>} />}
  </ProtectedPageFrame>;
}
