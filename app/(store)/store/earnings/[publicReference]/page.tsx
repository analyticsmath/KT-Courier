import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActivityTimeline } from "@/components/protected-v2/feedback/ActivityTimeline";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreEarningForOwner } from "@/lib/services/store-earning-query.service";

export default async function StoreEarningDetailPage({ params }: { params: Promise<{ publicReference: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const { publicReference } = await params;
  const earning = await getStoreEarningForOwner(user.id, publicReference);
  if (!earning) notFound();
  return <ProtectedPageFrame>
    <ProtectedPageHeader breadcrumbs={[{ label: "Earnings", href: "/store/earnings" }, { label: earning.publicReference }]} title="Earning record" description={earning.publicReference} actions={<Link className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] border border-[var(--eo-line-strong)] px-3 text-sm font-semibold" href="/store/earnings">Back to earnings</Link>} />
    <OperationalPanel title="Store earning status" padding="compact"><ProtectedStatus label={earning.status.replaceAll("_", " ")} /><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="font-semibold text-[var(--eo-text-muted)]">Original earning</dt><dd className="mt-1 font-semibold tabular-nums">ZAR {earning.originalEarningAmount}</dd></div><div><dt className="font-semibold text-[var(--eo-text-muted)]">Available payable</dt><dd className="mt-1 font-semibold tabular-nums">ZAR {earning.availablePayableAmount}</dd></div><div><dt className="font-semibold text-[var(--eo-text-muted)]">Refund reserved</dt><dd className="mt-1 tabular-nums">ZAR {earning.refundReservedAmount}</dd></div><div><dt className="font-semibold text-[var(--eo-text-muted)]">Released</dt><dd className="mt-1 tabular-nums">ZAR {earning.releasedAmount}</dd></div></dl></OperationalPanel>
    <OperationalPanel title="Earning activity" padding="compact">{earning.history.length ? <ActivityTimeline ariaLabel="Store earning activity" items={earning.history.map((event, index) => ({ id: `${event.createdAt}-${index}`, title: event.status.replaceAll("_", " "), description: event.reasonCode ? `Reason: ${event.reasonCode.replaceAll("_", " ")}` : undefined, timestamp: new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.createdAt)) }))} /> : <p className="text-sm text-[var(--eo-text-secondary)]" role="status">No store-safe earning activity is available.</p>}</OperationalPanel>
    <OperationalPanel title="Financial controls" padding="compact"><p className="text-sm text-[var(--eo-text-secondary)]">No withdrawal, reversal, or payment action is available from this record. Existing financial controls and review boundaries remain unchanged.</p></OperationalPanel>
  </ProtectedPageFrame>;
}
