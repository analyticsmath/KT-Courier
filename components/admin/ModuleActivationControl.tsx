"use client";

import { useState } from "react";
import type { GovernedModuleActivationState, GovernedModuleKey } from "@/lib/governance/module-activation";

export function ModuleActivationControl({
  moduleKey,
  title,
  initialState,
}: {
  moduleKey: GovernedModuleKey;
  title: string;
  initialState: GovernedModuleActivationState;
}) {
  const [state, setState] = useState<GovernedModuleActivationState>(initialState);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submitRequest() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/production-readiness/activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKey, expectedVersion: state.version, reason }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error || "Could not submit activation request.");
        return;
      }
      setState(payload);
      setReason("");
      setMessage("Activation draft submitted for independent second-admin review.");
    } catch {
      setMessage("Network error while submitting activation request.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReview(action: "APPROVE" | "REVOKE") {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/production-readiness/activation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKey, expectedVersion: state.version, action, reason }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error || `Could not ${action.toLowerCase()} module activation.`);
        return;
      }
      setState(payload);
      setReason("");
      setMessage(
        action === "APPROVE"
          ? "Dual-control activation approved."
          : "Module activation revoked.",
      );
    } catch {
      setMessage("Network error while reviewing activation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{state.summary}</p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
            state.active
              ? "bg-emerald-100 text-emerald-800"
              : state.status === "DRAFT_REQUESTED"
                ? "bg-amber-100 text-amber-800"
                : "bg-slate-100 text-slate-800"
          }`}
        >
          {state.active ? "ACTIVE" : state.status} (v{state.version})
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-xs text-slate-600 sm:grid-cols-3">
        <div>
          <dt className="font-medium text-slate-800">Runtime config</dt>
          <dd>{state.runtimeConfigured ? "Configured" : `Blocked (${state.blockerCode ?? "UNCONFIGURED"})`}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-800">Governance approval</dt>
          <dd>{state.approved ? `Approved at ${state.approvedAt ?? "recorded"}` : state.status}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-800">Setting key</dt>
          <dd className="font-mono">{state.settingKey}</dd>
        </div>
      </dl>

      <div className="mt-4 space-y-3">
        <label className="block text-xs font-medium text-slate-700">
          Governance reason / audit note (min 10 characters)
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe verified configuration and dual-control decision"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {(state.status === "UNREQUESTED" || state.status === "REVOKED") && (
            <button
              type="button"
              disabled={busy || reason.trim().length < 10 || !state.runtimeConfigured}
              onClick={submitRequest}
              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Request Activation
            </button>
          )}
          {state.status === "DRAFT_REQUESTED" && (
            <button
              type="button"
              disabled={busy || reason.trim().length < 10 || !state.runtimeConfigured}
              onClick={() => submitReview("APPROVE")}
              className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Approve Activation (Second Admin)
            </button>
          )}
          {(state.status === "DRAFT_REQUESTED" || state.status === "APPROVED") && (
            <button
              type="button"
              disabled={busy || reason.trim().length < 10}
              onClick={() => submitReview("REVOKE")}
              className="rounded-md border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
            >
              Revoke
            </button>
          )}
        </div>
        {message && <p className="text-xs text-slate-700">{message}</p>}
      </div>
    </section>
  );
}
