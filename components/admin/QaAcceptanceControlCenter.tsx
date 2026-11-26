"use client";

import { useState } from "react";
import Link from "next/link";
import { OperationalPanel, MetricTile } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";

type QaRole = "CUSTOMER" | "VENDOR" | "DRIVER" | "ADMIN";

export interface QaAcceptanceDashboardView {
  config: {
    eligible: boolean;
    laneFlagEnabled: boolean;
    acceptanceSandboxFlagEnabled: boolean;
    secretSource: string;
    secretConfigured: boolean;
    publicKeyConfigured: boolean;
    reason: string;
    credentialVersion: string;
    releaseSha: string | null;
  };
  principals: Array<{
    id: string;
    publicReference: string;
    role: QaRole;
    active: boolean;
    label: string | null;
    notes: string | null;
    enrolledAt: string;
    revokedAt: string | null;
    revokeReason: string | null;
    user: { id: string; email: string; name: string | null; role: string; status: string; isQaAcceptance: boolean };
    store: { id: string; name: string; slug: string; status: string; isQaAcceptance: boolean } | null;
    driverProfile: { id: string; driverCode: string; status: string; onboardingStatus: string; isQaAcceptance: boolean } | null;
  }>;
  runs: Array<{
    id: string;
    publicReference: string;
    title: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    archivedAt: string | null;
    archiveReason: string | null;
    store: { id: string; name: string; slug: string } | null;
    customerUser: { id: string; email: string; name: string | null } | null;
    driverProfile: { id: string; driverCode: string; user: { email: string; name: string | null } } | null;
    _count: {
      orders: number;
      payments: number;
      marketplaceCheckouts: number;
      marketplaceOrders: number;
      marketplaceStoreOrders: number;
    };
  }>;
  candidates: {
    stores: Array<{
      id: string;
      name: string;
      slug: string;
      status: string;
      isQaAcceptance: boolean;
      owner: { id: string; email: string; name: string | null; role: string };
    }>;
    users: Array<{
      id: string;
      email: string;
      name: string | null;
      role: string;
      status: string;
      isQaAcceptance: boolean;
      store: { id: string; name: string; slug: string } | null;
      driverProfile: { id: string; driverCode: string; status: string; onboardingStatus: string } | null;
    }>;
  };
  reconciliation: {
    qaOrderCount: number;
    qaMarketplaceOrderCount: number;
    qaSucceededPaymentCount: number;
    qaStoreEarningCount: number;
    qaDriverEarningCount: number;
    qaCommissionCount: number;
    qaCodCount: number;
    qaShipmentDocCount: number;
    isolatedWallets: Array<{
      id: string;
      ownerType: string;
      ownerId: string;
      isQaIsolated: boolean;
      accounts: Array<{
        id: string;
        code: string;
        purpose: string;
        category: string;
        currentBalance: string;
        debitTotal: string;
        creditTotal: string;
      }>;
    }>;
  };
}

