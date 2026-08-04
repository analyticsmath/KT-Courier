import Link from "next/link";
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
import { listCatalogDuplicateCandidates } from "@/lib/services/catalog-duplicate.service";

export default async function DuplicateProductsPage() {
  await requireAdminPagePermission(PERMISSIONS.CATALOG_MODERATION_READ);
  const candidates = await listCatalogDuplicateCandidates();
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Catalog administration" title="Duplicate Products" description="Canonical candidate records based on stored duplicate authority. This page does not calculate similarity or provide an automatic merge." />
    <CatalogAdministrationNav currentPath="/admin/catalog/duplicates" />
    <OperationalPanel title="Open duplicate candidates" description="Compare canonical product identity and the authority-provided reason. Resolution remains in the existing canonical API and is not introduced here.">
      <EditorialTable caption="Open catalog duplicate candidates" mobileMode="stack" rows={candidates} emptyState={<ProtectedState kind="empty" title="No open duplicate candidates" description="No canonical duplicate candidate is awaiting review." />} columns={[
        { id: "source", header: "Source product", priority: "primary", cell: (candidate) => <Link className="eo-table-link" href={`/admin/catalog/products/${candidate.sourceProductId}`}>{candidate.sourceProduct.title}<small>{candidate.sourceProduct.publicReference}</small></Link> },
        { id: "candidate", header: "Candidate product", priority: "primary", cell: (candidate) => <Link className="eo-table-link" href={`/admin/catalog/products/${candidate.candidateProductId}`}>{candidate.candidateProduct.title}<small>{candidate.candidateProduct.publicReference}</small></Link> },
        { id: "reason", header: "Canonical reason", priority: "secondary", cell: (candidate) => candidate.reason },
        { id: "confidence", header: "Authority band", priority: "secondary", cell: (candidate) => candidate.confidenceBand },
        { id: "status", header: "State", priority: "secondary", cell: (candidate) => { const state = presentCommerceStatus(candidate.status); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
      ]} />
    </OperationalPanel>
  </ProtectedPageFrame>;
}
