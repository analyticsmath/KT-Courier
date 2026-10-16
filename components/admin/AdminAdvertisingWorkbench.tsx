"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { OperationalPanel, MetricTile } from "@/components/protected-v2";

export interface ManagedMarketingAdminRequest {
  id: string;
  publicReference: string;
  storeId: string;
  channel: string;
  executionMode: string;
  status: string;
  objective: string;
  message: string;
  destinationLink: string;
  instructions: string | null;
  startsAt: string;
  endsAt: string;
  priceSnapshot: string | null;
  taxSnapshot: string | null;
  currency?: string;
  commercial?: {
    baseAmount: string;
    taxRate: string;
    taxAmount: string;
    grossAmount: string;
    currency: string;
  } | null;
  packageVersion?: {
    id: string;
    publicReference: string;
    code: string;
    name: string;
    channel: string;
    priceAmount: string | null;
  } | null;
  channels?: Array<{
    id: string;
    channelDefinition?: {
      code: string;
      displayName: string;
    };
    placements?: Array<{
      placement?: {
        displayName: string;
        kind: string;
      };
    }>;
  }>;
  creatives?: Array<{
    id: string;
    publicReference: string;
    source: string;
    role: string;
    mediaReference: string;
  }>;
  performanceRecords?: Array<{
    id: string;
    publicReference: string;
    impressions: number;
    clicks: number;
    conversions: number;
    periodStartsAt: string;
    periodEndsAt: string;
  }>;
}

export interface ManagedMarketingPackageSummary {
  id: string;
  publicReference: string;
  code: string;
  name: string;
  channel: string;
  durationDays: number | null;
  priceAmount: unknown;
  taxRate: unknown;
  currency?: string;
  status: string;
}

export interface ManagedMarketingPlacementSummary {
  id: string;
  publicReference: string;
  code: string;
  displayName: string;
  kind: string;
  channelReference: string;
  active: boolean;
}

export interface ManagedMarketingRevenueReport {
  requestReference: string;
  storeId: string;
  channel: string;
  status: string;
  startsAt: string;
  endsAt: string;
  netRevenue: string;
  taxAmount: string;
  grossAmount: string;
  paymentReference: string | null;
  billingEvidenceReference: string | null;
}

interface AdminAdvertisingWorkbenchProps {
  initialRequests?: ManagedMarketingAdminRequest[];
  initialPackages?: ManagedMarketingPackageSummary[];
  initialPlacements?: ManagedMarketingPlacementSummary[];
  initialRevenueReports?: ManagedMarketingRevenueReport[];
  packages?: ManagedMarketingPackageSummary[];
  placements?: ManagedMarketingPlacementSummary[];
  revenueReports?: ManagedMarketingRevenueReport[];
}

const STATUS_FILTERS = [
  "ALL",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "RUNNING",
  "PAUSED",
  "ENDED",
  "COMPLETED",
  "REJECTED",
] as const;

