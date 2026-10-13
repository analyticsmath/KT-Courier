import Link from "next/link";
import { requireAuth } from "@/lib/auth/guards";
import { PlatformError } from "@/lib/client-platform/contracts";
import { driverCashSummary } from "@/lib/client-platform/driver-cash.service";
import { DriverCash } from "@/components/forms/DriverCash";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
export const metadata = { title: "Cash collections" };
export default async function Page() {
  const u = await requireAuth();
  const summary = await driverCashSummary(u.id).catch((error: unknown) => {
    if (error instanceof PlatformError && error.code === "DRIVER_ACCESS_DENIED") return null;
    throw error;
  });
  if (!summary) {
    return (
      <ProtectedPageFrame>
        <ProtectedPageHeader
          eyebrow="Cash operations"
          title="Cash collections"
          description="Record exact delivery cash and track bank deposits through verification."
        />
        <OperationalPanel title="Cash operations">
          <div className="space-y-3">
            <p role="status">Cash collection tools are available to active drivers after KT completes account review.</p>
            <Link href="/driver/onboarding">Review onboarding status</Link>
          </div>
        </OperationalPanel>
      </ProtectedPageFrame>
    );
  }
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
