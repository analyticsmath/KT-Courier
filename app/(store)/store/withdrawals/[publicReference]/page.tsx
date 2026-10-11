import OwnerWithdrawalDetailPage from "@/components/withdrawals/OwnerWithdrawalDetailPage";
import { UserRole } from "@/types/db";
export default function Page({ params }: { params: Promise<{ publicReference: string }> }) { return <OwnerWithdrawalDetailPage ownerRole={UserRole.STORE} basePath="/store/withdrawals" params={params} />; }
