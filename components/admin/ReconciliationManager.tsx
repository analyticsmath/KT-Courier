"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { NormalizedCaseDetail, NormalizedReconciliationCase, ReconciliationDomain } from "@/lib/reconciliation/types";

interface ReconciliationManagerProps {
  initialCases: NormalizedReconciliationCase[];
}

const DOMAINS: ReconciliationDomain[] = [
  "payments",
  "marketplace_checkout",
  "store_orders",
  "refunds",
  "withdrawals",
  "store_earnings",
  "driver_earnings",
  "commissions",
  "subscriptions",
  "promotions",
  "advertising",
  "notifications",
  "developer_api",
  "reporting",
];

export function ReconciliationManager({ initialCases }: ReconciliationManagerProps) {
  const [cases, setCases] = useState<NormalizedReconciliationCase[]>(initialCases);
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [activeCase, setActiveCase] = useState<NormalizedCaseDetail | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  async function fetchCases() {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedDomain) params.set("domain", selectedDomain);
    if (selectedSeverity) params.set("severity", selectedSeverity);
    if (selectedStatus) params.set("status", selectedStatus);
    if (searchQuery) params.set("search", searchQuery);

    try {
      const res = await fetch(`/api/admin/reconciliation?${params.toString()}`);
      const json = await res.json();
      if (json.data?.cases) {
        setCases(json.data.cases);
      }
    } catch {
      // Keep existing cases on network error
    } finally {
      setLoading(false);
    }
  }

  async function viewCaseDetail(domain: string, reference: string) {
    try {
      const res = await fetch(`/api/admin/reconciliation/${domain}/${reference}`);
      const json = await res.json();
      if (json.data) {
        setActiveCase(json.data);
      }
    } catch {
      // Failed to load case detail
    }
  }

  async function handleExecuteAction(actionKey: string) {
    if (!activeCase) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    const operationId = `RECOP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    try {
      const res = await fetch(
        `/api/admin/reconciliation/${activeCase.domain}/${activeCase.publicReference}/actions/${actionKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operationId,
            reasonCode: actionReason || "MANUAL_RECOVERY_EXECUTION",
            confirmAction: actionKey,
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || json.error) {
        setActionError(json.error || "Recovery execution failed");
        return;
      }

      setActionSuccess(`Recovery action '${actionKey}' executed successfully.`);
      setActiveAction(null);
      setActionReason("");
      setConfirmText("");
      // Refresh active case & list
      await viewCaseDetail(activeCase.domain, activeCase.publicReference);
      await fetchCases();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unexpected error during recovery execution");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="bg-[--kt-surface] border border-[--kt-border] rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[--kt-text-muted] mb-1">Domain</label>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full text-sm border border-[--kt-border] rounded-lg p-2 bg-[--kt-surface]"
            >
              <option value="">All Domains</option>
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d.replace(/_/g, " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[--kt-text-muted] mb-1">Severity</label>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full text-sm border border-[--kt-border] rounded-lg p-2 bg-[--kt-surface]"
            >
              <option value="">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[--kt-text-muted] mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-sm border border-[--kt-border] rounded-lg p-2 bg-[--kt-surface]"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="CONVERGED">Converged</option>
              <option value="RESOLVED">Resolved</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[--kt-text-muted] mb-1">Search</label>
            <Input
              type="text"
              placeholder="Search reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={fetchCases} disabled={loading}>
            {loading ? "Filtering..." : "Apply Filters"}
          </Button>
        </div>
      </div>

      {/* Cases Table */}
      <div className="border border-[--kt-border] rounded-xl overflow-hidden bg-[--kt-surface]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[--kt-surface-muted] border-b border-[--kt-border] text-xs font-semibold text-[--kt-text-muted]">
            <tr>
              <th className="p-3">Reference</th>
              <th className="p-3">Domain</th>
              <th className="p-3">Severity</th>
              <th className="p-3">Status</th>
              <th className="p-3">Summary</th>
              <th className="p-3">Created</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[--kt-border]">
            {cases.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-xs text-[--kt-text-muted]">
                  No reconciliation cases found for the selected criteria.
                </td>
              </tr>
            ) : (
              cases.map((c) => (
                <tr key={`${c.domain}-${c.publicReference}`} className="hover:bg-[--kt-surface-muted]/50">
                  <td className="p-3 font-mono text-xs font-semibold">{c.publicReference}</td>
                  <td className="p-3 text-xs uppercase font-medium">{c.domain.replace(/_/g, " ")}</td>
                  <td className="p-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        c.severity === "CRITICAL"
                          ? "bg-red-100 text-red-800"
                          : c.severity === "HIGH"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {c.severity}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        c.canonicalStatus === "OPEN"
                          ? "bg-amber-100 text-amber-800"
                          : c.canonicalStatus === "CONVERGED" || c.canonicalStatus === "RESOLVED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-neutral-100 text-neutral-800"
                      }`}
                    >
                      {c.canonicalStatus}
                    </span>
                  </td>
                  <td className="p-3 text-xs max-w-xs truncate">{c.safeSummary}</td>
                  <td className="p-3 text-xs text-[--kt-text-muted]">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => viewCaseDetail(c.domain, c.publicReference)}
                    >
                      Inspect
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Case Detail Modal */}
      {activeCase && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[--kt-surface] border border-[--kt-border] rounded-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-[--kt-border] pb-3">
              <div>
                <h3 className="text-lg font-bold">Reconciliation Case: {activeCase.publicReference}</h3>
                <p className="text-xs text-[--kt-text-muted] font-mono">
                  Domain: {activeCase.domain} | Severity: {activeCase.severity} | Status: {activeCase.canonicalStatus}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveCase(null);
                  setActiveAction(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold block text-[--kt-text-muted]">Summary</span>
                <p className="p-2 bg-[--kt-surface-muted] rounded">{activeCase.safeSummary}</p>
              </div>

              <div>
                <span className="font-semibold block text-[--kt-text-muted]">Permitted Recovery Actions</span>
                <div className="space-y-2 mt-1">
                  {activeCase.permittedActions.map((action) => (
                    <div key={action.actionKey} className="border border-[--kt-border] p-3 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{action.name}</p>
                        <p className="text-[--kt-text-muted]">{action.description}</p>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={action.readinessState === "BLOCKED"}
                        onClick={() => setActiveAction(action.actionKey)}
                      >
                        Execute Action
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recovery Execution Confirmation Form */}
              {activeAction && (
                <div className="p-4 border border-[--kt-border] rounded-xl bg-[--kt-surface-muted] space-y-3 mt-4">
                  <h4 className="font-bold text-sm">Confirm Action: {activeAction}</h4>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Reason / Note</label>
                    <Input
                      type="text"
                      placeholder="Reason for manual recovery execution..."
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Type &apos;{activeAction}&apos; to confirm</label>
                    <Input
                      type="text"
                      placeholder={activeAction}
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                    />
                  </div>
                  {actionError && <p className="text-xs text-red-600 font-semibold">{actionError}</p>}
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setActiveAction(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={confirmText !== activeAction || actionLoading}
                      onClick={() => handleExecuteAction(activeAction)}
                    >
                      {actionLoading ? "Executing..." : "Confirm & Execute"}
                    </Button>
                  </div>
                </div>
              )}

              {actionSuccess && <p className="text-xs text-emerald-600 font-semibold p-2 bg-emerald-50 rounded">{actionSuccess}</p>}

              {/* Timeline */}
              <div>
                <span className="font-semibold block text-[--kt-text-muted]">Case Timeline</span>
                <div className="space-y-1 mt-1 border-l-2 border-[--kt-border] pl-3">
                  {activeCase.timeline.map((item, idx) => (
                    <div key={idx} className="py-1">
                      <span className="font-semibold text-xs">{item.eventType}</span> —{" "}
                      <span className="text-[--kt-text-muted]">{item.safeNote}</span>
                      <span className="block text-[10px] text-[--kt-text-muted]">{new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
