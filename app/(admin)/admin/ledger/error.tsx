"use client";

import { ErrorPanel } from "@/components/ui/ErrorPanel";

export default function LedgerError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel title="Ledger unavailable" message="The read-only ledger view could not be loaded." onRetry={reset} />;
}

