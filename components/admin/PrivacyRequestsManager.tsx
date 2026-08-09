"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export interface PrivacyRequestItem {
  id: string;
  publicReference: string;
  requesterUserId?: string | null;
  requestType: "ACCESS" | "DELETION" | "CORRECTION";
  status: string;
  identityVerificationStatus: string;
  scope?: string[] | null;
  deadlineAt?: string | null;
  holdEvaluationSummary?: {
    hasHold: boolean;
    activeHoldReason?: string;
  } | null;
  createdAt: string;
  completedAt?: string | null;
}

interface PrivacyRequestsManagerProps {
  initialRequests: PrivacyRequestItem[];
}

export function PrivacyRequestsManager({ initialRequests }: PrivacyRequestsManagerProps) {
  const [requests, setRequests] = useState<PrivacyRequestItem[]>(initialRequests);
  const [loading, setLoading] = useState(false);
  const [activeRequest, setActiveRequest] = useState<PrivacyRequestItem | null>(null);
  const [nextStatus, setNextStatus] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [confirmStatus, setConfirmStatus] = useState("");
  const [identityVerified, setIdentityVerified] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchRequests() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/privacy-requests");
      const json = await res.json();
      if (json.data) setRequests(json.data);
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
    }
  }

  async function viewDetail(reference: string) {
    try {
      const res = await fetch(`/api/admin/privacy-requests/${reference}`);
      const json = await res.json();
      if (json.data) setActiveRequest(json.data);
    } catch {
      // Failed to load detail
    }
  }

  async function handleTransition() {
    if (!activeRequest || !nextStatus) return;
    setTransitioning(true);
    setError(null);

    const operationId = `PRIVOP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    try {
      const res = await fetch(`/api/admin/privacy-requests/${activeRequest.publicReference}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nextStatus,
          reasonCode: reasonCode || "ADMIN_PRIVACY_FULFILMENT",
          identityVerified,
          operationId,
          confirmStatus,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error || "Privacy request transition failed");
        return;
      }

      setNextStatus("");
      setReasonCode("");
      setConfirmStatus("");
      await viewDetail(activeRequest.publicReference);
      await fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transition error");
    } finally {
      setTransitioning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[--kt-surface] border border-[--kt-border] rounded-xl p-4">
        <div>
          <h3 className="text-base font-bold text-[--kt-text]">Privacy Requests & Data Governance</h3>
          <p className="text-xs text-[--kt-text-muted]">
            Process identity-verified access, correction, and hold-evaluated deletion requests.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchRequests} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <div className="border border-[--kt-border] rounded-xl overflow-hidden bg-[--kt-surface]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[--kt-surface-muted] border-b border-[--kt-border] text-xs font-semibold text-[--kt-text-muted]">
            <tr>
              <th className="p-3">Reference</th>
              <th className="p-3">Type</th>
              <th className="p-3">Verification</th>
              <th className="p-3">Status</th>
              <th className="p-3">Hold Check</th>
              <th className="p-3">Created</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[--kt-border]">
            {requests.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-xs text-[--kt-text-muted]">
                  No privacy requests recorded.
                </td>
              </tr>
            ) : (
              requests.map((r) => (
                <tr key={r.publicReference} className="hover:bg-[--kt-surface-muted]/50">
                  <td className="p-3 font-mono text-xs font-bold">{r.publicReference}</td>
                  <td className="p-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      {r.requestType}
                    </span>
                  </td>
                  <td className="p-3 text-xs">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        r.identityVerificationStatus === "VERIFIED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {r.identityVerificationStatus}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs">{r.status}</td>
                  <td className="p-3 text-xs">
                    {r.holdEvaluationSummary?.hasHold ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800">
                        HOLD_ACTIVE
                      </span>
                    ) : (
                      <span className="text-[10px] text-[--kt-text-muted]">CLEAR</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-[--kt-text-muted]">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    <Button variant="secondary" size="sm" onClick={() => viewDetail(r.publicReference)}>
                      Inspect / Transition
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {activeRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[--kt-surface] border border-[--kt-border] rounded-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-[--kt-border] pb-3">
              <div>
                <h3 className="text-lg font-bold font-mono">{activeRequest.publicReference}</h3>
                <p className="text-xs text-[--kt-text-muted]">
                  Type: {activeRequest.requestType} | Identity: {activeRequest.identityVerificationStatus}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveRequest(null)}
                className="text-gray-500 hover:text-gray-700 text-lg font-bold"
              >
                ×
              </button>
            </div>

            {activeRequest.holdEvaluationSummary?.hasHold && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded text-xs">
                <span className="font-bold">Active Retention Hold:</span> {activeRequest.holdEvaluationSummary.activeHoldReason}
                <p className="mt-0.5">Destructive subject deletion is overridden until hold is released.</p>
              </div>
            )}

            {/* Transition controls */}
            <div className="border border-[--kt-border] p-4 rounded-xl space-y-3">
              <h4 className="font-bold text-xs uppercase text-[--kt-text-muted]">Transition Request State</h4>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="idVerify"
                  checked={identityVerified}
                  onChange={(e) => setIdentityVerified(e.target.checked)}
                />
                <label htmlFor="idVerify" className="text-xs font-semibold">Mark Identity Verified</label>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Target Status</label>
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value)}
                  className="w-full text-sm border border-[--kt-border] rounded-lg p-2 bg-[--kt-surface]"
                >
                  <option value="">Select Target Status</option>
                  <option value="IDENTITY_VERIFICATION_REQUIRED">IDENTITY_VERIFICATION_REQUIRED</option>
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="IN_REVIEW">IN_REVIEW</option>
                  <option value="FULFILMENT_IN_PROGRESS">FULFILMENT_IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="REJECTED_WITH_REASON">REJECTED_WITH_REASON</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Reason Code / Outcome Note</label>
                <input
                  type="text"
                  placeholder="e.g. FULFILLED_WITH_HOLD_CHECK"
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full text-sm border border-[--kt-border] rounded-lg p-2 bg-[--kt-surface]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Confirm Target Status (Type exact status name)</label>
                <input
                  type="text"
                  placeholder={nextStatus}
                  value={confirmStatus}
                  onChange={(e) => setConfirmStatus(e.target.value)}
                  className="w-full text-sm border border-[--kt-border] rounded-lg p-2 bg-[--kt-surface]"
                />
              </div>

              {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!nextStatus || confirmStatus !== nextStatus || transitioning}
                  onClick={handleTransition}
                >
                  {transitioning ? "Executing..." : "Transition Privacy Request"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
