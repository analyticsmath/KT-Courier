"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CatalogPackagingFields, EMPTY_PACKAGING, packagingInput, type PackageLimit } from "./CatalogPackagingFields";
import type { PackagingDeclaration } from "@/lib/services/catalog-packaging.service";
import { CatalogPackagingSchema } from "@/lib/validation/catalog-packaging";
export function StorePackagingManager({ offers, initial = [], limits = [] }: { offers: { publicReference: string; storeSku: string }[]; initial?: PackagingDeclaration[]; limits?: PackageLimit[] }) {
  const [offer, setOffer] = useState(offers[0]?.publicReference ?? "");
  function fields(reference: string) { const declaration = initial.find(item => item.offerReference === reference); return declaration ? { lengthCm: String(declaration.lengthCm), widthCm: String(declaration.widthCm), heightCm: String(declaration.heightCm), weightKg: String(declaration.weightKg), description: declaration.description } : EMPTY_PACKAGING; }
  const [value, setValue] = useState(() => fields(offers[0]?.publicReference ?? "")); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault(); const parsed = CatalogPackagingSchema.safeParse(packagingInput(value));
    if (!parsed.success) { setMessage("Enter positive packaged dimensions and weight, and a packing description of at least 10 characters."); return; }
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/store/catalog/packaging", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerReference: offer, packaging: parsed.data }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Package could not be submitted."); setMessage("Package measurements submitted for admin review. Delivery checkout requires approved packaging for the published offer. Updating measurements requires a new review."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Package could not be submitted."); } finally { setBusy(false); }
  }
  return <form onSubmit={save} className="space-y-4"><label htmlFor="packaging-offer" className="block font-medium">Product offer</label><select id="packaging-offer" className="w-full rounded border p-3" value={offer} onChange={event => { setOffer(event.target.value); setValue(fields(event.target.value)); setMessage(""); }}>{offers.map(item => <option key={item.publicReference} value={item.publicReference}>{item.storeSku}</option>)}</select><CatalogPackagingFields limits={limits} value={value} onChange={setValue} /><Button type="submit" disabled={busy || !offer}>{busy ? "Submitting package…" : "Submit package for review"}</Button><p role="status" aria-live="polite">{message}</p></form>;
}
