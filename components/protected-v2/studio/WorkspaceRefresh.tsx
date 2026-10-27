"use client";
import { useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import s from "./workspaceStudio.module.css";
/** Refresh server-authorized data; no animation and no background requests in hidden tabs. */
export function WorkspaceRefresh({ checkedAt }: { checkedAt: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refresh = useCallback(() => {
    if (!pending) startTransition(() => router.refresh());
  }, [router, pending]);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const interval = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);
  const time = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(checkedAt));
  return (
    <div className={s.refreshControl}>
      <span>
        Checked <time dateTime={checkedAt}>{time}</time> SAST · updates every
        minute
      </span>
      <button type="button" onClick={refresh} disabled={pending}>
        {pending ? "Refreshing…" : "Refresh data"}
      </button>
    </div>
  );
}
