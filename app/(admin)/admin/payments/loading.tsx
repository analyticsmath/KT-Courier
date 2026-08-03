import { Skeleton } from "@/components/ui/LoadingSkeleton";
export default function PaymentsLoading() { return <div className="space-y-6" role="status" aria-label="Loading payments"><span className="sr-only">Loading payments</span><Skeleton className="h-20" /><Skeleton className="h-96" /></div>; }

