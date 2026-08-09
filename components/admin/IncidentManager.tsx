"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

export interface OperationalIncidentItem {
  id: string;
  publicReference: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: string;
  status: string;
  safeSummary: string;
  affectedCapabilities?: string[] | null;
  detectionSource?: string | null;
  commanderUserId?: string | null;
  mitigationSummary?: string | null;
  resolutionSummary?: string | null;
  openedAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
  timeline?: Array<{
    eventType: string;
    safeNote: string;
    actorUserId?: string | null;
    createdAt: string;
  }>;
}

interface IncidentManagerProps {
  initialIncidents: OperationalIncidentItem[];
}

export function IncidentManager({ initialIncidents }: IncidentManagerProps) {
  const [incidents, setIncidents] = useState<OperationalIncidentItem[]>(initialIncidents);
  const [selectedSeverity, setSelectedSeverity] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeIncident, setActiveIncident] = useState<OperationalIncidentItem | null>(null);

  // Form states for creating incident
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("HIGH");
  const [summary, setSummary] = useState("");
  const [capabilities, setCapabilities] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Transition state
  const [nextStatus, setNextStatus] = useState("");
  const [transitionNote, setTransitionNote] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  async function fetchIncidents() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/incidents");
      const json = await res.json();
      if (json.data) setIncidents(json.data);
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
    }
  }

  async function viewDetail(reference: string) {
    try {
      const res = await fetch(`/api/admin/incidents/${reference}`);
      const json = await res.json();
      if (json.data) setActiveIncident(json.data);
    } catch {
      // Failed to view detail
    }
  }

  async function handleCreateIncident() {
    setCreating(true);
    setCreateError(null);

    const capabilityArray = capabilities
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/admin/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category || "Operational Anomaly",
          severity,
          safeSummary: summary,
          affectedCapabilities: capabilityArray,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setCreateError(json.error || "Failed to open operational incident");
        return;
      }

      setShowCreateModal(false);
      setCategory("");
      setSummary("");
      setCapabilities("");
      await fetchIncidents();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setCreating(false);
    }
  }

  async function handleTransition() {
    if (!activeIncident || !nextStatus) return;
    setTransitioning(true);
    setTransitionError(null);

    const operationId = `INCOP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    try {
      const res = await fetch(`/api/admin/incidents/${activeIncident.publicReference}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nextStatus,
          reasonCode: "ADMIN_OPERATIONAL_TRANSITION",
          note: transitionNote || undefined,
          operationId,
          confirmStatus: nextStatus,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setTransitionError(json.error || "Incident transition failed");
        return;
      }

      setNextStatus("");
      setTransitionNote("");
      await viewDetail(activeIncident.publicReference);
      await fetchIncidents();
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : "Transition error");
    } finally {
      setTransitioning(false);
    }
  }

  const filteredIncidents = incidents.filter((inc) => {
    if (selectedSeverity && inc.severity !== selectedSeverity) return false;
    if (selectedStatus && inc.status !== selectedStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[--kt-surface] border border-[--kt-border] rounded-xl p-4">
        <div>
          <h3 className="text-base font-bold text-[--kt-text]">Operational Incident Command Centre</h3>
          <p className="text-xs text-[--kt-text-muted]">
            Track, declare, transition, and log append-only timeline events for live operational incidents.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchIncidents} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
            Declare Incident
          </Button>
        </div>
      </div>

      {/* Filter controls */}
      <div className="flex gap-3 bg-[--kt-surface] border border-[--kt-border] rounded-xl p-4">
        <select
          value={selectedSeverity}
          onChange={(e) => setSelectedSeverity(e.target.value)}
          className="text-xs border border-[--kt-border] rounded-lg p-2 bg-[--kt-surface]"
        >
          <option value="">All Severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="text-xs border border-[--kt-border] rounded-lg p-2 bg-[--kt-surface]"
        >
          <option value="">All Lifecycle States</option>
          <option value="OPEN">Open</option>
          <option value="INVESTIGATING">Investigating</option>
          <option value="MITIGATING">Mitigating</option>
          <option value="MONITORING">Monitoring</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {/* Incidents table */}
      <div className="border border-[--kt-border] rounded-xl overflow-hidden bg-[--kt-surface]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[--kt-surface-muted] border-b border-[--kt-border] text-xs font-semibold text-[--kt-text-muted]">
            <tr>
              <th className="p-3">Reference</th>
              <th className="p-3">Severity</th>
              <th className="p-3">Category</th>
              <th className="p-3">Status</th>
              <th className="p-3">Summary</th>
              <th className="p-3">Opened</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[--kt-border]">
            {filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-xs text-[--kt-text-muted]">
                  No operational incidents found.
                </td>
              </tr>
            ) : (
              filteredIncidents.map((inc) => (
                <tr key={inc.publicReference} className="hover:bg-[--kt-surface-muted]/50">
                  <td className="p-3 font-mono text-xs font-bold">{inc.publicReference}</td>
                  <td className="p-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        inc.severity === "CRITICAL"
                          ? "bg-red-100 text-red-800"
                          : inc.severity === "HIGH"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {inc.severity}
                    </span>
                  </td>
                  <td className="p-3 text-xs font-medium">{inc.category}</td>
                  <td className="p-3 font-mono text-xs font-bold">{inc.status}</td>
                  <td className="p-3 text-xs max-w-xs truncate">{inc.safeSummary}</td>
                  <td className="p-3 text-xs text-[--kt-text-muted]">{new Date(inc.openedAt).toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    <Button variant="secondary" size="sm" onClick={() => viewDetail(inc.publicReference)}>
                      View Timeline / Transition
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Declare Incident Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[--kt-surface] border border-[--kt-border] rounded-xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">Declare Operational Incident</h3>

            <div>
              <label className="block text-xs font-semibold mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => {
                  const nextSeverity = e.target.value;
                  if (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(nextSeverity)) {
                    setSeverity(nextSeverity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL");
                  }
                }}
                className="w-full text-sm border border-[--kt-border] rounded-lg p-2 bg-[--kt-surface]"
              >
                <option value="CRITICAL">CRITICAL (Major Service Outage / Data Loss)</option>
                <option value="HIGH">HIGH (Degraded Operational Capability)</option>
                <option value="MEDIUM">MEDIUM (Non-blocking Operational Anomaly)</option>
                <option value="LOW">LOW (Minor Warning / Diagnostic Alert)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Category</label>
              <Input
                placeholder="e.g. Payment Gateway / Dispatch / Webhook Delivery"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Summary</label>
              <Textarea
                rows={3}
                placeholder="Describe the operational anomaly or incident safely..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Affected Capabilities (comma separated)</label>
              <Input
                placeholder="payments, dispatch, notifications"
                value={capabilities}
                onChange={(e) => setCapabilities(e.target.value)}
              />
            </div>

            {createError && <p className="text-xs text-red-600 font-semibold">{createError}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" disabled={!summary || creating} onClick={handleCreateIncident}>
                {creating ? "Declaring..." : "Declare Incident"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Incident Detail & Transition Modal */}
      {activeIncident && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[--kt-surface] border border-[--kt-border] rounded-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-[--kt-border] pb-3">
              <div>
                <h3 className="text-lg font-bold font-mono">{activeIncident.publicReference}</h3>
                <p className="text-xs text-[--kt-text-muted]">
                  Category: {activeIncident.category} | Severity: {activeIncident.severity} | Current Status: {activeIncident.status}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveIncident(null)}
                className="text-gray-500 hover:text-gray-700 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="text-xs space-y-2 bg-[--kt-surface-muted] p-3 rounded">
              <p><span className="font-semibold">Summary:</span> {activeIncident.safeSummary}</p>
              {activeIncident.mitigationSummary && (
                <p><span className="font-semibold text-amber-700">Mitigation Note:</span> {activeIncident.mitigationSummary}</p>
              )}
              {activeIncident.resolutionSummary && (
                <p><span className="font-semibold text-emerald-700">Resolution Note:</span> {activeIncident.resolutionSummary}</p>
              )}
            </div>

            {/* Transition Control */}
            <div className="border border-[--kt-border] p-4 rounded-xl space-y-3">
              <h4 className="font-bold text-xs uppercase text-[--kt-text-muted]">Transition Lifecycle State</h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Next State</label>
                  <select
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value)}
                    className="w-full text-sm border border-[--kt-border] rounded-lg p-2 bg-[--kt-surface]"
                  >
                    <option value="">Select Target State</option>
                    <option value="INVESTIGATING">INVESTIGATING</option>
                    <option value="MITIGATING">MITIGATING</option>
                    <option value="MONITORING">MONITORING</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Mitigation / Resolution Note</label>
                  <Input
                    placeholder="Append-only note..."
                    value={transitionNote}
                    onChange={(e) => setTransitionNote(e.target.value)}
                  />
                </div>
              </div>

              {transitionError && <p className="text-xs text-red-600 font-semibold">{transitionError}</p>}

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!nextStatus || transitioning}
                  onClick={handleTransition}
                >
                  {transitioning ? "Transitioning..." : "Apply State Transition"}
                </Button>
              </div>
            </div>

            {/* Append-only Timeline */}
            <div>
              <h4 className="font-bold text-xs uppercase text-[--kt-text-muted] mb-2">Append-Only Incident Timeline</h4>
              <div className="space-y-2 border-l-2 border-[--kt-border] pl-3 text-xs">
                {activeIncident.timeline?.map((t, i) => (
                  <div key={i} className="py-1">
                    <span className="font-bold font-mono">{t.eventType}</span> — <span>{t.safeNote}</span>
                    <span className="block text-[10px] text-[--kt-text-muted]">{new Date(t.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
