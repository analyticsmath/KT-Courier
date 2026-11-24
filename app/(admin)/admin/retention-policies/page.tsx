import { RetentionPoliciesManager, type RetentionPolicyItem } from "@/components/admin/RetentionPoliciesManager";
import { ProtectedPageFrame, ProtectedPageHeader } from "@/components/protected-v2";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listRetentionPolicyVersions } from "@/lib/retention/privacy-retention.service";

export default async function RetentionPoliciesPage() {
  const user = await requireAdminPagePermission(PERMISSIONS.RETENTION_POLICIES_READ);
  const [policyResult, canManage, canReview] = await Promise.all([
    listRetentionPolicyVersions().then((items) => ({ items, failed: false })).catch(() => ({ items: [], failed: true })),
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RETENTION_POLICIES_MANAGE }),
    hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.RETENTION_POLICIES_REVIEW }),
  ]);
  const initialPolicies: RetentionPolicyItem[] = policyResult.items.map((policy) => ({
    id: policy.id,
    publicReference: policy.publicReference,
    dataClass: policy.dataClass,
    version: policy.version,
    action: policy.action,
    retentionDays: policy.retentionDays,
    effectiveAt: policy.effectiveAt?.toISOString() ?? null,
    status: policy.status,
    legalReviewStatus: policy.legalReviewStatus,
    legalReviewReference: policy.legalReviewReference,
    legalReviewReason: policy.legalReviewReason,
    legalReviewedByUserId: policy.legalReviewedByUserId,
    legalReviewedAt: policy.legalReviewedAt?.toISOString() ?? null,
    createdByUserId: policy.createdByUserId,
    activatedByUserId: policy.activatedByUserId,
    createdAt: policy.createdAt.toISOString(),
  }));

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Governance"
        title="Retention policies"
        description="Versioned retention settings with a separate review record and guarded activation."
      />
      <RetentionPoliciesManager initialPolicies={initialPolicies} canManage={canManage} canReview={canReview} actorUserId={user.id} evaluatedAt={new Date().toISOString()} initialLoadFailed={policyResult.failed} />
    </ProtectedPageFrame>
  );
}
