"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export type CatalogVariantDraft = {
  title: string; options: { code: string; value: string }[]; attributeValues: Record<string, unknown>;
  storeSku: string; price: string; openingStock: string; inventoryLocationPublicReference: string;
};

export function readCatalogVariantDrafts(raw: string): CatalogVariantDraft[] | null {
  if (raw.trim() === "Default") return [];
  try {
    const rows: unknown = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length > 50 || rows.some(row => !row || typeof row !== "object" || Array.isArray(row))) return null;
    return rows.map(row => ({
      title: typeof row.title === "string" ? row.title : "",
      options: Array.isArray(row.options) ? row.options.map((option: { code?: unknown; value?: unknown }) => ({ code: typeof option?.code === "string" ? option.code : "", value: typeof option?.value === "string" ? option.value : "" })) : [],
      attributeValues: row.attributeValues && typeof row.attributeValues === "object" && !Array.isArray(row.attributeValues) ? row.attributeValues : {},
      storeSku: typeof row.storeSku === "string" ? row.storeSku : "",
      price: typeof row.price === "string" ? row.price : typeof row.price?.amount === "string" ? row.price.amount : "",
      openingStock: typeof row.openingStock === "string" || typeof row.openingStock === "number" ? String(row.openingStock) : "",
      inventoryLocationPublicReference: typeof row.inventoryLocationPublicReference === "string" ? row.inventoryLocationPublicReference : "",
    }));
  } catch { return null; }
}

const blankVariant = (codes = ["colour"]): CatalogVariantDraft => ({ title: "", options: codes.map(code => ({ code, value: "" })), attributeValues: {}, storeSku: "", price: "", openingStock: "", inventoryLocationPublicReference: "" });

export function CatalogVariantFields({ raw, onChange, mode, locations = [] }: {
  raw: string; onChange: (value: string) => void; mode: "options" | "commerce";
  locations?: { publicReference: string; name: string }[];
}) {
  const custom = raw.trim() !== "Default";
  const rows = readCatalogVariantDrafts(raw);
  const save = (next: CatalogVariantDraft[]) => onChange(JSON.stringify(next));
  const update = (index: number, patch: Partial<CatalogVariantDraft>) => save((rows ?? []).map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  return <section className="space-y-4" aria-label={mode === "options" ? "Product option variants" : "Variant prices and stock"}>
    {mode === "options" ? <><label className="flex min-h-11 items-center gap-3 font-bold"><input type="checkbox" checked={custom} onChange={event => onChange(event.target.checked ? JSON.stringify([blankVariant()]) : "Default")} />Sell sizes, colours or other product options</label><p className="text-sm text-[var(--kt-text-muted)]">Each listed choice gets its own SKU, price and stock count. Product photos and modifier groups are shared.</p></> : null}
    {custom ? <>
      {rows === null ? <p role="alert">The saved option list could not be read. Add a variant to start a new list.</p> : null}
      {(rows ?? []).map((row, index) => <fieldset key={index} className="space-y-4 rounded-xl border border-[var(--kt-soft-border)] p-4">
        <legend className="px-2 font-bold">{row.title || `Variant ${index + 1}`}</legend>
        {mode === "options" ? <>
          <div><label className="text-sm font-bold" htmlFor={`variant-${index}-title`}>Variant name</label><Input id={`variant-${index}-title`} value={row.title} maxLength={180} onChange={event => update(index, { title: event.target.value })} placeholder="Blue, Small" /></div>
          {row.options.map((option, optionIndex) => <div key={optionIndex} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div><label className="text-sm font-bold" htmlFor={`variant-${index}-option-${optionIndex}-name`}>Option name</label><Input id={`variant-${index}-option-${optionIndex}-name`} value={option.code} maxLength={64} onChange={event => update(index, { options: row.options.map((item, itemIndex) => itemIndex === optionIndex ? { ...item, code: event.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") } : item) })} placeholder="colour" /></div>
            <div><label className="text-sm font-bold" htmlFor={`variant-${index}-option-${optionIndex}-value`}>Option value</label><Input id={`variant-${index}-option-${optionIndex}-value`} value={option.value} maxLength={100} onChange={event => update(index, { options: row.options.map((item, itemIndex) => itemIndex === optionIndex ? { ...item, value: event.target.value } : item) })} placeholder="Blue" /></div>
            <Button type="button" variant="ghost" disabled={row.options.length <= 1} onClick={() => update(index, { options: row.options.filter((_, itemIndex) => itemIndex !== optionIndex) })} aria-label={`Remove option ${optionIndex + 1} from variant ${index + 1}`}>Remove option</Button>
          </div>)}
          <div className="flex flex-wrap gap-3"><Button type="button" variant="secondary" disabled={row.options.length >= 20} onClick={() => update(index, { options: [...row.options, { code: "", value: "" }] })}>Add option to variant {index + 1}</Button><Button type="button" variant="ghost" onClick={() => save((rows ?? []).filter((_, rowIndex) => rowIndex !== index))}>Remove variant {index + 1}</Button></div>
        </> : <>
          <p className="text-sm">{row.options.map(option => `${option.code}: ${option.value}`).join(" · ")}</p>
          <div className="grid gap-4 md:grid-cols-3">
            <div><label className="text-sm font-bold" htmlFor={`variant-${index}-sku`}>Variant SKU</label><Input id={`variant-${index}-sku`} value={row.storeSku} maxLength={100} onChange={event => update(index, { storeSku: event.target.value })} /></div>
            <div><label className="text-sm font-bold" htmlFor={`variant-${index}-price`}>Variant price including VAT (ZAR)</label><Input id={`variant-${index}-price`} inputMode="decimal" value={row.price} onChange={event => update(index, { price: event.target.value })} placeholder="19.25" /></div>
            <div><label className="text-sm font-bold" htmlFor={`variant-${index}-stock`}>Variant opening stock</label><Input id={`variant-${index}-stock`} inputMode="numeric" value={row.openingStock} onChange={event => update(index, { openingStock: event.target.value })} placeholder="0" /></div>
          </div>
          <div><label className="text-sm font-bold" htmlFor={`variant-${index}-location`}>Variant stock location</label><select id={`variant-${index}-location`} className="min-h-11 w-full rounded-lg border p-2" value={row.inventoryLocationPublicReference} onChange={event => update(index, { inventoryLocationPublicReference: event.target.value })}><option value="">Use shared stock location below</option>{locations.map(location => <option key={location.publicReference} value={location.publicReference}>{location.name}</option>)}</select></div>
        </>}
      </fieldset>)}
      {mode === "options" ? <><Button type="button" variant="secondary" disabled={(rows?.length ?? 0) >= 50} onClick={() => save([...(rows ?? []), blankVariant(rows?.[0]?.options.map(option => option.code))])}>Add product variant</Button><p className="text-sm text-[var(--kt-text-muted)]">Use the same option names for every variant. Set each SKU, price and opening stock in Offer &amp; stock.</p></> : null}
    </> : null}
  </section>;
}
