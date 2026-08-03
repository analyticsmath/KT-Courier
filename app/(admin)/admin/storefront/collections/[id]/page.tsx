import { notFound } from "next/navigation";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedContentGrid, ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StorefrontCollectionItemForm, StorefrontLifecycleActions } from "@/components/protected-v2/commerce-admin/CommerceAdminActions";
import { StorefrontAdministrationNav } from "@/components/protected-v2/commerce-admin/CommerceAdminNavigation";
import { CommerceDefinitionList, CommerceLockNotice, commerceAdminStyles } from "@/components/protected-v2/commerce-admin/CommerceAdminPrimitives";
import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { StorefrontCollectionService } from "@/lib/services/storefront-collection.service";
import { storefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { formatDateTime } from "@/lib/utils/formatters";

export default async function StorefrontCollectionAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminPagePermission(PERMISSIONS.STOREFRONT_COLLECTIONS_READ);
  const [collection, canManage] = await Promise.all([new StorefrontCollectionService().get((await params).id), hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.STOREFRONT_COLLECTIONS_MANAGE })]);
  if (!collection) notFound();
  const publicExposureLocked = !storefrontPublicExposureAllowed(); const state = presentCommerceStatus(collection.status);
  return <ProtectedPageFrame>
    <ProtectedPageHeader breadcrumbs={[{ label: "Storefront", href: "/admin/storefront/collections" }, { label: "Collections", href: "/admin/storefront/collections" }, { label: collection.publicReference }]} eyebrow="Storefront administration" title={collection.name} description={collection.publicReference} />
    <StorefrontAdministrationNav currentPath="/admin/storefront/collections" />
    {publicExposureLocked ? <CommerceLockNotice title="Storefront exposure is locked" description="An approved collection remains configuration evidence only; the unavailable public activation action is intentionally omitted." /> : null}
    <ProtectedContentGrid contextRail={<OperationalPanel title="Lifecycle state" padding="compact"><ProtectedStatus label={state.label} tone={state.tone} /></OperationalPanel>}>
      <OperationalPanel title="Collection configuration" description="Canonical configuration exists independently from public storefront exposure."><CommerceDefinitionList items={[{ label: "Reference", value: collection.publicReference }, { label: "Slug", value: collection.slug }, { label: "Type", value: collection.collectionType }, { label: "Modified", value: <time>{formatDateTime(collection.updatedAt)}</time> }]} /></OperationalPanel>
      <OperationalPanel title="Lifecycle actions" description="Transitions are shown only when the current administrator has the existing management permission and the source state is eligible."><StorefrontLifecycleActions basePath="/api/admin/storefront/collections" canManage={canManage} publicExposureLocked={publicExposureLocked} reference={collection.publicReference} status={collection.status} version={collection.version} /></OperationalPanel>
      <OperationalPanel title="Collection items" description="Only canonical target references are listed. No public ranking, pricing, or availability is calculated.">
        {collection.items?.length ? <ul className={commerceAdminStyles.safeList}>{collection.items.map((item) => <li key={item.id}><strong>{item.targetReference}</strong><span>{item.targetType} · display order {item.displayOrder}{item.removedAt ? " · Removed" : ""}</span><span>{item.safeLabelOverride ? "Editorial label recorded" : "No editorial label"}</span></li>)}</ul> : <ProtectedState kind="empty" title="No collection items" description="This collection has no canonical item record." />}
      </OperationalPanel>
      <OperationalPanel title="Add eligible item" description="Eligibility is checked by the existing canonical endpoint. This form does not create public content or bypass source validation."><StorefrontCollectionItemForm canManage={canManage && collection.status === "DRAFT"} reference={collection.publicReference} version={collection.version} /></OperationalPanel>
    </ProtectedContentGrid>
  </ProtectedPageFrame>;
}
