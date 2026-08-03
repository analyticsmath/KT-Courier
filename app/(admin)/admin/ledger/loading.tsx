import { Skeleton } from "@/components/ui/LoadingSkeleton";

export default function LedgerLoading() {
  return <div className="space-y-6" role="status" aria-label="Loading ledger">
    <span className="sr-only">Loading ledger</span>
    <Skeleton className="h-20" />
    <Skeleton className="h-80" />
    <Skeleton className="h-80" />
  </div>;
}
