import type { Metadata } from "next";
import { PricingRulesManager } from "@/components/admin/PricingRulesManager";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listDeliveryRegions } from "@/lib/services/admin-regions.service";
import { getAllPricingRules } from "@/lib/services/pricing.service";
import { formatDateTime } from "@/lib/utils/formatters";

export const metadata: Metadata = { title: "Pricing rules" };
export default async function AdminPricingPage() {
  const user = await requireAdminPagePermission(PERMISSIONS.PRICING_READ);
  const [rules, regions, canManage] = await Promise.all([getAllPricingRules(), listDeliveryRegions(true), hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.PRICING_MANAGE })]);
  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Pricing" title="Pricing rules" description="Rule applicability, effective dates, decimals, conflict detection, and revisions remain server-authoritative. This page does not calculate quotes." /><OperationalPanel title="Rule directory" description={canManage ? "Existing canonical pricing controls are available below." : "Read-only pricing access. Edit and activation controls are omitted without the management permission."}><EditorialTable caption="Pricing rule directory" mobileMode="stack" rows={rules} columns={[
    { id: "name", header: "Rule", priority: "primary", cell: (rule) => <div><strong>{rule.name}</strong><small>{rule.deliveryType?.replaceAll("_", " ") ?? "All services"}</small></div> },
    { id: "state", header: "State", priority: "primary", cell: (rule) => <ProtectedStatus label={rule.active ? "Active" : "Inactive"} tone={rule.active ? "success" : "neutral"} /> },
    { id: "region", header: "Region scope", priority: "secondary", cell: (rule) => regions.find((region) => region.id === rule.regionId)?.name ?? "Global fallback" },
    { id: "effective", header: "Effective period", priority: "optional", cell: (rule) => `${rule.effectiveFrom ? formatDateTime(rule.effectiveFrom) : "Now"} — ${rule.effectiveTo ? formatDateTime(rule.effectiveTo) : "No end"}` },
    { id: "revision", header: "Revision", priority: "secondary", cell: (rule) => rule.revision },
  ]} /></OperationalPanel>{canManage ? <OperationalPanel title="Pricing rule controls" description="The existing form preserves currency, precision, conflict, effective-date, revision, and audit behavior."><PricingRulesManager rules={rules} regions={regions.map((region) => ({ id: region.id, name: region.name }))} /></OperationalPanel> : null}</ProtectedPageFrame>;
}
