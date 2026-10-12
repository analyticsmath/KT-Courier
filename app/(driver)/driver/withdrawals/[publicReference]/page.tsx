import OwnerWithdrawalDetailPage from "@/components/withdrawals/OwnerWithdrawalDetailPage";
import { UserRole } from "@/types/db";
export default function Page({ params }: { params: Promise<{ publicReference: string }> }) { return <OwnerWithdrawalDetailPage ownerRole={UserRole.DRIVER} basePath="/driver/withdrawals" params={params} />; }
