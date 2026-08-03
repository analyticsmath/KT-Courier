"use client";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
export default function PaymentWebhooksError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <ErrorPanel title="Payment webhooks unavailable" message="The read-only webhook view could not be loaded." onRetry={reset} />; }
