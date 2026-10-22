import Link from "next/link";
import type { Metadata } from "next";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedPagination } from "@/components/protected-v2/data/FilterAndPagination";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus, type ProtectedStatusTone } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getStoreStatusConfig } from "@/lib/constants/statuses";
import { listStores } from "@/lib/services/admin-stores.service";
import { StoreAccountStatusActions } from "@/components/admin/StoreAccountStatusActions";
import type { StoreStatus } from "@/types/db";

export const metadata: Metadata = { title: "Store administration" };
function tone(variant: string): ProtectedStatusTone { return variant === "green" ? "success" : variant === "amber" ? "warning" : variant === "red" ? "danger" : variant === "blue" ? "information" : "neutral"; }

const PAGE_SIZE = 25;
const STORE_FILTERS = ["PENDING", "ALL", "ACTIVE", "SUSPENDED", "DISABLED"] as const;
type StoreFilter = typeof STORE_FILTERS[number];

function filterHref(filter: StoreFilter, page = 1) {
  const params = new URLSearchParams();
  if (filter !== "PENDING") params.set("status", filter);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/stores?${query}` : "/admin/stores";
}

export default async function AdminStoresPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const user = await requireAdminPagePermission(PERMISSIONS.STORES_READ);
  const filters = await searchParams;
  const selectedFilter: StoreFilter = STORE_FILTERS.includes(filters.status as StoreFilter) ? filters.status as StoreFilter : "PENDING";
  const requestedPage = Number(filters.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 1 && (requestedPage - 1) * PAGE_SIZE <= 2_147_483_647 ? requestedPage : 1;
  const status = selectedFilter === "ALL" ? undefined : selectedFilter as StoreStatus;
  const [{ data: stores, total }, canApprove, canReviewSellerIdentity, canManageRates] = await Promise.all([
    listStores({ status, page, pageSize: PAGE_SIZE }),
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.STORES_APPROVE }),
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.LEGAL_DOCUMENTS_READ }),
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.PRICING_MANAGE }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="People and network" title="Store administration" description={`${total} ${selectedFilter === "PENDING" ? "vendor account" : "store account"}${total === 1 ? "" : "s"}${selectedFilter === "PENDING" ? " awaiting review" : " in this view"}.`} />
    <nav aria-label="Store account status filters" className="flex flex-wrap gap-2">
      {STORE_FILTERS.map((filter) => <Link aria-current={selectedFilter === filter ? "page" : undefined} className={`rounded-full border px-3 py-2 text-sm ${selectedFilter === filter ? "bg-[var(--kt-brand-navy)] text-white" : ""}`} href={filterHref(filter)} key={filter}>{filter === "PENDING" ? "Pending approval" : filter === "ALL" ? "All stores" : filter.toLowerCase()}</Link>)}
    </nav>
    <OperationalPanel title={selectedFilter === "PENDING" ? "Vendor approvals" : "Store directory"} description="Approving a store account opens its workspace. Seller identity, product catalog publication, pricing, inventory, and checkout each retain their own review and operational gates."><EditorialTable caption="Store administration directory" mobileMode="stack" rows={stores} emptyState={<ProtectedState kind="empty" title={selectedFilter === "PENDING" ? "No vendor accounts are waiting for approval" : "No stores match this view"} description="New store accounts will appear here when their canonical registration has been completed." />} columns={[
    { id: "store", header: "Store", priority: "primary", cell: (store) => <div><strong>{store.name}</strong><small>/{store.slug}</small></div> },
    { id: "owner", header: "Owner context", priority: "secondary", cell: (store) => store.ownerUser?.email ?? "Owner unavailable" },
    { id: "review", header: "Vendor dossier", priority: "primary", cell: (store) => <Link href={`/admin/stores/${encodeURIComponent(store.id)}`} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">Review business details</Link> },
    { id: "contact", header: "Contact", priority: "optional", cell: (store) => store.contactName ?? "Not supplied" },
    { id: "state", header: "Operational state", priority: "primary", cell: (store) => { const state = getStoreStatusConfig(store.status); return <ProtectedStatus label={state.label} tone={tone(state.variant)} />; } },
    ...(user.role === "SUPER_ADMIN" ? [{ id:"support", header:"Support", priority:"secondary" as const, cell:(store: {id:string})=><Link href={`/admin/business-support/${store.id}`} className="inline-flex min-h-11 items-center">Open support dashboard</Link> }] : []),
    { id: "storefront", header: "Storefront", priority: "secondary", cell: () => <ProtectedStatus label="Separate catalog review" tone="information" /> },
    ...(canManageRates ? [{ id: "deliveryRate", header: "Delivery pricing", priority: "secondary" as const, cell: (store: { id: string; status: StoreStatus }) => store.status === "ACTIVE" ? <Link href={`/admin/pricing?storeId=${encodeURIComponent(store.id)}`} className="inline-flex min-h-11 items-center">Set this store’s rate</Link> : "Activate store first" }] : []),
    { id: "seller", header: "Seller identity", priority: "secondary", cell: (store) => canReviewSellerIdentity ? <Link href={`/admin/stores/${store.id}/seller-identity`} className="inline-flex min-h-11 items-center">Review seller identity</Link> : "Separate legal-document review permission required" },
    ...(canApprove ? [{ id: "approval", header: "Account approval", priority: "primary" as const, cell: (store: { id: string; status: StoreStatus }) => store.status === "PENDING" ? <Link href={`/admin/stores/${encodeURIComponent(store.id)}`} className="inline-flex min-h-11 items-center font-semibold">Review before approval</Link> : <StoreAccountStatusActions storeId={store.id} status={store.status} /> }] : []),
  ]} /></OperationalPanel>
    <ProtectedPagination currentPage={page} pageCount={pageCount} hrefForPage={(nextPage) => filterHref(selectedFilter, nextPage)} />
  </ProtectedPageFrame>;
}
