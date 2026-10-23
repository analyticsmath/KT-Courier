"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refreshes server-rendered delivery stages without full-page navigation.
 * Location coordinates remain available only through their owner-authorized API.
 * Pauses when hidden and never changes or advances any delivery state. */
export function LiveDeliveryStatusRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const update = () => { if (document.visibilityState === "visible") router.refresh(); };
    const interval = window.setInterval(update, 30_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [active, router]);
  return null;
}
