"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const promoterNavigation = [
  ["Dashboard", "/promoter"], ["Programs", "/promoter/programs"], ["Links", "/promoter/links"], ["Referrals", "/promoter/referrals"], ["Earnings", "/promoter/earnings"], ["Wallet", "/promoter/wallet"], ["Withdrawals", "/promoter/withdrawals"], ["Performance", "/promoter/performance"], ["Assets", "/promoter/assets"], ["Compliance", "/promoter/compliance"], ["Disputes", "/promoter/disputes"], ["Profile", "/promoter/profile"], ["Support", "/promoter/support"],
] as const;
const adminNavigation = [
  ["Promoters", "/admin/promoters"], ["Programs", "/admin/promoter-programs"], ["Attributions", "/admin/promoter-attributions"], ["Qualifications", "/admin/promoter-qualifications"], ["Earnings", "/admin/promoter-earnings"], ["Fraud", "/admin/promoter-fraud"], ["Reconciliation", "/admin/promoter-reconciliation"], ["Disputes", "/admin/promoter-disputes"], ["Assets", "/admin/promoter-assets"], ["Agreements", "/admin/promoter-agreements"],
] as const;

function apiPath(pathname: string, admin: boolean): string | null {
  if (admin) return pathname.startsWith("/admin/") ? `/api${pathname}` : null;
  if (pathname === "/promoter") return "/api/promoter";
  if (pathname === "/promoter/links") return "/api/promoter/referral-codes";
  if (pathname === "/promoter/support") return "/api/promoter/disputes";
  return pathname.startsWith("/promoter/") ? `/api${pathname}` : null;
}

export function PromoterSurface({ title, admin = false, detail = false }: { title: string; admin?: boolean; detail?: boolean }) {
  const pathname = usePathname(); const endpoint = useMemo(() => apiPath(pathname, admin), [pathname, admin]);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "denied" | "locked" | "reconciliation" | "error">("loading"); const [data, setData] = useState<unknown>(null);
  useEffect(() => { let active = true; if (!endpoint) return () => { active = false; }; fetch(endpoint, { cache: "no-store", credentials: "same-origin" }).then(async (response) => { const payload = await response.json().catch(() => null); if (!active) return; setData(payload); if (response.status === 401 || response.status === 403) setState("denied"); else if (response.status === 503) setState("locked"); else if (!response.ok) setState("error"); else if ((payload as { state?: string; reconciliationRequired?: boolean } | null)?.state === "RECONCILIATION_REQUIRED" || (payload as { reconciliationRequired?: boolean } | null)?.reconciliationRequired === true) setState("reconciliation"); else if (Object.values(payload ?? {}).some((value) => Array.isArray(value) && value.length === 0)) setState("empty"); else setState("ready"); }).catch(() => active && setState("error")); return () => { active = false; }; }, [endpoint]);
  const navigation = admin ? adminNavigation : promoterNavigation;
  return <main className="mx-auto max-w-6xl p-6"><p className="text-sm text-slate-500">Phase 25 promoter operations</p><h1 className="text-3xl font-semibold">{title}</h1><p className="mt-3 max-w-3xl text-slate-700">{detail ? "Safe evidence and permitted canonical recovery are shown here. Financial edits are unavailable." : "Visits, valid touches, attributed subjects, pending qualifications, qualified conversions, held earnings, payable earnings, available funds, withdrawn earnings, and reversals are distinct states."}</p><nav className="mt-6 flex flex-wrap gap-3">{navigation.map(([label, href]) => <Link key={href} className="rounded border px-3 py-2" href={href}>{label}</Link>)}</nav><section aria-live="polite" className="mt-8 rounded border p-5"><h2 className="font-medium">{state === "loading" ? "Loading safe projection" : state === "empty" ? "No records yet" : state === "denied" ? "Permission denied" : state === "locked" ? "Production locked" : state === "reconciliation" ? "Reconciliation required" : state === "error" ? "Projection unavailable" : "Current safe projection"}</h2><p className="mt-2 text-sm text-slate-600">{state === "loading" ? "Retrieving the current source-backed projection." : state === "empty" ? "There are no records matching this view." : state === "denied" ? "Your account does not have the required promoter permission." : state === "locked" ? "Promoter mutations and dependent operational validation remain locked until Phase 26.5." : state === "reconciliation" ? "Canonical reconciliation is required before this projection can be treated as complete." : state === "error" ? "The projection could not be loaded safely. Try again later." : "The records below are privacy-filtered and do not include customer identity, payment, address, device, network, or fraud evidence."}</p>{state === "ready" && <pre className="mt-4 overflow-auto rounded bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(data, null, 2)}</pre>}</section></main>;
}
