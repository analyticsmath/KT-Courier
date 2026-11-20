import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import {
  StoreCatalogNavigation,
  StorefrontAvailability,
} from "@/components/protected-v2/store/StoreCatalogNavigation";
import { getCurrentStoreForCatalogPage } from "@/lib/services/catalog-page.service";
import { listStoreCatalogOffers } from "@/lib/services/store-offer.service";
import { storeOfferReviewLabel } from "@/lib/catalog/store-offer-review";

export default async function StoreCatalogOffersPage() {
  await requireBusinessPage("/store/catalog/offers");
  const { store } = await getCurrentStoreForCatalogPage();
  const offers = await listStoreCatalogOffers(store.id, {
    page: 1,
    pageSize: 100,
  });
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Catalog"
        title="Store offers"
        description="The exact variants this store proposes to sell. Price and inventory are separate canonical evidence."
      />
      <StoreCatalogNavigation />
      {offers.length ? (
        <EditorialTable
          caption="Store catalog offers"
          mobileMode="stack"
          rows={offers.map((offer) => ({ id: offer.id, offer }))}
          columns={[
            {
              id: "sku",
              header: "Offer",
              priority: "primary",
              cell: ({ offer }) => (
                <Link
                  className="font-mono font-semibold"
                  href={`/store/catalog/offers/${offer.publicReference}`}
                >
                  {offer.storeSku}
                </Link>
              ),
            },
            {
              id: "product",
              header: "Product / variant",
              priority: "secondary",
              cell: ({ offer }) => (
                <div>
                  <p>{offer.product.title}</p>
                  <p className="mt-1 text-xs text-[var(--eo-text-muted)]">
                    {offer.variant.title}
                  </p>
                </div>
              ),
            },
            {
              id: "offer",
              header: "Offer state",
              priority: "secondary",
              cell: ({ offer }) => (
                <ProtectedStatus label={offer.status.replaceAll("_", " ")} />
              ),
            },
            {
              id: "review",
              header: "Independent review",
              priority: "secondary",
              cell: ({ offer }) => (
                <ProtectedStatus
                  label={storeOfferReviewLabel(
                    offer.status,
                    offer.approvedByUserId,
                  )}
                />
              ),
            },
            {
              id: "publication",
              header: "Publication",
              priority: "optional",
              cell: ({ offer }) => (
                <ProtectedStatus
                  label={offer.publicationStatus.replaceAll("_", " ")}
                />
              ),
            },
            {
              id: "inventory",
              header: "Inventory",
              priority: "optional",
              cell: ({ offer }) =>
                offer.inventoryItem?.trackingMode.replaceAll("_", " ") ??
                "Not established",
            },
          ]}
        />
      ) : (
        <ProtectedState
          kind="empty"
          title="No store offers are available"
          description="Create a canonical product draft before attaching a store offer."
          action={
            <Link
              className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] bg-[var(--eo-signal)] px-4 text-sm font-semibold text-white"
              href="/store/catalog/products/new"
            >
              New product
            </Link>
          }
        />
      )}
      <StorefrontAvailability />
    </ProtectedPageFrame>
  );
}
