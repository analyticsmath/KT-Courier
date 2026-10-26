import { prisma } from "@/lib/db/prisma";
import { ProductCsvImport } from "@/components/store/ProductCsvImport";
import { storeCatalogPermission } from "@/lib/catalog/catalog-auth";
import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StoreCatalogNavigation } from "@/components/protected-v2/store/StoreCatalogNavigation";
import { getCurrentStoreForCatalogPage } from "@/lib/services/catalog-page.service";
import { listStoreCatalogImports } from "@/lib/services/catalog-import.service";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

export default async function StoreCatalogImportsPage() {
  await requireBusinessPage("/store/catalog/imports");
  const { store, user } = await getCurrentStoreForCatalogPage(PERMISSIONS.CATALOG_IMPORTS_READ);
  const [imports, manage, types, categories] = await Promise.all([listStoreCatalogImports(store.id), storeCatalogPermission(user.id, PERMISSIONS.CATALOG_IMPORTS_MANAGE), prisma.productTypeDefinition.findMany({ where: { status: { in: ["APPROVED", "ACTIVE"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }), prisma.catalogCategory.findMany({ where: { status: "ACTIVE" }, select: { id: true, path: true }, orderBy: { path: "asc" } })]);
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Catalog"
        title="Bulk imports"
        description="Upload a CSV, review each row and create private product drafts."
      />
      <StoreCatalogNavigation />
      {manage.allowed && <ProductCsvImport types={types} categories={categories} initialJobs={JSON.parse(JSON.stringify(imports))} />}
      <OperationalPanel title="Import safeguards" padding="compact">
        <p className="text-sm text-[var(--eo-text-secondary)]">
          Imports create product identities only. Add photos, offers, prices and stock before submitting them for review. To record received stock, use
          Upload stock receipts on the Inventory page.
        </p>
      </OperationalPanel>
      {imports.length ? (
        <EditorialTable
          caption="Store catalog import jobs"
          mobileMode="stack"
          rows={imports.map((job) => ({ id: job.id, job }))}
          columns={[
            {
              id: "file",
              header: "File",
              priority: "primary",
              cell: ({ job }) => (
                <div>
                  <p className="font-semibold">{job.filename}</p>
                  <p className="mt-1 font-mono text-xs text-[var(--eo-text-muted)]">
                    {job.publicReference}
                  </p>
                </div>
              ),
            },
            {
              id: "state",
              header: "State",
              priority: "secondary",
              cell: ({ job }) => (
                <ProtectedStatus label={job.status.replaceAll("_", " ")} />
              ),
            },
            {
              id: "rows",
              header: "Rows",
              align: "end",
              priority: "secondary",
              cell: ({ job }) => job.totalRows,
            },
            {
              id: "dry-run",
              header: "Dry run",
              priority: "optional",
              cell: ({ job }) =>
                job.dryRunCompleted ? "Complete" : "Required",
            },
          ]}
        />
      ) : (
        <ProtectedState
          kind="empty"
          title="No catalog import jobs are available"
          description="Import history is shown only when a store-owned catalog import job exists."
        />
      )}
    </ProtectedPageFrame>
  );
}
