import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { DeliveryConfiguration } from "@/components/forms/DeliveryConfiguration";
import { CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";
import { OperationalPanel } from "@/components/protected-v2";
export default async function Page() {
  await requireAdminPagePermission(PERMISSIONS.COMMERCIAL_CONFIGURATION_MANAGE);
  return (
    <CustomerPage title="Delivery services & tariffs">
      <OperationalPanel title="Versioned delivery configuration">
        <DeliveryConfiguration />
      </OperationalPanel>
    </CustomerPage>
  );
}
