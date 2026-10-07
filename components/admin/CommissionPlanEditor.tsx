"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import type { getCommissionPlan } from "@/lib/services/commission-plan-query.service";

type Plan = NonNullable<Awaited<ReturnType<typeof getCommissionPlan>>>;
type Rule = Plan["rules"][number];
export function CommissionPlanEditor({ plan }: { plan: Plan }) {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>([...plan.rules]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/commission-plans/${plan.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectType: plan.subjectType, scopeKey: plan.scopeKey,
          expectedVersion: plan.version, operationId: crypto.randomUUID(),
          basisType: form.get("basisType"), calculationVersion: form.get("calculationVersion"),
          effectiveFrom: new Date(`${form.get("effectiveFrom")}Z`).toISOString(),
          effectiveUntil: form.get("effectiveUntil") ? new Date(`${form.get("effectiveUntil")}Z`).toISOString() : null,
          rules: rules.map((rule, index) => {
            const field = (key: string) => String(form.get(`rule-${index}-${key}`) ?? "");
            const beneficiaryType = field("beneficiaryType");
            const calculationMethod = field("calculationMethod");
            return {
              ruleCode: field("ruleCode").toUpperCase(), beneficiaryType,
              allocationType: beneficiaryType === "PLATFORM" ? "PLATFORM_COMMISSION_REVENUE" : "BENEFICIARY_COMMISSION_PAYABLE",
              calculationMethod, priority: Number(field("priority")),
              isRequired: form.get(`rule-${index}-isRequired`) === "on",
              ...(calculationMethod === "PERCENTAGE_BPS" ? { rateBasisPoints: Number(field("rateBasisPoints")) } : { fixedAmount: field("fixedAmount") }),
              ...(field("minimumAmount") ? { minimumAmount: field("minimumAmount") } : {}),
              ...(field("maximumAmount") ? { maximumAmount: field("maximumAmount") } : {}),
            };
          }),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Draft could not be saved.");
      setMessage("Draft saved. Independent approval is still required.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Draft could not be saved."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} aria-label="Edit commission draft" aria-busy={busy} className="space-y-5">
    <h2 className="text-lg font-semibold">Edit draft rules</h2>
    <p>Only the maker can edit this draft. Saving a changed version invalidates stale edits.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><Label htmlFor="draft-basis">Basis</Label><select id="draft-basis" name="basisType" defaultValue={plan.basisType}><option value="ORDER_SUBTOTAL">Order subtotal</option><option value="ORDER_TOTAL">Order total</option></select></div>
      <div><Label htmlFor="draft-calculation-version">Calculation version</Label><Input id="draft-calculation-version" name="calculationVersion" defaultValue={plan.calculationVersion} required maxLength={80} /></div>
      <div><Label htmlFor="draft-effective-from">Effective from (UTC)</Label><Input id="draft-effective-from" name="effectiveFrom" type="datetime-local" defaultValue={plan.effectiveFrom.slice(0, 16)} required /></div>
      <div><Label htmlFor="draft-effective-until">Effective until (UTC, exclusive)</Label><Input id="draft-effective-until" name="effectiveUntil" type="datetime-local" defaultValue={plan.effectiveUntil?.slice(0, 16) ?? ""} /></div>
    </div>
    {rules.map((rule, index) => {
      const id = (field: string) => `rule-${index}-${field}`;
      return <fieldset key={rule.publicReference} className="grid gap-4 rounded border p-4 sm:grid-cols-2">
        <legend>Rule {index + 1}</legend>
        <div><Label htmlFor={id("ruleCode")}>Rule code</Label><Input id={id("ruleCode")} name={id("ruleCode")} defaultValue={rule.ruleCode} required maxLength={64} /></div>
        <div><Label htmlFor={id("beneficiaryType")}>Beneficiary</Label><select id={id("beneficiaryType")} name={id("beneficiaryType")} defaultValue={rule.beneficiaryType}><option value="PLATFORM">Platform</option><option value="PROMOTER">Promoter</option></select></div>
        <div><Label htmlFor={id("calculationMethod")}>Calculation</Label><select id={id("calculationMethod")} name={id("calculationMethod")} value={rule.calculationMethod} onChange={(event) => setRules((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, calculationMethod: event.target.value as Rule["calculationMethod"] } : row))}><option value="PERCENTAGE_BPS">Percentage in basis points</option><option value="FIXED_AMOUNT">Fixed amount in ZAR</option></select></div>
        {rule.calculationMethod === "PERCENTAGE_BPS" ? <div><Label htmlFor={id("rateBasisPoints")}>Rate (basis points)</Label><Input id={id("rateBasisPoints")} name={id("rateBasisPoints")} type="number" min={0} max={10000} step={1} required defaultValue={rule.rateBasisPoints ?? ""} /></div> : <div><Label htmlFor={id("fixedAmount")}>Fixed amount (ZAR)</Label><Input id={id("fixedAmount")} name={id("fixedAmount")} type="number" min={0} step="0.01" required defaultValue={rule.fixedAmount ?? ""} /></div>}
        <div><Label htmlFor={id("minimumAmount")}>Minimum (ZAR, optional)</Label><Input id={id("minimumAmount")} name={id("minimumAmount")} type="number" min={0} step="0.01" defaultValue={rule.minimumAmount ?? ""} /></div>
        <div><Label htmlFor={id("maximumAmount")}>Maximum (ZAR, optional)</Label><Input id={id("maximumAmount")} name={id("maximumAmount")} type="number" min={0} step="0.01" defaultValue={rule.maximumAmount ?? ""} /></div>
        <div><Label htmlFor={id("priority")}>Priority</Label><Input id={id("priority")} name={id("priority")} type="number" min={0} max={10000} step={1} required defaultValue={rule.priority} /></div>
        <label className="flex min-h-11 items-center gap-2"><input name={id("isRequired")} type="checkbox" defaultChecked={rule.isRequired} />Required allocation</label>
      </fieldset>;
    })}
    <Button type="submit" loading={busy}>Save draft</Button>
    {message && <p role="status">{message}</p>}
  </form>;
}
