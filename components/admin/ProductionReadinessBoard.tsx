"use client";

import { useState } from "react";
import Link from "next/link";
import type { Capability, CapabilityStatus } from "@/lib/production-readiness/contracts";

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

export function ProductionReadinessBoard({ capabilities }: { capabilities: Capability[] }) {
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
