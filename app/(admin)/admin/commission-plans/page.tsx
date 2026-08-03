import Link from "next/link";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { CommissionPlanDraftForm } from "@/components/admin/CommissionPlanDraftForm";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listCommissionPlans } from "@/lib/services/commission-plan-query.service";

export default async function CommissionPlansPage() {
  await requireAdminPagePermission(PERMISSIONS.COMMISSION_PLANS_READ); const plans = await listCommissionPlans({ page: 1, pageSize: 50 }); const user = await getCurrentUser(); const canManage = user ? await hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.COMMISSION_PLANS_MANAGE }) : false;
  return <div className="max-w-7xl space-y-6"><ProtectedPageHeader eyebrow="Finance administration" title="Commission Plans" description="Versioned policy drafts, independent review, and immutable activated policy evidence." />{canManage ? <CommissionPlanDraftForm /> : null}<AdministrationPanel>{plans.data.length ? <table className="w-full text-left text-sm" aria-label="commission-plans-table"><thead><tr><th>Reference</th><th>Status</th><th>Version</th><th>Scope</th><th>Basis</th><th>Effective period</th></tr></thead><tbody>{plans.data.map((plan) => <tr key={plan.id}><td><Link href={`/admin/commission-plans/${plan.id}`}>{plan.publicReference}</Link></td><td>{plan.status}</td><td>{plan.versionNumber}</td><td>{plan.scopeKey}</td><td>{plan.basisType}</td><td>{plan.effectiveFrom} — {plan.effectiveUntil ?? "Open"}</td></tr>)}</tbody></table> : <p role="status">No commission plans are available.</p>}</AdministrationPanel></div>;
}
