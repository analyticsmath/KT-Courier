"use client";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
export default function PaymentReconciliationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <ErrorPanel title="Payment reconciliation unavailable" message="The read-only reconciliation view could not be loaded." onRetry={reset} />; }
