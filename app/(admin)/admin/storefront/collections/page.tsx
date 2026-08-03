import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StorefrontCollectionCreateForm } from "@/components/protected-v2/commerce-admin/CommerceAdminActions";
import { StorefrontAdministrationNav } from "@/components/protected-v2/commerce-admin/CommerceAdminNavigation";
import { CommerceLockNotice } from "@/components/protected-v2/commerce-admin/CommerceAdminPrimitives";
import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { StorefrontCollectionService } from "@/lib/services/storefront-collection.service";
import { storefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { formatDateTime } from "@/lib/utils/formatters";

export default async function StorefrontCollectionsAdminPage() {
  const user = await requireAdminPagePermission(PERMISSIONS.STOREFRONT_COLLECTIONS_READ);
  const [collections, canManage] = await Promise.all([new StorefrontCollectionService().list(), hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.STOREFRONT_COLLECTIONS_MANAGE })]);
  const publicExposureLocked = !storefrontPublicExposureAllowed();
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Storefront administration" title="Editorial collections" description="Canonical collection configuration and lifecycle evidence. No traffic, ranking, or public-visibility metric is implied." />
    <StorefrontAdministrationNav currentPath="/admin/storefront/collections" />
    {publicExposureLocked ? <CommerceLockNotice title="Storefront exposure is locked" description="Collection configuration may exist, but this route does not claim that a collection is publicly visible or activatable." /> : null}
    <OperationalPanel title="Create collection draft" description="The existing canonical collection API validates and stores each draft. Read-only administrators receive no form."><StorefrontCollectionCreateForm canManage={canManage} /></OperationalPanel>
    <OperationalPanel title="Collection records" description="Open the dedicated record route to inspect lifecycle context and source-backed items.">
      <EditorialTable caption="Storefront editorial collections" mobileMode="stack" rows={collections} emptyState={<ProtectedState kind="empty" title="No collection drafts" description="No canonical storefront collection record is available." />} columns={[
        { id: "name", header: "Collection", priority: "primary", cell: (collection) => <Link className="eo-table-link" href={`/admin/storefront/collections/${collection.publicReference}`}>{collection.name}<small>{collection.publicReference}</small></Link> },
        { id: "type", header: "Type", priority: "secondary", cell: (collection) => collection.collectionType },
        { id: "state", header: "State", priority: "primary", cell: (collection) => { const state = presentCommerceStatus(collection.status); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
        { id: "window", header: "Effective window", priority: "optional", cell: (collection) => collection.effectiveFrom || collection.effectiveUntil ? `${collection.effectiveFrom ? formatDateTime(collection.effectiveFrom) : "Unbounded"} – ${collection.effectiveUntil ? formatDateTime(collection.effectiveUntil) : "Unbounded"}` : "Not scheduled" },
        { id: "updated", header: "Modified", priority: "secondary", cell: (collection) => <time>{formatDateTime(collection.updatedAt)}</time> },
        { id: "open", header: "", priority: "optional", cell: (collection) => <Link className="eo-table-action" href={`/admin/storefront/collections/${collection.publicReference}`}>Open<span className="sr-only"> {collection.name}</span></Link> },
      ]} />
    </OperationalPanel>
  </ProtectedPageFrame>;
}
