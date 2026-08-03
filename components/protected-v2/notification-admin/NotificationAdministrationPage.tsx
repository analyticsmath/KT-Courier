import Link from "next/link";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { presentR21Status } from "@/lib/admin-presentation/r21-status";
import { prisma } from "@/lib/db/prisma";
import { resolveNotificationProductionComposition } from "@/lib/notifications/composition-root";

export type NotificationAdministrationKind = "category" | "template" | "route" | "delivery" | "suppression" | "provider" | "reconciliation";

const configuration: Record<NotificationAdministrationKind, { title: string; description: string; model: string }> = {
  category: { title: "Notification categories", description: "Canonical category records. Mutation authority remains server-side.", model: "notificationCategory" },
  template: { title: "Notification templates", description: "Versioned templates and canonical variables only.", model: "notificationTemplate" },
  route: { title: "Notification routing", description: "Event-route records without inferred channel or recipient analytics.", model: "notificationEventRoute" },
  delivery: { title: "Notification delivery attempts", description: "Safe delivery metadata; payloads, headers, and recipient analytics are not shown.", model: "notificationDelivery" },
  suppression: { title: "Notification suppressions", description: "Canonical suppression records with no client-side eligibility calculation.", model: "notificationSuppression" },
  provider: { title: "Notification provider readiness", description: "Readiness records only. Provider secrets and active-delivery claims are withheld.", model: "notificationEndpoint" },
  reconciliation: { title: "Notification reconciliation", description: "Canonical recovery cases without a force-resolve action.", model: "notificationReconciliationCase" },
};

type SafeNotificationRow = { id: string; reference: string; label: string; status: string; recordedAt: string | null };

function safeRow(record: Record<string, unknown>): SafeNotificationRow {
  const reference = typeof record.publicReference === "string" ? record.publicReference : "Reference unavailable";
  const label = [record.key, record.name, record.channel, record.provider, record.reason, record.eventType]
    .find((value): value is string => typeof value === "string" && value.length > 0) ?? reference;
  const status = typeof record.status === "string" ? record.status : record.active === false ? "RETIRED" : "RECORDED";
  const date = record.updatedAt ?? record.createdAt ?? record.openedAt;
  return { id: typeof record.id === "string" ? record.id : reference, reference, label, status, recordedAt: date instanceof Date ? date.toISOString() : null };
}

function lockNotice() {
  const composition = resolveNotificationProductionComposition();
  return composition.status === "LOCKED" ? <ProtectedState kind="locked" title="Delivery changes are production locked" description="Read-only canonical records remain available. No activation, retry, or configuration control is presented here." /> : null;
}

export async function NotificationAdministrationPage({ kind, reference }: { kind: NotificationAdministrationKind; reference?: string }) {
  const config = configuration[kind];
  const db = prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<Record<string, unknown>[]>; findUnique: (args: unknown) => Promise<Record<string, unknown> | null> }>;
  const records = reference
    ? [await db[config.model].findUnique({ where: { publicReference: reference } })].filter((record): record is Record<string, unknown> => Boolean(record))
    : await db[config.model].findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const rows = records.map(safeRow);

  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Notification administration" title={reference ?? config.title} description={config.description} />
    {lockNotice()}
    <OperationalPanel title={reference ? "Canonical record" : "Canonical records"} description="Statuses are source-backed. An unknown state remains neutral until its authority is reviewed.">
      <EditorialTable caption={`${config.title} records`} mobileMode="stack" rows={rows} emptyState={<ProtectedState kind="empty" title="No records available" description="No canonical record is currently available for this view." />} columns={[
        { id: "record", header: "Record", priority: "primary", cell: (row) => <div><strong>{row.label}</strong><p className="text-sm text-[var(--eo-muted)]">{row.reference}</p></div> },
        { id: "state", header: "State", priority: "secondary", cell: (row) => { const state = presentR21Status(row.status); return <ProtectedStatus label={state.label} tone={state.tone} />; } },
        { id: "recorded", header: "Recorded", priority: "optional", cell: (row) => row.recordedAt ? new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.recordedAt)) : "Not recorded" },
      ]} />
    </OperationalPanel>
  </ProtectedPageFrame>;
}

export async function NotificationAdministrationOverview() {
  const db = prisma as unknown as Record<string, { count: (args?: unknown) => Promise<number> }>;
  const entries = await Promise.all([
    ["Categories", "notificationCategory", "/admin/notifications/categories"],
    ["Templates", "notificationTemplate", "/admin/notifications/templates"],
    ["Routes", "notificationEventRoute", "/admin/notifications/routes"],
    ["Delivery attempts", "notificationDelivery", "/admin/notifications/deliveries"],
    ["Suppressions", "notificationSuppression", "/admin/notifications/suppressions"],
    ["Reconciliation cases", "notificationReconciliationCase", "/admin/notifications/reconciliation"],
  ].map(async ([label, model, href]) => ({ id: model, label, href, count: await db[model].count() })));

  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Notification administration" title="Notification operations" description="Canonical configuration, delivery, and reconciliation records. Counts are source-backed, not delivery analytics." />
    {lockNotice()}
    <OperationalPanel title="Operational records" description="Open a record group to review its permission-scoped projection.">
      <ul aria-label="Notification administration record groups" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{entries.map((entry) => <li key={entry.id}><Link className="block rounded border border-[var(--eo-border)] p-4 font-semibold hover:underline" href={entry.href}>{entry.label}<span className="mt-1 block text-sm font-normal text-[var(--eo-muted)]">{entry.count} recorded</span></Link></li>)}</ul>
    </OperationalPanel>
  </ProtectedPageFrame>;
}
