/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is intentionally deferred. */
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export async function NotificationIndicator({ userId, href }: { userId: string; href: string }) {
  const count = await (prisma as any).notificationInboxItem.count({ where: { ownerUserId: userId, state: "UNREAD", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
  return <Link href={href} aria-label={`${count} unread notifications`} className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-[var(--kt-navy)] hover:bg-[var(--kt-cloud-blue)] rounded-lg">Notifications <span aria-label="Unread notification count" className="min-w-5 h-5 px-1 grid place-items-center rounded-full bg-[var(--kt-signal-cobalt)] text-white text-xs">{count}</span></Link>;
}

export async function NotificationCentre({ userId, title = "Notifications" }: { userId: string; title?: string }) {
  const items = await (prisma as any).notificationInboxItem.findMany({ where: { ownerUserId: userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { createdAt: "desc" }, take: 50 });
  return <section className="max-w-2xl mx-auto space-y-5" aria-label="Notification centre"><div><h1 className="font-display text-2xl font-black text-[var(--kt-navy)]">{title}</h1><p className="text-sm text-[var(--kt-text-muted)] mt-1">Account and service updates from one canonical inbox.</p></div>{items.length === 0 ? <div className="rounded-xl border border-[var(--kt-soft-border)] bg-white p-5 text-sm text-[var(--kt-text-muted)]">You have no notifications.</div> : <ul className="space-y-3">{items.map((item: any) => <li key={item.id} className={`rounded-xl border bg-white p-4 ${item.state === "UNREAD" ? "border-[var(--kt-signal-cobalt)]" : "border-[var(--kt-soft-border)]"}`}><div className="flex gap-3"><div className="min-w-0 flex-1"><h2 className="font-bold text-[var(--kt-navy)]">{item.title}</h2><p className="mt-1 text-sm text-[var(--kt-text-muted)]">{item.body}</p><time className="mt-2 block text-xs text-[var(--kt-text-muted)]">{item.createdAt.toLocaleString("en-ZA")}</time></div>{item.state === "UNREAD" ? <span aria-label="Unread notification" className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--kt-signal-cobalt)]" /> : null}</div></li>)}</ul>}</section>;
}
