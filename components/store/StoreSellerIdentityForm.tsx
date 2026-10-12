"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function StoreSellerIdentityForm({ currentReference }: { currentReference: string | null }) {
  const router = useRouter(), pending = useRef(false), command = useRef<{ signature: string; body: Record<string, unknown> } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current) return; pending.current = true; setBusy(true); setError(""); setStatus("");
    const data = new FormData(event.currentTarget), value = (key: string) => String(data.get(key) ?? "").trim(), optional = (key: string) => value(key) || null;
    try {
      const fields = { expectedIdentityReference: currentReference, identityVersion: value("identityVersion"), legalName: value("legalName"), tradingName: optional("tradingName"), registrationReference: optional("registrationReference"), vatRegistrationStatus: value("vatRegistrationStatus"), vatNumber: optional("vatNumber"), countryCode: "ZA", termsReference: optional("termsReference"), invoiceClassification: value("invoiceClassification"), effectiveFrom: new Date(value("effectiveFrom")).toISOString(), effectiveUntil: value("effectiveUntil") ? new Date(value("effectiveUntil")).toISOString() : null, sourceEvidenceReference: value("sourceEvidenceReference"), confirmSuppliedDetails: data.get("confirmSuppliedDetails") === "on" };
      const signature = JSON.stringify(fields);
      if (command.current?.signature !== signature) command.current = { signature, body: { ...fields, operationId: crypto.randomUUID() } };
      const response = await fetch("/api/store/seller-identity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command.current.body) });
      const reply = await response.json(); if (!response.ok) { setError(reply.error ?? "Seller details could not be submitted."); return; }
      setStatus("Seller identity submitted for independent review."); router.refresh();
    } catch { setError("Submission could not be confirmed. Retry the same details to check this request."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <form onSubmit={submit} aria-label="Seller legal identity submission" className="space-y-4">
    <p>Supply the seller details and supporting evidence for a separate administrator to review. Checkout requires an effective reviewed identity and approved commercial policies.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <label>Identity version<Input name="identityVersion" required maxLength={80} /></label>
      <label>Legal seller name<Input name="legalName" required maxLength={240} /></label>
      <label>Trading name<Input name="tradingName" maxLength={160} /></label>
      <label>Registration reference<Input name="registrationReference" maxLength={160} /></label>
      <label>VAT registration status<select name="vatRegistrationStatus" required defaultValue="" className="min-h-11 w-full rounded border p-2"><option value="" disabled>Select supplied status</option><option value="NOT_REGISTERED">Not registered</option><option value="REGISTERED">Registered</option></select></label>
      <label>VAT reference<Input name="vatNumber" maxLength={160} /></label>
      <label>Receipt classification<select name="invoiceClassification" required defaultValue="" className="min-h-11 w-full rounded border p-2"><option value="" disabled>Select reviewed classification</option><option value="RECEIPT">Receipt</option><option value="TAX_INVOICE">Tax invoice</option></select></label>
      <label>Terms reference<Input name="termsReference" maxLength={160} /></label>
      <label>Effective from<Input name="effectiveFrom" type="datetime-local" required /></label>
      <label>Effective until (optional)<Input name="effectiveUntil" type="datetime-local" /></label>
      <label className="sm:col-span-2">Supplied evidence reference<Input name="sourceEvidenceReference" required minLength={8} maxLength={240} /></label>
    </div>
    <label className="flex items-start gap-2"><input name="confirmSuppliedDetails" type="checkbox" required />I confirm these are the supplied seller details and evidence for review.</label>
    {error ? <p role="alert">{error}</p> : null}<p role="status" aria-live="polite">{status}</p>
    <Button type="submit" disabled={busy}>{busy ? "Submitting seller details…" : "Submit seller identity"}</Button>
  </form>;
}
