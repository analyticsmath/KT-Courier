import Link from "next/link";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";

/** Finance restriction is not an empty or zero-balance ledger. */
export function StoreEarningsUnavailable() {
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader title="Earnings" description="Store finance access" />
      <ProtectedState
        kind="restricted"
        title="Earnings unavailable"
        description="Your business is not currently authorized to view store earnings. Check your store approval and finance permissions with an administrator. No balances are shown while access is restricted."
        action={<Link href="/store/workspace" className="inline-flex min-h-11 items-center underline underline-offset-4">Return to your workspace</Link>}
      />
    </ProtectedPageFrame>
  );
}
