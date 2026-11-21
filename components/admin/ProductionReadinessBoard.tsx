"use client";

import { useState } from "react";
import Link from "next/link";
import type { Capability, CapabilityStatus } from "@/lib/production-readiness/contracts";
import type { CapabilityMatrixEntry } from "@/lib/production-readiness/capability-matrix.service";
import type { EnvSchemaVerificationReport } from "@/lib/runtime/env-schema-verifier";
import type { CommerceActivation } from "@/lib/runtime/commerce-activation";

type EntityConfigurationStatus = Readonly<{
  storefrontStoresTotal: number | null;
  storefrontStoresActive: number | null;
  approvedDriversActive: number | null;
  paymentProviderConfigured: boolean;
  paymentProviderEnvironment: string;
  repairLinks: readonly { label: string; href: string }[];
}>;

type Owner = Capability["owner"];
const owners: Owner[] = ["ENGINEERING", "OPERATIONS", "FINANCE", "ADMIN_REVIEW", "CLIENT"];
const ownerNames: Record<Owner, string> = {
  ENGINEERING: "Engineering", OPERATIONS: "Delivery operations", FINANCE: "Finance & settlement", ADMIN_REVIEW: "Independent review", CLIENT: "Client authority",
};
const statusNames: Record<CapabilityStatus, string> = {
  READY: "Verified ready", DISABLED_BY_POLICY: "Excluded by policy", BLOCKED_CONFIGURATION: "Configuration required",
  BLOCKED_EXTERNAL_INPUT: "External decision required", BLOCKED_HUMAN_APPROVAL: "Approval required", BLOCKED_LIVE_ACCEPTANCE: "Acceptance pending",
};
const routes: Record<string, { href: string; label: string }> = {
  cod_policy: { href: "/admin/payment-policies", label: "Payment policies" },
  cod_remittance: { href: "/admin/cash-deposits", label: "Cash & banking" },
  operational_coverage: { href: "/admin/regions", label: "Delivery coverage" },
  courier_services: { href: "/admin/pricing", label: "Courier pricing" },
  notification_routes: { href: "/admin/notifications", label: "Notification settings" },
  notification_templates: { href: "/admin/notifications", label: "Notification settings" },
  payment_provider: { href: "/admin/integrations", label: "Provider diagnostics" },
};
const isBlocker = (s: CapabilityStatus) => s !== "READY" && s !== "DISABLED_BY_POLICY";
const readable = (s: string) => s.replaceAll("_", " ").toLowerCase().replace(/^./, c => c.toUpperCase());

