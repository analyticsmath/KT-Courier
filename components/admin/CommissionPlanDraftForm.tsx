"use client";

import { useState } from "react";

export function CommissionPlanDraftForm() {
  const [message, setMessage] = useState<string | null>(null);
  async function submit(formData: FormData) {
    setMessage(null);
    const body = { subjectType: "COURIER_ORDER", scopeKey: "GLOBAL:COURIER_ORDER", basisType: formData.get("basisType"), effectiveFrom: new Date(String(formData.get("effectiveFrom"))).toISOString(), effectiveUntil: formData.get("effectiveUntil") ? new Date(String(formData.get("effectiveUntil"))).toISOString() : null, calculationVersion: String(formData.get("calculationVersion")), rules: [{ ruleCode: String(formData.get("ruleCode")).toUpperCase(), allocationType: "PLATFORM_COMMISSION_REVENUE", beneficiaryType: "PLATFORM", calculationMethod: "PERCENTAGE_BPS", rateBasisPoints: Number(formData.get("rateBasisPoints")), priority: 10, isRequired: true }], operationId: crypto.randomUUID() };
    const response = await fetch("/api/admin/commission-plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json() as { error?: string; plan?: { publicReference: string } };
    setMessage(response.ok ? `Draft ${data.plan?.publicReference ?? "commission plan"} created. Refresh to inspect it.` : data.error ?? "Unable to create commission plan draft.");
  }
  return <form action={submit} className="grid gap-3 rounded border border-[--kt-border] p-4" aria-label="create-commission-plan"><h2 className="font-semibold">Create commission plan draft</h2><p className="text-sm text-[--kt-text-muted]">Policy inputs only. Amounts are calculated by the server and no policy is activated from this form.</p><label htmlFor="commission-basis">Basis<select id="commission-basis" name="basisType" defaultValue="ORDER_TOTAL"><option value="ORDER_TOTAL">Order total</option><option value="ORDER_SUBTOTAL">Order subtotal</option></select></label><label htmlFor="commission-effective-from">Effective from<input id="commission-effective-from" name="effectiveFrom" type="datetime-local" required /></label><label htmlFor="commission-effective-until">Effective until (exclusive)<input id="commission-effective-until" name="effectiveUntil" type="datetime-local" /></label><label htmlFor="commission-calculation-version">Calculation version<input id="commission-calculation-version" name="calculationVersion" defaultValue="commission-v1" required /></label><label htmlFor="commission-rule-code">Platform rule code<input id="commission-rule-code" name="ruleCode" defaultValue="PLATFORM_COMMISSION" required /></label><label htmlFor="commission-bps">Rate (basis points)<input id="commission-bps" name="rateBasisPoints" type="number" min="0" max="10000" defaultValue="1000" required /></label><button type="submit">Create draft</button>{message ? <p role="status">{message}</p> : null}</form>;
}
