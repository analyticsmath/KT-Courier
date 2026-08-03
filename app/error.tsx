"use client";

import { PublicErrorState } from "@/components/public-v2/errors";

export default function Error({ reset }: { reset: () => void }) {
  return <PublicErrorState onRetry={reset} />;
}
