import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedFilterBar } from "@/components/protected-v2/data/FilterAndPagination";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { CatalogAdministrationNav } from "@/components/protected-v2/commerce-admin/CommerceAdminNavigation";
import { presentCommerceStatus } from "@/lib/commerce-admin-presentation/commerce-status";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listCatalogModerationCases } from "@/lib/services/catalog-moderation.service";
import { formatDateTime } from "@/lib/utils/formatters";

const MODERATION_FILTERS = ["", "OPEN", "UNDER_REVIEW", "NEEDS_CHANGES", "APPROVED", "REJECTED", "SUSPENDED"] as const;
function buildHref(status?: string) { return status ? `/admin/catalog/moderation?status=${encodeURIComponent(status)}` : "/admin/catalog/moderation"; }

export default async function CatalogModerationPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdminPagePermission(PERMISSIONS.CATALOG_MODERATION_READ);
  const input = await searchParams; const status = MODERATION_FILTERS.includes(input.status as typeof MODERATION_FILTERS[number]) ? input.status : undefined;
  const cases = await listCatalogModerationCases({ status });
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Catalog administration" title="Moderation" description="Source-backed review cases with safe summaries and canonical immutable history." />
    <CatalogAdministrationNav currentPath="/admin/catalog/moderation" />
    <ProtectedFilterBar activeFilterCount={Number(Boolean(status))} clearHref={status ? "/admin/catalog/moderation" : undefined}><div aria-label="Moderation status filters" className="eo-filter-chips">{MODERATION_FILTERS.map((filter) => <Link aria-current={(status ?? "") === filter ? "page" : undefined} className={(status ?? "") === filter ? "is-active" : undefined} href={buildHref(filter || undefined)} key={filter || "all"}>{filter ? presentCommerceStatus(filter).label : "All states"}</Link>)}</div></ProtectedFilterBar>
    <OperationalPanel title="Moderation queue" description="Review evidence is intentionally limited to canonical safe summaries, reason codes, and source state.">
      <EditorialTable caption="Catalog moderation queue" mobileMode="stack" rows={cases} emptyState={<ProtectedState kind="empty" title="No moderation records match this view" description="Adjust or clear the current server-backed state filter." />} columns={[
        { id: "case", header: "Case", priority: "primary", cell: (item) => <Link className="eo-table-link" href={item.product ? `/admin/catalog/products/${item.product.id}` : `/admin/catalog/moderation/${item.id}`}>{item.publicReference}</Link> },
        { id: "subject", header: "Subject", priority: "primary", cell: (item) => item.product?.title ?? item.offer?.storeSku ?? "Catalog evidence" },
        { id: "type", header: "Type", priority: "secondary", cell: (item) => item.type },
        { id: "reason", header: "Reason", priority: "secondary", cell: (item) => item.reasonCode },
        { id: "status", header: "State", priority: "primary", cell: (item) => { const state = presentCommerceStatus(item.status); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
        { id: "opened", header: "Opened", priority: "secondary", cell: (item) => <time>{formatDateTime(item.openedAt)}</time> },
        { id: "open", header: "", priority: "optional", cell: (item) => <Link className="eo-table-action" href={item.product ? `/admin/catalog/products/${item.product.id}` : `/admin/catalog/moderation/${item.id}`}>Open<span className="sr-only"> {item.publicReference}</span></Link> },
      ]} />
    </OperationalPanel>
  </ProtectedPageFrame>;
}
