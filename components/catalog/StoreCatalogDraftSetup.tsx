"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CatalogMediaUploader, type CatalogMediaDraft } from "./CatalogMediaUploader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export function StoreCatalogDraftSetup({ product, hasPrimary, canCreateOffer }: { product: { id: string; publicReference: string; version: number; variants: { id: string; title: string }[]; nextMediaOrder: number; attachedMediaReferences: string[] }; hasPrimary: boolean; canCreateOffer: boolean }) {
  const router = useRouter();
  const [media, setMedia] = useState<CatalogMediaDraft[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("");
  const offerOperation = useRef(crypto.randomUUID());
  async function post(url: string, data: unknown) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Draft setup failed. Reload to check saved records before retrying."); return body;
  }
  async function photos() {
    setBusy(true); setError(""); setStatus("");
    try {
      if (!media.length || media.some(item => !item.altText.trim())) throw new Error("Choose at least one image and enter its alt text.");
      if (!hasPrimary && media.filter(item => item.primary).length !== 1) throw new Error("Choose exactly one primary product image.");
      let version = product.version;
      const ordered = [...media].sort((a, b) => Number(b.primary) - Number(a.primary));
      for (const [index, item] of ordered.entries()) {
        const result = await post(`/api/store/catalog/products/${product.publicReference}/media`, { operationId: crypto.randomUUID(), productVersion: version, assetPublicReference: item.assetPublicReference, role: !hasPrimary && item.primary ? "PRIMARY" : "GALLERY", altText: item.altText, displayOrder: product.nextMediaOrder + index });
        version = result.productVersion;
      }
      setStatus("Product photos saved. Review the current product before submitting."); setMedia([]); router.refresh();
    } catch (failure) { setError(`${failure instanceof Error ? failure.message : "Photos could not be saved."} Reload to check any images already saved.`); router.refresh(); }
    finally { setBusy(false); }
  }
  async function offer(form: HTMLFormElement) {
    setBusy(true); setError("");
    try {
      const data = new FormData(form);
      const result = await post("/api/store/catalog/offers", { productId: product.id, variantId: String(data.get("variantId")), storeSku: String(data.get("storeSku")), inventoryTrackingMode: "TRACKED", fulfilmentMode: "COURIER_DELIVERY", sellingUnit: "EACH", quantityStep: "1", minimumQuantity: "1", operationId: offerOperation.current });
      router.push(`/store/catalog/offers/${result.offer.publicReference}`); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Offer could not be created. Check the product's offers before retrying."); router.refresh(); }
    finally { setBusy(false); }
  }
  return <section aria-label="Complete product draft" className="space-y-6">
    <div className="space-y-3"><h3 className="font-semibold">Product photos</h3><p className="text-sm">Upload or select product images, enter alt text, then save them to this draft. Existing photos stay attached.</p><p className="text-sm" role="status">{product.attachedMediaReferences.length} saved product {product.attachedMediaReferences.length === 1 ? "photo" : "photos"} attached.</p><fieldset disabled={busy}><legend className="sr-only">Product photo selection</legend><CatalogMediaUploader value={media} onChange={setMedia} excludedReferences={product.attachedMediaReferences} productOnly /></fieldset><Button type="button" disabled={busy || !media.length} onClick={() => void photos()}>Save product photos</Button></div>
    {canCreateOffer && <form onSubmit={event => { event.preventDefault(); void offer(event.currentTarget); }} className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">Create a store offer</h3><p className="text-sm">Choose a variant and unique SKU. The next screen lets you enter the draft price. Add stock and package details before submitting the listing.</p><label htmlFor="draft-offer-variant">Product variant</label><Select id="draft-offer-variant" name="variantId" options={product.variants.map(variant => ({ value: variant.id, label: variant.title }))} disabled={busy} /><label htmlFor="draft-offer-sku">Store offer SKU</label><Input id="draft-offer-sku" name="storeSku" required maxLength={100} disabled={busy} /><Button type="submit" disabled={busy}>Create offer and add price</Button></form>}
    <p role="status">{status}</p><p role="alert" className="text-sm text-red-600">{error}</p>
  </section>;
}
