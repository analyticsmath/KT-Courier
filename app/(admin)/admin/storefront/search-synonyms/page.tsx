import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StorefrontSynonymCreateForm } from "@/components/protected-v2/commerce-admin/CommerceAdminActions";
import { StorefrontAdministrationNav } from "@/components/protected-v2/commerce-admin/CommerceAdminNavigation";
import { CommerceLockNotice } from "@/components/protected-v2/commerce-admin/CommerceAdminPrimitives";
import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { StorefrontSynonymService } from "@/lib/services/storefront-synonym.service";
import { storefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { formatDateTime } from "@/lib/utils/formatters";

export default async function StorefrontSynonymsAdminPage() {
  const user = await requireAdminPagePermission(PERMISSIONS.STOREFRONT_SEARCH_SYNONYMS_READ);
  const [synonymSets, canManage] = await Promise.all([new StorefrontSynonymService().list(), hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.STOREFRONT_SEARCH_SYNONYMS_MANAGE })]);
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Storefront administration" title="Search synonym versions" description="Canonical deterministic synonym versions. No search-volume analytics, client-only publication, executable rule, or automatic AI activation is introduced." />
    <StorefrontAdministrationNav currentPath="/admin/storefront/search-synonyms" />
    {!storefrontPublicExposureAllowed() ? <CommerceLockNotice title="Storefront exposure is locked" description="Synonym versions can be reviewed as configuration evidence, while public activation remains unavailable." /> : null}
    <OperationalPanel title="Create deterministic synonym draft" description="Validation and conflict handling remain server-authoritative in the existing endpoint."><StorefrontSynonymCreateForm canManage={canManage} /></OperationalPanel>
    <OperationalPanel title="Synonym version records" description="Open a canonical record to review version context and permitted lifecycle controls.">
      <EditorialTable caption="Storefront search synonym versions" mobileMode="stack" rows={synonymSets} emptyState={<ProtectedState kind="empty" title="No synonym drafts" description="No canonical search synonym version is available." />} columns={[
        { id: "name", header: "Set", priority: "primary", cell: (synonymSet) => <Link className="eo-table-link" href={`/admin/storefront/search-synonyms/${synonymSet.publicReference}`}>{synonymSet.name}<small>{synonymSet.publicReference}</small></Link> },
        { id: "language", header: "Language", priority: "secondary", cell: (synonymSet) => synonymSet.language },
        { id: "version", header: "Version", priority: "secondary", align: "end", cell: (synonymSet) => synonymSet.versionNumber },
        { id: "state", header: "State", priority: "primary", cell: (synonymSet) => { const state = presentCommerceStatus(synonymSet.status); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
        { id: "modified", header: "Modified", priority: "secondary", cell: (synonymSet) => <time>{formatDateTime(synonymSet.updatedAt)}</time> },
        { id: "open", header: "", priority: "optional", cell: (synonymSet) => <Link className="eo-table-action" href={`/admin/storefront/search-synonyms/${synonymSet.publicReference}`}>Open<span className="sr-only"> {synonymSet.name}</span></Link> },
      ]} />
    </OperationalPanel>
  </ProtectedPageFrame>;
}