export function ProductionReadinessBoard({
  capabilities,
  capabilityMatrix = [],
  envSchema,
  commerceActivation,
  entityConfigurationStatus,
}: {
  capabilities: Capability[];
  capabilityMatrix?: readonly CapabilityMatrixEntry[];
  envSchema?: EnvSchemaVerificationReport;
  commerceActivation?: CommerceActivation;
  entityConfigurationStatus?: EntityConfigurationStatus;
}) {
  const [view, setView] = useState<"ALL" | "BLOCKERS">("ALL");
  const ready = capabilities.filter(c => c.status === "READY").length;
  const excluded = capabilities.filter(c => c.status === "DISABLED_BY_POLICY").length;
  const blocked = capabilities.filter(c => isBlocker(c.status)).length;
  const filtered = view === "BLOCKERS" ? capabilities.filter(c => isBlocker(c.status)) : capabilities;

  return <section aria-labelledby="launch-gates-heading" className="space-y-7">
    <header className="space-y-2">
      <h2 id="launch-gates-heading" className="text-xl font-semibold tracking-tight text-[var(--kt-brand-navy)]">Launch control</h2>
      <p className="max-w-3xl text-sm leading-6 text-[var(--kt-text-soft)]">Each gate is based on current configuration or recorded acceptance evidence. A software deployment cannot substitute for finance, compliance or real-world approval.</p>
    </header>
    <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--kt-border)] bg-[var(--kt-border)] sm:grid-cols-3">
      {[
        { label: "Launch blockers", count: blocked, subtitle: "Require action or evidence", strong: true },
        { label: "Verified ready", count: ready, subtitle: "Passed their configured gate", strong: false },
        { label: "Excluded by policy", count: excluded, subtitle: "Not part of this launch", strong: false },
      ].map(k => <div key={k.label} className="space-y-3 bg-white p-5 sm:p-6">
        <dt className="text-sm font-medium text-[var(--kt-text-soft)]">{k.label}</dt>
        <dd className={`text-3xl font-semibold tracking-tight ${k.strong && blocked > 0 ? "text-[var(--kt-red)]" : "text-[var(--kt-brand-navy)]"}`}>
          {k.count}<span className="sr-only"> {k.label.toLowerCase()}</span>
        </dd>
        <p className="text-xs text-[var(--kt-text-muted)]">{k.subtitle}</p>
      </div>)}
    </dl>
    <p className="sr-only">{blocked} launch blockers, {ready} verified ready, {excluded} excluded by policy.</p>
    {(commerceActivation || envSchema || entityConfigurationStatus) && (
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="code-capability-view-heading" className="space-y-3 rounded-xl border border-[var(--kt-border)] bg-white p-5">
          <h3 id="code-capability-view-heading" className="text-sm font-semibold text-[var(--kt-brand-navy)]">
            Code capability &amp; global switch posture
          </h3>
          <p className="text-xs leading-5 text-[var(--kt-text-soft)]">
            Software capabilities and sandbox checks are strictly separated from live entity approvals. Secrets are never shown here.
          </p>
          {commerceActivation && (
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-[var(--kt-text-muted)]">KT_COMMERCE_ENABLED</dt>
                <dd className="font-mono font-semibold text-[var(--kt-brand-navy)]">
                  {commerceActivation.globalRequested ? "true" : "false"} ({commerceActivation.switchSource})
                </dd>
              </div>
              <div>
                <dt className="text-[var(--kt-text-muted)]">Public checkout exposed</dt>
                <dd className="font-semibold text-[var(--kt-brand-navy)]">
                  {commerceActivation.publicCheckoutExposed ? "YES" : `NO (${commerceActivation.primaryBlockReason ?? "LOCKED"})`}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--kt-text-muted)]">Paystack mode</dt>
                <dd className="font-mono font-semibold text-[var(--kt-brand-navy)]">
                  {commerceActivation.paystackMode} / {commerceActivation.paystackEnvironment}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--kt-text-muted)]">Customer bank withdrawal</dt>
                <dd className="font-mono font-semibold text-[#875224]">FORBIDDEN_BY_POLICY</dd>
              </div>
            </dl>
          )}
          {envSchema && (
            <div className="rounded-lg bg-[var(--kt-surface-muted)] p-3 text-xs">
              <div className="flex items-center justify-between font-medium text-[var(--kt-brand-navy)]">
                <span>Environment schema check ({envSchema.runtime})</span>
                <span>{envSchema.valid ? "VALID" : `${envSchema.errorCount} ERROR(S)`}</span>
              </div>
              {envSchema.checks.filter((c) => c.severity !== "INFO").length > 0 && (
                <ul className="mt-2 space-y-1 text-[11px] text-[var(--kt-text-soft)]">
                  {envSchema.checks.filter((c) => c.severity !== "INFO").slice(0, 5).map((item) => (
                    <li key={`${item.key}-${item.code}`}>
                      <span className="font-mono font-semibold">{item.key}</span>: {item.code}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
        {entityConfigurationStatus && (
          <section aria-labelledby="live-entity-status-heading" className="space-y-3 rounded-xl border border-[var(--kt-border)] bg-white p-5">
            <h3 id="live-entity-status-heading" className="text-sm font-semibold text-[var(--kt-brand-navy)]">
              Live entity &amp; external configuration status
            </h3>
            <p className="text-xs leading-5 text-[var(--kt-text-soft)]">
              Real store go-live, driver approvals, banking credentials, and regional tariffs live in operator records and must never be auto-fabricated by code.
            </p>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-[var(--kt-text-muted)]">Active stores</dt>
                <dd className="font-semibold text-[var(--kt-brand-navy)]">
                  {entityConfigurationStatus.storefrontStoresActive ?? "—"} / {entityConfigurationStatus.storefrontStoresTotal ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--kt-text-muted)]">Approved active drivers</dt>
                <dd className="font-semibold text-[var(--kt-brand-navy)]">
                  {entityConfigurationStatus.approvedDriversActive ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--kt-text-muted)]">Payment gateway</dt>
                <dd className="font-semibold text-[var(--kt-brand-navy)]">
                  {entityConfigurationStatus.paymentProviderConfigured ? `Configured (${entityConfigurationStatus.paymentProviderEnvironment})` : "Not configured"}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-3 pt-1 text-xs">
              {entityConfigurationStatus.repairLinks.map((link) => (
                <Link key={link.href} href={link.href} className="font-semibold text-[var(--kt-brand-blue)] underline underline-offset-4">
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    )}
    {capabilityMatrix.length > 0 && (
      <section aria-labelledby="capability-matrix-heading" className="space-y-3">
        <div>
          <h3 id="capability-matrix-heading" className="font-semibold text-[var(--kt-brand-navy)]">Read-only capability &amp; live activation matrix</h3>
          <p className="mt-1 text-sm text-[var(--kt-text-soft)]">Source implementation, runtime credentials, external entitlements, admin policy, and worker health are measured independently so no software deployment can claim live activation prematurely.</p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[var(--kt-border)] bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--kt-border)] bg-[var(--kt-surface-muted)] font-semibold text-[var(--kt-text-soft)]">
              <tr>
                <th className="p-3">Capability</th>
                <th className="p-3">Source</th>
                <th className="p-3">Isolated SHA</th>
                <th className="p-3">Runtime</th>
                <th className="p-3">External Auth</th>
                <th className="p-3">Admin Policy</th>
                <th className="p-3">Worker</th>
                <th className="p-3">Live Eligible</th>
                <th className="p-3">Blocker</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--kt-border)]">
              {capabilityMatrix.map((row) => (
                <tr key={row.key}>
                  <td className="p-3 font-medium text-[var(--kt-brand-navy)]">{row.label}</td>
                  <td className="p-3">{row.sourceImplemented ? "Yes" : "No"}</td>
                  <td className="p-3 font-mono">{row.isolatedTestPassSha ? row.isolatedTestPassSha.slice(0, 8) : "Unrecorded"}</td>
                  <td className="p-3">{row.runtimeConfigured ? "Configured" : "Pending"}</td>
                  <td className="p-3">{row.externalEntitlementApproved ? "Approved" : "Locked"}</td>
                  <td className="p-3">{row.adminPolicyEffective ? "Effective" : "Pending"}</td>
                  <td className="p-3">{row.schedulerRegisteredAndHealthy === null ? "N/A" : row.schedulerRegisteredAndHealthy ? "Healthy" : "Blocked"}</td>
                  <td className="p-3">
                    <span className={`inline-block rounded px-2 py-0.5 font-semibold ${row.eligibleForLiveUse ? "bg-[#edf7f0] text-[#236547]" : "bg-[#fff2e7] text-[#875224]"}`}>
                      {row.eligibleForLiveUse ? "ELIGIBLE" : "BLOCKED"}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-[11px] text-[var(--kt-text-soft)]">{row.lastBlockerCode ?? "NONE"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    )}
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--kt-border)] pb-4">
      <div><h3 className="font-semibold text-[var(--kt-brand-navy)]">Release acceptance register</h3><p className="mt-1 text-sm text-[var(--kt-text-soft)]">{capabilities.length} evidence-backed checks · organized by responsible team</p></div>
      <div role="group" aria-label="Filter release checks" className="inline-flex gap-1 rounded-lg border border-[var(--kt-border)] bg-white p-1">
        {(["ALL", "BLOCKERS"] as const).map(v => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`min-h-11 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--kt-brand-blue)] ${view === v ? "bg-[var(--kt-brand-navy)] text-white" : "text-[var(--kt-text-soft)] hover:bg-[var(--kt-surface-muted)]"}`}>{v === "ALL" ? "All checks" : "Launch blockers"}</button>)}
      </div>
    </div>
    {capabilities.length === 0 ? <div role="status" className="rounded-xl border border-dashed border-[var(--kt-border)] p-8 text-sm text-[var(--kt-text-soft)]">No readiness evidence available. This does not authorize launch. Check the readiness service and database connection.</div> :
      <div className="space-y-8">
        {owners.map(owner => {
          const entries = filtered.filter(c => c.owner === owner).sort((a,b) => Number(isBlocker(b.status)) - Number(isBlocker(a.status)) || a.key.localeCompare(b.key));
          return entries.length ? <section key={owner} aria-label={ownerNames[owner]} className="space-y-3">
            <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold uppercase tracking-wide text-[var(--kt-text-soft)]">{ownerNames[owner]}</h4><span className="text-xs text-[var(--kt-text-muted)]">{entries.length} {entries.length === 1 ? "check" : "checks"}</span></div>
            <div className="overflow-hidden rounded-xl border border-[var(--kt-border)] bg-white divide-y divide-[var(--kt-border)]">
              {entries.map(c => <article key={c.key} className="space-y-3 px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1"><h5 className="font-semibold text-[var(--kt-brand-navy)]">{readable(c.key)}</h5><p className="max-w-3xl text-sm leading-6 text-[var(--kt-text-soft)]">{c.safeSummary}</p></div>
                  <span className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold ${c.status === "READY" ? "bg-[#edf7f0] text-[#236547]" : c.status === "DISABLED_BY_POLICY" ? "bg-[var(--kt-surface-muted)] text-[var(--kt-text-soft)]" : "bg-[#fff2e7] text-[#875224]"}`}>{statusNames[c.status]}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--kt-text-muted)]"><span>Reason: <code className="font-mono">{c.reasonCode}</code></span>{routes[c.key] && <Link href={routes[c.key].href} className="font-semibold text-[var(--kt-brand-blue)] underline underline-offset-4">{routes[c.key].label}</Link>}</div>
                {c.evidence && Object.keys(c.evidence).length > 0 && <details className="text-xs text-[var(--kt-text-soft)]"><summary className="cursor-pointer py-1 font-medium">View recorded evidence</summary><dl className="mt-3 grid gap-3 rounded-lg bg-[var(--kt-surface-muted)] p-4 sm:grid-cols-2">{Object.entries(c.evidence).map(([key,value]) => <div key={key} className="min-w-0"><dt className="mb-1 text-[var(--kt-text-muted)]">{readable(key)}</dt><dd className="break-words font-medium text-[var(--kt-brand-navy)]">{Array.isArray(value) ? value.join("; ") || "None" : value == null ? "Not recorded" : String(value)}</dd></div>)}</dl></details>}
              </article>)}
            </div>
          </section> : null;
        })}
      </div>}
  </section>;
}
