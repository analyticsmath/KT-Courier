import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StorefrontAdministrationNav } from "@/components/protected-v2/commerce-admin/CommerceAdminNavigation";
import { CommerceLockNotice } from "@/components/protected-v2/commerce-admin/CommerceAdminPrimitives";
import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { StorefrontReconciliationService } from "@/lib/services/storefront-reconciliation.service";
import { storefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { formatDateTime } from "@/lib/utils/formatters";

export default async function StorefrontProjectionsAdminPage() {
  await requireAdminPagePermission(PERMISSIONS.STOREFRONT_PROJECTIONS_READ);
  const cases = await new StorefrontReconciliationService().list();
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Storefront administration" title="Projection records" description="Canonical projection reconciliation records. A projection is not a claim of public availability or a manual public-field override." />
    <StorefrontAdministrationNav currentPath="/admin/storefront/projections" />
    {!storefrontPublicExposureAllowed() ? <CommerceLockNotice title="Public storefront exposure is locked" description="Projection records remain inspectable, but this route does not claim that projected content is publicly active." /> : null}
    <OperationalPanel title="Projection reconciliation" description="Open a canonical case to inspect its source and eligible reconciliation action.">
      <EditorialTable caption="Storefront projection reconciliation cases" mobileMode="stack" rows={cases} emptyState={<ProtectedState kind="empty" title="No projection reconciliation records" description="No canonical storefront projection case is available." />} columns={[
        { id: "reference", header: "Case", priority: "primary", cell: (item) => <Link className="eo-table-link" href={`/admin/storefront/projections/${item.publicReference}`}>{item.publicReference}</Link> },
        { id: "source", header: "Canonical source", priority: "primary", cell: (item) => <span className="font-mono text-xs">{item.aggregateReference}</span> },
        { id: "reason", header: "Reason", priority: "secondary", cell: (item) => item.reason },
        { id: "state", header: "State", priority: "secondary", cell: (item) => { const state = presentCommerceStatus(item.status); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
        { id: "observed", header: "Last observed", priority: "secondary", cell: (item) => <time>{formatDateTime(item.lastObservedAt)}</time> },
        { id: "open", header: "", priority: "optional", cell: (item) => <Link className="eo-table-action" href={`/admin/storefront/projections/${item.publicReference}`}>Open<span className="sr-only"> {item.publicReference}</span></Link> },
      ]} />
    </OperationalPanel>
  </ProtectedPageFrame>;
}
