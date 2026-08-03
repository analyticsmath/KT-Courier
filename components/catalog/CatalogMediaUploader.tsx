"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export type CatalogMediaDraft = {
  assetPublicReference: string;
  status: "READY";
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  altText: string;
  primary: boolean;
  variantAssociation: "PRODUCT" | "DEFAULT";
};

type SafeAsset = { publicReference: string; status: string; purpose: "PRODUCT_IMAGE" | "VARIANT_IMAGE"; mimeType: string | null; byteSize: number | null; width: number | null; height: number | null };

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function CatalogMediaUploader({ value, onChange }: { value: CatalogMediaDraft[]; onChange: (value: CatalogMediaDraft[]) => void }) {
  const [available, setAvailable] = useState<SafeAsset[]>([]);
  const [phase, setPhase] = useState<"IDLE" | "CREATING_INTENT" | "UPLOADING" | "VALIDATING">("IDLE");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<"PRODUCT_IMAGE" | "VARIANT_IMAGE">("PRODUCT_IMAGE");
  const retryFile = useRef<File | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/store/catalog/media", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const body = await response.json() as { assets?: SafeAsset[] };
      if (active) setAvailable((body.assets ?? []).filter((asset) => asset.status === "READY"));
    });
    return () => { active = false; };
  }, []);

  async function upload(file: File) {
    retryFile.current = file;
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) { setError("Choose a JPEG, PNG or WebP image. SVG, GIF, HTML and documents are prohibited."); return; }
    if (file.size < 1 || file.size > MAX_BYTES) { setError("The image must be no larger than 8 MiB."); return; }
    try {
      setPhase("CREATING_INTENT"); setProgress(10);
      const intentResponse = await fetch("/api/store/catalog/media/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose, declaredMimeType: file.type, declaredByteSize: file.size, operationId: crypto.randomUUID() }) });
      const intentBody = await intentResponse.json() as { upload?: { publicReference: string; target: { uploadPath: string } }; error?: string; code?: string };
      if (!intentResponse.ok || !intentBody.upload) throw new Error(intentBody.code === "CONSOLIDATED_VALIDATION_NOT_APPROVED" ? "Catalog media uploads remain locked pending Phase 26.5 validation." : intentBody.error ?? "Upload intent could not be created.");
      setPhase("UPLOADING"); setProgress(35);
      const bytesResponse = await fetch(intentBody.upload.target.uploadPath, { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-Catalog-Operation-Id": crypto.randomUUID() }, body: file });
      const bytesBody = await bytesResponse.json() as { error?: string };
      if (!bytesResponse.ok) throw new Error(bytesBody.error ?? "Image bytes were rejected.");
      setPhase("VALIDATING"); setProgress(75);
      const completeResponse = await fetch(`/api/store/catalog/media/uploads/${encodeURIComponent(intentBody.upload.publicReference)}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operationId: crypto.randomUUID() }) });
      const completeBody = await completeResponse.json() as { asset?: SafeAsset; error?: string };
      if (!completeResponse.ok || completeBody.asset?.status !== "READY" || !completeBody.asset.mimeType || !completeBody.asset.byteSize || !completeBody.asset.width || !completeBody.asset.height) throw new Error(completeBody.error ?? "Image did not reach READY validation state.");
      addReadyAsset(completeBody.asset);
      setAvailable((current) => [completeBody.asset as SafeAsset, ...current.filter((item) => item.publicReference !== completeBody.asset?.publicReference)]);
      retryFile.current = null; setProgress(100);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed safely.");
    } finally {
      setPhase("IDLE");
    }
  }

  function addReadyAsset(asset: SafeAsset) {
    if (value.some((item) => item.assetPublicReference === asset.publicReference) || asset.status !== "READY" || !asset.mimeType || !asset.byteSize || !asset.width || !asset.height) return;
    onChange([...value, { assetPublicReference: asset.publicReference, status: "READY", mimeType: asset.mimeType, byteSize: asset.byteSize, width: asset.width, height: asset.height, altText: "", primary: asset.purpose === "PRODUCT_IMAGE" && value.every((item) => !item.primary), variantAssociation: asset.purpose === "VARIANT_IMAGE" ? "DEFAULT" : "PRODUCT" }]);
  }

  function update(index: number, patch: Partial<CatalogMediaDraft>) {
    onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : patch.primary ? { ...item, primary: false } : item));
  }

  function move(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= value.length) return;
    const next = [...value]; const current = next[index]; const other = next[destination];
    if (!current || !other) return;
    next[index] = other; next[destination] = current; onChange(next);
  }

  return <div className="space-y-5">
    <div className="rounded-xl border border-dashed border-[var(--kt-soft-border)] p-4">
      <label htmlFor="catalog-media-file" className="block text-sm font-extrabold">Upload product image</label>
      <label htmlFor="catalog-media-purpose" className="mt-3 block text-sm font-bold">Image purpose</label><Select id="catalog-media-purpose" value={purpose} onChange={(event) => setPurpose(event.target.value as "PRODUCT_IMAGE" | "VARIANT_IMAGE")} options={[{ value: "PRODUCT_IMAGE", label: "Product gallery image" }, { value: "VARIANT_IMAGE", label: "Variant or swatch image" }]} />
      <input id="catalog-media-file" type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block min-h-11 w-full text-sm" disabled={phase !== "IDLE"} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} />
      <p className="mt-2 text-xs text-[var(--kt-text-muted)]">JPEG, PNG or WebP; 8 MiB maximum; 300 × 300 minimum. The server verifies bytes, dimensions, privacy metadata and checksum.</p>
      {phase !== "IDLE" ? <div className="mt-3" role="status" aria-live="polite"><p className="text-sm font-bold">{phase === "CREATING_INTENT" ? "Creating secure upload…" : phase === "UPLOADING" ? "Uploading bytes…" : "Validating image…"}</p><progress className="mt-2 w-full" max={100} value={progress}>{progress}%</progress></div> : null}
      {error ? <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm" role="alert"><p>{error}</p>{retryFile.current && phase === "IDLE" ? <Button type="button" variant="secondary" className="mt-2" onClick={() => { const file = retryFile.current; if (file) void upload(file); }}>Retry selected file</Button> : null}</div> : null}
    </div>

    {available.some((asset) => !value.some((item) => item.assetPublicReference === asset.publicReference)) ? <div><h3 className="text-sm font-black">READY media already owned by this store</h3><div className="mt-2 flex flex-wrap gap-2">{available.filter((asset) => !value.some((item) => item.assetPublicReference === asset.publicReference)).map((asset) => <Button key={asset.publicReference} type="button" variant="secondary" onClick={() => addReadyAsset(asset)}>Select {asset.publicReference}</Button>)}</div></div> : null}

    <div aria-live="polite"><h3 className="text-sm font-black">Draft associations</h3>{value.length === 0 ? <p className="mt-2 text-sm text-[var(--kt-text-muted)]">No READY image is attached to this draft.</p> : <ol className="mt-3 space-y-4">{value.map((item, index) => <li key={item.assetPublicReference} className="rounded-xl border border-[var(--kt-soft-border)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold">{item.assetPublicReference}</p><p className="mt-1 text-xs text-[var(--kt-text-muted)]">{item.mimeType} · {item.width} × {item.height} · {Math.ceil(item.byteSize / 1024)} KiB · READY</p></div><Button type="button" variant="ghost" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>Remove from draft</Button></div><div className="mt-4 grid gap-3 md:grid-cols-2"><div><label htmlFor={`catalog-media-alt-${index}`} className="text-sm font-bold">Alt text</label><Input id={`catalog-media-alt-${index}`} value={item.altText} maxLength={240} onChange={(event) => update(index, { altText: event.target.value })} /></div><div><label htmlFor={`catalog-media-association-${index}`} className="text-sm font-bold">Association</label><Select id={`catalog-media-association-${index}`} value={item.variantAssociation} onChange={(event) => update(index, { variantAssociation: event.target.value as "PRODUCT" | "DEFAULT" })} options={[{ value: "PRODUCT", label: "Product gallery" }, { value: "DEFAULT", label: "Default variant" }]} /></div></div><div className="mt-3 flex flex-wrap items-center gap-2"><label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name="catalog-primary-image" checked={item.primary} disabled={item.variantAssociation === "DEFAULT"} onChange={() => update(index, { primary: true, variantAssociation: "PRODUCT" })} /> Primary image</label><Button type="button" variant="secondary" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${item.assetPublicReference} earlier`}>Move earlier</Button><Button type="button" variant="secondary" disabled={index === value.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${item.assetPublicReference} later`}>Move later</Button></div></li>)}</ol>}</div>
  </div>;
}
