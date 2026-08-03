"use client";

import { useState } from "react";

export function CommissionPlanActions({ id, status, canReview, canApprove }: Readonly<{ id: string; status: string; canReview: boolean; canApprove: boolean }>) {
  const [message, setMessage] = useState<string | null>(null);
  const action = async (name: "submit" | "approve" | "activate" | "reject" | "retire") => {
    const response = await fetch(`/api/admin/commission-plans/${id}/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operationId: crypto.randomUUID() }) });
    const data = await response.json() as { error?: string };
    setMessage(response.ok ? `${name} request recorded. Refresh to view current evidence.` : data.error ?? "Commission plan action failed.");
  };
  return <section aria-label="commission-plan-actions"><h2 className="font-semibold">Lifecycle actions</h2><div className="flex gap-2">{status === "DRAFT" && canReview ? <button type="button" onClick={() => void action("submit")}>Submit for review</button> : null}{status === "UNDER_REVIEW" && canApprove ? <button type="button" onClick={() => void action("approve")}>Approve</button> : null}{status === "UNDER_REVIEW" && canReview ? <button type="button" onClick={() => void action("reject")}>Reject</button> : null}{status === "APPROVED" && canApprove ? <button type="button" onClick={() => void action("activate")}>Activate</button> : null}{status === "ACTIVE" && canApprove ? <button type="button" onClick={() => void action("retire")}>Retire</button> : null}</div>{message ? <p role="status">{message}</p> : null}</section>;
}
