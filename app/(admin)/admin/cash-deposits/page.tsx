import { requireAdminPagePermission } from "@/lib/auth/guards";
import {
  listCashDeposits,
  readBankInstructions,
} from "@/lib/client-platform/driver-cash.service";
import { CashDepositReview } from "@/components/forms/CashDepositReview";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
export const metadata = { title: "Cash deposits" };
export default async function Page() {
  const u = await requireAdminPagePermission("cod_operations.manage", "/admin");
  const [deposits, bank] = await Promise.all([
    listCashDeposits(u),
    readBankInstructions(),
  ]);
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Cash operations"
        title="Cash deposits"
        description="Manage official bank details, share them with drivers and reconcile verified deposits or cash physically handed over."
      />
      <OperationalPanel title="Deposit verification">
        <CashDepositReview deposits={deposits} bank={bank} />
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
