import { Skeleton } from "@/components/ui/LoadingSkeleton";
export default function PaymentWebhooksLoading() { return <div className="space-y-6" role="status" aria-label="Loading payment webhooks"><span className="sr-only">Loading payment webhooks</span><Skeleton className="h-20" /><Skeleton className="h-96" /></div>; }
