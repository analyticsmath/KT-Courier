import { notFound } from "next/navigation";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedContentGrid, ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StorefrontLifecycleActions } from "@/components/protected-v2/commerce-admin/CommerceAdminActions";
import { StorefrontAdministrationNav } from "@/components/protected-v2/commerce-admin/CommerceAdminNavigation";
import { CommerceDefinitionList, CommerceLockNotice, commerceAdminStyles } from "@/components/protected-v2/commerce-admin/CommerceAdminPrimitives";
import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { StorefrontSynonymService } from "@/lib/services/storefront-synonym.service";
import { storefrontPublicExposureAllowed } from "@/lib/storefront/storefront-production-lock";
import { formatDateTime } from "@/lib/utils/formatters";

type DisplaySynonymTerm = Readonly<{ input: string; outputs: readonly string[]; direction: "EQUIVALENT" | "ONE_WAY" }>;
function displayTerms(value: unknown): readonly DisplaySynonymTerm[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((term) => {
    if (!term || typeof term !== "object") return [];
    const candidate = term as { input?: unknown; outputs?: unknown; direction?: unknown };
    return typeof candidate.input === "string" && Array.isArray(candidate.outputs) && candidate.outputs.every((output) => typeof output === "string") && (candidate.direction === "EQUIVALENT" || candidate.direction === "ONE_WAY") ? [{ input: candidate.input, outputs: candidate.outputs as string[], direction: candidate.direction }] : [];
  });
}

export default async function StorefrontSynonymAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminPagePermission(PERMISSIONS.STOREFRONT_SEARCH_SYNONYMS_READ);
  const [synonymSet, canManage] = await Promise.all([new StorefrontSynonymService().get((await params).id), hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.STOREFRONT_SEARCH_SYNONYMS_MANAGE })]);
  if (!synonymSet) notFound(); const state = presentCommerceStatus(synonymSet.status); const terms = displayTerms(synonymSet.terms); const publicExposureLocked = !storefrontPublicExposureAllowed();
  return <ProtectedPageFrame>
    <ProtectedPageHeader breadcrumbs={[{ label: "Storefront", href: "/admin/storefront/search-synonyms" }, { label: "Search synonyms", href: "/admin/storefront/search-synonyms" }, { label: synonymSet.publicReference }]} eyebrow="Storefront administration" title={synonymSet.name} description={`${synonymSet.language} · version ${synonymSet.versionNumber}`} />
    <StorefrontAdministrationNav currentPath="/admin/storefront/search-synonyms" />
    {publicExposureLocked ? <CommerceLockNotice title="Storefront exposure is locked" description="This deterministic synonym version remains private configuration evidence; the unavailable public activation action is omitted." /> : null}
    <ProtectedContentGrid contextRail={<OperationalPanel title="Lifecycle state" padding="compact"><ProtectedStatus label={state.label} tone={state.tone} /></OperationalPanel>}>
      <OperationalPanel title="Version context" description="The server remains the authority for term normalization, validation, conflict handling, and lifecycle transitions."><CommerceDefinitionList items={[{ label: "Reference", value: synonymSet.publicReference }, { label: "Language", value: synonymSet.language }, { label: "Version", value: synonymSet.versionNumber }, { label: "Modified", value: <time>{formatDateTime(synonymSet.updatedAt)}</time> }]} /></OperationalPanel>
      <OperationalPanel title="Canonical terms" description="Terms are deterministic data, not executable SQL, regular expressions, or AI-authored recommendations.">
        {terms.length ? <ul className={commerceAdminStyles.safeList}>{terms.map((term, index) => <li key={`${term.direction}-${term.input}-${index}`}><strong>{term.input}</strong><span>{term.direction === "EQUIVALENT" ? "Equivalent" : "One way"} · {term.outputs.join(", ")}</span></li>)}</ul> : <ProtectedState kind="unavailable" title="Terms unavailable" description="No safe deterministic term projection is available for this version." />}
      </OperationalPanel>
      <OperationalPanel title="Lifecycle actions" description="Actions are shown only with the existing server-resolved management permission. Public activation remains omitted while the production lock is active."><StorefrontLifecycleActions basePath="/api/admin/storefront/search-synonyms" canManage={canManage} publicExposureLocked={publicExposureLocked} reference={synonymSet.publicReference} status={synonymSet.status} version={synonymSet.version} /></OperationalPanel>
    </ProtectedContentGrid>
  </ProtectedPageFrame>;
}
