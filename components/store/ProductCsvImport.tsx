"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

type Row = { rowNumber: number; status: string; normalizedPayload: unknown; errorCodes: unknown; resultingProductId?: string | null };
type Job = { publicReference: string; status: string; validRows: number; invalidRows: number; totalRows: number; rows: Row[] };
export function ProductCsvImport({ types, categories, initialJobs }: { types: { id: string; name: string }[]; categories: { id: string; path: string }[]; initialJobs: Job[] }) {
  const router = useRouter();
  const operation = useRef("");
  const [file, setFile] = useState<File | null>(null);
  const [pastedCsv, setPastedCsv] = useState("");
  const [type, setType] = useState(types[0]?.id ?? "");
  const [category, setCategory] = useState(categories[0]?.id ?? "");
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("");
  function change() { operation.current = ""; setJob(null); setError(""); setStatus(""); }
  async function request(url: string, body: unknown) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Import could not be completed. Retry the same operation.");
    return result.importJob as Job;
  }
  async function preview() {
    if (!file && !pastedCsv.trim()) return;
    setBusy(true); setError(""); setStatus("");
    try {
      if (file && (!file.name.toLowerCase().endsWith(".csv") || file.size < 1 || file.size > 64000)) throw new Error("Choose a nonempty CSV of at most 64 KB.");
      operation.current ||= crypto.randomUUID();
      const csv = pastedCsv || await file!.text();
      const uploaded = await request("/api/store/catalog/imports", { filename: file?.name ?? "pasted-products.csv", mimeType: "text/csv", byteSize: new TextEncoder().encode(csv).length, templateVersion: 1, operationId: operation.current, csv, productTypeDefinitionId: type, primaryCategoryId: category });
      const result = uploaded.status === "COMPLETED" ? uploaded : await request(`/api/store/catalog/imports/${uploaded.publicReference}/validate`, { operationId: `${operation.current}:validate` });
      setJob(result); setStatus(result.invalidRows ? "Correct the listed rows in your CSV and upload it again. No products were created." : result.status === "COMPLETED" ? "This import has already been applied." : "Preview ready. Confirm the rows before creating product drafts."); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Connection unavailable. Retry this file to check its existing import."); }
    finally { setBusy(false); }
  }
  async function apply(target: Job) {
    setBusy(true); setError("");
    try {
      const result = await request(`/api/store/catalog/imports/${target.publicReference}/apply`, { operationId: `${target.publicReference}:apply` });
      setJob(result); setStatus(`${result.totalRows} private product drafts saved. Photos, offers, prices, stock and publication still need to be completed.`); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Import failed. Retry to check its result; do not start another batch."); }
    finally { setBusy(false); }
  }
  function template() {
    const url = URL.createObjectURL(new Blob(['title,shortDescription,description,attributes\r\n"Your product name","Short summary","Full product description","{}"\r\n'], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "kt-product-drafts-v1.csv"; link.click(); URL.revokeObjectURL(url);
  }
  const selected = job ?? null;
  return <section aria-labelledby="product-import-heading" className="space-y-4 rounded-xl border border-[var(--eo-border)] p-5">
    <h2 id="product-import-heading" className="text-xl font-semibold">Import product drafts</h2>
    <p className="text-sm">Up to 100 products and 64 KB per file. All rows use the selected category and product type. Uploading previews the rows; applying saves all drafts together or none.</p>
    <Button type="button" variant="secondary" onClick={template}>Download product CSV template</Button>
    <p className="break-words text-sm">Required column: title. Optional: shortDescription, description, attributes. Attributes must contain a JSON object matching the product type. Put quoted commas and newlines inside double quotes; double any quotes inside a quoted cell.</p>
    <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <legend className="sr-only">Product import settings</legend>
      <div><label htmlFor="import-product-type">Product type</label><Select id="import-product-type" value={type} onChange={event => { change(); setType(event.target.value); }} options={types.map(item => ({ value: item.id, label: item.name }))} /></div>
      <div><label htmlFor="import-category">Category</label><Select id="import-category" value={category} onChange={event => { change(); setCategory(event.target.value); }} options={categories.map(item => ({ value: item.id, label: item.path }))} /></div>
      <div className="min-w-0 sm:col-span-2"><label htmlFor="product-csv-file" className="mb-2 block">Product CSV file</label><input id="product-csv-file" type="file" accept=".csv,text/csv" className="max-w-full text-sm" onChange={event => { change(); setFile(event.target.files?.[0] ?? null); setPastedCsv(""); }} /></div>
      <div className="min-w-0 sm:col-span-2"><label htmlFor="product-csv-contents" className="mb-2 block">Or paste CSV contents</label><textarea id="product-csv-contents" value={pastedCsv} maxLength={64000} rows={5} className="w-full rounded-lg border p-3 font-mono text-sm" onChange={event => { change(); setFile(null); setPastedCsv(event.target.value); }} /><p className="mt-2 text-sm">Pasting uses the same validation, preview and save rules as a CSV file.</p></div>
    </fieldset>
    <Button type="button" disabled={busy || (!file && !pastedCsv.trim()) || !type || !category} onClick={() => void preview()}>{busy ? "Processing import…" : "Upload and preview rows"}</Button>
    <p role="status">{status}</p><p role="alert" className="text-sm text-red-600">{error}</p>
    {selected && <div className="space-y-3"><h3 className="font-semibold">{selected.publicReference} · {selected.status.replaceAll("_", " ")}</h3><p>{selected.validRows} valid · {selected.invalidRows} invalid · {selected.totalRows} total</p><ul aria-label="Product import preview" className="space-y-3">{selected.rows.map(row => { const title = row.normalizedPayload && typeof row.normalizedPayload === "object" && "title" in row.normalizedPayload ? String(row.normalizedPayload.title) : "Product"; return <li key={row.rowNumber} className="break-words rounded-lg border p-3"><strong>Row {row.rowNumber}: {title}</strong><p>{row.status}</p>{Array.isArray(row.errorCodes) && row.errorCodes.length > 0 && <ul>{row.errorCodes.map((issue, i) => <li key={i}>{String(issue)}</li>)}</ul>}{row.resultingProductId && <Link className="underline" href="/store/catalog/products">Review saved product drafts</Link>}</li>; })}</ul>{selected.status === "VALIDATED" && !selected.invalidRows && <Button type="button" disabled={busy} onClick={() => void apply(selected)}>Create {selected.totalRows} unpublished drafts</Button>}</div>}
    {!job && initialJobs.filter(item => ["UPLOADED", "VALIDATED"].includes(item.status)).map(item => <div key={item.publicReference} className="space-y-2 rounded-lg border p-3"><p className="break-all">Saved preview: {item.publicReference}</p><Button type="button" variant="secondary" disabled={busy} onClick={() => { void (async () => { setBusy(true); setError(""); try { const result = item.status === "UPLOADED" ? await request(`/api/store/catalog/imports/${item.publicReference}/validate`, { operationId: `${item.publicReference}:validate` }) : item; setJob(result); setStatus("Review these saved rows before applying."); } catch (failure) { setError(failure instanceof Error ? failure.message : "Preview could not be loaded."); } finally { setBusy(false); } })(); }}>Review saved import</Button></div>)}
  </section>;
}
