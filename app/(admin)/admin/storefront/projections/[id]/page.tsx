import { notFound } from "next/navigation";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedContentGrid, ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StorefrontProjectionActions } from "@/components/protected-v2/commerce-admin/CommerceAdminActions";
import { StorefrontAdministrationNav } from "@/components/protected-v2/commerce-admin/CommerceAdminNavigation";
import { CommerceDefinitionList, CommerceLockNotice } from "@/components/protected-v2/commerce-admin/CommerceAdminPrimitives";
import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { StorefrontReconciliationService } from "@/lib/services/storefront-reconciliation.service";
import { storefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { formatDateTime } from "@/lib/utils/formatters";

export default async function StorefrontProjectionAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminPagePermission(PERMISSIONS.STOREFRONT_PROJECTIONS_READ);
  const [projectionCase, canReconcile] = await Promise.all([new StorefrontReconciliationService().inspect((await params).id).catch(() => null), hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.STOREFRONT_PROJECTIONS_RECONCILE })]);
  if (!projectionCase) notFound(); const state = presentCommerceStatus(projectionCase.status);
  return <ProtectedPageFrame>
    <ProtectedPageHeader breadcrumbs={[{ label: "Storefront", href: "/admin/storefront/projections" }, { label: "Projections", href: "/admin/storefront/projections" }, { label: projectionCase.publicReference }]} eyebrow="Storefront administration" title="Projection case" description={projectionCase.safeSummary} />
    <StorefrontAdministrationNav currentPath="/admin/storefront/projections" />
    {!storefrontPublicExposureAllowed() ? <CommerceLockNotice title="Public storefront exposure is locked" description="This reconciliation record remains source evidence only and does not make content public." /> : null}
    <ProtectedContentGrid contextRail={<OperationalPanel title="Case state" padding="compact"><ProtectedStatus label={state.label} tone={state.tone} /></OperationalPanel>}>
      <OperationalPanel title="Canonical projection context" description="No provider detail, cache key, or raw projection payload is rendered."><CommerceDefinitionList items={[{ label: "Reference", value: projectionCase.publicReference }, { label: "Aggregate type", value: projectionCase.aggregateType }, { label: "Canonical source", value: projectionCase.aggregateReference }, { label: "Reason", value: projectionCase.reason }, { label: "Opened", value: <time>{formatDateTime(projectionCase.openedAt)}</time> }, { label: "Last observed", value: <time>{formatDateTime(projectionCase.lastObservedAt)}</time> }]} /></OperationalPanel>
      <OperationalPanel title="Canonical reconciliation" description="The existing endpoint can only request canonical rebuild and resolve source-coherent evidence; it cannot manually override public fields."><StorefrontProjectionActions canReconcile={canReconcile} reference={projectionCase.publicReference} resolved={projectionCase.status === "RESOLVED"} version={projectionCase.version} /></OperationalPanel>
    </ProtectedContentGrid>
  </ProtectedPageFrame>;
}
