import { requireAdminPagePermission } from "@/lib/auth/guards";
import { listPaymentConfigurations } from "@/lib/client-platform/payment-configuration.service";
import { PaymentPolicyConfiguration } from "@/components/forms/PaymentPolicyConfiguration";
import {
  ProtectedPageFrame,
  ProtectedPageHeader,
  OperationalPanel,
} from "@/components/protected-v2";
export const metadata = { title: "Payment policies" };
export default async function Page() {
  const u = await requireAdminPagePermission("cod_operations.manage", "/admin");
  const data = await listPaymentConfigurations(u);
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Cash operations"
        title="Payment policies"
        description="Configure approved-business cash eligibility and online deposits."
      />
      <OperationalPanel title="Payment configuration">
        <PaymentPolicyConfiguration data={data} />
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
