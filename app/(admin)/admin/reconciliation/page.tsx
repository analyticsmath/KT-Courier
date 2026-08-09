import { ReconciliationManager } from "@/components/admin/ReconciliationManager";
import { ProtectedPageFrame, ProtectedPageHeader } from "@/components/protected-v2";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { getEffectivePermissionKeysForUser } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listUnifiedReconciliationCases } from "@/lib/reconciliation/service";

export default async function ReconciliationPage() {
  const user = await requireAdminPagePermission(PERMISSIONS.PAYMENT_RECONCILIATION_READ);

  const effectiveKeys = await getEffectivePermissionKeysForUser({ userId: user.id, role: user.role });
  const actorPermissionKeys = new Set(effectiveKeys);
  const result = await listUnifiedReconciliationCases(actorPermissionKeys, { limit: 50 }).catch(() => ({
    cases: [],
    totalReturned: 0,
    hasMore: false,
  }));

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Finance"
        title="Cross-Domain Unified Reconciliation"
        description="Permission-scoped operational projection and recovery router over canonical domain reconciliation authorities."
      />

      <ReconciliationManager initialCases={result.cases} />
    </ProtectedPageFrame>
  );
}
