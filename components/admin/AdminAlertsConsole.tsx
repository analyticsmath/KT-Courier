"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  ADMIN_ALERT_EVENT_TYPES,
  ADMIN_ALERT_EVENT_LABELS,
  ADMIN_ALERT_ROLE_SCOPES,
  type AdminAlertEventType,
  type AdminAlertRecipientConfig,
  type AdminAlertRoleScope,
} from "@/lib/settings/admin-alert-recipient-policy";
import type {
  AdminAlertDeliveryOverviewItem,
  AdminAlertOverviewItem,
} from "@/lib/notifications/admin-alert-dispatch.service";

interface AdminAlertsConsoleProps {
  initialRecipients: AdminAlertRecipientConfig[];
  events: AdminAlertOverviewItem[];
  deliveries: AdminAlertDeliveryOverviewItem[];
  counts: {
    pending: number;
    failed: number;
    sent: number;
    activeAdminRecipients: number;
    activeSuperAdminRecipients: number;
  };
  canEditRecipients: boolean;
  canRetryDeliveries: boolean;
}

export function AdminAlertsConsole({
  initialRecipients,
  events,
  deliveries,
  counts,
  canEditRecipients,
  canRetryDeliveries,
}: AdminAlertsConsoleProps) {
  const router = useRouter();
  const [recipients, setRecipients] = useState<AdminAlertRecipientConfig[]>(initialRecipients);
  const [eventFilter, setEventFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [newEmail, setNewEmail] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newRoleScope, setNewRoleScope] = useState<AdminAlertRoleScope>("ADMIN");
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addRecipient() {
    setError(null);
    const email = newEmail.trim().toLowerCase();
    const label = newLabel.trim();
    if (!email || !label) {
      setError("Enter both an email address and recipient label.");
      return;
    }
    if (recipients.some((r) => r.email.toLowerCase() === email)) {
      setError("That email is already configured.");
      return;
    }
    setRecipients((prev) => [
      ...prev,
      {
        email,
        label,
        active: true,
        roleScope: newRoleScope,
        events: [...ADMIN_ALERT_EVENT_TYPES],
      },
    ]);
    setNewEmail("");
    setNewLabel("");
  }

  function toggleEvent(email: string, eventType: AdminAlertEventType) {
    setRecipients((prev) =>
      prev.map((r) => {
        if (r.email !== email) return r;
        const exists = r.events.includes(eventType);
        const next = exists
          ? r.events.filter((e) => e !== eventType)
          : [...r.events, eventType];
        return { ...r, events: next };
      }),
    );
  }

  async function saveRecipients() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = recipients.map((r) => ({
        email: r.email,
        label: r.label,
        active: r.active,
        roleScope: r.roleScope ?? "ALL",
        events: [...r.events],
      }));
      const res = await fetch(
        `/api/admin/settings/${encodeURIComponent("notifications.admin_alert_recipients")}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: payload }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Failed to update recipient policy.");
        return;
      }
      setMessage("Admin and SuperAdmin alert recipients updated.");
      router.refresh();
    } catch {
      setError("Network error while saving recipients.");
    } finally {
      setSaving(false);
    }
  }

  async function retryFailed() {
    setRetrying(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/notifications/admin-alerts/retry", {
        method: "POST",
      });
      const data = (await res.json()) as {
        error?: string;
        checked?: number;
        sent?: number;
        failed?: number;
      };
      if (!res.ok || data.error) {
        setError(data.error ?? "Failed to retry admin alerts.");
        return;
      }
      setMessage(
        `Retried ${data.checked ?? 0} deliveries: ${data.sent ?? 0} sent, ${data.failed ?? 0} still failing.`,
      );
      router.refresh();
    } catch {
      setError("Network error while retrying alerts.");
    } finally {
      setRetrying(false);
    }
  }

  const filteredEvents = events.filter(
    (e) => eventFilter === "ALL" || e.eventType === eventFilter,
  );
  const filteredDeliveries = deliveries.filter(
    (d) =>
      (eventFilter === "ALL" || d.eventType === eventFilter) &&
      (statusFilter === "ALL" || d.deliveryStatus === statusFilter),
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-[var(--kt-soft-border)] bg-white p-3">
          <p className="text-xs text-[var(--kt-text-muted)]">Admin recipients</p>
          <p className="mt-1 text-xl font-bold">{counts.activeAdminRecipients}</p>
        </div>
        <div className="rounded-xl border border-[var(--kt-soft-border)] bg-white p-3">
          <p className="text-xs text-[var(--kt-text-muted)]">SuperAdmin recipients</p>
          <p className="mt-1 text-xl font-bold">{counts.activeSuperAdminRecipients}</p>
        </div>
        <div className="rounded-xl border border-[var(--kt-soft-border)] bg-white p-3">
          <p className="text-xs text-[var(--kt-text-muted)]">Email sent</p>
          <p className="mt-1 text-xl font-bold text-emerald-700">{counts.sent}</p>
        </div>
        <div className="rounded-xl border border-[var(--kt-soft-border)] bg-white p-3">
          <p className="text-xs text-[var(--kt-text-muted)]">Pending retry</p>
          <p className="mt-1 text-xl font-bold text-amber-700">{counts.pending}</p>
        </div>
        <div className="rounded-xl border border-[var(--kt-soft-border)] bg-white p-3">
          <p className="text-xs text-[var(--kt-text-muted)]">Failed alerts</p>
          <p className="mt-1 text-xl font-bold text-red-700">{counts.failed}</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}

      <section className="rounded-2xl border border-[var(--kt-soft-border)] bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--kt-ink-navy)]">
              Verified Admin &amp; SuperAdmin Alert Recipients
            </h2>
            <p className="text-xs text-[var(--kt-text-muted)]">
              Configure distinct Admin and SuperAdmin destinations per parcel, payment, expiry, and COD event. Placeholders are rejected.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canRetryDeliveries ? (
              <Button variant="secondary" size="sm" onClick={retryFailed} disabled={retrying}>
                {retrying ? "Retrying…" : "Retry failed email deliveries"}
              </Button>
            ) : null}
            {canEditRecipients ? (
              <Button variant="primary" size="sm" onClick={saveRecipients} disabled={saving}>
                {saving ? "Saving…" : "Save recipient policy"}
              </Button>
            ) : null}
          </div>
        </div>

        {canEditRecipients ? (
          <div className="grid gap-3 sm:grid-cols-4 rounded-xl border border-[var(--kt-soft-border)] p-3 bg-[var(--kt-surface)]">
            <div>
              <Label htmlFor="alert-new-email">Email</Label>
              <Input
                id="alert-new-email"
                type="email"
                placeholder="ops-admin@domain.co.za"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="alert-new-label">Desk / Label</Label>
              <Input
                id="alert-new-label"
                placeholder="SuperAdmin Escalation"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="alert-new-scope">Role scope</Label>
              <select
                id="alert-new-scope"
                value={newRoleScope}
                onChange={(e) => setNewRoleScope(e.target.value as AdminAlertRoleScope)}
                className="w-full min-h-10 rounded-lg border border-[var(--kt-soft-border)] px-3 text-sm bg-white"
              >
                {ADMIN_ALERT_ROLE_SCOPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="button" variant="secondary" size="sm" onClick={addRecipient}>
                Add recipient
              </Button>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          {recipients.length === 0 ? (
            <p className="text-sm text-[var(--kt-text-muted)]">
              No active Admin or SuperAdmin email recipients configured yet.
            </p>
          ) : (
            recipients.map((r) => (
              <div
                key={r.email}
                className="rounded-xl border border-[var(--kt-soft-border)] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {r.label} ({r.email})
                    </p>
                    <p className="text-xs text-[var(--kt-text-muted)]">
                      Scope: {r.roleScope ?? "ALL"} · Status: {r.active ? "Active" : "Paused"}
                    </p>
                  </div>
                  {canEditRecipients ? (
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Role scope for ${r.email}`}
                        value={r.roleScope ?? "ALL"}
                        onChange={(e) => {
                          const nextScope = e.target.value as AdminAlertRoleScope;
                          setRecipients((prev) =>
                            prev.map((x) => (x.email === r.email ? { ...x, roleScope: nextScope } : x)),
                          );
                        }}
                        className="rounded border border-[var(--kt-soft-border)] px-2 py-1 text-xs"
                      >
                        {ADMIN_ALERT_ROLE_SCOPES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setRecipients((prev) =>
                            prev.map((x) => (x.email === r.email ? { ...x, active: !x.active } : x)),
                          )
                        }
                      >
                        {r.active ? "Pause" : "Activate"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setRecipients((prev) => prev.filter((x) => x.email !== r.email))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {ADMIN_ALERT_EVENT_TYPES.map((ev) => {
                    const checked = r.events.includes(ev);
                    return (
                      <label key={ev} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canEditRecipients}
                          onChange={() => toggleEvent(r.email, ev)}
                        />
                        <span>{ADMIN_ALERT_EVENT_LABELS[ev]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--kt-soft-border)] bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[var(--kt-ink-navy)]">
            Admin Alert Feed &amp; Email Delivery Log
          </h2>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Filter by alert event type"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="rounded-lg border border-[var(--kt-soft-border)] px-3 py-1.5 text-xs bg-white"
            >
              <option value="ALL">All event types</option>
              {ADMIN_ALERT_EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ADMIN_ALERT_EVENT_LABELS[t]}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by email delivery status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-[var(--kt-soft-border)] px-3 py-1.5 text-xs bg-white"
            >
              <option value="ALL">All delivery statuses</option>
              <option value="SENT">Sent</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Recent operational alerts ({filteredEvents.length})</h3>
            {filteredEvents.length === 0 ? (
              <p className="text-xs text-[var(--kt-text-muted)]">No operational alerts match the selected filter.</p>
            ) : (
              <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {filteredEvents.map((ev) => (
                  <li
                    key={ev.id}
                    className="rounded-lg border border-[var(--kt-soft-border)] p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{ev.eventLabel}</span>
                      <span className="text-[var(--kt-text-muted)]">
                        {new Date(ev.createdAt).toLocaleString("en-ZA")}
                      </span>
                    </div>
                    <p className="font-medium text-[var(--kt-ink-navy)]">{ev.title}</p>
                    <p className="text-[var(--kt-text-muted)]">{ev.summary}</p>
                    <Link href={ev.adminPath} className="eo-text-link inline-block">
                      Open record ({ev.aggregateReference})
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Recipient email deliveries ({filteredDeliveries.length})</h3>
            {filteredDeliveries.length === 0 ? (
              <p className="text-xs text-[var(--kt-text-muted)]">No email delivery logs match the selected filter.</p>
            ) : (
              <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {filteredDeliveries.map((del) => (
                  <li
                    key={del.id}
                    className="rounded-lg border border-[var(--kt-soft-border)] p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{del.eventLabel}</span>
                      <span
                        className={`rounded px-2 py-0.5 font-semibold ${
                          del.deliveryStatus === "SENT"
                            ? "bg-emerald-100 text-emerald-800"
                            : del.deliveryStatus === "FAILED"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {del.deliveryStatus}
                      </span>
                    </div>
                    <p className="text-[var(--kt-text-muted)]">
                      Ref: {del.aggregateReference} · Retries: {del.retryCount}
                      {del.lastFailureCode ? ` · Reason: ${del.lastFailureCode}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
