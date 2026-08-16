"use client";

import React, { useState } from "react";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";

export interface MarketingPackagePlacement {
  id: string;
  publicReference: string;
  code: string;
  displayName: string;
  kind: string;
}

export interface MarketingPackageChannelItem {
  id: string;
  publicReference: string;
  code: string;
  displayName: string;
  channel: string;
  placements?: MarketingPackagePlacement[];
}

export interface MarketingPackageItem {
  id: string;
  publicReference: string;
  code: string;
  name: string;
  description: string | null;
  channel: string;
  durationDays: number | null;
  postCount: number;
  videoCount: number;
  storyCount: number;
  priceAmount: string;
  taxRate: string;
  currency: string;
  status: string;
  channels?: MarketingPackageChannelItem[];
}

export interface EntitledStoreMediaItem {
  id: string;
  publicReference: string;
  fileName: string;
  mimeType: string;
  purpose: string;
}

export interface MarketingRequestCreativeItem {
  id: string;
  publicReference: string;
  source: string;
  role: string;
  mediaReference: string;
  createdAt: string;
}

export interface MarketingRequestItem {
  id: string;
  publicReference: string;
  objective: string;
  message: string;
  instructions: string | null;
  status: string;
  executionMode: string;
  priceAmount: string;
  taxAmount: string;
  totalAmount: string;
  currency: string;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  packageVersion?: {
    name: string;
    code: string;
  } | null;
  creatives?: MarketingRequestCreativeItem[];
  performanceRecord?: {
    impressions: number;
    clicks: number;
    spendAmount: string;
  } | null;
}

export interface CampaignReportData {
  advertiser: { storeId: string; requesterUserId: string };
  campaign: { reference: string; status: string; startsAt: string; endsAt: string };
  package: { reference: string; code: string; versionNumber: number };
  commercial: {
    committedBaseAmount: string;
    committedTaxAmount: string;
    committedGrossAmount: string;
    currency: string;
    paymentReference: string | null;
    receiptLedgerJournalReference: string | null;
    revenueLedgerJournalReference: string | null;
    recognizedRevenueAmount: string;
    recognizedTaxAmount: string;
    reconciliationStatus: string;
  };
  performance: {
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalSpendAmount: string;
    currency: string;
    records: Array<{
      periodStartsAt: string;
      periodEndsAt: string;
      impressions: number;
      clicks: number;
      conversions: number;
      spendAmount: string;
      reportedByUserId: string;
      recordedAt: string;
    }>;
  };
}

interface StoreAdvertisingWorkbenchProps {
  initialPackages: MarketingPackageItem[];
  initialRequests: MarketingRequestItem[];
  entitledMedia?: EntitledStoreMediaItem[];
  storeName: string;
  backendError?: string | null;
}

