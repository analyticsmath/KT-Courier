"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CatalogListingDraftSchema } from "@/lib/validation/catalog-listing-draft";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { CatalogMediaUploader, type CatalogMediaDraft } from "@/components/catalog/CatalogMediaUploader";

type ProductTypeChoice = { id: string; name: string; code: string; versionNumber: number; attributeSchema: unknown };
type CategoryChoice = { id: string; name: string; path: string };
type Draft = {
  existingSearch: string;
  productTypeDefinitionId: string;
  primaryCategoryId: string;
  title: string;
  description: string;
  attributes: string;
  variants: string;
  media: CatalogMediaDraft[];
  compliance: string;
  storeSku: string;
  price: string;
  stock: string;
  inventoryLocation: string;
  modifiers: string;
};

const EMPTY: Draft = { existingSearch: "", productTypeDefinitionId: "", primaryCategoryId: "", title: "", description: "", attributes: "{}", variants: "Default", media: [], compliance: "{}", storeSku: "", price: "", stock: "0", inventoryLocation: "", modifiers: "" };
const STEPS = ["Find existing product", "Type and category", "Core information", "Attributes", "Variants", "Media", "Compliance", "Store offer", "Price", "Inventory", "Modifiers", "Preview", "Submit"];
const DRAFT_STORAGE_PREFIX = "kt_store_catalog_wizard_draft:v2:";
const DRAFT_STORAGE_EVENT = "kt-store-catalog-wizard-draft-change";
const PERSISTED_DRAFT_KEYS = ["existingSearch", "productTypeDefinitionId", "primaryCategoryId", "title", "description", "attributes", "variants", "compliance", "storeSku", "price", "stock", "modifiers"] as const;

type PersistedDraft = Omit<Draft, "media" | "inventoryLocation"> & { inventoryLocation?: string };

type DraftCache = { inMemoryDraft: Draft | null; lastStoredDraft: string | null | undefined; lastSnapshot: Draft };
const draftCaches = new Map<string, DraftCache>();

function draftCache(draftKey: string): DraftCache {
  let cache = draftCaches.get(draftKey);
  if (!cache) {
    cache = { inMemoryDraft: null, lastStoredDraft: undefined, lastSnapshot: EMPTY };
    draftCaches.set(draftKey, cache);
  }
  return cache;
}

function isPersistedDraft(value: unknown): value is PersistedDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return PERSISTED_DRAFT_KEYS.every((key) => typeof record[key] === "string") && (record.inventoryLocation === undefined || typeof record.inventoryLocation === "string");
}

function readStoredDraft(draftKey: string): Draft {
  if (typeof window === "undefined") return EMPTY;
  const cache = draftCache(draftKey);
  if (cache.inMemoryDraft) return cache.inMemoryDraft;

  try {
    const stored = window.localStorage.getItem(draftKey);
    if (stored === cache.lastStoredDraft) return cache.lastSnapshot;
    cache.lastStoredDraft = stored;
    if (!stored) return cache.lastSnapshot = EMPTY;
    const parsed: unknown = JSON.parse(stored);
    return cache.lastSnapshot = isPersistedDraft(parsed) ? { ...EMPTY, ...parsed, media: [] } : EMPTY;
  } catch {
    return cache.lastSnapshot = EMPTY;
  }
}

function subscribeToDraft(draftKey: string, callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea === window.localStorage && (event.key === draftKey || event.key === null)) {
      draftCache(draftKey).inMemoryDraft = null;
      callback();
    }
  };
  const onDraftChange = (event: Event) => {
    if ((event as CustomEvent<string>).detail === draftKey) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(DRAFT_STORAGE_EVENT, onDraftChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(DRAFT_STORAGE_EVENT, onDraftChange);
  };
}

function persistDraft(draftKey: string, draft: Draft): void {
  const cache = draftCache(draftKey);
  cache.inMemoryDraft = draft;
  cache.lastSnapshot = draft;
  try {
    const persisted: PersistedDraft = {
      existingSearch: draft.existingSearch,
      productTypeDefinitionId: draft.productTypeDefinitionId,
      primaryCategoryId: draft.primaryCategoryId,
      title: draft.title,
      description: draft.description,
      attributes: draft.attributes,
      variants: draft.variants,
      compliance: draft.compliance,
      storeSku: draft.storeSku,
      price: draft.price,
      stock: draft.stock,
      inventoryLocation: draft.inventoryLocation,
      modifiers: draft.modifiers,
    };
    const serialized = JSON.stringify(persisted);
    window.localStorage.setItem(draftKey, serialized);
    cache.lastStoredDraft = serialized;
  } catch {
    // Local storage quota or security errors do not prevent this browser-only draft from continuing.
  }
  window.dispatchEvent(new CustomEvent(DRAFT_STORAGE_EVENT, { detail: draftKey }));
}

