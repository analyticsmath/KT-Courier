import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedFilterBar, ProtectedPagination } from "@/components/protected-v2/data/FilterAndPagination";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { CatalogAdministrationNav } from "@/components/protected-v2/commerce-admin/CommerceAdminNavigation";
import { CommerceLockNotice } from "@/components/protected-v2/commerce-admin/CommerceAdminPrimitives";
import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { listCatalogAdminOffers } from "@/lib/services/catalog-query.service";
import { storefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";

const PAGE_SIZE = 25;
const OFFER_FILTERS = ["", "DRAFT", "SUBMITTED", "NEEDS_CHANGES", "ACTIVE", "PAUSED", "OUT_OF_STOCK", "SUSPENDED", "ARCHIVED"] as const;
function buildHref(input: { status?: string; page?: number }) { const params = new URLSearchParams(); if (input.status) params.set("status", input.status); if (input.page && input.page > 1) params.set("page", String(input.page)); const query = params.toString(); return query ? `/admin/catalog/offers?${query}` : "/admin/catalog/offers"; }

export default async function AdminCatalogOffersPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireAdminPagePermission(PERMISSIONS.CATALOG_MODERATION_READ);
  const input = await searchParams; const status = OFFER_FILTERS.includes(input.status as typeof OFFER_FILTERS[number]) ? input.status : undefined; const page = Math.max(1, Number(input.page) || 1);
  const [offers, total] = await Promise.all([listCatalogAdminOffers({ page, pageSize: PAGE_SIZE, status }), prisma.storeCatalogOffer.count({ where: status ? { status: status as never } : undefined })]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Catalog administration" title="Store offers" description={`${total} source-backed store offer record${total === 1 ? "" : "s"}. No discount calculation or sales analytics is shown.`} />
    <CatalogAdministrationNav currentPath="/admin/catalog/offers" />
    {!storefrontPublicExposureAllowed() ? <CommerceLockNotice title="Storefront exposure is locked" description="Offer review evidence is visible, but this route does not claim public price, inventory, or storefront availability." /> : null}
    <ProtectedFilterBar activeFilterCount={Number(Boolean(status))} clearHref={status ? "/admin/catalog/offers" : undefined}><div aria-label="Offer status filters" className="eo-filter-chips">{OFFER_FILTERS.map((filter) => <Link aria-current={(status ?? "") === filter ? "page" : undefined} className={(status ?? "") === filter ? "is-active" : undefined} href={buildHref({ status: filter || undefined })} key={filter || "all"}>{filter ? presentCommerceStatus(filter).label : "All states"}</Link>)}</div></ProtectedFilterBar>
    <OperationalPanel title="Offer records" description="Ownership, canonical state, price version evidence, inventory record count, and publication state remain source-backed.">
      <EditorialTable caption="Store catalog offers" mobileMode="stack" rows={offers} emptyState={<ProtectedState kind="empty" title="No store offer records match this view" description="Adjust or clear the current server-backed state filter." />} columns={[
        { id: "store", header: "Store", priority: "primary", cell: (offer) => offer.store.name },
        { id: "sku", header: "Store SKU", priority: "primary", cell: (offer) => <span className="font-mono text-xs">{offer.storeSku}</span> },
        { id: "product", header: "Product", priority: "secondary", cell: (offer) => <Link className="eo-table-link" href={`/admin/catalog/products/${offer.productId}`}>{offer.product.title}<small>{offer.variant.title}</small></Link> },
        { id: "state", header: "Offer state", priority: "secondary", cell: (offer) => { const state = presentCommerceStatus(offer.status); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
        { id: "price", header: "Current price", priority: "secondary", cell: (offer) => offer.priceVersions[0] ? `${offer.priceVersions[0].amount.toString()} ${offer.priceVersions[0].currency}` : "No current record" },
        { id: "inventory", header: "Inventory records", priority: "optional", align: "end", cell: (offer) => offer.inventoryItem?.levels.length ?? 0 },
        { id: "publication", header: "Exposure state", priority: "optional", cell: (offer) => { const state = presentCommerceStatus(offer.publicationStatus); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
      ]} />
    </OperationalPanel>
    <ProtectedPagination currentPage={page} pageCount={pageCount} hrefForPage={(nextPage) => buildHref({ status, page: nextPage })} />
  </ProtectedPageFrame>;
}
