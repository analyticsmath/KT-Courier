import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { CatalogAdministrationNav } from "@/components/protected-v2/commerce-admin/CommerceAdminNavigation";
import { CommerceLockNotice } from "@/components/protected-v2/commerce-admin/CommerceAdminPrimitives";
import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listAdminCatalogMediaForPage } from "@/lib/services/catalog-media-page.service";
import { storefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { formatDateTime } from "@/lib/utils/formatters";

export default async function AdminCatalogMediaPage() {
  await requireAdminPagePermission(PERMISSIONS.CATALOG_MODERATION_READ);
  const assets = await listAdminCatalogMediaForPage();
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Catalog operations" title="Media evidence" description="Safe ownership, validation, and descriptive metadata. Storage locations, upload credentials, and raw provider data are intentionally absent." />
    <CatalogAdministrationNav currentPath="/admin/catalog/media" />
    {!storefrontPublicExposureAllowed() ? <CommerceLockNotice title="Public media delivery is locked" description="Media review remains source-backed, but this page does not claim that a reviewed asset is publicly deliverable." /> : null}
    <OperationalPanel title="Catalog media records" description="This bounded canonical media projection does not expose storage keys, bucket names, or signed-upload internals.">
      <EditorialTable caption="Catalog media evidence queue" mobileMode="stack" rows={assets} emptyState={<ProtectedState kind="empty" title="No media evidence" description="No canonical catalog media record is available." />} columns={[
        { id: "asset", header: "Asset", priority: "primary", cell: (asset) => <Link className="eo-table-link" href={`/admin/catalog/media/${asset.id}`}>{asset.publicReference}</Link> },
        { id: "owner", header: "Owner", priority: "primary", cell: (asset) => asset.ownerType === "PLATFORM" ? "Platform" : asset.ownerStore?.name ?? "Store unavailable" },
        { id: "purpose", header: "Purpose", priority: "secondary", cell: (asset) => asset.purpose },
        { id: "state", header: "State", priority: "secondary", cell: (asset) => { const state = presentCommerceStatus(asset.status); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
        { id: "description", header: "Safe metadata", priority: "optional", cell: (asset) => <>{asset.mimeType ?? "Pending type"}{asset.width && asset.height ? ` · ${asset.width} × ${asset.height}` : ""}</> },
        { id: "created", header: "Created", priority: "secondary", cell: (asset) => <time>{formatDateTime(asset.createdAt)}</time> },
        { id: "open", header: "", priority: "optional", cell: (asset) => <Link className="eo-table-action" href={`/admin/catalog/media/${asset.id}`}>Open<span className="sr-only"> {asset.publicReference}</span></Link> },
      ]} />
    </OperationalPanel>
  </ProtectedPageFrame>;
}
