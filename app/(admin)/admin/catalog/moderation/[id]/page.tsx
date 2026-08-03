import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/protected-v2/feedback/ActivityTimeline";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedContentGrid, ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { CatalogAdministrationNav } from "@/components/protected-v2/commerce-admin/CommerceAdminNavigation";
import { CommerceDefinitionList } from "@/components/protected-v2/commerce-admin/CommerceAdminPrimitives";
import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getCatalogModerationCase } from "@/lib/services/catalog-moderation.service";
import { formatDateTime } from "@/lib/utils/formatters";

export default async function CatalogModerationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPagePermission(PERMISSIONS.CATALOG_MODERATION_READ);
  const moderationCase = await getCatalogModerationCase((await params).id).catch(() => null); if (!moderationCase) notFound();
  const state = presentCommerceStatus(moderationCase.status);
  return <ProtectedPageFrame>
    <ProtectedPageHeader breadcrumbs={[{ label: "Catalog", href: "/admin/catalog" }, { label: "Moderation", href: "/admin/catalog/moderation" }, { label: moderationCase.publicReference }]} eyebrow="Catalog administration" title="Moderation case" description={moderationCase.safeSummary} />
    <CatalogAdministrationNav currentPath="/admin/catalog/moderation" />
    <ProtectedContentGrid contextRail={<OperationalPanel title="Case state" padding="compact"><ProtectedStatus label={state.label} tone={state.tone} /></OperationalPanel>}>
      <OperationalPanel title="Canonical review evidence" description="Only the review-safe record is shown. Private moderation evidence and actor identity remain unavailable in this presentation.">
        <CommerceDefinitionList items={[{ label: "Reference", value: moderationCase.publicReference }, { label: "Subject", value: moderationCase.product?.title ?? moderationCase.offer?.storeSku ?? "Catalog evidence" }, { label: "Type", value: moderationCase.type }, { label: "Reason", value: moderationCase.reasonCode }, { label: "Opened", value: <time>{formatDateTime(moderationCase.openedAt)}</time> }]} />
      </OperationalPanel>
      <OperationalPanel title="Immutable history" description="Timeline events are rendered only when canonical history exists.">
        {moderationCase.history.length ? <ActivityTimeline ariaLabel="Moderation history" items={moderationCase.history.map((item) => ({ id: item.id, title: item.action, description: item.reasonCode, timestamp: formatDateTime(item.createdAt), tone: presentCommerceStatus(item.toStatus).tone }))} /> : <ProtectedState kind="empty" title="No moderation history" description="No canonical moderation action has been recorded for this case." />}
      </OperationalPanel>
    </ProtectedContentGrid>
  </ProtectedPageFrame>;
}
