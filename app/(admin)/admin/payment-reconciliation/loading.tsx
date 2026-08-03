import { Skeleton } from "@/components/ui/LoadingSkeleton";
export default function PaymentReconciliationLoading() { return <div className="space-y-6" role="status" aria-label="Loading payment reconciliation"><span className="sr-only">Loading payment reconciliation</span><Skeleton className="h-20" /><Skeleton className="h-96" /></div>; }
