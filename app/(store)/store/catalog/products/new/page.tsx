import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { StoreCatalogWizard } from "@/components/catalog/StoreCatalogWizard";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StoreCatalogNavigation, StorefrontAvailability } from "@/components/protected-v2/store/StoreCatalogNavigation";
import { getCurrentStoreForCatalogPage } from "@/lib/services/catalog-page.service";

export default async function NewStoreCatalogProductPage() {
  await getCurrentStoreForCatalogPage();
  const [productTypes, categories] = await Promise.all([
    prisma.productTypeDefinition.findMany({ where: { status: { in: ["APPROVED", "ACTIVE"] } }, select: { id: true, name: true, code: true, versionNumber: true, attributeSchema: true }, orderBy: [{ name: "asc" }, { versionNumber: "desc" }] }),
    prisma.catalogCategory.findMany({ where: { status: { in: ["ACTIVE", "DRAFT"] } }, select: { id: true, name: true, path: true }, orderBy: { path: "asc" } }),
  ]);
  return <ProtectedPageFrame>
    <ProtectedPageHeader breadcrumbs={[{ label: "Catalog", href: "/store/catalog" }, { label: "Products", href: "/store/catalog/products" }, { label: "New product" }]} title="New product" description="Create a saved canonical product draft. Validation, review, and publication retain their existing separate authorities." actions={<Link className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] border border-[var(--eo-line-strong)] px-3 text-sm font-semibold" href="/store/catalog/products">Back to products</Link>} />
    <StoreCatalogNavigation />
    {productTypes.length && categories.length ? <StoreCatalogWizard productTypes={productTypes} categories={categories} /> : <ProtectedState kind="unavailable" title="Catalog foundations are required" description="An approved product-type version and an available category are required before a store product draft can be created." />}
    <StorefrontAvailability />
  </ProtectedPageFrame>;
}
