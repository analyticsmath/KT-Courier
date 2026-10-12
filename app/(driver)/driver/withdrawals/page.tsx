import OwnerWithdrawalsPage from "@/components/withdrawals/OwnerWithdrawalsPage";
import { UserRole } from "@/types/db";
export default function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) { return <OwnerWithdrawalsPage ownerRole={UserRole.DRIVER} basePath="/driver/withdrawals" searchParams={searchParams} />; }
