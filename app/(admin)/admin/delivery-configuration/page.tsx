import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { DeliveryConfiguration } from "@/components/forms/DeliveryConfiguration";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2";
export default async function Page() {
  await requireAdminPagePermission(PERMISSIONS.COMMERCIAL_CONFIGURATION_MANAGE);
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader title="Delivery services & tariffs" />
      <OperationalPanel title="Versioned delivery configuration">
        <DeliveryConfiguration />
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
