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
  const { store } = await getCurrentStoreForCatalogPage(PERMISSIONS.CATALOG_IMPORTS_READ);
  const imports = await listStoreCatalogImports(store.id);
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Catalog"
        title="Bulk imports"
        description="Store import records and validation evidence. Product draft import is currently unavailable."
      />
      <StoreCatalogNavigation />
      <OperationalPanel title="Import safeguards" padding="compact">
        <p className="text-sm text-[var(--eo-text-secondary)]">
          Create product drafts in the catalog. To record received stock, use
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
