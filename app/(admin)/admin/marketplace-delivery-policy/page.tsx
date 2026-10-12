import { requireAdminPagePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listDeliveryMatrices } from "@/lib/marketplace-checkout/delivery-policy-configuration";
import { MarketplaceDeliveryPolicyManager } from "@/components/admin/MarketplaceDeliveryPolicyManager";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { listTrustedPackageVersions } from "@/lib/marketplace-checkout/parcel-configuration.service";
import { MarketplaceTrustedPackageManager } from "@/components/admin/MarketplaceTrustedPackageManager";
export default async function MarketplaceDeliveryPolicyPage() {
  const user = await requireAdminPagePermission(PERMISSIONS.COMMERCIAL_CONFIGURATION_READ);
  const [initial, packages, canManage] = await Promise.all([listDeliveryMatrices(), listTrustedPackageVersions(), hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.COMMERCIAL_CONFIGURATION_MANAGE })]);
  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Commercial configuration" title="Marketplace delivery policy" description="Versioned tariffs with explicit region, distance, size, risk, and authorized store scope." /><OperationalPanel title="Policy authoring and governance"><MarketplaceDeliveryPolicyManager initial={initial} actorId={user.id} canManage={canManage} /></OperationalPanel><OperationalPanel title="Trusted measured packaging"><MarketplaceTrustedPackageManager initial={packages} actorId={user.id} canManage={canManage} /></OperationalPanel></ProtectedPageFrame>;
}
