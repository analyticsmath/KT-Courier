import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { managedMarketingService } from "@/lib/advertising/managed-marketing-admin-route";
import { AdminAdvertisingWorkbench } from "@/components/admin/AdminAdvertisingWorkbench";

export default async function AdminAdvertisingPage() {
  const admin = await requireAdminPagePermission(PERMISSIONS.ADVERTISING_READ);
  const actor = { actorUserId: admin.id, actorRole: admin.role };

  const [requests, packages, placements, revenueReports] = await Promise.all([
    managedMarketingService.listRequestsForReview(actor).catch(() => []),
    managedMarketingService.listPackages().catch(() => []),
    managedMarketingService.listPlacements().catch(() => []),
    managedMarketingService.listRevenueReports(actor).catch(() => []),
  ]);

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Commercial programmes"
        title="Advertising administration"
        description="Review managed marketing campaigns, inspect rate cards & placements, and moderate advertising requests."
      />
      <AdminAdvertisingWorkbench
        initialRequests={requests as any}
        initialPackages={packages as any}
        initialPlacements={placements as any}
        initialRevenueReports={revenueReports as any}
      />
    </ProtectedPageFrame>
  );
}
