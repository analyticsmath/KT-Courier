import OwnerPayoutDestinationsPage from "@/components/withdrawals/OwnerPayoutDestinationsPage";
import { UserRole } from "@/types/db";
export default function Page() { return <OwnerPayoutDestinationsPage ownerRole={UserRole.STORE} basePath="/store/withdrawals" />; }
