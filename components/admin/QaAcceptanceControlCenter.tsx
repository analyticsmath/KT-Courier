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
    runBreakdowns?: Array<{
      runId: string;
      runReference: string;
      title: string;
      status: string;
      courierOrdersCount: number;
      courierOrdersTotalZar: string;
      settledCourierCount: number;
      blockedCourierCount: number;
      marketplaceOrdersCount: number;
      marketplaceOrdersTotalZar: string;
    }>;
    qaOrders?: Array<{
      orderId: string;
      orderNumber: string;
      runReference: string | null;
      status: string;
      totalAmountZar: string;
      paymentReference: string | null;
      paymentAmountZar: string | null;
      paymentStatus: string | null;
      driverCode: string | null;
      completedAt: string | null;
      settled: boolean;
      driverEarningReference: string | null;
      driverNetZar: string | null;
      commissionAmountZar: string | null;
      settlementVersion: string | null;
      blockerCode: string | null;
      blockerMessage: string | null;
      recovery: {
        status: string;
        version: number;
        planPublicReference: string;
        preparedByUserId: string;
        approvedByUserId: string | null;
      } | null;
    }>;
    sandboxProbes?: Array<{
      reference: string;
      amountZar: string;
      status: string;
      providerDomain: string | null;
      releaseSha: string;
      ledgerJournalId: string | null;
      verifiedAt: string;
    }>;
    balanceBreakdown?: {
      heldBalanceZar: string;
      clearingBalanceZar: string;
      unsettledPaidCourierHeldZar: string;
      settledCourierGrossZar: string;
      marketplaceReceiptsZar: string;
      sandboxProbesTotalZar: string;
      expectedActiveHeldFromOrdersAndProbesZar: string;
    };
    ledgerJournals?: Array<{
      id: string;
      reference: string;
      type: string;
      postedAt: string;
      memo: string | null;
      classification: string;
      sourceRef: string | null;
      runReference: string | null;
      heldDeltaZar: string;
      clearingDeltaZar: string;
      commissionDeltaZar: string;
      totalDebitsZar: string;
    }>;
    courierCommissionPlans?: Array<{
      id: string;
      publicReference: string;
      scopeKey: string;
      status: string;
      versionNumber: number;
      basisType: string;
      effectiveFrom: string;
      approvedAt: string | null;
      createdByUserId: string;
      approvedByUserId: string | null;
      bpsRate: number | null;
    }>;
    qaOffers?: Array<{
      storeId: string;
      storeName: string;
      offerReference: string;
      offerVersion: number;
      storeSku: string;
      title: string;
      variantReference: string;
      variantTitle: string;
      offerStatus: string;
      publicationStatus: string;
      sellableForCheckout: boolean;
      failedReasonCodes: readonly string[];
      trustedPackageMatched: boolean;
      trustedPackageReason: string | null;
      trustedPackageVersion: number | null;
      isQaSyntheticAuthority: boolean;
      latestVersionNumber: number | null;
      latestVersionStatus: string | null;
      latestVersionUpdatedAt: string | null;
      latestVersionCreatedByUserId: string | null;
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
  const [pkgDims, setPkgDims] = useState({ lengthCm: "15", widthCm: "10", heightCm: "5", weightKg: "0.25", reason: "Synthetic QA acceptance packaging dimensions isolated to active QA run." });
  const [recoveryPlanRef, setRecoveryPlanRef] = useState<string>(
    initial.reconciliation.courierCommissionPlans?.find((p) => p.status === "ACTIVE")?.publicReference ?? "",
  );

  async function callSubEndpoint(url: string, method: "POST" | "PATCH", body: Record<string, unknown>, successMsg: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Request failed.");
      setNotice(successMsg);
      await refreshDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
      setBusy(false);
    }
  }

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
        title="5. Isolated Sandbox Ledger & Per-Order Reconciliation"
        description="Zero-trust isolated balances inside platform-sandbox-acceptance and isQaIsolated wallets, reconciled per run, per order, and per Paystack sandbox probe."
      >
        {dashboard.reconciliation.balanceBreakdown ? (
          <div className="mb-5 rounded-xl border bg-slate-50 p-4 text-xs space-y-2">
            <h3 className="text-sm font-semibold">Platform Sandbox Account Attribution (Held vs Order &amp; Probe Sources)</h3>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <div><span className="text-[var(--kt-text-muted)] block">Held balance</span><strong>ZAR {dashboard.reconciliation.balanceBreakdown.heldBalanceZar}</strong></div>
              <div><span className="text-[var(--kt-text-muted)] block">Cash clearing</span><strong>ZAR {dashboard.reconciliation.balanceBreakdown.clearingBalanceZar}</strong></div>
              <div><span className="text-[var(--kt-text-muted)] block">Unsettled QA courier orders</span><strong>ZAR {dashboard.reconciliation.balanceBreakdown.unsettledPaidCourierHeldZar}</strong></div>
              <div><span className="text-[var(--kt-text-muted)] block">Settled QA courier orders</span><strong>ZAR {dashboard.reconciliation.balanceBreakdown.settledCourierGrossZar}</strong></div>
              <div><span className="text-[var(--kt-text-muted)] block">Marketplace receipts</span><strong>ZAR {dashboard.reconciliation.balanceBreakdown.marketplaceReceiptsZar}</strong></div>
              <div><span className="text-[var(--kt-text-muted)] block">Paystack sandbox probes</span><strong>ZAR {dashboard.reconciliation.balanceBreakdown.sandboxProbesTotalZar}</strong></div>
            </div>
          </div>
        ) : null}

        {dashboard.reconciliation.qaOrders && dashboard.reconciliation.qaOrders.length > 0 ? (
          <div className="mb-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">QA Courier Orders &amp; Driver Settlement Status</h3>
              <select
                aria-label="Courier plan for QA recovery"
                value={recoveryPlanRef || dashboard.reconciliation.courierCommissionPlans?.find((p) => p.status === "ACTIVE")?.publicReference || ""}
                onChange={(e) => setRecoveryPlanRef(e.target.value)}
                className="rounded border bg-white px-2.5 py-1 text-xs"
              >
                {(dashboard.reconciliation.courierCommissionPlans ?? [])
                  .filter((p) => p.status === "ACTIVE")
                  .map((p) => (
                    <option key={p.publicReference} value={p.publicReference}>
                      {p.publicReference} ({p.scopeKey} v{p.versionNumber})
                    </option>
                  ))}
              </select>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 uppercase text-[var(--kt-text-muted)]">
                  <tr>
                    <th className="p-2.5">Order</th>
                    <th className="p-2.5">Run / Payment</th>
                    <th className="p-2.5">Driver / Delivery</th>
                    <th className="p-2.5">Settlement / Blocker</th>
                    <th className="p-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dashboard.reconciliation.qaOrders.map((ord) => (
                    <tr key={ord.orderId} className="align-top">
                      <td className="p-2.5 font-mono font-semibold">{ord.orderNumber}<span className="block font-sans font-normal text-[var(--kt-text-muted)]">ZAR {ord.totalAmountZar} · {ord.status}</span></td>
                      <td className="p-2.5">{ord.runReference ?? "—"}<span className="block font-mono text-[var(--kt-text-muted)]">{ord.paymentReference ?? "Unpaid"} ({ord.paymentStatus ?? "N/A"})</span></td>
                      <td className="p-2.5">{ord.driverCode ?? "—"}<span className="block text-[var(--kt-text-muted)]">{ord.completedAt ? new Date(ord.completedAt).toISOString() : "Not completed"}</span></td>
                      <td className="p-2.5">
                        {ord.settled ? (
                          <span className="text-emerald-800 font-semibold">
                            Settled {ord.driverEarningReference} · Net R {ord.driverNetZar} (Comm R {ord.commissionAmountZar}) · {ord.settlementVersion}
                          </span>
                        ) : (
                          <div>
                            <span className="font-mono font-semibold text-amber-800">{ord.blockerCode ?? "PENDING"}</span>
                            {ord.blockerMessage ? <p className="mt-0.5 text-[var(--kt-text-soft)]">{ord.blockerMessage}</p> : null}
                            {ord.recovery ? <p className="mt-0.5 font-mono text-[11px]">Recovery v{ord.recovery.version}: {ord.recovery.status}</p> : null}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 space-x-2">
                        {!ord.settled && ord.completedAt && (!ord.recovery || ord.recovery.status === "REVOKED") ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              callSubEndpoint(
                                "/api/admin/qa-acceptance/settlement-recovery",
                                "POST",
                                {
                                  orderId: ord.orderId,
                                  planPublicReference: recoveryPlanRef || dashboard.reconciliation.courierCommissionPlans?.find((p) => p.status === "ACTIVE")?.publicReference || "",
                                  reason: "Dual-control QA historical settlement recovery preparation",
                                },
                                `Prepared QA settlement recovery for ${ord.orderNumber}`,
                              )
                            }
                            className="rounded border px-2 py-1 font-semibold hover:bg-slate-100 disabled:opacity-50"
                          >
                            Prepare QA Recovery
                          </button>
                        ) : null}
                        {!ord.settled && ord.recovery?.status === "PENDING_REVIEW" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              callSubEndpoint(
                                "/api/admin/qa-acceptance/settlement-recovery",
                                "PATCH",
                                {
                                  action: "APPROVE",
                                  orderId: ord.orderId,
                                  expectedVersion: ord.recovery!.version,
                                  reason: "Second admin approved QA settlement recovery and execution",
                                  settleImmediately: true,
                                },
                                `Approved & settled QA earning for ${ord.orderNumber}`,
                              )
                            }
                            className="rounded bg-emerald-700 px-2 py-1 font-semibold text-white disabled:opacity-50"
                          >
                            Approve &amp; Settle
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {dashboard.reconciliation.qaOffers && dashboard.reconciliation.qaOffers.length > 0 ? (
          <div className="mb-5 rounded-xl border bg-slate-50 p-4 text-xs space-y-3">
            <h3 className="text-sm font-semibold">5B. QA Store Offer &amp; Synthetic Packaging Authority (15×10×5 cm, 0.25 kg)</h3>
            <p className="text-[var(--kt-text-soft)]">Explicitly labeled synthetic QA dimensions apply only to enrolled QA stores and active QA runs — never commercial stores.</p>
            <div className="grid gap-2 sm:grid-cols-5">
              <input value={pkgDims.lengthCm} onChange={(e) => setPkgDims((p) => ({ ...p, lengthCm: e.target.value }))} placeholder="Length cm" className="rounded border bg-white px-2 py-1.5" />
              <input value={pkgDims.widthCm} onChange={(e) => setPkgDims((p) => ({ ...p, widthCm: e.target.value }))} placeholder="Width cm" className="rounded border bg-white px-2 py-1.5" />
              <input value={pkgDims.heightCm} onChange={(e) => setPkgDims((p) => ({ ...p, heightCm: e.target.value }))} placeholder="Height cm" className="rounded border bg-white px-2 py-1.5" />
              <input value={pkgDims.weightKg} onChange={(e) => setPkgDims((p) => ({ ...p, weightKg: e.target.value }))} placeholder="Weight kg" className="rounded border bg-white px-2 py-1.5" />
              <input value={pkgDims.reason} onChange={(e) => setPkgDims((p) => ({ ...p, reason: e.target.value }))} placeholder="Audit reason" className="rounded border bg-white px-2 py-1.5" />
            </div>
            <ul className="space-y-2">
              {dashboard.reconciliation.qaOffers.map((offer) => {
                const activeRunId = dashboard.runs.find((r) => r.status === "ACTIVE" && (!r.store || r.store.id === offer.storeId))?.id ?? dashboard.runs.find((r) => r.status === "ACTIVE")?.id ?? "";
                return (
                  <li key={offer.offerReference} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-white p-2.5">
                    <div>
                      <span className="font-semibold">{offer.storeName} · {offer.title} ({offer.variantTitle})</span>
                      <span className="block font-mono text-[var(--kt-text-muted)]">
                        {offer.offerReference} v{offer.offerVersion} · {offer.offerStatus}/{offer.publicationStatus} · Pkg: {offer.trustedPackageMatched ? `MATCHED v${offer.trustedPackageVersion}` : offer.trustedPackageReason ?? "UNMATCHED"}
                        {offer.latestVersionNumber ? ` · Latest pkg v${offer.latestVersionNumber} (${offer.latestVersionStatus})` : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy || !activeRunId || offer.offerStatus !== "ACTIVE" || offer.publicationStatus !== "PUBLISHED"}
                        onClick={() =>
                          callSubEndpoint(
                            "/api/admin/qa-acceptance/synthetic-packaging",
                            "POST",
                            {
                              runId: activeRunId,
                              storeId: offer.storeId,
                              offerReference: offer.offerReference,
                              lengthCm: Number(pkgDims.lengthCm),
                              widthCm: Number(pkgDims.widthCm),
                              heightCm: Number(pkgDims.heightCm),
                              weightKg: Number(pkgDims.weightKg),
                              reason: pkgDims.reason,
                            },
                            `Recorded synthetic QA package draft for ${offer.offerReference}`,
                          )
                        }
                        className="rounded border px-2.5 py-1 font-semibold hover:bg-slate-100 disabled:opacity-50"
                      >
                        Record QA Synthetic Pkg
                      </button>
                      {offer.latestVersionStatus === "DRAFT" && offer.latestVersionNumber && offer.latestVersionUpdatedAt ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            callSubEndpoint(
                              "/api/admin/qa-acceptance/synthetic-packaging",
                              "PATCH",
                              {
                                version: offer.latestVersionNumber!,
                                expectedUpdatedAt: offer.latestVersionUpdatedAt!,
                                action: "APPROVE",
                                reason: "Independent reviewer approved synthetic QA packaging",
                              },
                              `Approved QA synthetic package v${offer.latestVersionNumber}`,
                            )
                          }
                          className="rounded bg-blue-700 px-2.5 py-1 font-semibold text-white disabled:opacity-50"
                        >
                          Approve v{offer.latestVersionNumber}
                        </button>
                      ) : null}
                      {offer.latestVersionStatus === "APPROVED" && offer.latestVersionNumber && offer.latestVersionUpdatedAt ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            callSubEndpoint(
                              "/api/admin/qa-acceptance/synthetic-packaging",
                              "PATCH",
                              {
                                version: offer.latestVersionNumber!,
                                expectedUpdatedAt: offer.latestVersionUpdatedAt!,
                                action: "ACTIVATE",
                                reason: "Activated approved synthetic QA packaging",
                              },
                              `Activated QA synthetic package v${offer.latestVersionNumber}`,
                            )
                          }
                          className="rounded bg-emerald-700 px-2.5 py-1 font-semibold text-white disabled:opacity-50"
                        >
                          Activate v{offer.latestVersionNumber}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {dashboard.reconciliation.ledgerJournals && dashboard.reconciliation.ledgerJournals.length > 0 ? (
          <details className="mb-5 rounded-xl border bg-white p-4 text-xs">
            <summary className="cursor-pointer font-semibold">Itemized QA &amp; Sandbox Ledger Journals ({dashboard.reconciliation.ledgerJournals.length})</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b text-[var(--kt-text-muted)]">
                  <tr><th className="py-1.5 pr-2">Journal</th><th className="py-1.5 pr-2">Classification</th><th className="py-1.5 pr-2">Source</th><th className="py-1.5 pr-2">Held Δ</th><th className="py-1.5 pr-2">Clearing Δ</th><th className="py-1.5">Commission Δ</th></tr>
                </thead>
                <tbody className="divide-y">
                  {dashboard.reconciliation.ledgerJournals.map((j) => (
                    <tr key={j.id}>
                      <td className="py-1.5 pr-2 font-mono">{j.reference}</td>
                      <td className="py-1.5 pr-2">{j.classification}</td>
                      <td className="py-1.5 pr-2 font-mono">{j.sourceRef ?? "—"}{j.runReference ? ` (${j.runReference})` : ""}</td>
                      <td className="py-1.5 pr-2 font-mono">{j.heldDeltaZar}</td>
                      <td className="py-1.5 pr-2 font-mono">{j.clearingDeltaZar}</td>
                      <td className="py-1.5 font-mono">{j.commissionDeltaZar}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}

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
