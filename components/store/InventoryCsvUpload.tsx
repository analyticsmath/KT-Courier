"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { INVENTORY_UPLOAD_HEADER, parseInventoryUpload } from "@/lib/catalog/inventory-upload-policy";
type TemplateRow = { inventoryReference: string; locationReference: string; version: number };
type PreviewRow = TemplateRow & { quantity: number; onHand: number; resultingOnHand: number };
export function InventoryCsvUpload({ template }: { template: TemplateRow[] }) {
  const router = useRouter();
  const operation = useRef("");
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  function download() {
    const content = [INVENTORY_UPLOAD_HEADER, ...template.slice(0, 100).map(row => `${row.inventoryReference},${row.locationReference},${row.version},`)].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "inventory-stock-receipts.csv"; link.click(); URL.revokeObjectURL(url);
  }
  async function choose(file?: File) {
    setPreview(null); setCsv(""); setError(""); setStatus(""); operation.current = crypto.randomUUID();
    if (!file) return;
    setBusy(true);
    try {
      if (!file.name.toLowerCase().endsWith(".csv") || file.size > 64_000) throw Error("Choose a CSV file of at most 64 KB.");
      const text = await file.text(); parseInventoryUpload(text); setCsv(text); setStatus("File loaded. Review the stock changes before applying.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "File could not be read."); }
    finally { setBusy(false); }
  }
  async function submit(dryRun: boolean) {
    setBusy(true); setError(""); setStatus("");
    try {
      const response = await fetch("/api/store/catalog/inventory/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv, operationId: operation.current, dryRun }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error ?? "Stock receipt could not be completed.");
      if (result.dryRun) { setPreview(result.preview); setStatus("Stock changes reviewed. Confirm the received quantities before applying."); }
      else { setCsv(""); setPreview(null); setStatus(`Stock receipt recorded for ${result.movements.length} items.`); router.refresh(); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Connection unavailable. Retry the same file to check its receipt."); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="inventory-upload-heading" className="space-y-4 rounded-xl border p-5">
    <h2 id="inventory-upload-heading" className="text-xl font-semibold">Upload stock receipts</h2>
    <p className="text-sm">Download the template, enter the positive whole-unit quantities physically received, and review the CSV. Up to 100 items per file. Existing reservations remain protected.</p>
    <Button type="button" variant="secondary" disabled={busy || !template.length} onClick={download}>Download stock receipt template</Button>
    {!template.length && <p className="text-sm">Create tracked inventory and an active stock location before uploading receipts.</p>}
    <div><label htmlFor="inventory-csv" className="mb-2 block font-medium">Inventory CSV file</label><input id="inventory-csv" type="file" accept=".csv,text/csv" disabled={busy} onChange={event => void choose(event.target.files?.[0])} aria-describedby="inventory-upload-error" className="max-w-full text-sm file:mr-3 file:rounded-lg file:border file:px-3 file:py-2" /></div>
    <div className="flex flex-wrap gap-3"><Button type="button" disabled={busy || !csv} onClick={() => void submit(true)}>{busy ? "Checking stock…" : "Review stock changes"}</Button>{preview && <Button type="button" disabled={busy} onClick={() => void submit(false)}>Apply received stock</Button>}</div>
    {preview && <ul aria-label="Reviewed stock changes" className="space-y-2 text-sm">{preview.map(row => <li key={row.inventoryReference} className="break-all">{row.inventoryReference}: {row.onHand} + {row.quantity} = {row.resultingOnHand} units</li>)}</ul>}
    <p role="status">{status}</p><p id="inventory-upload-error" role="alert" className="text-sm text-red-600">{error}</p>
  </section>;
}