function draftSaveFailure(status: number, attachment = false) {
  if (status === 409 || status === 412) return "The catalog record changed before this request completed. Refresh and review the canonical record before trying again.";
  if (status === 429) return "The catalog service is temporarily rate limited. Wait before trying again.";
  if (status >= 500) return "The catalog service is temporarily unavailable. Try again later.";
  return attachment ? "The product was saved, but an image could not be attached. Review the canonical draft before trying again." : "The product draft could not be saved. Review the highlighted fields and try again.";
}

export function StoreCatalogWizard({ productTypes, categories, draftOwnerKey, inventoryLocations = [] }: { productTypes: ProductTypeChoice[]; categories: CategoryChoice[]; draftOwnerKey: string; inventoryLocations?: { publicReference: string; name: string }[] }) {
  const [step, setStep] = useState(0);
  // The authenticated page supplies both owner and store. Never adopt the legacy unscoped draft.
  const draftKey = `${DRAFT_STORAGE_PREFIX}${draftOwnerKey}`;
  const draftStore = useMemo(() => ({
    subscribe: (callback: () => void) => subscribeToDraft(draftKey, callback),
    getSnapshot: () => readStoredDraft(draftKey),
  }), [draftKey]);
  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getSnapshot, () => EMPTY);
  const [status, setStatus] = useState("Draft is held only in this browser view until it is submitted.");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const operation = useRef<{ identity: string; id: string; effectiveFrom: string } | null>(null);
  const [saved, setSaved] = useState<{ productReference: string; offerReference: string } | null>(null);
  const [duplicateSearch, setDuplicateSearch] = useState<{ pending: boolean; message: string; candidates: { publicReference: string; title: string; confidenceBand: string }[] }>({ pending: false, message: "", candidates: [] });

  const selectedType = productTypes.find((choice) => choice.id === draft.productTypeDefinitionId);
  const completed = useMemo(() => [draft.existingSearch.length > 2, !!draft.productTypeDefinitionId && !!draft.primaryCategoryId, draft.title.length >= 3 && draft.description.length >= 20, isJson(draft.attributes), draft.variants.trim().length > 0, draft.media.length > 0 && draft.media.every((item) => item.status === "READY" && item.altText.trim()) && draft.media.filter((item) => item.primary).length === 1, isJson(draft.compliance), draft.storeSku.trim().length > 0, /^\d+\.\d{2}$/.test(draft.price), Number.isSafeInteger(Number(draft.stock)) && Number(draft.stock) >= 0, true, draft.title.length >= 3, false], [draft]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) { persistDraft(draftKey, { ...draft, [key]: value }); setErrors([]); setStatus("Draft changed in this browser view."); }

  async function findDuplicates() {
    if (!selectedType || draft.existingSearch.trim().length < 3) { setDuplicateSearch({ pending: false, message: "Choose a product type in Type and category, then enter at least three title characters.", candidates: [] }); return; }
    setDuplicateSearch({ pending: true, message: "Searching available catalog identities…", candidates: [] });
    try {
      const response = await fetch(`/api/store/catalog/products/duplicate-search?${new URLSearchParams({ title: draft.existingSearch.trim(), productTypeCode: selectedType.code })}`, { cache: "no-store" });
      const body = await response.json() as { candidates?: typeof duplicateSearch.candidates };
      if (!response.ok || !Array.isArray(body.candidates)) throw new Error("Unavailable");
      setDuplicateSearch({ pending: false, message: body.candidates.length ? "Review these matching identities before creating another product." : "No matching available identity was found.", candidates: body.candidates });
    } catch { setDuplicateSearch({ pending: false, message: "The search could not be completed. Check your connection and try again.", candidates: [] }); }
  }

  async function submitDraft() {
    if (inFlight.current || saved) return;
    const nextErrors: string[] = [];
    if (!draft.productTypeDefinitionId) nextErrors.push("Select a product type.");
    if (!draft.primaryCategoryId) nextErrors.push("Select a category.");
    if (draft.title.trim().length < 3) nextErrors.push("Enter a product title.");
    if (!isJson(draft.attributes)) nextErrors.push("Attributes must be valid JSON.");
    if (!isJson(draft.compliance)) nextErrors.push("Compliance data must be valid JSON.");
    if (!draft.storeSku.trim()) nextErrors.push("Enter this store's SKU.");
    if (!/^(?:0|[1-9]\d{0,15})\.\d{2}$/.test(draft.price)) nextErrors.push("Enter a VAT-inclusive ZAR price with exactly two decimal places.");
    if (!/^\d+$/.test(draft.stock) || !Number.isSafeInteger(Number(draft.stock)) || Number(draft.stock) > 2_147_483_647) nextErrors.push("Enter a non-negative whole opening stock count.");
    if (Number(draft.stock) > 0 && !draft.inventoryLocation) nextErrors.push("Select an active inventory location for opening stock.");
    if (draft.variants.trim() !== "Default" && !isJsonArray(draft.variants)) nextErrors.push("Enter Default or a JSON array of variant definitions.");
    if (draft.modifiers.trim() && !isJsonArray(draft.modifiers)) nextErrors.push("Modifier groups must be a JSON array.");
    if (draft.media.length < 1) nextErrors.push("Attach at least one READY product image.");
    if (draft.media.some((item) => !item.altText.trim())) nextErrors.push("Enter alt text for every attached image.");
    if (draft.media.filter((item) => item.primary && item.variantAssociation === "PRODUCT").length !== 1) nextErrors.push("Select exactly one primary product image.");
    setErrors(nextErrors);
    if (nextErrors.length) { setStep(1); document.getElementById("catalog-error-summary")?.focus(); return; }
    inFlight.current = true; setSaving(true); setStatus("Saving the listing draft…");
    try {
      const facts = {
        product: { scope: "STORE_PRIVATE", productTypeDefinitionId: draft.productTypeDefinitionId, primaryCategoryId: draft.primaryCategoryId, title: draft.title, description: draft.description || undefined, condition: "NEW", attributeValues: JSON.parse(draft.attributes), complianceValues: JSON.parse(draft.compliance) },
        variants: draft.variants.trim() === "Default" ? [] : JSON.parse(draft.variants),
        storeSku: draft.storeSku, openingStock: Number(draft.stock), inventoryLocationPublicReference: draft.inventoryLocation || undefined,
        modifiers: draft.modifiers.trim() ? JSON.parse(draft.modifiers) : [],
        media: draft.media.map((media, displayOrder) => ({ assetPublicReference: media.assetPublicReference, altText: media.altText, primary: media.primary, variantAssociation: media.variantAssociation, displayOrder })),
      };
      const identity = JSON.stringify([draftOwnerKey, facts, draft.price]);
      if (operation.current?.identity !== identity) operation.current = { identity, id: crypto.randomUUID(), effectiveFrom: new Date().toISOString() };
      const parsed = CatalogListingDraftSchema.safeParse({ ...facts, operationId: operation.current.id, price: { amount: draft.price, currency: "ZAR", priceIncludesTax: true, effectiveFrom: operation.current.effectiveFrom } });
      if (!parsed.success) { setErrors(["Review the variant, modifier, price and media definitions before saving."]); setStatus("The listing has not been sent."); return; }
      const response = await fetch("/api/store/catalog/listing-drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const body = await response.json().catch(() => ({})) as { error?: string; product?: { publicReference: string; offers: { publicReference: string }[] } };
      if (!response.ok) { setErrors([body.error ?? draftSaveFailure(response.status)]); setStatus("The listing save was not confirmed."); return; }
      if (!body.product?.offers[0]) { setErrors(["The catalog service did not return the saved listing confirmation. Retry to check this operation."]); setStatus("The listing save could not be confirmed."); return; }
      setSaved({ productReference: body.product.publicReference, offerReference: body.product.offers[0].publicReference });
      setStatus("Product, variants, images, offer, price, opening stock and modifiers were saved together. Review the saved records before submission."); setStep(12);
    } catch {
      setErrors(["The save could not be confirmed. Check your connection and retry; the unchanged listing keeps the same operation."]); setStatus("The listing save could not be confirmed.");
    } finally { inFlight.current = false; setSaving(false); }
  }

  if (saved) return <Card><h2 className="text-xl font-bold">Listing draft saved</h2><p className="mt-3" role="status">{status}</p><div className="mt-4 flex flex-wrap gap-4"><Link className="underline" href={`/store/catalog/products/${saved.productReference}`}>View saved product</Link><Link className="underline" href={`/store/catalog/offers/${saved.offerReference}`}>View saved offer</Link></div></Card>;

  return <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
    <Card padding="sm"><h2 className="mb-3 text-sm font-black text-[var(--kt-ink-navy)]">Listing progress</h2><ol className="space-y-1" aria-label="Product listing steps">{STEPS.map((label, index) => <li key={label}><button type="button" onClick={() => setStep(index)} aria-current={step === index ? "step" : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${step === index ? "bg-[var(--kt-cloud-blue)] font-extrabold" : "hover:bg-[var(--kt-surface-muted)]"}`}><span aria-hidden="true">{completed[index] ? "✓" : index + 1}</span><span>{label}</span><span className="sr-only">{completed[index] ? "complete" : "incomplete"}</span></button></li>)}</ol></Card>
    <div className="space-y-4">
      <div id="catalog-error-summary" tabIndex={-1}>{errors.length > 0 ? <div className="rounded-xl border border-red-300 bg-red-50 p-4" role="alert"><h2 className="font-black">Resolve these issues</h2><ul className="mt-2 list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}</div>
      <p className="text-sm text-[var(--kt-text-muted)]" aria-live="polite">{status}</p>
      <Card><p className="text-xs font-extrabold uppercase tracking-widest text-[var(--kt-signal-cobalt)]">Step {step + 1} of {STEPS.length}</p><h2 className="mt-1 text-xl font-black">{STEPS[step]}</h2><div className="mt-5 space-y-4">{renderStep(step, draft, update, productTypes, categories, selectedType, inventoryLocations)}{step === 0 ? <section aria-label="Duplicate suggestions"><Button type="button" disabled={duplicateSearch.pending} onClick={findDuplicates}>Search matching products</Button><p className="mt-3 text-sm" role="status">{duplicateSearch.message}</p><ul className="mt-3 space-y-2">{duplicateSearch.candidates.map(candidate => <li className="break-words text-sm" key={candidate.publicReference}>{candidate.title} · {candidate.publicReference} · {candidate.confidenceBand}</li>)}</ul></section> : null}</div><div className="mt-6 flex flex-wrap justify-between gap-3"><Button type="button" variant="secondary" disabled={saving || step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>Previous</Button>{step < 12 ? <Button type="button" disabled={saving} onClick={() => setStep((value) => Math.min(12, value + 1))}>Continue</Button> : <Button type="button" disabled={saving} onClick={submitDraft}>{saving ? "Saving product draft…" : "Save product draft"}</Button>}</div></Card>
    </div>
  </div>;
}

function isJson(value: string) { try { const parsed = JSON.parse(value) as unknown; return !!parsed && typeof parsed === "object" && !Array.isArray(parsed); } catch { return false; } }
function isJsonArray(value: string) { try { return Array.isArray(JSON.parse(value)); } catch { return false; } }

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) { const id = label.toLocaleLowerCase("en-ZA").replace(/[^a-z0-9]+/g, "-"); return <div><label htmlFor={id} className="mb-1 block text-sm font-extrabold">{label}</label>{children}<p id={`${id}-help`} className="mt-1 text-xs text-[var(--kt-text-muted)]">{help}</p></div>; }

function renderStep(step: number, draft: Draft, update: <K extends keyof Draft>(key: K, value: Draft[K]) => void, productTypes: ProductTypeChoice[], categories: CategoryChoice[], selectedType: ProductTypeChoice | undefined, inventoryLocations: { publicReference: string; name: string }[]) {
  if (step === 0) return <Field label="Find an existing product" help="Search by title after choosing a product type. Suggestions include this store’s private drafts and published shared products."><Input id="find-an-existing-product" value={draft.existingSearch} onChange={(event) => update("existingSearch", event.target.value)} placeholder="Product title" /></Field>;
  if (step === 1) return <div className="grid gap-4 md:grid-cols-2"><Field label="Product type" help="The stored version remains attached to this product."><Select id="product-type" value={draft.productTypeDefinitionId} onChange={(event) => update("productTypeDefinitionId", event.target.value)} placeholder="Select a product type" options={productTypes.map((item) => ({ value: item.id, label: `${item.name} · v${item.versionNumber}` }))} /></Field><Field label="Category" help="Categories drive navigation; the product type drives attributes."><Select id="category" value={draft.primaryCategoryId} onChange={(event) => update("primaryCategoryId", event.target.value)} placeholder="Select a category" options={categories.map((item) => ({ value: item.id, label: `${item.name} · ${item.path}` }))} /></Field></div>;
  if (step === 2) return <><Field label="Product title" help="Describe the product identity, not price or stock."><Input id="product-title" value={draft.title} onChange={(event) => update("title", event.target.value)} /></Field><Field label="Description" help="Plain text only. Include material facts and condition disclosures."><Textarea id="description" value={draft.description} onChange={(event) => update("description", event.target.value)} rows={7} /></Field></>;
  if (step === 3) return <Field label="Attribute values" help={`Schema-driven JSON for ${selectedType?.code ?? "the selected product type"}. Unknown fields are rejected.`}><Textarea id="attribute-values" value={draft.attributes} onChange={(event) => update("attributes", event.target.value)} rows={9} className="font-mono" /></Field>;
  if (step === 4) return <Field label="Variant matrix" help={'Keep Default for one variant, or enter a JSON array such as [{"title":"Blue","options":[{"code":"color","value":"blue"}],"attributeValues":{}}]. The offer below sells the Default variant.'}><Textarea id="variant-matrix" value={draft.variants} onChange={(event) => update("variants", event.target.value)} rows={6} /></Field>;
  if (step === 5) return <CatalogMediaUploader value={draft.media} onChange={(media) => update("media", media)} />;
  if (step === 6) return <Field label="Compliance values" help="Ingredients, allergens, origin, condition and restriction evidence are validated before submission."><Textarea id="compliance-values" value={draft.compliance} onChange={(event) => update("compliance", event.target.value)} rows={8} className="font-mono" /></Field>;
  if (step === 7) return <Field label="Store SKU" help="Unique inside this store. It does not replace GTIN or manufacturer part number."><Input id="store-sku" value={draft.storeSku} onChange={(event) => update("storeSku", event.target.value)} /></Field>;
  if (step === 8) return <Field label="VAT-inclusive price (ZAR)" help="Enter an exact amount such as 24999.00. Price versions are immutable after activation."><Input id="vat-inclusive-price-zar" inputMode="decimal" value={draft.price} onChange={(event) => update("price", event.target.value)} /></Field>;
  if (step === 9) return <><Field label="Opening stock" help="Enter a whole count for the Default variant. Saving records an opening stock movement."><Input id="opening-stock" inputMode="numeric" value={draft.stock} onChange={(event) => update("stock", event.target.value)} /></Field><Field label="Inventory location" help="Choose an existing active location. Opening stock above zero requires a location."><Select id="inventory-location" value={draft.inventoryLocation} onChange={(event) => update("inventoryLocation", event.target.value)} placeholder="Select an inventory location" options={inventoryLocations.map(item => ({ value: item.publicReference, label: item.name }))} /></Field>{inventoryLocations.length === 0 ? <p role="status">No active inventory location is available. Set opening stock to zero or ask the store administrator to configure a location.</p> : null}</>;
  if (step === 10) return <Field label="Modifier groups" help={'Optional JSON array of groups. Each group needs name, minimumSelections, maximumSelections, isRequired and options. Each option needs name, priceDelta (for example "1.00"), currency "ZAR" and displayOrder. Leave blank for none.'}><Textarea id="modifier-groups" value={draft.modifiers} onChange={(event) => update("modifiers", event.target.value)} rows={6} /></Field>;
  if (step === 11) return <div role="region" aria-label="Exact draft preview" className="space-y-2 rounded-xl border border-[var(--kt-soft-border)] p-4"><h3 className="text-lg font-black">{draft.title || "Untitled product"}</h3><p>{draft.description || "No description"}</p><dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-bold">SKU</dt><dd>{draft.storeSku || "Not ready"}</dd></div><div><dt className="font-bold">Price</dt><dd>{draft.price ? `R ${draft.price}` : "Not ready"}</dd></div><div><dt className="font-bold">Stock</dt><dd>{draft.stock}</dd></div><div><dt className="font-bold">Publication</dt><dd>Draft only; review and publication are separate</dd></div></dl></div>;
  return <div><h3 className="font-black">Quality checklist</h3><ul className="mt-3 space-y-2">{["Product type and category", "Core information", "Attributes", "Variant", "Compliance", "Offer SKU", "Price", "Inventory"].map((item, index) => <li key={item} className="flex gap-2"><span aria-hidden="true">{completedForSubmit(index, draft) ? "✓" : "○"}</span>{item}</li>)}</ul><p className="mt-4 text-sm text-[var(--kt-text-muted)]">Saving creates a draft only. Submission and public activation are separate reviewed actions.</p></div>;
}

function completedForSubmit(index: number, draft: Draft) { return [!!draft.productTypeDefinitionId && !!draft.primaryCategoryId, draft.title.length >= 3, isJson(draft.attributes), draft.variants.length > 0, isJson(draft.compliance), draft.storeSku.length > 0, /^\d+\.\d{2}$/.test(draft.price), Number(draft.stock) >= 0][index]; }
