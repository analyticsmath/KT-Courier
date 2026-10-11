"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";

type Product = { publicReference: string; version: number; title: string; description: string | null };
export function StoreCatalogProductActions({ product, canManage, canSubmit }: { product: Product; canManage: boolean; canSubmit: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description ?? "");
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const operation = useRef<{ facts: string; id: string } | null>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const changed = title.trim() !== product.title || (description.trim() || null) !== product.description;

  function reportError(text: string) { setError(text); errorSummary.current?.focus(); }
  async function command(action: "save" | "submit") {
    if (inFlight.current || (action === "save" && !canManage) || (action === "submit" && (!canSubmit || changed))) return;
    const data = action === "save" ? { version: product.version, title: title.trim(), description: description.trim() || null } : { version: product.version };
    if (action === "save" && (title.trim().length < 3 || title.trim().length > 180 || /<\/?[a-z][^>]*>/i.test(title + description))) { reportError("Use a product title of 3–180 characters and plain text without HTML."); return; }
    const facts = JSON.stringify([product.publicReference, action, data]);
    if (operation.current?.facts !== facts) operation.current = { facts, id: crypto.randomUUID() };
    inFlight.current = true; setBusy(action); setError(""); setMessage(action === "save" ? "Saving product changes…" : "Submitting the product for review…");
    try {
      const response = await fetch(`/api/store/catalog/products/${product.publicReference}${action === "submit" ? "/submit" : ""}`, {
        method: action === "save" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, operationId: operation.current.id }),
      });
      const body = await response.json().catch(() => null) as { error?: string; product?: { publicReference?: string; version?: number; status?: string } } | null;
      if (!response.ok) { reportError(body?.error ?? (response.status === 403 ? "Your product access is unavailable. Contact the business owner." : "The product could not be updated. Refresh the record and review it before retrying.")); setMessage(""); return; }
      if (!body?.product || body.product.publicReference !== product.publicReference || !Number.isSafeInteger(body.product.version) || typeof body.product.status !== "string") throw new Error("Unconfirmed product response");
      setMessage(`Product confirmed as ${body.product.status.toLowerCase().replaceAll("_", " ")}.`);
      router.refresh();
    } catch {
      reportError("The product result could not be confirmed. Keep the same values and retry to recover the original operation."); setMessage("");
    } finally { inFlight.current = false; setBusy(null); }
  }

  return <div className="space-y-5" aria-busy={busy !== null}>
    <div ref={errorSummary} id="catalog-product-action-errors" tabIndex={-1} className="scroll-mt-24">
      {error ? <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">{error}</p> : null}
    </div>
    {canManage ? <form className="space-y-4" onSubmit={event => { event.preventDefault(); void command("save"); }}>
      <div><Label htmlFor="product-edit-title">Product title</Label><Input id="product-edit-title" required minLength={3} maxLength={180} disabled={busy !== null} value={title} onChange={event => { setTitle(event.target.value); setError(""); setMessage(""); }} /></div>
      <div><Label htmlFor="product-edit-description">Description</Label><Textarea id="product-edit-description" maxLength={10_000} disabled={busy !== null} value={description} onChange={event => { setDescription(event.target.value); setError(""); setMessage(""); }} /></div>
      <Button type="submit" loading={busy === "save"} disabled={busy !== null}>Save product changes</Button>
    </form> : null}
    {canSubmit ? <div className="space-y-3">
      <p id="product-submit-help" className="text-sm text-[var(--eo-text-secondary)]">{changed ? "Save your product changes before submitting for review." : "Submit this saved product and its attached images for catalog review."}</p>
      <Button type="button" variant="secondary" loading={busy === "submit"} disabled={busy !== null || changed} aria-describedby="product-submit-help" onClick={() => void command("submit")}>Submit product for review</Button>
    </div> : null}
    <p role="status">{message}</p>
  </div>;
}