function makeOperationId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function StoreAdvertisingWorkbench({
  initialPackages,
  initialRequests,
  entitledMedia = [],
  storeName,
  backendError,
}: StoreAdvertisingWorkbenchProps) {
  const [packages] = useState<MarketingPackageItem[]>(initialPackages);
  const [requests, setRequests] = useState<MarketingRequestItem[]>(initialRequests);
  const [selectedPackage, setSelectedPackage] = useState<MarketingPackageItem | null>(
    packages[0] || null
  );

  // Form State
  const [isCreating, setIsCreating] = useState(false);
  const [objective, setObjective] = useState("");
  const [message, setMessage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [destinationLink, setDestinationLink] = useState("https://ktcourier.co.za");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Creative Management State per draft
  const [selectedMediaForDraft, setSelectedMediaForDraft] = useState<Record<string, string>>({});
  const [attachingMedia, setAttachingMedia] = useState<Record<string, boolean>>({});

  // Active Report View State
  const [selectedReportReq, setSelectedReportReq] = useState<MarketingRequestItem | null>(null);
  const [reportData, setReportData] = useState<CampaignReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage) {
      setFeedback({ type: "error", text: "Please select an advertising package." });
      return;
    }
    if (!objective.trim() || !message.trim()) {
      setFeedback({ type: "error", text: "Objective and campaign message are required." });
      return;
    }

    const startDate = startsAt ? new Date(startsAt) : new Date(Date.now() + 86400000);
    const durationDays = selectedPackage.durationDays || 14;
    const endDate = endsAt ? new Date(endsAt) : new Date(startDate.getTime() + durationDays * 86400000);

    if (startDate >= endDate) {
      setFeedback({ type: "error", text: "Campaign start date must be before end date." });
      return;
    }

    const channel = selectedPackage.channels?.find((c) => c.placements && c.placements.length > 0) || selectedPackage.channels?.[0];
    const placement = channel?.placements?.[0];

    if (!channel || !placement) {
      setFeedback({
        type: "error",
        text: "The selected marketing package does not have active channel placements configured. Please select a package with active placements.",
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const payload = {
        packageReference: selectedPackage.publicReference,
        selections: [
          {
            channelReference: channel.publicReference,
            placementReferences: [placement.publicReference],
          },
        ],
        executionMode: "MANUAL",
        objective: objective.trim(),
        message: message.trim(),
        destinationLink: destinationLink.trim() || "https://ktcourier.co.za",
        instructions: instructions.trim() || null,
        startsAt: startDate.toISOString(),
        endsAt: endDate.toISOString(),
        operationId: makeOperationId("op_draft"),
      };

      const res = await fetch("/api/store/managed-marketing/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create campaign draft");
      }

      const created = data.request;
      if (!created.commercial) {
        throw new Error("Created campaign is missing authoritative commercial snapshot data.");
      }

      const newRequestItem: MarketingRequestItem = {
        id: created.id,
        publicReference: created.publicReference,
        objective: created.objective,
        message: created.message,
        instructions: created.instructions,
        status: created.status,
        executionMode: created.executionMode,
        priceAmount: created.commercial.baseAmount,
        taxAmount: created.commercial.taxAmount,
        totalAmount: created.commercial.grossAmount,
        currency: created.commercial.currency,
        startAt: created.startsAt,
        endAt: created.endsAt,
        createdAt: created.createdAt || new Date().toISOString(),
        packageVersion: { name: selectedPackage.name, code: selectedPackage.code },
        creatives: [],
        performanceRecord: null,
      };

      setRequests((prev) => [newRequestItem, ...prev]);
      setIsCreating(false);
      setObjective("");
      setMessage("");
      setInstructions("");
      setStartsAt("");
      setEndsAt("");
      setFeedback({ type: "success", text: `Campaign draft ${created.publicReference} created. Next, attach a creative asset to enable submission.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create advertising request.";
      setFeedback({ type: "error", text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachCreative = async (requestReference: string) => {
    const defaultMediaRef = entitledMedia[0]?.publicReference || "";
    const mediaRef = selectedMediaForDraft[requestReference] || defaultMediaRef;
    if (!mediaRef.trim()) {
      setFeedback({ type: "error", text: "Please select an entitled media asset to attach." });
      return;
    }
    setAttachingMedia((prev) => ({ ...prev, [requestReference]: true }));
    setFeedback(null);
    try {
      const res = await fetch(`/api/store/managed-marketing/requests/${requestReference}/creatives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "PRIVATE_MEDIA",
          mediaReference: mediaRef.trim(),
          role: "PRIMARY_HERO",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to attach creative to draft campaign");
      }
      const createdCreative = data.creative;
      setRequests((prev) =>
        prev.map((r) => {
          if (r.publicReference === requestReference) {
            const updated = [
              ...(r.creatives || []),
              {
                id: createdCreative.id,
                publicReference: createdCreative.publicReference,
                source: createdCreative.source,
                role: createdCreative.role || "PRIMARY_HERO",
                mediaReference: mediaRef.trim(),
                createdAt: createdCreative.createdAt || new Date().toISOString(),
              },
            ];
            return { ...r, creatives: updated };
          }
          return r;
        })
      );
      setFeedback({ type: "success", text: `Creative ${mediaRef} attached to campaign ${requestReference}.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to attach creative.";
      setFeedback({ type: "error", text: msg });
    } finally {
      setAttachingMedia((prev) => ({ ...prev, [requestReference]: false }));
    }
  };

  const handleRemoveCreative = async (requestReference: string, creativeReference: string) => {
    setFeedback(null);
    try {
      const res = await fetch(`/api/store/managed-marketing/requests/${requestReference}/creatives/${creativeReference}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove creative");
      }
      setRequests((prev) =>
        prev.map((r) => {
          if (r.publicReference === requestReference) {
            return {
              ...r,
              creatives: (r.creatives || []).filter((c) => c.publicReference !== creativeReference),
            };
          }
          return r;
        })
      );
      setFeedback({ type: "success", text: `Creative removed from campaign ${requestReference}.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove creative.";
      setFeedback({ type: "error", text: msg });
    }
  };

  const handleSubmitForReview = async (reference: string) => {
    setFeedback(null);
    const targetReq = requests.find((r) => r.publicReference === reference);
    if (!targetReq?.creatives || targetReq.creatives.length === 0) {
      setFeedback({
        type: "error",
        text: "At least one entitled creative asset must be attached before submitting campaign for administrator review.",
      });
      return;
    }

    try {
      const operationId = makeOperationId("op_sub");
      const res = await fetch(`/api/store/managed-marketing/requests/${reference}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit campaign for review");
      }

      setRequests((prev) =>
        prev.map((r) =>
          r.publicReference === reference ? { ...r, status: "SUBMITTED" } : r
        )
      );
      setFeedback({ type: "success", text: `Campaign ${reference} submitted for administrator review.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed.";
      setFeedback({ type: "error", text: msg });
    }
  };

  const handleOpenReport = async (req: MarketingRequestItem) => {
    setSelectedReportReq(req);
    setReportData(null);
    setReportError(null);
    setLoadingReport(true);

    try {
      const res = await fetch(`/api/store/managed-marketing/requests/${req.publicReference}/report`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load report data from server");
      }
      setReportData(data.report);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to retrieve performance report.";
      setReportError(msg);
    } finally {
      setLoadingReport(false);
    }
  };

  // Metrics summary calculated only from real state
  const totalCampaigns = requests.length;
  const activeCampaigns = requests.filter((r) => r.status === "ACTIVE" || r.status === "SCHEDULED" || r.status === "RUNNING").length;
  const totalSpend = requests
    .filter((r) => r.status === "COMPLETED" || r.status === "ACTIVE" || r.status === "RUNNING")
    .reduce((sum, r) => sum + Number(r.totalAmount || 0), 0);
  const hasAnyPerformance = requests.some((r) => r.performanceRecord != null);
  const totalImpressions = hasAnyPerformance
    ? requests.reduce((sum, r) => sum + (r.performanceRecord?.impressions || 0), 0)
    : null;

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      {/* Backend / Error Banner */}
      {backendError && (
        <div
          style={{
            padding: "16px",
            borderRadius: "8px",
            background: "#fce8e6",
            color: "#c5221f",
            border: "1px solid #fad2cf",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          ⚠️ Marketing Service Unavailable: {backendError}
        </div>
      )}

      {/* Top Notification Feedback */}
      {feedback && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "6px",
            background: feedback.type === "success" ? "#e6f4ea" : "#fce8e6",
            color: feedback.type === "success" ? "#137333" : "#c5221f",
            border: `1px solid ${feedback.type === "success" ? "#ceead6" : "#fad2cf"}`,
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          {feedback.text}
        </div>
      )}

      {/* Metrics Banner */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        <OperationalPanel title="Total Campaigns" description="Persisted merchant requests" padding="compact">
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--eo-text, #111)" }}>{totalCampaigns}</div>
        </OperationalPanel>
        <OperationalPanel title="Active Running" description="Campaigns in active distribution" padding="compact">
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#137333" }}>{activeCampaigns}</div>
        </OperationalPanel>
        <OperationalPanel title="Total Spend" description="Committed campaign investment" padding="compact">
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--eo-text, #111)" }}>
            R {totalSpend.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </OperationalPanel>
        <OperationalPanel title="Recorded Impressions" description="Audience impressions recorded" padding="compact">
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#1a73e8" }}>
            {totalImpressions != null ? totalImpressions.toLocaleString() : "Unrecorded"}
          </div>
        </OperationalPanel>
      </div>

      {/* Available Packages Selection */}
      <OperationalPanel
        title="Managed Marketing Packages"
        description="Choose an active, platform-approved marketing package for your store."
        padding="compact"
      >
        {packages.length === 0 ? (
          <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--eo-text-muted, #777)", fontSize: "0.875rem" }}>
            No marketing packages are currently configured or active on the platform. Please check back later or contact platform administration.
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginTop: "12px" }}>
              {packages.map((pkg) => {
                const isSelected = selectedPackage?.id === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    onClick={() => setSelectedPackage(pkg)}
                    style={{
                      border: isSelected ? "2px solid #1a73e8" : "1px solid var(--eo-line-soft, #e0e0e0)",
                      borderRadius: "8px",
                      padding: "16px",
                      background: isSelected ? "rgba(26, 115, 232, 0.04)" : "var(--eo-surface, #fff)",
                      cursor: "pointer",
                      display: "grid",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 800, fontSize: "1rem" }}>{pkg.name}</span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "2px 8px", borderRadius: "12px", background: "#e8f0fe", color: "#1a73e8" }}>
                        {pkg.channel}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.8125rem", color: "var(--eo-text-secondary, #666)", margin: 0 }}>
                      {pkg.description || "Platform managed marketing distribution."}
                    </p>
                    <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: "var(--eo-text-muted, #777)", marginTop: "4px" }}>
                      <span>⏱️ {pkg.durationDays ? `${pkg.durationDays} Days` : "Standard"}</span>
                      <span>📱 {pkg.postCount} Posts</span>
                      <span>🎥 {pkg.videoCount} Videos</span>
                    </div>
                    <div style={{ marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: "1.25rem", fontWeight: 800 }}>R {Number(pkg.priceAmount).toFixed(2)}</span>
                      <span style={{ fontSize: "0.75rem", color: "#666" }}>+ {Number(pkg.taxRate) * 100}% Tax</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="eo-button eo-button--primary"
                onClick={() => setIsCreating(true)}
                style={{
                  padding: "8px 18px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + Create Campaign Request
              </button>
            </div>
          </>
        )}
      </OperationalPanel>

      {/* Campaign Creation Drawer / Form */}
      {isCreating && selectedPackage && (
        <OperationalPanel
          title="New Campaign Request"
          description={`Submit a growth marketing campaign for ${storeName} using package: ${selectedPackage.name}.`}
          padding="compact"
        >
          <form onSubmit={handleCreateDraft} style={{ display: "grid", gap: "16px", marginTop: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, marginBottom: "6px" }}>
                Campaign Objective *
              </label>
              <input
                type="text"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="e.g. Seasonal Promotion - 20% Off"
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--eo-line-strong, #ccc)",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, marginBottom: "6px" }}>
                Marketing Copy / Core Message *
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your special offer, products, or promotional highlights..."
                rows={4}
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--eo-line-strong, #ccc)",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, marginBottom: "6px" }}>
                Destination Landing URL *
              </label>
              <input
                type="url"
                value={destinationLink}
                onChange={(e) => setDestinationLink(e.target.value)}
                placeholder="https://ktcourier.co.za/shop/stores/your-store"
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--eo-line-strong, #ccc)",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, marginBottom: "6px" }}>
                  Target Start Date
                </label>
                <input
                  type="date"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--eo-line-strong, #ccc)",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, marginBottom: "6px" }}>
                  Target Audience Instructions
                </label>
                <input
                  type="text"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. Local township customer focus"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--eo-line-strong, #ccc)",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}>
              <button
                type="button"
                className="eo-button eo-button--secondary"
                onClick={() => setIsCreating(false)}
                style={{ padding: "8px 16px", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="eo-button eo-button--primary"
                style={{ padding: "8px 20px", fontWeight: 700, cursor: "pointer" }}
              >
                {submitting ? "Persisting to Database..." : "Save Draft Campaign"}
              </button>
            </div>
          </form>
        </OperationalPanel>
      )}

      {/* Existing Requests Table */}
      <OperationalPanel
        title="Store Advertising Requests & Campaigns"
        description="Historical and active promotional campaigns submitted for platform and partner distribution."
        padding="compact"
      >
        {requests.length === 0 ? (
          <p style={{ color: "var(--eo-text-muted, #777)", fontSize: "0.875rem", margin: "16px 0" }}>
            No advertising campaigns created yet. Select a package above to create your first campaign.
          </p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: "12px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--eo-line, #ddd)", textAlign: "left" }}>
                  <th style={{ padding: "10px 12px" }}>Reference</th>
                  <th style={{ padding: "10px 12px" }}>Objective & Media</th>
                  <th style={{ padding: "10px 12px" }}>Package</th>
                  <th style={{ padding: "10px 12px" }}>Amount (ZAR)</th>
                  <th style={{ padding: "10px 12px" }}>Status</th>
                  <th style={{ padding: "10px 12px" }}>Date</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const statusColors: Record<string, { bg: string; text: string }> = {
                    DRAFT: { bg: "#f1f3f4", text: "#5f6368" },
                    SUBMITTED: { bg: "#fef7e0", text: "#b06000" },
                    UNDER_REVIEW: { bg: "#fef7e0", text: "#b06000" },
                    APPROVED: { bg: "#e8f0fe", text: "#1a73e8" },
                    SCHEDULED: { bg: "#e8f0fe", text: "#1a73e8" },
                    ACTIVE: { bg: "#e6f4ea", text: "#137333" },
                    RUNNING: { bg: "#e6f4ea", text: "#137333" },
                    COMPLETED: { bg: "#e6f4ea", text: "#137333" },
                    REJECTED: { bg: "#fce8e6", text: "#c5221f" },
                  };
                  const color = statusColors[req.status] || { bg: "#f1f3f4", text: "#333" };
                  const hasCreatives = (req.creatives?.length ?? 0) > 0;

                  return (
                    <tr key={req.id} style={{ borderBottom: "1px solid var(--eo-line-soft, #eee)" }}>
                      <td style={{ padding: "12px", fontFamily: "monospace", fontWeight: 700, verticalAlign: "top" }}>
                        {req.publicReference}
                      </td>
                      <td style={{ padding: "12px", maxWidth: "300px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 600 }}>{req.objective}</div>
                        <div style={{ fontSize: "0.75rem", color: "#666", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                          {req.message}
                        </div>

                        {/* Creative Assets Management */}
                        <div style={{ marginTop: "6px" }}>
                          {hasCreatives ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                              {req.creatives!.map((c) => (
                                <span
                                  key={c.id || c.publicReference}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: "#e8f0fe",
                                    color: "#1a73e8",
                                    fontSize: "0.7rem",
                                    fontWeight: 600,
                                  }}
                                >
                                  🖼️ {c.mediaReference}
                                  {req.status === "DRAFT" && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCreative(req.publicReference, c.publicReference)}
                                      title="Remove creative"
                                      style={{
                                        border: "none",
                                        background: "none",
                                        color: "#c5221f",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                        padding: "0 2px",
                                      }}
                                    >
                                      ×
                                    </button>
                                  )}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: "0.7rem", color: "#c5221f", fontWeight: 600 }}>
                              ⚠️ No creative attached (required before submit)
                            </div>
                          )}

                          {/* DRAFT Attach Creative Selector */}
                          {req.status === "DRAFT" && (
                            <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "6px" }}>
                              {entitledMedia.length > 0 ? (
                                <>
                                  <select
                                    value={selectedMediaForDraft[req.publicReference] || entitledMedia[0]?.publicReference || ""}
                                    onChange={(e) =>
                                      setSelectedMediaForDraft((prev) => ({
                                        ...prev,
                                        [req.publicReference]: e.target.value,
                                      }))
                                    }
                                    style={{
                                      padding: "2px 6px",
                                      fontSize: "0.7rem",
                                      borderRadius: "4px",
                                      border: "1px solid #ccc",
                                      maxWidth: "160px",
                                    }}
                                  >
                                    {entitledMedia.map((m) => (
                                      <option key={m.id} value={m.publicReference}>
                                        {m.fileName} ({m.publicReference.slice(0, 10)})
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    disabled={attachingMedia[req.publicReference]}
                                    onClick={() => handleAttachCreative(req.publicReference)}
                                    style={{
                                      padding: "2px 6px",
                                      borderRadius: "4px",
                                      border: "1px solid #1a73e8",
                                      background: "#f0f6ff",
                                      color: "#1a73e8",
                                      fontSize: "0.7rem",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {attachingMedia[req.publicReference] ? "..." : "+ Attach"}
                                  </button>
                                </>
                              ) : (
                                <span style={{ fontSize: "0.7rem", color: "#c5221f", fontStyle: "italic" }}>
                                  No entitled media assets available. Upload media in store profile first.
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "12px", verticalAlign: "top" }}>{req.packageVersion?.name || "Unavailable Package"}</td>
                      <td style={{ padding: "12px", fontWeight: 700, verticalAlign: "top" }}>
                        R {Number(req.totalAmount).toFixed(2)}
                      </td>
                      <td style={{ padding: "12px", verticalAlign: "top" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "12px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background: color.bg,
                            color: color.text,
                          }}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px", color: "#666", verticalAlign: "top" }}>
                        {new Date(req.createdAt).toLocaleDateString("en-ZA")}
                      </td>
                      <td style={{ padding: "12px", textAlign: "right", verticalAlign: "top" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                          {req.status === "DRAFT" && (
                            <button
                              type="button"
                              disabled={!hasCreatives}
                              title={hasCreatives ? "Submit for admin review" : "Attach a creative asset first"}
                              onClick={() => handleSubmitForReview(req.publicReference)}
                              style={{
                                padding: "4px 10px",
                                borderRadius: "4px",
                                border: hasCreatives ? "1px solid #1a73e8" : "1px solid #ccc",
                                background: hasCreatives ? "#1a73e8" : "#f5f5f5",
                                color: hasCreatives ? "#fff" : "#999",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                cursor: hasCreatives ? "pointer" : "not-allowed",
                              }}
                            >
                              Submit
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenReport(req)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "4px",
                              border: "1px solid var(--eo-line, #ccc)",
                              background: "#fff",
                              color: "var(--eo-text, #333)",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Report
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </OperationalPanel>

      {/* Performance Report Modal */}
      {selectedReportReq && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => {
            setSelectedReportReq(null);
            setReportData(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "8px",
              maxWidth: "600px",
              width: "100%",
              padding: "24px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 800 }}>
                Campaign Performance Report: {selectedReportReq.publicReference}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedReportReq(null);
                  setReportData(null);
                }}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: "#666", fontSize: "0.875rem", marginTop: "4px" }}>
              {selectedReportReq.objective} ({selectedReportReq.status})
            </p>

            {loadingReport ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#666" }}>
                Loading verified campaign telemetry from ledger & marketing authority...
              </div>
            ) : reportError ? (
              <div style={{ padding: "16px", background: "#fce8e6", color: "#c5221f", borderRadius: "6px", marginTop: "16px" }}>
                {reportError}
              </div>
            ) : reportData ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "16px" }}>
                  <div style={{ padding: "12px", background: "#f8f9fa", borderRadius: "6px" }}>
                    <div style={{ fontSize: "0.75rem", color: "#666" }}>Recorded Impressions</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1a73e8", marginTop: "4px" }}>
                      {reportData.performance.totalImpressions.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ padding: "12px", background: "#f8f9fa", borderRadius: "6px" }}>
                    <div style={{ fontSize: "0.75rem", color: "#666" }}>Recorded Clicks</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#137333", marginTop: "4px" }}>
                      {reportData.performance.totalClicks.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ padding: "12px", background: "#f8f9fa", borderRadius: "6px" }}>
                    <div style={{ fontSize: "0.75rem", color: "#666" }}>Recorded Conversions</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#9334e6", marginTop: "4px" }}>
                      {reportData.performance.totalConversions.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ padding: "12px", background: "#f8f9fa", borderRadius: "6px" }}>
                    <div style={{ fontSize: "0.75rem", color: "#666" }}>Recognized Spend</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#111", marginTop: "4px" }}>
                      R {Number(reportData.commercial.committedGrossAmount).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "16px", padding: "12px", border: "1px solid #eee", borderRadius: "6px", fontSize: "0.8125rem" }}>
                  <div style={{ fontWeight: 700, marginBottom: "4px" }}>Commercial & Reconciliation Audit:</div>
                  <div style={{ color: "#555", display: "grid", gap: "4px" }}>
                    <div><strong>Status:</strong> {reportData.commercial.reconciliationStatus}</div>
                    <div><strong>Revenue Journal:</strong> {reportData.commercial.revenueLedgerJournalReference || "Pending recognition"}</div>
                    <div><strong>Receipt Journal:</strong> {reportData.commercial.receiptLedgerJournalReference || "Pending receipt"}</div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: "16px", color: "#777", fontSize: "0.875rem" }}>
                No telemetry recorded for this campaign yet.
              </div>
            )}

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="eo-button eo-button--primary"
                onClick={() => {
                  setSelectedReportReq(null);
                  setReportData(null);
                }}
                style={{ padding: "8px 18px", cursor: "pointer" }}
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