export function AdminAdvertisingWorkbench({
  initialRequests = [],
  initialPackages,
  initialPlacements,
  initialRevenueReports,
  packages: rawPackages = [],
  placements: rawPlacements = [],
  revenueReports: rawRevenueReports = [],
}: AdminAdvertisingWorkbenchProps) {
  const packages = initialPackages ?? rawPackages;
  const placements = initialPlacements ?? rawPlacements;
  const revenueReports = initialRevenueReports ?? rawRevenueReports;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"campaigns" | "packages" | "revenue">("campaigns");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog states
  const [rejectingRef, setRejectingRef] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [runningRef, setRunningRef] = useState<string | null>(null);
  const [externalReference, setExternalReference] = useState("");
  const [performanceRef, setPerformanceRef] = useState<string | null>(null);
  const [perfImpressions, setPerfImpressions] = useState(0);
  const [perfClicks, setPerfClicks] = useState(0);
  const [perfConversions, setPerfConversions] = useState(0);
  const [perfExtRef, setPerfExtRef] = useState("");

  const filteredRequests = initialRequests.filter((req) => {
    if (statusFilter === "ALL") return true;
    return req.status === statusFilter;
  });

  const totalGrossRevenue = revenueReports.reduce(
    (acc, r) => acc + Number(r.grossAmount || 0),
    0
  );

  async function callAction(
    reference: string,
    action: string,
    payload: Record<string, unknown> = {}
  ) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const operationId = `admin-action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const response = await fetch(
        `/api/admin/managed-marketing/requests/${reference}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operationId, ...payload }),
        }
      );
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || `Failed to ${action} request`);
      }
      setSuccess(`Campaign ${reference} ${action} succeeded.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectingRef || !rejectionReason.trim()) return;
    await callAction(rejectingRef, "reject", { reason: rejectionReason.trim() });
    setRejectingRef(null);
    setRejectionReason("");
  }

  async function handleRunManually(e: React.FormEvent) {
    e.preventDefault();
    if (!runningRef || !externalReference.trim()) return;
    await callAction(runningRef, "run", {
      externalReference: externalReference.trim(),
    });
    setRunningRef(null);
    setExternalReference("");
  }

  async function handleRecordPerformance(e: React.FormEvent) {
    e.preventDefault();
    if (!performanceRef || !perfExtRef.trim()) return;
    const req = initialRequests.find((r) => r.publicReference === performanceRef);
    await callAction(performanceRef, "performance", {
      periodStartsAt: req?.startsAt ?? new Date().toISOString(),
      periodEndsAt: req?.endsAt ?? new Date().toISOString(),
      impressions: Number(perfImpressions),
      clicks: Number(perfClicks),
      conversions: Number(perfConversions),
      externalReference: perfExtRef.trim(),
    });
    setPerformanceRef(null);
    setPerfExtRef("");
    setPerfImpressions(0);
    setPerfClicks(0);
    setPerfConversions(0);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("campaigns")}
          className={`px-4 py-2 font-medium text-sm rounded-lg ${
            activeTab === "campaigns"
              ? "bg-[var(--kt-text)] text-white"
              : "text-[var(--kt-text-muted)] hover:text-[var(--kt-text)]"
          }`}
        >
          Campaign Requests ({initialRequests.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("packages")}
          className={`px-4 py-2 font-medium text-sm rounded-lg ${
            activeTab === "packages"
              ? "bg-[var(--kt-text)] text-white"
              : "text-[var(--kt-text-muted)] hover:text-[var(--kt-text)]"
          }`}
        >
          Packages & Placements ({packages.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("revenue")}
          className={`px-4 py-2 font-medium text-sm rounded-lg ${
            activeTab === "revenue"
              ? "bg-[var(--kt-text)] text-white"
              : "text-[var(--kt-text-muted)] hover:text-[var(--kt-text)]"
          }`}
        >
          Revenue Reports ({revenueReports.length})
        </button>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-lg bg-red-50 text-red-800 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="p-4 rounded-lg bg-green-50 text-green-800 text-sm">
          {success}
        </div>
      )}

      {activeTab === "campaigns" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[var(--kt-text-muted)] uppercase">
              Filter status:
            </span>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  statusFilter === s
                    ? "bg-[var(--kt-text)] text-white border-transparent"
                    : "text-[var(--kt-text-muted)] border-gray-300 hover:border-gray-400"
                }`}
              >
                {s.replaceAll("_", " ")}
              </button>
            ))}
          </div>

          <OperationalPanel
            title={`Managed Campaign Requests (${filteredRequests.length})`}
            description="Operational moderation, schedule control, manual execution evidence, and performance records."
          >
            {filteredRequests.length === 0 ? (
              <p className="text-sm text-[var(--kt-text-muted)] py-6 text-center">
                No marketing requests match the selected status filter.
              </p>
            ) : (
              <div className="divide-y">
                {filteredRequests.map((req) => (
                  <article key={req.id} className="py-5 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base">{req.objective}</span>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded ${
                              req.status === "RUNNING"
                                ? "bg-green-100 text-green-800"
                                : req.status === "UNDER_REVIEW"
                                ? "bg-amber-100 text-amber-800"
                                : req.status === "APPROVED"
                                ? "bg-blue-100 text-blue-800"
                                : req.status === "REJECTED"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {req.status.replaceAll("_", " ")}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--kt-text-muted)] mt-0.5">
                          Ref: {req.publicReference} · Store: {req.storeId} · Channel: {req.channel} · Mode: {req.executionMode}
                        </p>
                      </div>

                      <div className="text-right text-sm">
                        <span className="font-semibold">
                          {req.commercial
                            ? `R ${req.commercial.grossAmount}`
                            : req.priceSnapshot
                            ? `R ${req.priceSnapshot}`
                            : "—"}
                        </span>
                        <p className="text-xs text-[var(--kt-text-muted)]">
                          {new Date(req.startsAt).toLocaleDateString()} – {new Date(req.endsAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-[var(--kt-text)]">{req.message}</p>

                    {req.destinationLink && (
                      <p className="text-xs text-blue-600 break-all">
                        Destination: <a href={req.destinationLink} target="_blank" rel="noopener noreferrer" className="underline">{req.destinationLink}</a>
                      </p>
                    )}

                    {req.performanceRecords && req.performanceRecords.length > 0 && (
                      <div className="bg-gray-50 rounded p-2 text-xs grid grid-cols-3 gap-2">
                        <div>
                          <strong>Impressions:</strong> {req.performanceRecords.reduce((acc, p) => acc + p.impressions, 0).toLocaleString()}
                        </div>
                        <div>
                          <strong>Clicks:</strong> {req.performanceRecords.reduce((acc, p) => acc + p.clicks, 0).toLocaleString()}
                        </div>
                        <div>
                          <strong>Conversions:</strong> {req.performanceRecords.reduce((acc, p) => acc + p.conversions, 0).toLocaleString()}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2">
                      {req.status === "SUBMITTED" && (
                        <Button
                          disabled={busy}
                          onClick={() => void callAction(req.publicReference, "review")}
                          size="sm"
                        >
                          Begin Review
                        </Button>
                      )}

                      {req.status === "UNDER_REVIEW" && (
                        <>
                          <Button
                            disabled={busy}
                            onClick={() => void callAction(req.publicReference, "approve")}
                            size="sm"
                            className="bg-green-700 hover:bg-green-800"
                          >
                            Approve Campaign
                          </Button>
                          <Button
                            disabled={busy}
                            onClick={() => setRejectingRef(req.publicReference)}
                            size="sm"
                            variant="danger"
                          >
                            Reject with Reason
                          </Button>
                        </>
                      )}

                      {req.status === "APPROVED" && (
                        <>
                          <Button
                            disabled={busy}
                            onClick={() => void callAction(req.publicReference, "schedule")}
                            size="sm"
                          >
                            Schedule Campaign
                          </Button>
                          <Button
                            disabled={busy}
                            onClick={() => setRunningRef(req.publicReference)}
                            size="sm"
                            className="bg-indigo-700 hover:bg-indigo-800"
                          >
                            Run Manually
                          </Button>
                        </>
                      )}

                      {req.status === "SCHEDULED" && (
                        <Button
                          disabled={busy}
                          onClick={() => setRunningRef(req.publicReference)}
                          size="sm"
                          className="bg-indigo-700 hover:bg-indigo-800"
                        >
                          Run Manually
                        </Button>
                      )}

                      {req.status === "RUNNING" && (
                        <>
                          <Button
                            disabled={busy}
                            onClick={() => setPerformanceRef(req.publicReference)}
                            size="sm"
                          >
                            Record Performance
                          </Button>
                          <Button
                            disabled={busy}
                            onClick={() => void callAction(req.publicReference, "pause")}
                            size="sm"
                            variant="secondary"
                          >
                            Pause
                          </Button>
                          <Button
                            disabled={busy}
                            onClick={() => void callAction(req.publicReference, "end")}
                            size="sm"
                            variant="secondary"
                          >
                            End Campaign
                          </Button>
                        </>
                      )}

                      {req.status === "PAUSED" && (
                        <Button
                          disabled={busy}
                          onClick={() => void callAction(req.publicReference, "resume")}
                          size="sm"
                        >
                          Resume
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </OperationalPanel>
        </div>
      )}

      {activeTab === "packages" && (
        <div className="space-y-6">
          <OperationalPanel
            title="Managed Marketing Packages"
            description="Versioned commercial packages available to vendors."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {packages.map((pkg) => (
                <div key={pkg.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-base">{pkg.name}</h4>
                      <p className="text-xs text-[var(--kt-text-muted)]">
                        Code: {pkg.code} · Channel: {pkg.channel}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100">
                      {pkg.status}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-[var(--kt-text)]">
                    Price: R {String(pkg.priceAmount)} {pkg.currency || "ZAR"}
                  </div>
                  {pkg.durationDays && (
                    <p className="text-xs text-[var(--kt-text-muted)]">
                      Duration: {pkg.durationDays} days
                    </p>
                  )}
                </div>
              ))}
            </div>
          </OperationalPanel>

          <OperationalPanel
            title="Channel Placements"
            description="Configured on-platform and external placement channels."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 font-semibold">Name</th>
                    <th className="py-2 pr-4 font-semibold">Code</th>
                    <th className="py-2 pr-4 font-semibold">Kind</th>
                    <th className="py-2 pr-4 font-semibold">Channel</th>
                    <th className="py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {placements.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 pr-4 font-medium">{p.displayName}</td>
                      <td className="py-2.5 pr-4 text-xs font-mono">{p.code}</td>
                      <td className="py-2.5 pr-4 text-xs">{p.kind}</td>
                      <td className="py-2.5 pr-4 text-xs">{p.channelReference}</td>
                      <td className="py-2.5 text-xs">
                        {p.active ? (
                          <span className="text-green-700 font-semibold">Active</span>
                        ) : (
                          <span className="text-gray-500">Disabled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </OperationalPanel>
        </div>
      )}

      {activeTab === "revenue" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetricTile
              label="Recognized Managed Marketing Gross"
              value={`R ${totalGrossRevenue.toFixed(2)}`}
              description="Total verified billing evidence"
            />
            <MetricTile
              label="Billed Campaigns"
              value={String(revenueReports.length)}
              description="Campaigns with recognized billing evidence"
            />
          </div>

          <OperationalPanel
            title="Managed Marketing Revenue Evidence"
            description="Audit-grade revenue records tied to verified payment receipts."
          >
            {revenueReports.length === 0 ? (
              <p className="text-sm text-[var(--kt-text-muted)] py-6 text-center">
                No revenue reports found for the current period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-4 font-semibold">Request</th>
                      <th className="py-2 pr-4 font-semibold">Channel</th>
                      <th className="py-2 pr-4 font-semibold">Net</th>
                      <th className="py-2 pr-4 font-semibold">Tax</th>
                      <th className="py-2 pr-4 font-semibold">Gross</th>
                      <th className="py-2 font-semibold">Payment / Evidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {revenueReports.map((r) => (
                      <tr key={r.requestReference}>
                        <td className="py-2.5 pr-4 font-mono text-xs">{r.requestReference}</td>
                        <td className="py-2.5 pr-4">{r.channel}</td>
                        <td className="py-2.5 pr-4">R {r.netRevenue}</td>
                        <td className="py-2.5 pr-4">R {r.taxAmount}</td>
                        <td className="py-2.5 pr-4 font-semibold">R {r.grossAmount}</td>
                        <td className="py-2.5 text-xs text-[var(--kt-text-muted)]">
                          {r.paymentReference || "—"} / {r.billingEvidenceReference || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </OperationalPanel>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingRef && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-semibold text-lg">Reject Campaign Request</h3>
            <p className="text-xs text-[var(--kt-text-muted)]">
              A clear rejection reason is required and will be recorded in the audit event log.
            </p>
            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <Label htmlFor="rejection-reason">Rejection reason</Label>
                <textarea
                  id="rejection-reason"
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full rounded-lg border p-2 text-sm mt-1"
                  placeholder="e.g. Media artwork does not meet resolution standards or destination URL is invalid."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setRejectingRef(null)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="danger" disabled={busy || !rejectionReason.trim()}>
                  Reject Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Run Manually Modal */}
      {runningRef && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-semibold text-lg">Record Manual Publishing Evidence</h3>
            <p className="text-xs text-[var(--kt-text-muted)]">
              Enter the external campaign or ad reference from TikTok Ads Manager, Meta Business Suite, etc.
            </p>
            <form onSubmit={handleRunManually} className="space-y-4">
              <div>
                <Label htmlFor="external-reference">External Ad/Campaign ID</Label>
                <Input
                  id="external-reference"
                  required
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  placeholder="e.g. tt_adv_719482749 or meta_cam_928194"
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setRunningRef(null)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || !externalReference.trim()}>
                  Mark as Running
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Performance Modal */}
      {performanceRef && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-semibold text-lg">Record Campaign Performance</h3>
            <form onSubmit={handleRecordPerformance} className="space-y-3">
              <div>
                <Label htmlFor="perf-ext-ref">Provider Report Reference</Label>
                <Input
                  id="perf-ext-ref"
                  required
                  value={perfExtRef}
                  onChange={(e) => setPerfExtRef(e.target.value)}
                  placeholder="e.g. report_export_20261016_csv"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="perf-impressions">Impressions</Label>
                  <Input
                    id="perf-impressions"
                    type="number"
                    min={0}
                    value={perfImpressions}
                    onChange={(e) => setPerfImpressions(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="perf-clicks">Clicks</Label>
                  <Input
                    id="perf-clicks"
                    type="number"
                    min={0}
                    value={perfClicks}
                    onChange={(e) => setPerfClicks(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="perf-conversions">Conversions</Label>
                  <Input
                    id="perf-conversions"
                    type="number"
                    min={0}
                    value={perfConversions}
                    onChange={(e) => setPerfConversions(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPerformanceRef(null)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || !perfExtRef.trim()}>
                  Save Performance
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
