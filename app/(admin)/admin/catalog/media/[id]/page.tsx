import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/protected-v2/feedback/ActivityTimeline";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedContentGrid, ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { CatalogMediaReviewActions } from "@/components/protected-v2/commerce-admin/CommerceAdminActions";
import { CatalogAdministrationNav } from "@/components/protected-v2/commerce-admin/CommerceAdminNavigation";
import { CommerceDefinitionList, commerceAdminStyles } from "@/components/protected-v2/commerce-admin/CommerceAdminPrimitives";
import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getAdminCatalogMediaForPage } from "@/lib/services/catalog-media-page.service";
import { formatDateTime } from "@/lib/utils/formatters";

export default async function AdminCatalogMediaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminPagePermission(PERMISSIONS.CATALOG_MODERATION_READ);
  const asset = await getAdminCatalogMediaForPage((await params).id); if (!asset) notFound();
  const [canApprove, canQuarantine, canReject] = await Promise.all([
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.CATALOG_MODERATION_APPROVE }),
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.CATALOG_MODERATION_SUSPEND }),
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.CATALOG_MODERATION_REVIEW }),
  ]);
  const actions = [
    ...(canApprove && asset.status === "QUARANTINED" ? ["approve" as const] : []),
    ...(canQuarantine && ["UPLOADED", "VALIDATING", "READY"].includes(asset.status) ? ["quarantine" as const] : []),
    ...(canReject && ["PENDING_UPLOAD", "UPLOADED", "VALIDATING", "QUARANTINED"].includes(asset.status) ? ["reject" as const] : []),
  ];
  const state = presentCommerceStatus(asset.status);
  return <ProtectedPageFrame>
    <ProtectedPageHeader breadcrumbs={[{ label: "Catalog", href: "/admin/catalog" }, { label: "Media", href: "/admin/catalog/media" }, { label: asset.publicReference }]} eyebrow="Catalog media review" title={asset.publicReference} description="Safe validation, ownership, and association evidence. Storage locations and upload authorization are intentionally absent." />
    <CatalogAdministrationNav currentPath="/admin/catalog/media" />
    <ProtectedContentGrid contextRail={<OperationalPanel title="Lifecycle" padding="compact"><ProtectedStatus label={state.label} tone={state.tone} /></OperationalPanel>}>
      <OperationalPanel title="Validated evidence" description="Only safe media properties are displayed.">
        <CommerceDefinitionList items={[{ label: "Owner scope", value: asset.ownerType }, { label: "Owning store", value: asset.ownerStore?.name ?? "Not applicable" }, { label: "Purpose", value: asset.purpose }, { label: "MIME type", value: asset.mimeType ?? `Declared ${asset.declaredMimeType}` }, { label: "Byte size", value: asset.byteSize ?? asset.declaredByteSize }, { label: "Dimensions", value: asset.width && asset.height ? `${asset.width} × ${asset.height}` : "Not validated" }, { label: "Alt text state", value: asset.productMedia.some((item) => Boolean(item.altText)) ? "Present on attached record" : "No attached alt text" }]} />
      </OperationalPanel>
      <OperationalPanel title="Review actions" description="Actions are rendered only when the current administrator has the canonical permission and the source state has an eligible transition."><CatalogMediaReviewActions actions={actions} assetId={asset.id} /></OperationalPanel>
      <OperationalPanel title="Attached catalog records" description="Only canonical product and variant identity is shown.">
        {asset.productMedia.length ? <ul className={commerceAdminStyles.safeList}>{asset.productMedia.map((item) => <li key={item.id}><strong>{item.product.title}</strong><span>{item.role} · {item.product.publicReference}{item.variant ? ` · ${item.variant.title}` : ""}</span><span>{item.altText ? "Alt text recorded" : "Alt text not recorded"}</span></li>)}</ul> : <ProtectedState kind="empty" title="No attached catalog record" description="This media record is not attached to a catalog product or variant." />}
      </OperationalPanel>
      <OperationalPanel title="Immutable history" description="Timeline records contain no storage key, provider, or actor identity.">
        {asset.history.length ? <ActivityTimeline ariaLabel="Media lifecycle history" items={asset.history.map((item, index) => ({ id: `${item.createdAt.toISOString()}-${index}`, title: item.action, description: item.reasonCode ?? undefined, timestamp: formatDateTime(item.createdAt), tone: presentCommerceStatus(item.toStatus).tone }))} /> : <ProtectedState kind="empty" title="No media history" description="No canonical lifecycle history is available for this asset." />}
      </OperationalPanel>
    </ProtectedContentGrid>
  </ProtectedPageFrame>;
}
