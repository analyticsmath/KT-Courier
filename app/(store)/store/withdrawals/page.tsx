import OwnerWithdrawalsPage from "@/components/withdrawals/OwnerWithdrawalsPage";
import { UserRole } from "@/types/db";
export default function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) { return <OwnerWithdrawalsPage ownerRole={UserRole.STORE} basePath="/store/withdrawals" searchParams={searchParams} />; }
