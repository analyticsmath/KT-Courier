import { requireAuth } from "@/lib/auth/guards";
import { driverCashSummary } from "@/lib/client-platform/driver-cash.service";
import { DriverCash } from "@/components/forms/DriverCash";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
export const metadata = { title: "Cash collections" };
export default async function Page() {
  const u = await requireAuth();
  const summary = await driverCashSummary(u.id);
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Cash operations"
        title="Cash collections"
        description="Record exact delivery cash and track bank deposits through verification."
      />
      <OperationalPanel title="Your cash records">
        <DriverCash summary={summary} />
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
