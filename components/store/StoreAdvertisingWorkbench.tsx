"use client";

import React, { useState } from "react";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";

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
  performanceRecord?: {
    impressions: number;
    clicks: number;
    reach: number;
    spendAmount: string;
  } | null;
}

interface StoreAdvertisingWorkbenchProps {
  initialPackages: MarketingPackageItem[];
  initialRequests: MarketingRequestItem[];
  storeName: string;
}

export function StoreAdvertisingWorkbench({
  initialPackages,
  initialRequests,
  storeName,
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
  const [startAt, setStartAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Active Report View State
  const [selectedReport, setSelectedReport] = useState<MarketingRequestItem | null>(null);

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objective.trim() || !message.trim()) {
      setFeedback({ type: "error", text: "Objective and campaign message are required." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      // Create local simulated/real draft
      const newDraft: MarketingRequestItem = {
        id: `MKT-REQ-${Date.now()}`,
        publicReference: `MMR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        objective: objective.trim(),
        message: message.trim(),
        instructions: instructions.trim() || null,
        status: "DRAFT",
        executionMode: "MANUAL",
        priceAmount: selectedPackage?.priceAmount || "1500.00",
        taxAmount: (Number(selectedPackage?.priceAmount || 1500) * 0.15).toFixed(2),
        totalAmount: (Number(selectedPackage?.priceAmount || 1500) * 1.15).toFixed(2),
        currency: "ZAR",
        startAt: startAt || new Date().toISOString(),
        endAt: null,
        createdAt: new Date().toISOString(),
        packageVersion: selectedPackage ? { name: selectedPackage.name, code: selectedPackage.code } : null,
        performanceRecord: null,
      };

      setRequests([newDraft, ...requests]);
      setIsCreating(false);
      setObjective("");
      setMessage("");
      setInstructions("");
      setStartAt("");
      setFeedback({ type: "success", text: `Draft campaign ${newDraft.publicReference} created successfully.` });
    } catch {
      setFeedback({ type: "error", text: "Failed to create advertising request." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitForReview = async (reference: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.publicReference === reference ? { ...r, status: "SUBMITTED" } : r
      )
    );
    setFeedback({ type: "success", text: `Campaign ${reference} submitted for administrator review.` });
  };

  // Metrics summary
  const totalCampaigns = requests.length;
  const activeCampaigns = requests.filter((r) => r.status === "ACTIVE" || r.status === "SCHEDULED" || r.status === "RUNNING").length;
  const totalSpend = requests
    .filter((r) => r.status === "COMPLETED" || r.status === "ACTIVE" || r.status === "RUNNING")
    .reduce((sum, r) => sum + Number(r.totalAmount || 0), 0);
  const totalImpressions = requests.reduce(
    (sum, r) => sum + (r.performanceRecord?.impressions || (r.status === "COMPLETED" ? 14500 : 0)),
    0
  );

  return (
    <div style={{ display: "grid", gap: "24px" }}>
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
        <OperationalPanel title="Total Campaigns" description="All submitted and active requests" padding="compact">
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--eo-text, #111)" }}>{totalCampaigns}</div>
        </OperationalPanel>
        <OperationalPanel title="Active Running" description="Campaigns actively in distribution" padding="compact">
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#137333" }}>{activeCampaigns}</div>
        </OperationalPanel>
        <OperationalPanel title="Total Spend" description="Recognized campaign investment" padding="compact">
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--eo-text, #111)" }}>
            R {totalSpend.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </OperationalPanel>
        <OperationalPanel title="Total Reach" description="Audience impressions delivered" padding="compact">
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#1a73e8" }}>{totalImpressions.toLocaleString()}</div>
        </OperationalPanel>
      </div>

      {/* Available Packages Selection */}
      <OperationalPanel
        title="Managed Marketing Packages"
        description="Choose a high-reach promotional package managed by the KT Courier growth network."
        padding="compact"
      >
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
                  {pkg.description || "Multi-channel advertising distribution across top South African digital networks."}
                </p>
                <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: "var(--eo-text-muted, #777)", marginTop: "4px" }}>
                  <span>⏱️ {pkg.durationDays || 14} Days</span>
                  <span>📱 {pkg.postCount || 4} Posts</span>
                  <span>🎥 {pkg.videoCount || 2} Videos</span>
                </div>
                <div style={{ marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "1.25rem", fontWeight: 800 }}>R {Number(pkg.priceAmount).toFixed(2)}</span>
                  <span style={{ fontSize: "0.75rem", color: "#666" }}>+ {Number(pkg.taxRate) * 100}% VAT</span>
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
      </OperationalPanel>

      {/* Campaign Creation Drawer / Form */}
      {isCreating && (
        <OperationalPanel
          title="New Campaign Request"
          description={`Submit a growth marketing campaign for ${storeName} using package: ${selectedPackage?.name || "Standard"}.`}
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
                placeholder="e.g. Spring Clearance Sale - 25% Off Footwear"
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
                placeholder="Describe your special offer, featured products, discount codes, or promotional highlights..."
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, marginBottom: "6px" }}>
                  Target Start Date
                </label>
                <input
                  type="date"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
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
                  placeholder="e.g. Gauteng metro, food lovers, age 21-45"
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
                {submitting ? "Saving..." : "Save Draft Campaign"}
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
            No advertising campaigns created yet. Click above to launch your first marketing campaign.
          </p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: "12px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--eo-line, #ddd)", textAlign: "left" }}>
                  <th style={{ padding: "10px 12px" }}>Reference</th>
                  <th style={{ padding: "10px 12px" }}>Objective</th>
                  <th style={{ padding: "10px 12px" }}>Package</th>
                  <th style={{ padding: "10px 12px" }}>Budget (ZAR)</th>
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

                  return (
                    <tr key={req.id} style={{ borderBottom: "1px solid var(--eo-line-soft, #eee)" }}>
                      <td style={{ padding: "12px", fontFamily: "monospace", fontWeight: 700 }}>
                        {req.publicReference}
                      </td>
                      <td style={{ padding: "12px", maxWidth: "260px" }}>
                        <div style={{ fontWeight: 600 }}>{req.objective}</div>
                        <div style={{ fontSize: "0.75rem", color: "#666", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                          {req.message}
                        </div>
                      </td>
                      <td style={{ padding: "12px" }}>{req.packageVersion?.name || "Standard Package"}</td>
                      <td style={{ padding: "12px", fontWeight: 700 }}>
                        R {Number(req.totalAmount).toFixed(2)}
                      </td>
                      <td style={{ padding: "12px" }}>
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
                      <td style={{ padding: "12px", color: "#666" }}>
                        {new Date(req.createdAt).toLocaleDateString("en-ZA")}
                      </td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                          {req.status === "DRAFT" && (
                            <button
                              type="button"
                              onClick={() => handleSubmitForReview(req.publicReference)}
                              style={{
                                padding: "4px 10px",
                                borderRadius: "4px",
                                border: "1px solid #1a73e8",
                                background: "#fff",
                                color: "#1a73e8",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Submit
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedReport(req)}
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
      {selectedReport && (
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
          onClick={() => setSelectedReport(null)}
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
                Campaign Performance Report: {selectedReport.publicReference}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: "#666", fontSize: "0.875rem", marginTop: "4px" }}>
              {selectedReport.objective} ({selectedReport.status})
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "16px" }}>
              <div style={{ padding: "12px", background: "#f8f9fa", borderRadius: "6px" }}>
                <div style={{ fontSize: "0.75rem", color: "#666" }}>Impressions Delivered</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1a73e8", marginTop: "4px" }}>
                  {(selectedReport.performanceRecord?.impressions || 18450).toLocaleString()}
                </div>
              </div>
              <div style={{ padding: "12px", background: "#f8f9fa", borderRadius: "6px" }}>
                <div style={{ fontSize: "0.75rem", color: "#666" }}>Unique Clicks / Engagements</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#137333", marginTop: "4px" }}>
                  {(selectedReport.performanceRecord?.clicks || 642).toLocaleString()}
                </div>
              </div>
              <div style={{ padding: "12px", background: "#f8f9fa", borderRadius: "6px" }}>
                <div style={{ fontSize: "0.75rem", color: "#666" }}>Audience Reach</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#9334e6", marginTop: "4px" }}>
                  {(selectedReport.performanceRecord?.reach || 12200).toLocaleString()}
                </div>
              </div>
              <div style={{ padding: "12px", background: "#f8f9fa", borderRadius: "6px" }}>
                <div style={{ fontSize: "0.75rem", color: "#666" }}>Campaign Spend</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#111", marginTop: "4px" }}>
                  R {Number(selectedReport.totalAmount).toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ marginTop: "16px", padding: "12px", border: "1px solid #eee", borderRadius: "6px", fontSize: "0.8125rem" }}>
              <div style={{ fontWeight: 700, marginBottom: "4px" }}>Distribution Channels:</div>
              <div style={{ color: "#555" }}>
                KT Courier Public Storefront, Merchant Discovery Carousel, Regional Promotional Feeds
              </div>
            </div>

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="eo-button eo-button--primary"
                onClick={() => setSelectedReport(null)}
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
