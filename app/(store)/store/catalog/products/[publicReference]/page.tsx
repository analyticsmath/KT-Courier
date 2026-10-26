import { StoreCatalogDraftSetup } from "@/components/catalog/StoreCatalogDraftSetup";
import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import {
  StoreCatalogNavigation,
  StorefrontAvailability,
} from "@/components/protected-v2/store/StoreCatalogNavigation";
import { getCurrentStoreForCatalogPage } from "@/lib/services/catalog-page.service";
import { getStoreCatalogProduct } from "@/lib/services/catalog-product.service";
import { listCatalogPackaging } from "@/lib/services/catalog-packaging.service";
import { publicParcelProfiles } from "@/lib/commercial/parcel-profiles";
import { StorePackagingManager } from "@/components/catalog/StorePackagingManager";
import { StoreCatalogProductActions } from "@/components/catalog/StoreCatalogProductActions";
import { requireStoreCatalogPermission } from "@/lib/catalog/catalog-auth";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

export default async function StoreCatalogProductDetailPage({
  params,
}: {
  params: Promise<{ publicReference: string }>;
}) {
  await requireBusinessPage("/store/catalog/products/[publicReference]");
  const { store } = await getCurrentStoreForCatalogPage();
  const { publicReference } = await params;
  const product = await getStoreCatalogProduct(store.id, publicReference);
  const [packaging, packageLimits] = await Promise.all([listCatalogPackaging(store.id), publicParcelProfiles()]);
  const editable = product.scope === "STORE_PRIVATE" && product.sourceStoreId === store.id && ["DRAFT", "NEEDS_CHANGES"].includes(product.status);
  const [manageAccess, submitAccess] = await Promise.all([
    requireStoreCatalogPermission(PERMISSIONS.CATALOG_MANAGE),
    editable ? requireStoreCatalogPermission(PERMISSIONS.CATALOG_SUBMIT) : Promise.resolve(null),
  ]);
  const canManage = manageAccess !== null && !("response" in manageAccess);
  const canSubmit = submitAccess !== null && !("response" in submitAccess);
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        breadcrumbs={[
          { label: "Catalog", href: "/store/catalog" },
          { label: "Products", href: "/store/catalog/products" },
          { label: product.title },
        ]}
        title={product.title}
        description={product.publicReference}
        actions={
          <Link
            className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] border border-[var(--eo-line-strong)] px-3 text-sm font-semibold"
            href="/store/catalog/products"
          >
            Back to products
          </Link>
        }
      />
      <StoreCatalogNavigation />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <OperationalPanel
          title="Product identity"
          description="Canonical attributes are shown exactly as recorded for this store product."
          padding="compact"
        >
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-[var(--eo-text-muted)]">
                Category
              </dt>
              <dd className="mt-1">{product.primaryCategory.path}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[var(--eo-text-muted)]">
                Brand
              </dt>
              <dd className="mt-1">{product.brand?.name ?? "Unbranded"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[var(--eo-text-muted)]">
                Record scope
              </dt>
              <dd className="mt-1">{product.scope}</dd>
            </div>
          </dl>
        </OperationalPanel>
        <OperationalPanel title="Catalog state" padding="compact">
          <div className="grid gap-2">
            <ProtectedStatus label={product.status.replaceAll("_", " ")} />
            <ProtectedStatus
              label={product.moderationStatus.replaceAll("_", " ")}
            />
            <ProtectedStatus
              label={product.publicationStatus.replaceAll("_", " ")}
            />
          </div>
        </OperationalPanel>
      </div>
      {editable && (canManage || canSubmit) ? <OperationalPanel title="Update product draft" description="Save text changes, then submit the saved product for catalog review.">
        <StoreCatalogProductActions key={`${product.publicReference}:${product.version}`} product={{ publicReference: product.publicReference, version: product.version, title: product.title, description: product.description }} canManage={canManage} canSubmit={canSubmit} />
      </OperationalPanel> : null}
      {editable && canManage ? <OperationalPanel title="Complete product draft" description="Add photos and prepare a store offer for an imported or existing private draft."><StoreCatalogDraftSetup key={`${product.publicReference}:${product.version}`} product={{ id: product.id, publicReference: product.publicReference, version: product.version, variants: product.variants.map(variant => ({ id: variant.id, title: variant.title })), nextMediaOrder: Math.max(-1, ...product.media.map(item => item.displayOrder)) + 1, attachedMediaReferences: product.media.map(item => item.asset.publicReference) }} hasPrimary={product.media.some(item => item.role === "PRIMARY")} canCreateOffer={!product.offers.length} /></OperationalPanel> : null}
      {product.offers.length > 0 && <OperationalPanel title="Store offers"><ul className="space-y-2">{product.offers.map(offer => <li key={offer.publicReference}><Link className="underline" href={`/store/catalog/offers/${offer.publicReference}`}>{offer.storeSku} — manage price and listing</Link></li>)}</ul></OperationalPanel>}
      <OperationalPanel
        title="Variants"
        description="Each variant remains an individual canonical record."
        padding="compact"
      >
        <EditorialTable
          caption="Product variants"
          mobileMode="stack"
          rows={product.variants.map((variant) => ({
            id: variant.id,
            variant,
          }))}
          columns={[
            {
              id: "variant",
              header: "Variant",
              priority: "primary",
              cell: ({ variant }) => variant.title,
            },
            {
              id: "gtin",
              header: "GTIN",
              priority: "secondary",
              cell: ({ variant }) => variant.gtin ?? "Not provided",
            },
            {
              id: "state",
              header: "State",
              priority: "secondary",
              cell: ({ variant }) => (
                <ProtectedStatus label={variant.status.replaceAll("_", " ")} />
              ),
            },
          ]}
        />
      </OperationalPanel>
      {canManage && product.offers.length ? <OperationalPanel title="Delivery packaging" description="Supply measured package details for each sellable offer. KT Couriers reviews them before enabling delivery quotes."><StorePackagingManager initial={packaging} limits={packageLimits} offers={product.offers.map(offer => ({ publicReference: offer.publicReference, storeSku: offer.storeSku }))} /></OperationalPanel> : null}
      <StorefrontAvailability />
    </ProtectedPageFrame>
  );
}