export function QaAcceptanceControlCenter({ initial }: { initial: QaAcceptanceDashboardView }) {
  const [dashboard, setDashboard] = useState<QaAcceptanceDashboardView>(initial);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [enrollIdentifier, setEnrollIdentifier] = useState("");
  const [enrollRole, setEnrollRole] = useState<QaRole>("CUSTOMER");
  const [enrollStoreIdentifier, setEnrollStoreIdentifier] = useState("");
  const [enrollLabel, setEnrollLabel] = useState("");

  const [runTitle, setRunTitle] = useState("Issue #40 Full End-to-End Acceptance");
  const [runStoreId, setRunStoreId] = useState<string>(
    initial.principals.find((p) => p.active && p.store)?.store?.id ?? "",
  );
  const [runCustomerId, setRunCustomerId] = useState<string>(
    initial.principals.find((p) => p.active && p.role === "CUSTOMER")?.user.id ?? "",
  );
  const [runDriverId, setRunDriverId] = useState<string>(
    initial.principals.find((p) => p.active && p.driverProfile)?.driverProfile?.id ?? "",
  );

  async function refreshDashboard(query = search) {
    setBusy(true);
    setError(null);
    try {
      const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      const res = await fetch(`/api/admin/qa-acceptance${qs}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = (await res.json()) as { dashboard?: QaAcceptanceDashboardView; error?: string };
      if (!res.ok || !payload.dashboard) throw new Error(payload.error ?? "Could not reload QA acceptance state.");
      setDashboard(payload.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reload QA acceptance state.");
    } finally {
      setBusy(false);
    }
  }

  async function postAction(body: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/qa-acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Action failed.");
      setNotice(successMessage);
      await refreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
      setBusy(false);
    }
  }

  async function patchRecord(id: string, body: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/qa-acceptance/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Update failed.");
      setNotice(successMessage);
      await refreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
      setBusy(false);
    }
  }

  const activeVendors = dashboard.principals.filter((p) => p.active && p.role === "VENDOR" && p.store);
  const activeCustomers = dashboard.principals.filter((p) => p.active && p.role === "CUSTOMER");
  const activeDrivers = dashboard.principals.filter((p) => p.active && p.role === "DRIVER" && p.driverProfile);

  return (
    <div className="space-y-6">
      {(notice || error) && (
        <div
          role="status"
          className={`rounded-xl border p-4 text-sm font-medium ${
            error
              ? "border-rose-300 bg-rose-50 text-rose-950"
              : "border-emerald-300 bg-emerald-50 text-emerald-950"
          }`}
        >
          {error ?? notice}
        </div>
      )}

      <OperationalPanel
        title="1. Runtime & Paystack Test-Mode Boundary"
        description="Server-enforced sandbox lane for demonstration accounts. Live customer checkout, commercial reporting, and live wallets stay strictly isolated."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="QA Lane Status"
            value={dashboard.config.eligible ? "ENABLED" : "BLOCKED"}
            tone={dashboard.config.eligible ? "citrus" : undefined}
            description={dashboard.config.reason}
          />
          <MetricTile
            label="Paystack Test Source"
            value={dashboard.config.secretSource === "NONE" ? "UNSET" : "TEST KEY CONFIGURED"}
            description={`Source: ${dashboard.config.secretSource} · Creds: ${dashboard.config.credentialVersion}`}
          />
          <MetricTile
            label="Release SHA"
            value={dashboard.config.releaseSha ? dashboard.config.releaseSha.slice(0, 12) : "UNRESOLVED"}
            description={`Lane flag: ${dashboard.config.laneFlagEnabled ? "true" : "false"} · Acceptance flag: ${dashboard.config.acceptanceSandboxFlagEnabled ? "true" : "false"}`}
          />
          <MetricTile
            label="Isolated Records"
            value={`${dashboard.reconciliation.qaOrderCount} orders / ${dashboard.reconciliation.qaMarketplaceOrderCount} mkt`}
            description={`${dashboard.reconciliation.qaSucceededPaymentCount} paid · ${dashboard.reconciliation.qaShipmentDocCount} PDFs · ${dashboard.reconciliation.qaCommissionCount} comm`}
          />
        </div>
        <p className="mt-4 text-xs text-[var(--kt-text-muted)]">
          Paystack test webhook destination: <code className="font-mono">/api/payments/paystack/sandbox-webhook</code> (signed by test secret; ordinary live webhooks stay at <code className="font-mono">/api/webhooks/paystack</code>).
        </p>
      </OperationalPanel>

      <OperationalPanel
        title="2. Enrolled QA Acceptance Principals"
        description="Only active QA principals can view /shop/qa, checkout QA stores, receive QA sandbox Paystack charges, or post to platform-sandbox-acceptance."
      >
        {dashboard.principals.length === 0 ? (
          <p className="text-sm text-[var(--kt-text-muted)]">
            No principals enrolled yet. Search for demonstration customer, Kaventra Tech Supply vendor, driver, or admin accounts below to enroll them.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-[var(--kt-text-muted)]">
                  <th className="py-2 pr-3">Ref</th>
                  <th className="py-2 pr-3">QA Role</th>
                  <th className="py-2 pr-3">User Account</th>
                  <th className="py-2 pr-3">Linked Entity</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.principals.map((p) => (
                  <tr key={p.id} className="border-b align-top">
                    <td className="py-3 pr-3 font-mono text-xs">{p.publicReference}</td>
                    <td className="py-3 pr-3 font-semibold">{p.role}</td>
                    <td className="py-3 pr-3">
                      <div className="font-medium">{p.label ?? p.user.name ?? p.user.email}</div>
                      <div className="text-xs text-[var(--kt-text-muted)]">{p.user.email} ({p.user.role} · {p.user.status})</div>
                    </td>
                    <td className="py-3 pr-3 text-xs">
                      {p.store ? (
                        <Link href={`/admin/stores/${encodeURIComponent(p.store.id)}`} className="font-semibold underline underline-offset-4">
                          {p.store.name} ({p.store.status})
                        </Link>
                      ) : p.driverProfile ? (
                        <Link href={`/admin/drivers/${encodeURIComponent(p.driverProfile.id)}`} className="font-semibold underline underline-offset-4">
                          {p.driverProfile.driverCode} ({p.driverProfile.status})
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <ProtectedStatus label={p.active ? "ACTIVE" : "REVOKED"} tone={p.active ? "success" : "neutral"} />
                    </td>
                    <td className="py-3">
                      {p.active ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            patchRecord(
                              p.id,
                              { action: "REVOKE_PRINCIPAL", reason: "Revoked from QA Acceptance Control Center" },
                              `Revoked QA access for ${p.user.email}`,
                            )
                          }
                          className="rounded border px-3 py-1 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      ) : (
                        <span className="text-xs text-[var(--kt-text-muted)]">{p.revokeReason ?? "Revoked"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </OperationalPanel>

      <OperationalPanel
        title="3. Search & Enroll Existing Demonstration Accounts"
        description="Dynamically locate Kaventra Tech Supply or any demonstration account by email, store name, slug, or ID — no hardcoded IDs."
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Kaventra, store slug, customer or driver email..."
            aria-label="Search accounts or stores"
            className="min-w-[260px] flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => refreshDashboard(search)}
            className="rounded-lg bg-[var(--kt-public-surface-inverse,#17181d)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Search
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setSearch("");
              void refreshDashboard("");
            }}
            className="rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            Reset
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void postAction(
              {
                action: "ENROLL_PRINCIPAL",
                userIdentifier: enrollIdentifier,
                role: enrollRole,
                ...(enrollStoreIdentifier ? { storeIdentifier: enrollStoreIdentifier } : {}),
                ...(enrollLabel ? { label: enrollLabel } : {}),
              },
              `Enrolled ${enrollIdentifier} as QA ${enrollRole}.`,
            );
          }}
          className="mb-6 grid gap-3 rounded-xl border bg-slate-50 p-4 md:grid-cols-5"
        >
          <input
            required
            value={enrollIdentifier}
            onChange={(e) => setEnrollIdentifier(e.target.value)}
            placeholder="User email or ID"
            aria-label="User email or ID"
            className="rounded border bg-white px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={enrollRole}
            onChange={(e) => setEnrollRole(e.target.value as QaRole)}
            aria-label="QA acceptance role"
            className="rounded border bg-white px-3 py-2 text-sm"
          >
            <option value="CUSTOMER">CUSTOMER</option>
            <option value="VENDOR">VENDOR</option>
            <option value="DRIVER">DRIVER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <input
            value={enrollStoreIdentifier}
            onChange={(e) => setEnrollStoreIdentifier(e.target.value)}
            placeholder="Store slug/ID (optional)"
            aria-label="Store slug or ID"
            className="rounded border bg-white px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              value={enrollLabel}
              onChange={(e) => setEnrollLabel(e.target.value)}
              placeholder="Label (opt.)"
              aria-label="Label"
              className="w-full rounded border bg-white px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy || !enrollIdentifier.trim()}
              className="shrink-0 rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Enroll
            </button>
          </div>
        </form>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Candidate Stores ({dashboard.candidates.stores.length})</h3>
            <ul className="space-y-2 text-xs">
              {dashboard.candidates.stores.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.name} <span className="font-mono text-[var(--kt-text-muted)]">({s.slug})</span></p>
                    <p className="truncate text-[var(--kt-text-muted)]">{s.owner.email} · {s.status}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      postAction(
                        {
                          action: "ENROLL_PRINCIPAL",
                          userIdentifier: s.owner.id,
                          role: "VENDOR",
                          storeIdentifier: s.id,
                          label: s.name,
                        },
                        `Enrolled vendor owner for ${s.name}`,
                      )
                    }
                    className="shrink-0 rounded border px-3 py-1.5 font-semibold hover:bg-slate-100 disabled:opacity-50"
                  >
                    {s.isQaAcceptance ? "Re-enroll QA Vendor" : "Enroll QA Vendor"}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Candidate Users ({dashboard.candidates.users.length})</h3>
            <ul className="space-y-2 text-xs">
              {dashboard.candidates.users.map((u) => {
                const suggestedRole: QaRole = u.store
                  ? "VENDOR"
                  : u.driverProfile
                    ? "DRIVER"
                    : u.role === "ADMIN" || u.role === "SUPER_ADMIN"
                      ? "ADMIN"
                      : "CUSTOMER";
                return (
                  <li key={u.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{u.name ?? u.email} <span className="text-[var(--kt-text-muted)]">[{u.role}]</span></p>
                      <p className="truncate text-[var(--kt-text-muted)]">
                        {u.email}
                        {u.store ? ` · Store: ${u.store.name}` : ""}
                        {u.driverProfile ? ` · Driver: ${u.driverProfile.driverCode}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        postAction(
                          {
                            action: "ENROLL_PRINCIPAL",
                            userIdentifier: u.id,
                            role: suggestedRole,
                            ...(u.store ? { storeIdentifier: u.store.id } : {}),
                            label: u.name ?? u.email,
                          },
                          `Enrolled ${u.email} as QA ${suggestedRole}`,
                        )
                      }
                      className="shrink-0 rounded border px-3 py-1.5 font-semibold hover:bg-slate-100 disabled:opacity-50"
                    >
                      Enroll QA {suggestedRole}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </OperationalPanel>

      <OperationalPanel
        title="4. QA Acceptance Runs & Supported Teardown"
        description="Start a traceable run for Work mode and archive/tear down open QA carts or abandoned drafts once complete without erasing immutable ledger or document audit trails."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void postAction(
              {
                action: "START_RUN",
                title: runTitle,
                storeId: runStoreId || null,
                customerUserId: runCustomerId || null,
                driverProfileId: runDriverId || null,
              },
              `Started QA run: ${runTitle}`,
            );
          }}
          className="mb-5 grid gap-3 rounded-xl border bg-slate-50 p-4 md:grid-cols-5"
        >
          <input
            required
            value={runTitle}
            onChange={(e) => setRunTitle(e.target.value)}
            placeholder="Run title"
            aria-label="QA Run title"
            className="rounded border bg-white px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={runStoreId}
            onChange={(e) => setRunStoreId(e.target.value)}
            aria-label="Vendor store"
            className="rounded border bg-white px-3 py-2 text-sm"
          >
            <option value="">Any QA vendor store</option>
            {activeVendors.map((v) => v.store && (
              <option key={v.store.id} value={v.store.id}>{v.store.name}</option>
            ))}
          </select>
          <select
            value={runCustomerId}
            onChange={(e) => setRunCustomerId(e.target.value)}
            aria-label="Customer account"
            className="rounded border bg-white px-3 py-2 text-sm"
          >
            <option value="">Any QA customer</option>
            {activeCustomers.map((c) => (
              <option key={c.user.id} value={c.user.id}>{c.user.email}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              value={runDriverId}
              onChange={(e) => setRunDriverId(e.target.value)}
              aria-label="Driver account"
              className="w-full rounded border bg-white px-3 py-2 text-sm"
            >
              <option value="">Any QA driver</option>
              {activeDrivers.map((d) => d.driverProfile && (
                <option key={d.driverProfile.id} value={d.driverProfile.id}>{d.driverProfile.driverCode}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy || !dashboard.config.eligible}
              className="shrink-0 rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Start Run
            </button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-[var(--kt-text-muted)]">
                <th className="py-2 pr-3">Reference</th>
                <th className="py-2 pr-3">Title &amp; Personas</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Activity Counts</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.runs.map((r) => (
                <tr key={r.id} className="border-b align-top">
                  <td className="py-3 pr-3 font-mono text-xs">{r.publicReference}</td>
                  <td className="py-3 pr-3">
                    <div className="font-semibold">{r.title}</div>
                    <div className="text-xs text-[var(--kt-text-muted)]">
                      Store: {r.store?.name ?? "—"} · Customer: {r.customerUser?.email ?? "—"} · Driver: {r.driverProfile?.driverCode ?? "—"}
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <ProtectedStatus
                      label={r.status}
                      tone={r.status === "ACTIVE" ? "warning" : r.status === "COMPLETED" ? "success" : "neutral"}
                    />
                  </td>
                  <td className="py-3 pr-3 text-xs">
                    {r._count.orders} courier orders · {r._count.marketplaceCheckouts} checkouts · {r._count.marketplaceOrders} mkt orders · {r._count.payments} payments
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      {r.status === "ACTIVE" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => patchRecord(r.id, { action: "COMPLETE_RUN" }, `Marked ${r.publicReference} COMPLETED`)}
                          className="rounded border px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50"
                        >
                          Complete
                        </button>
                      )}
                      {r.status !== "ARCHIVED" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            patchRecord(
                              r.id,
                              { action: "ARCHIVE_AND_TEARDOWN", reason: "Supported Work mode teardown" },
                              `Archived ${r.publicReference} & cleaned transient QA carts/drafts`,
                            )
                          }
                          className="rounded border px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50"
                        >
                          Archive &amp; Teardown
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OperationalPanel>

      <OperationalPanel
        title="5. Isolated Sandbox Ledger & Reconciliation Balances"
        description="Zero-trust isolated balances inside platform-sandbox-acceptance and isQaIsolated wallets. Non-withdrawable; excluded from commercial finance reporting."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {dashboard.reconciliation.isolatedWallets.map((w) => (
            <div key={w.id} className="rounded-xl border p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">{w.ownerType}: <code className="font-mono text-xs">{w.ownerId}</code></span>
                <ProtectedStatus label={w.isQaIsolated ? "ISOLATED QA" : "SANDBOX PLATFORM"} tone="warning" />
              </div>
              <ul className="space-y-1 text-xs">
                {w.accounts.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2 border-t pt-1">
                    <span className="font-mono text-[var(--kt-text-muted)]">{a.purpose}</span>
                    <span className="font-semibold">ZAR {a.currentBalance} <span className="font-normal text-[var(--kt-text-muted)]">(Dr {a.debitTotal} / Cr {a.creditTotal})</span></span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </OperationalPanel>

      <OperationalPanel
        title="6. Work Mode End-to-End Navigation Shortcuts"
        description="Direct operational routes across Admin, Vendor (Kaventra Tech Supply), Customer, and Driver workspaces."
      >
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1 rounded-lg border p-3">
            <h4 className="font-semibold">Admin Governance</h4>
            <ul className="space-y-1 text-xs underline underline-offset-4">
              <li><Link href="/admin/stores">Stores &amp; Kaventra dossier</Link></li>
              <li><Link href="/admin/drivers">Drivers &amp; document review</Link></li>
              <li><Link href="/admin/commission-plans">Commission plans</Link></li>
              <li><Link href="/admin/catalog">Catalog &amp; moderation</Link></li>
              <li><Link href="/admin/dispatch">Dispatch &amp; driver allocation</Link></li>
              <li><Link href="/admin/orders">Courier orders &amp; Waybill/POD</Link></li>
              <li><Link href="/admin/ledger">Ledger journals</Link></li>
              <li><Link href="/admin/payment-webhooks">Payment webhooks</Link></li>
            </ul>
          </div>
          <div className="space-y-1 rounded-lg border p-3">
            <h4 className="font-semibold">Vendor Workspace</h4>
            <ul className="space-y-1 text-xs underline underline-offset-4">
              <li><Link href="/store">Vendor overview</Link></li>
              <li><Link href="/store/get-started">Onboarding &amp; documents</Link></li>
              <li><Link href="/store/profile">Profile, pickup &amp; trading hours</Link></li>
              <li><Link href="/store/catalog">Product &amp; inventory</Link></li>
              <li><Link href="/store/orders">Vendor marketplace &amp; parcel orders</Link></li>
              <li><Link href="/store/earnings">Isolated store earnings</Link></li>
            </ul>
          </div>
          <div className="space-y-1 rounded-lg border p-3">
            <h4 className="font-semibold">QA Customer Workspace</h4>
            <ul className="space-y-1 text-xs underline underline-offset-4">
              <li><Link href="/shop/qa">Private QA storefront</Link></li>
              <li><Link href="/cart">Cart</Link></li>
              <li><Link href="/checkout">Marketplace checkout</Link></li>
              <li><Link href="/account">Customer dashboard</Link></li>
              <li><Link href="/account/request-delivery">Standalone parcel booking</Link></li>
              <li><Link href="/account/orders">Customer deliveries &amp; PDFs</Link></li>
            </ul>
          </div>
          <div className="space-y-1 rounded-lg border p-3">
            <h4 className="font-semibold">Driver Workspace</h4>
            <ul className="space-y-1 text-xs underline underline-offset-4">
              <li><Link href="/driver">Driver dashboard</Link></li>
              <li><Link href="/driver/onboarding">Driver documents</Link></li>
              <li><Link href="/driver/availability">Availability &amp; status</Link></li>
              <li><Link href="/driver/assignments">Assigned jobs &amp; Waybill</Link></li>
              <li><Link href="/driver/delivery">Pickup, transit, OTP &amp; POD</Link></li>
              <li><Link href="/driver/earnings">Isolated driver earnings</Link></li>
            </ul>
          </div>
        </div>
      </OperationalPanel>
    </div>
  );
}
