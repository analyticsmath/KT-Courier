import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import { getStoreCommissionReadiness } from "@/lib/admin/store-commission-readiness";
import Link from "next/link";
import {
  MetricTile,
  OperationalPanel,
} from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import {
  StoreCatalogNavigation,
  StorefrontAvailability,
} from "@/components/protected-v2/store/StoreCatalogNavigation";
import {
  getCurrentStoreForCatalogPage,
  getStoreCatalogPageSummary,
} from "@/lib/services/catalog-page.service";

export default async function StoreCatalogPage() {
  await requireBusinessPage("/store/catalog");
  const { store } = await getCurrentStoreForCatalogPage();
  const [summary, commissionReadiness] = await Promise.all([
    getStoreCatalogPageSummary(store.id),
    getStoreCommissionReadiness(store.id),
  ]);
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Catalog"
        title="Product Catalog"
        description="Add products, prepare your listings, set prices and record stock. Review and publication are required before products appear in the marketplace."
        actions={
          <Link
            className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] bg-[var(--eo-signal)] px-4 text-sm font-semibold text-white"
            href="/store/catalog/products/new"
          >
            Add product
          </Link>
        }
      />
      <StoreCatalogNavigation />
      {store.status === "PENDING" ? (
        <div role="status" className="rounded-[var(--eo-radius-panel)] border border-[var(--eo-border)] p-4 text-sm text-[var(--eo-text-secondary)]">
          Business verification is pending. You can prepare product drafts, images, prices and stock now. Products become public only after the business is approved and the catalog passes moderation and publication checks.
        </div>
      ) : null}
      {store.status === "ACTIVE" && !commissionReadiness.ready ? (
        <div role="status" className="rounded-[var(--eo-radius-panel)] border border-[var(--eo-border)] p-4 text-sm text-[var(--eo-text-secondary)]">
          <p className="font-semibold text-[var(--eo-text)]">Marketplace checkout setup is awaiting KT Couriers approval.</p>
          <p className="mt-2">You can continue preparing and publishing approved products, but customers cannot finish purchasing from this store until KT Couriers activates the independently reviewed store commission agreement. No commission is deducted without an approved policy.</p>
          <Link className="mt-3 inline-block font-semibold underline underline-offset-4" href="/store/support">Request checkout activation from KT Couriers support</Link>
        </div>
      ) : null}
      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Catalog summary"
      >
        <MetricTile
          label="Products"
          value={summary.products}
          description="Products in your catalog"
        />
        <MetricTile
          label="Offers"
          value={summary.offers}
          description="Listings with their own SKU and price"
        />
        <MetricTile
          label="Open imports"
          value={summary.imports}
          description="In-progress catalog import jobs"
        />
        <MetricTile
          label="Needs review"
          value={summary.moderation}
          description="Open catalog moderation records"
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <OperationalPanel
          title="Catalog workspace"
          description="Prepare the product details first, then complete its price, stock and packaging before review."
          padding="compact"
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-[var(--eo-text-muted)]">
                Inventory locations
              </dt>
              <dd className="mt-1 font-semibold text-[var(--eo-text)]">
                {summary.locations}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-[var(--eo-text-muted)]">
                Next action
              </dt>
              <dd className="mt-1 text-[var(--eo-text-secondary)]">
                <Link className="underline underline-offset-4" href={summary.products ? "/store/catalog/products" : "/store/catalog/products/new"}>{summary.products ? "Review your products and complete their listings" : "Add your first product"}</Link>
              </dd>
            </div>
          </dl>
        </OperationalPanel>
        <StorefrontAvailability />
      </div>
    </ProtectedPageFrame>
  );
}
