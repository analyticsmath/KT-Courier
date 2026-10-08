import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { isSafeInternalRoute } from "@/lib/notifications/contracts";
import { InboxControls, NotificationPreferences } from "./InboxControls";

async function ownedPermissions(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
  if (user?.status !== "ACTIVE") return { read: false, state: false, preferences: false };
  const check = (permissionKey: string) => hasPermission({ userId, role: user.role, permissionKey });
  const [read, state, preferences] = await Promise.all([check(PERMISSIONS.NOTIFICATION_READ_OWN), check(PERMISSIONS.NOTIFICATION_MANAGE_OWN_READ_STATE), check(PERMISSIONS.NOTIFICATION_MANAGE_OWN_PREFERENCES)]);
  return { read, state, preferences };
}
export async function NotificationIndicator({ userId, href }: { userId: string; href: string }) {
  if (!(await ownedPermissions(userId)).read) return null;
  const count = await prisma.notificationInboxItem.count({ where: { ownerUserId: userId, state: "UNREAD", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
  return <Link href={href} aria-label={`${count} unread notifications`} className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-[var(--kt-navy)] hover:bg-[var(--kt-cloud-blue)] rounded-lg">Notifications <span aria-label="Unread notification count" className="min-w-5 h-5 px-1 grid place-items-center rounded-full bg-[var(--kt-signal-cobalt)] text-white text-xs">{count}</span></Link>;
}
export async function NotificationCentre({ userId, title = "Notifications" }: { userId: string; title?: string }) {
  const permissions = await ownedPermissions(userId);
  if (!permissions.read) return <p>You do not have permission to read account notifications.</p>;
  const [items, categories, preferences] = await Promise.all([
    prisma.notificationInboxItem.findMany({ where: { ownerUserId: userId, state: { not: "ARCHIVED" }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { createdAt: "desc" }, take: 50 }),
    permissions.preferences ? prisma.notificationCategory.findMany({ where: { status: "ACTIVE" }, select: { key: true, mandatory: true, purpose: true }, orderBy: { key: "asc" } }) : [],
    permissions.preferences ? prisma.notificationPreference.findMany({ where: { userId, channel: "EMAIL" }, select: { categoryKey: true, mode: true } }) : [],
  ]);
  return <section className="min-w-0 w-full max-w-2xl mx-auto space-y-5" aria-label="Notification centre">
    <div><h1 className="font-display text-2xl font-black text-[var(--kt-navy)]">{title}</h1><p className="text-sm text-[var(--kt-text-muted)] mt-1">Account and service updates from one canonical inbox.</p></div>
    {items.length === 0 ? <div className="rounded-xl border border-[var(--kt-soft-border)] bg-white p-5 text-sm text-[var(--kt-text-muted)]">You have no notifications.</div> : <ul className="space-y-3">{items.map(item => <li key={item.id} className={`rounded-xl border bg-white p-4 ${item.state === "UNREAD" ? "border-[var(--kt-signal-cobalt)]" : "border-[var(--kt-soft-border)]"}`}>
      <div className="flex gap-3"><div className="min-w-0 flex-1"><h2 className="font-bold text-[var(--kt-navy)] [overflow-wrap:anywhere]">{item.title}</h2><p className="mt-1 text-sm text-[var(--kt-text-muted)] [overflow-wrap:anywhere]">{item.body}</p><time className="mt-2 block text-xs text-[var(--kt-text-muted)]">{item.createdAt.toLocaleString("en-ZA")}</time></div>{item.state === "UNREAD" ? <span aria-label="Unread notification" className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--kt-signal-cobalt)]" /> : null}</div>
      {item.actionRoute && isSafeInternalRoute(item.actionRoute) ? <Link href={item.actionRoute} className="mt-2 inline-flex min-h-12 items-center underline">View update</Link> : null}
      {permissions.state ? <InboxControls reference={item.publicReference} state={item.state} /> : null}
    </li>)}</ul>}
    {permissions.preferences && categories.length ? <NotificationPreferences categories={categories.map(category => ({ key: category.key, required: category.mandatory || ["SECURITY", "LEGAL"].includes(category.purpose), emailEnabled: preferences.find(preference => preference.categoryKey === category.key)?.mode !== "DISABLED" }))} /> : null}
  </section>;
}
