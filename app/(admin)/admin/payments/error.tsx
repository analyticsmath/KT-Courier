"use client";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
export default function PaymentsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <ErrorPanel title="Payments unavailable" message="The read-only payment view could not be loaded." onRetry={reset} />; }

