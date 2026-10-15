import { requireAdminPagePermission } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getEarningClearancePolicy, getPendingEarningClearancePolicy } from "@/lib/services/earning-clearance-policy.service";
import { ClearancePolicySchema } from "@/lib/earnings/clearance-policy";
import { EarningClearancePolicyForm } from "@/components/admin/EarningClearancePolicyForm";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";

export default async function EarningClearancePolicyPage() {
  await requireAdminPagePermission(PERMISSIONS.COMMISSION_PLANS_READ);
  const user = await getCurrentUser();
  const canManage = user ? await hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.COMMISSION_PLANS_MANAGE }) : false;
  const active = ClearancePolicySchema.safeParse(await getEarningClearancePolicy());
  const pending = ClearancePolicySchema.safeParse(await getPendingEarningClearancePolicy());
  return <div className="max-w-5xl space-y-6"><ProtectedPageHeader eyebrow="Finance administration" title="Earning clearance policy" description="Reviewed hold periods for store and driver earnings." /><AdministrationPanel><EarningClearancePolicyForm active={active.success ? active.data : null} pending={pending.success ? pending.data : null} canManage={canManage} /></AdministrationPanel></div>;
}
