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
import { listProductTypeDefinitions } from "@/lib/services/product-type.service";
import { storefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";

export default async function CatalogProductTypesPage() {
  await requireAdminPagePermission(PERMISSIONS.CATALOG_PRODUCT_TYPES_READ);
  const types = await listProductTypeDefinitions();
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Catalog administration" title="Product Types" description="Versioned schema definitions. This presentation does not expose or alter schema internals." />
    <CatalogAdministrationNav currentPath="/admin/catalog/product-types" />
    {!storefrontPublicExposureAllowed() ? <CommerceLockNotice title="Public exposure is locked" description="Reviewed schema records remain visible, while public storefront activation is unavailable." /> : null}
    <OperationalPanel title="Product type definitions" description="Active definitions are canonical immutable records. No product-type create or edit page exists in the current admin route tree.">
      <EditorialTable caption="Product type definitions" mobileMode="stack" rows={types} emptyState={<ProtectedState kind="empty" title="No product type definitions" description="No canonical product type definition is available." />} columns={[
        { id: "code", header: "Code", priority: "primary", cell: (type) => <span className="font-mono text-xs">{type.code}</span> },
        { id: "name", header: "Name", priority: "primary", cell: (type) => type.name },
        { id: "version", header: "Version", priority: "secondary", align: "end", cell: (type) => type.versionNumber },
        { id: "schema", header: "Schema", priority: "optional", align: "end", cell: (type) => type.schemaVersion },
        { id: "status", header: "State", priority: "secondary", cell: (type) => { const state = presentCommerceStatus(type.status); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
      ]} />
    </OperationalPanel>
  </ProtectedPageFrame>;
}
