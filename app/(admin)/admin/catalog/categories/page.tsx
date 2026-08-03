import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { CatalogAdministrationNav } from "@/components/protected-v2/commerce-admin/CommerceAdminNavigation";
import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listCatalogCategories } from "@/lib/services/catalog-category.service";

export default async function CatalogCategoriesPage() {
  await requireAdminPagePermission(PERMISSIONS.CATALOG_TAXONOMY_READ);
  const categories = await listCatalogCategories();
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Catalog administration" title="Categories" description="Canonical hierarchy records with deterministic paths and bounded depth." />
    <CatalogAdministrationNav currentPath="/admin/catalog/categories" />
    <OperationalPanel title="Category hierarchy" description="This route has no dedicated category detail or editor page in the current tree. The canonical API remains the authority for taxonomy changes.">
      <EditorialTable caption="Catalog category hierarchy" mobileMode="stack" rows={categories} emptyState={<ProtectedState kind="empty" title="No category records" description="No canonical category record is available for this administration view." />} columns={[
        { id: "path", header: "Path", priority: "primary", cell: (category) => <span className="font-mono text-xs">{category.path}</span> },
        { id: "name", header: "Category", priority: "primary", cell: (category) => category.name },
        { id: "depth", header: "Depth", priority: "secondary", align: "end", cell: (category) => category.depth },
        { id: "order", header: "Display order", priority: "optional", align: "end", cell: (category) => category.displayOrder },
        { id: "status", header: "State", priority: "secondary", cell: (category) => { const state = presentCommerceStatus(category.status); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
        { id: "version", header: "Version", priority: "optional", align: "end", cell: (category) => category.version },
      ]} />
    </OperationalPanel>
  </ProtectedPageFrame>;
}
