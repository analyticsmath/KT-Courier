import Link from "next/link";
import { MetricTile, OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { CatalogAdministrationNav } from "@/components/protected-v2/commerce-admin/CommerceAdminNavigation";
import { CommerceLockNotice, commerceAdminStyles } from "@/components/protected-v2/commerce-admin/CommerceAdminPrimitives";
import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { listCatalogModerationCases } from "@/lib/services/catalog-moderation.service";
import { storefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { formatDateTime } from "@/lib/utils/formatters";

export default async function CatalogAdministrationPage() {
  await requireAdminPagePermission(PERMISSIONS.CATALOG_MODERATION_READ);
  const [categories, products, moderation, media, moderationCases] = await Promise.all([
    prisma.catalogCategory.count(),
    prisma.catalogProduct.count(),
    prisma.catalogModerationCase.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW", "NEEDS_CHANGES"] } } }),
    prisma.catalogMediaAsset.count(),
    listCatalogModerationCases(),
  ]);
  const publicExposureLocked = !storefrontPublicExposureAllowed();
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Commerce operations" title="Catalog administration" description="Canonical taxonomy, product review, media evidence, and duplicate records. No sales analytics or public storefront performance is shown." />
    <CatalogAdministrationNav currentPath="/admin/catalog" />
    {publicExposureLocked ? <CommerceLockNotice title="Storefront exposure is locked" description="Catalog records can be drafted and reviewed, but this workspace does not claim public visibility or provide an activation control." /> : null}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricTile label="Categories" value={categories} description="Canonical taxonomy records" />
      <MetricTile label="Products" value={products} description="Canonical product records" />
      <MetricTile label="Open moderation" value={moderation} description="Source-backed review cases" />
      <MetricTile label="Media records" value={media} description="Catalog media evidence" />
    </div>
    <OperationalPanel title="Moderation attention" description="The canonical moderation service determines ordering. Open a record to inspect its dedicated review route.">
      {moderationCases.length ? <ul className={commerceAdminStyles.safeList}>{moderationCases.slice(0, 6).map((item) => {
        const state = presentCommerceStatus(item.status);
        const href = item.product ? `/admin/catalog/products/${item.product.id}` : `/admin/catalog/moderation/${item.id}`;
        return <li key={item.id}><Link className={commerceAdminStyles.recordLink} href={href}>{item.publicReference}</Link><span>{item.product?.title ?? item.offer?.storeSku ?? "Catalog evidence"} · {item.reasonCode}</span><span><ProtectedStatus label={state.label} tone={state.tone} /> <time>{formatDateTime(item.openedAt)}</time></span></li>;
      })}</ul> : <p className={commerceAdminStyles.note} role="status">No moderation records currently require review.</p>}
    </OperationalPanel>
  </ProtectedPageFrame>;
}
