"use client";

import { useEffect, useState } from "react";

export function OfflineBanner() {
  // A stable online default renders identically on the server and client.
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-[var(--kt-red)] text-white text-xs font-semibold text-center py-2 px-4 sticky top-0 z-50 shadow-sm"
    >
      ⚠️ You appear to be offline. Some information may be outdated and actions that require a connection may not complete.
    </div>
  );
}
