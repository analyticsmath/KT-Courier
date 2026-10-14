import { requireAdminPagePermission } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { StoreOrderPolicyManager } from "@/components/store-orders/StoreOrderPolicyManager";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";

export const metadata = { title: "Store-order operational policies | KT Couriers" };

export default async function StoreOrderPoliciesPage() {
  await requireAdminPagePermission("store_order_policies.manage", "/admin");
  const policies = await prisma.storeOrderOperationalPolicy.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    select: {
      publicReference: true, name: true, versionNumber: true, status: true,
      acceptanceWindowSeconds: true, customerDecisionWindowSeconds: true,
      maximumPrepMinutes: true, maximumPrepExtensionMinutes: true,
      maximumIssueCount: true, maximumSubstitutionProposalsPerLine: true,
      substitutionMode: true, handoffVerificationMode: true,
      effectiveFrom: true, effectiveUntil: true, approvedByUserId: true,
    },
  });
  return <ProtectedPageFrame>
    <ProtectedPageHeader
      eyebrow="Marketplace fulfilment"
      title="Store-order policies"
      description="Version and activate real vendor acceptance, preparation, substitution and courier handoff rules."
    />
    <OperationalPanel title="Commercial operations configuration" description="Review operational timings before placing marketplace orders. Changing a draft never silently changes an existing paid order.">
      <StoreOrderPolicyManager initialPolicies={policies.map(p => ({
        ...p, effectiveFrom: p.effectiveFrom.toISOString(),
        effectiveUntil: p.effectiveUntil?.toISOString() ?? null,
      }))} />
    </OperationalPanel>
  </ProtectedPageFrame>;
}
