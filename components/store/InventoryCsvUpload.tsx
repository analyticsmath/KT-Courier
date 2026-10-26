"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { INVENTORY_UPLOAD_HEADER, parseInventoryUpload } from "@/lib/catalog/inventory-upload-policy";
type TemplateRow = { inventoryReference: string; locationReference: string; version: number; label?: string; locationName?: string };
type PreviewRow = TemplateRow & { quantity: number; onHand: number; resultingOnHand: number };
export function InventoryCsvUpload({ template }: { template: TemplateRow[] }) {
  const router = useRouter();
  const operation = useRef("");
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [selected, setSelected] = useState("");
  const [quantity, setQuantity] = useState("");
  const pending = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  function editReceipt() { setCsv(""); setPreview(null); setError(""); setStatus(""); }
  function load(text: string) {
    parseInventoryUpload(text);
    if (text !== csv) operation.current = crypto.randomUUID();
    setCsv(text); setPreview(null); setError(""); setStatus("Receipt loaded. Review the stock changes before applying.");
  }
  function singleReceipt() {
    const row = template.find(item => item.inventoryReference === selected);
    if (!row) return;
    try { load(`${INVENTORY_UPLOAD_HEADER}\n${row.inventoryReference},${row.locationReference},${row.version},${quantity}`); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Enter a positive whole-unit quantity."); }
  }
  function download() {
    const content = [INVENTORY_UPLOAD_HEADER, ...template.slice(0, 100).map(row => `${row.inventoryReference},${row.locationReference},${row.version},`)].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "inventory-stock-receipts.csv"; link.click(); URL.revokeObjectURL(url);
  }
  async function choose(file?: File) {
    setError(""); setStatus("");
    if (!file) return;
    setBusy(true);
    try {
      if (!file.name.toLowerCase().endsWith(".csv") || file.size > 64_000) throw Error("Choose a CSV file of at most 64 KB.");
      const text = await file.text(); load(text);
    } catch (failure) { setCsv(""); setPreview(null); setError(failure instanceof Error ? failure.message : "File could not be read."); }
    finally { setBusy(false); }
  }
  async function submit(dryRun: boolean) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(""); setStatus("");
    let receivedResponse = false;
    try {
      const response = await fetch("/api/store/catalog/inventory/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv, operationId: operation.current, dryRun }) });
      const result = await response.json();
      receivedResponse = true;
      if (!response.ok) { if (response.status === 409) { setCsv(""); router.refresh(); } throw Error(result.error ?? "Stock receipt could not be completed."); }
      if (result.dryRun) { setPreview(result.preview); setStatus("Stock changes reviewed. Confirm the received quantities before applying."); }
      else { setUncertain(false); setCsv(""); setQuantity(""); setPreview(null); setStatus(`Stock receipt recorded for ${result.movements.length} items.`); router.refresh(); }
    } catch (failure) {
      if (!dryRun && !receivedResponse) { setUncertain(true); setError("The connection ended before the stock receipt was confirmed. Keep this page open and retry this receipt; the same request will not add stock twice."); }
      else { setUncertain(false); setPreview(null); setError(failure instanceof Error ? failure.message : "Connection unavailable. Review these stock changes again."); }
    }
    finally { pending.current = false; setBusy(false); }
  }
  return <section aria-labelledby="inventory-upload-heading" className="space-y-4 rounded-xl border p-5">
    <h2 id="inventory-upload-heading" className="text-xl font-semibold">Upload stock receipts</h2>
    <p className="text-sm">Download the template, enter the positive whole-unit quantities physically received, and review the CSV. Up to 100 items per file. Existing reservations remain protected.</p>
    {template.length > 0 && <fieldset disabled={busy || uncertain} className="space-y-3 rounded-lg border p-4"><legend className="px-1 font-semibold">Record one stock receipt</legend><p className="text-sm">Choose a product and its stock location, then enter the units received. Review the totals before saving.</p><label htmlFor="receipt-product">Product and stock location</label><Select id="receipt-product" value={selected} onChange={event => { editReceipt(); setSelected(event.target.value); }} placeholder="Choose a product" options={template.map(row => ({ value: row.inventoryReference, label: `${row.label ?? row.inventoryReference} · ${row.locationName ?? row.locationReference}` }))} /><label htmlFor="receipt-quantity">Units received</label><Input id="receipt-quantity" type="number" min="1" max="2147483647" step="1" value={quantity} onChange={event => { editReceipt(); setQuantity(event.target.value); }} /><Button type="button" disabled={!selected || !quantity} onClick={singleReceipt}>Prepare stock receipt</Button></fieldset>}
    <Button type="button" variant="secondary" disabled={busy || !template.length} onClick={download}>Download stock receipt template</Button>
    {!template.length && <p className="text-sm">Create tracked inventory and an active stock location before uploading receipts.</p>}
    <div><label htmlFor="inventory-csv" className="mb-2 block font-medium">Inventory CSV file</label><input id="inventory-csv" type="file" accept=".csv,text/csv" disabled={busy || uncertain} onChange={event => void choose(event.target.files?.[0])} aria-describedby="inventory-upload-error" className="max-w-full text-sm file:mr-3 file:rounded-lg file:border file:px-3 file:py-2" /></div>
    <div className="flex flex-wrap gap-3"><Button type="button" disabled={busy || !csv || uncertain} onClick={() => void submit(true)}>{busy ? "Checking stock…" : "Review stock changes"}</Button>{preview && <Button type="button" disabled={busy} onClick={() => void submit(false)}>{uncertain ? "Retry unconfirmed stock receipt" : "Apply received stock"}</Button>}</div>
    {preview && <ul aria-label="Reviewed stock changes" className="space-y-2 text-sm">{preview.map(row => { const item = template.find(item => item.inventoryReference === row.inventoryReference); return <li key={row.inventoryReference} className="break-words">{item?.label ?? row.inventoryReference} · {item?.locationReference === row.locationReference ? item.locationName ?? row.locationReference : row.locationReference}: {row.onHand} + {row.quantity} = {row.resultingOnHand} units</li>; })}</ul>}
    <p role="status">{status}</p><p id="inventory-upload-error" role="alert" className="text-sm text-red-600">{error}</p>
  </section>;
}
