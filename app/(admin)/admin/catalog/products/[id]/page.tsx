import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/protected-v2/feedback/ActivityTimeline";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedContentGrid, ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { CatalogModerationActions } from "@/components/protected-v2/commerce-admin/CommerceAdminActions";
import { CatalogAdministrationNav } from "@/components/protected-v2/commerce-admin/CommerceAdminNavigation";
import { CommerceDefinitionList, CommerceLockNotice, commerceAdminStyles } from "@/components/protected-v2/commerce-admin/CommerceAdminPrimitives";
import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { storefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { formatDateTime } from "@/lib/utils/formatters";

export default async function AdminCatalogProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminPagePermission(PERMISSIONS.CATALOG_MODERATION_READ);
  const { id } = await params;
  const product = await prisma.catalogProduct.findUnique({
    where: { id },
    include: {
      sourceStore: { select: { name: true, slug: true } },
      primaryCategory: { select: { path: true, name: true } },
      productTypeDefinition: { select: { code: true, name: true } },
      variants: { select: { id: true, publicReference: true, title: true } },
      media: { include: { asset: { select: { publicReference: true, status: true } } } },
      offers: { include: { store: { select: { name: true, slug: true } }, priceVersions: { orderBy: { versionNumber: "desc" }, take: 1 }, inventoryItem: { include: { levels: true } } } },
      moderationCases: { include: { history: { orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!product) notFound();
  const [canReview, canApprove, canSuspend] = await Promise.all([
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.CATALOG_MODERATION_REVIEW }),
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.CATALOG_MODERATION_APPROVE }),
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.CATALOG_MODERATION_SUSPEND }),
  ]);
  const actions = [
    ...(canApprove && product.status === "SUBMITTED" ? ["approve" as const] : []),
    ...(canReview && ["SUBMITTED", "SUSPENDED"].includes(product.status) ? ["request-changes" as const] : []),
    ...(canReview && ["DRAFT", "SUBMITTED", "NEEDS_CHANGES", "APPROVED", "ACTIVE", "SUSPENDED"].includes(product.status) ? ["reject" as const] : []),
    ...(canSuspend && ["SUBMITTED", "APPROVED", "ACTIVE"].includes(product.status) ? ["suspend" as const] : []),
  ];
  const productState = presentCommerceStatus(product.status);
  const moderationState = presentCommerceStatus(product.moderationStatus);
  const publicationState = presentCommerceStatus(product.publicationStatus);
  const history = product.moderationCases.flatMap((moderationCase) => moderationCase.history);
  return <ProtectedPageFrame>
    <ProtectedPageHeader breadcrumbs={[{ label: "Catalog", href: "/admin/catalog" }, { label: "Products", href: "/admin/catalog/products" }, { label: product.publicReference }]} eyebrow="Catalog product review" title={product.title} description={product.publicReference} />
    <CatalogAdministrationNav currentPath="/admin/catalog/products" />
    {!storefrontPublicExposureAllowed() ? <CommerceLockNotice title="Storefront exposure is locked" description="Product review and moderation can proceed, but no public listing or activation is claimed by this record." /> : null}
    <ProtectedContentGrid contextRail={<OperationalPanel title="Canonical states" padding="compact"><div className="flex flex-wrap gap-2"><ProtectedStatus label={productState.label} tone={productState.tone} /><ProtectedStatus label={moderationState.label} tone={moderationState.tone} /><ProtectedStatus label={publicationState.label} tone={publicationState.tone} /></div></OperationalPanel>}>
      <OperationalPanel title="Product identity" description="Canonical identity and ownership context only; private structured compliance values are not rendered here.">
        <CommerceDefinitionList items={[{ label: "Reference", value: product.publicReference }, { label: "Source store", value: product.sourceStore?.name ?? "Platform record" }, { label: "Category", value: product.primaryCategory.path }, { label: "Product type", value: `${product.productTypeDefinition.code} v${product.productTypeVersionNumber}` }, { label: "Condition", value: product.condition }, { label: "Modified", value: <time>{formatDateTime(product.updatedAt)}</time> }]} />
      </OperationalPanel>
      <OperationalPanel title="Store offers and inventory projection" description="Price and inventory evidence are read from canonical offer records; no amount or availability is calculated in the browser.">
        {product.offers.length ? <ul className={commerceAdminStyles.safeList}>{product.offers.map((offer) => <li key={offer.id}><strong>{offer.store.name} · {offer.storeSku}</strong><span>{offer.priceVersions[0] ? `${offer.priceVersions[0].amount.toString()} ${offer.priceVersions[0].currency}` : "No current price record"} · {offer.inventoryItem?.levels.length ?? 0} inventory record(s)</span><span><ProtectedStatus label={presentCommerceStatus(offer.status).label} tone={presentCommerceStatus(offer.status).tone} /> <ProtectedStatus label={presentCommerceStatus(offer.publicationStatus).label} tone={presentCommerceStatus(offer.publicationStatus).tone} /></span></li>)}</ul> : <ProtectedState kind="empty" title="No store offer records" description="This product has no canonical store offer projection." />}
      </OperationalPanel>
      <OperationalPanel title="Media records" description="Safe media references and canonical lifecycle state only; no storage key or provider detail is exposed.">
        {product.media.length ? <ul className={commerceAdminStyles.safeList}>{product.media.map((item) => { const state = presentCommerceStatus(item.asset.status); return <li key={item.id}><strong>{item.asset.publicReference}</strong><span>{item.role}{item.variantId ? " · Variant association" : " · Product association"}</span><span><ProtectedStatus label={state.label} tone={state.tone} /></span></li>; })}</ul> : <ProtectedState kind="empty" title="No media records" description="No catalog media association is recorded for this product." />}
      </OperationalPanel>
      <OperationalPanel title="Moderation actions" description="Actions are server-permissioned and source-state eligible. The canonical endpoint handles concurrency and confirmation."><CatalogModerationActions actions={actions} productId={product.id} version={product.version} /></OperationalPanel>
      <OperationalPanel title="Immutable moderation history" description="Timeline events contain canonical action, reason, timestamp, and source version only.">
        {history.length ? <ActivityTimeline ariaLabel="Product moderation history" items={history.map((item) => ({ id: item.id, title: item.action, description: `${item.reasonCode} · version ${item.aggregateVersion}`, timestamp: formatDateTime(item.createdAt), tone: presentCommerceStatus(item.toStatus).tone }))} /> : <ProtectedState kind="empty" title="No moderation history" description="No canonical moderation action has been recorded for this product." />}
      </OperationalPanel>
    </ProtectedContentGrid>
  </ProtectedPageFrame>;
}
