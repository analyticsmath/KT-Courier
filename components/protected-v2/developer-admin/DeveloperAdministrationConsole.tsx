"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import type { GovernedModuleActivationState } from "@/lib/governance/module-activation";
import { ModuleActivationControl } from "@/components/admin/ModuleActivationControl";

const SECTION_ENDPOINTS: Record<string, string> = {
  applications: "/api/admin/developers/applications",
  scopes: "/api/admin/developers/scopes",
  credentials: "/api/admin/developers/credentials",
  usage: "/api/admin/developers/usage",
  requests: "/api/admin/developers/requests",
  webhooks: "/api/admin/developers/webhooks",
  "webhook-deliveries": "/api/admin/developers/webhook-deliveries",
  reconciliation: "/api/admin/developers/reconciliation",
};

export function DeveloperAdministrationConsole({
  segments,
  activation,
}: {
  segments: readonly string[];
  activation: GovernedModuleActivationState;
}) {
  const section = segments[0] && segments[0] in SECTION_ENDPOINTS ? segments[0] : "applications";
  const [rows, setRows] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(SECTION_ENDPOINTS[section]!, { cache: "no-store" });
        const payload = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(payload.detail || payload.title || "Could not load developer records.");
          setRows([]);
        } else {
          setRows(Array.isArray(payload.data) ? payload.data : []);
        }
      } catch {
        if (!cancelled) setError("Could not reach developer administration API.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [section]);

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Developer administration"
        title="Developer API & Webhook Oversight"
        description="Govern live Developer API activation and inspect owner-isolated applications, scopes, masked credentials, webhooks, and reconciliation cases."
      />
      <div className="space-y-6">
        <ModuleActivationControl
          moduleKey="DEVELOPER_API"
          title="Developer API Live Activation"
          initialState={activation}
        />

        <nav aria-label="Developer administration sections" className="flex flex-wrap gap-2">
          {Object.keys(SECTION_ENDPOINTS).map((key) => (
            <Link
              key={key}
              href={`/admin/developers/${key}`}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                key === section
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {key}
            </Link>
          ))}
        </nav>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold capitalize text-slate-900">{section}</h2>
          {loading ? (
            <p className="mt-3 text-sm text-slate-500">Loading safe metadata...</p>
          ) : error ? (
            <p className="mt-3 text-sm text-rose-700">{error}</p>
          ) : rows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No records found in {section}.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 text-xs text-slate-700">
              {rows.slice(0, 50).map((row, idx) => (
                <li key={idx} className="py-2 font-mono break-all">
                  {JSON.stringify(row)}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ProtectedPageFrame>
  );
}
