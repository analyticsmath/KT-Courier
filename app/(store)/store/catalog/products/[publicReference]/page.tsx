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
  const editable = product.scope === "STORE_PRIVATE" && product.sourceStoreId === store.id && ["DRAFT", "NEEDS_CHANGES"].includes(product.status);
  const [manageAccess, submitAccess] = editable ? await Promise.all([
    requireStoreCatalogPermission(PERMISSIONS.CATALOG_MANAGE),
    requireStoreCatalogPermission(PERMISSIONS.CATALOG_SUBMIT),
  ]) : [null, null];
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
                Product type
              </dt>
              <dd className="mt-1">
                {product.productTypeDefinition.name} v
                {product.productTypeVersionNumber}
              </dd>
            </div>
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
      <StorefrontAvailability />
    </ProtectedPageFrame>
  );
}
