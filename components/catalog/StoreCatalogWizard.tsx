"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
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
  modifiers: string;
};

const EMPTY: Draft = { existingSearch: "", productTypeDefinitionId: "", primaryCategoryId: "", title: "", description: "", attributes: "{}", variants: "Default", media: [], compliance: "{}", storeSku: "", price: "", stock: "0", modifiers: "" };
const STEPS = ["Find existing product", "Type and category", "Core information", "Attributes", "Variants", "Media", "Compliance", "Store offer", "Price", "Inventory", "Modifiers", "Preview", "Submit"];
const DRAFT_STORAGE_KEY = "kt_store_catalog_wizard_draft";
const DRAFT_STORAGE_EVENT = "kt-store-catalog-wizard-draft-change";
const PERSISTED_DRAFT_KEYS = ["existingSearch", "productTypeDefinitionId", "primaryCategoryId", "title", "description", "attributes", "variants", "compliance", "storeSku", "price", "stock", "modifiers"] as const;

type PersistedDraft = Omit<Draft, "media">;

let inMemoryDraft: Draft | null = null;
let lastStoredDraft: string | null | undefined;
let lastSnapshot: Draft = EMPTY;

function isPersistedDraft(value: unknown): value is PersistedDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return PERSISTED_DRAFT_KEYS.every((key) => typeof record[key] === "string");
}

function readStoredDraft(): Draft {
  if (typeof window === "undefined") return EMPTY;
  if (inMemoryDraft) return inMemoryDraft;

  try {
    const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (stored === lastStoredDraft) return lastSnapshot;
    lastStoredDraft = stored;
    if (!stored) return lastSnapshot = EMPTY;
    const parsed: unknown = JSON.parse(stored);
    return lastSnapshot = isPersistedDraft(parsed) ? { ...EMPTY, ...parsed, media: [] } : EMPTY;
  } catch {
    return lastSnapshot = EMPTY;
  }
}

function subscribeToDraft(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === DRAFT_STORAGE_KEY) {
      inMemoryDraft = null;
      callback();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(DRAFT_STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(DRAFT_STORAGE_EVENT, callback);
  };
}

function persistDraft(draft: Draft): void {
  inMemoryDraft = draft;
  lastSnapshot = draft;
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
      modifiers: draft.modifiers,
    };
    const serialized = JSON.stringify(persisted);
    window.localStorage.setItem(DRAFT_STORAGE_KEY, serialized);
    lastStoredDraft = serialized;
  } catch {
    // Local storage quota or security errors do not prevent this browser-only draft from continuing.
  }
  window.dispatchEvent(new Event(DRAFT_STORAGE_EVENT));
}

function draftSaveFailure(status: number, attachment = false) {
  if (status === 409 || status === 412) return "The catalog record changed before this request completed. Refresh and review the canonical record before trying again.";
  if (status === 429) return "The catalog service is temporarily rate limited. Wait before trying again.";
  if (status >= 500) return "The catalog service is temporarily unavailable. Try again later.";
  return attachment ? "The product was saved, but an image could not be attached. Review the canonical draft before trying again." : "The product draft could not be saved. Review the highlighted fields and try again.";
}

export function StoreCatalogWizard({ productTypes, categories }: { productTypes: ProductTypeChoice[]; categories: CategoryChoice[] }) {
  const [step, setStep] = useState(0);
  const draft = useSyncExternalStore(subscribeToDraft, readStoredDraft, () => EMPTY);
  const [status, setStatus] = useState("Draft is held only in this browser view until it is submitted.");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const selectedType = productTypes.find((choice) => choice.id === draft.productTypeDefinitionId);
  const completed = useMemo(() => [draft.existingSearch.length > 2, !!draft.productTypeDefinitionId && !!draft.primaryCategoryId, draft.title.length >= 3 && draft.description.length >= 20, isJson(draft.attributes), draft.variants.trim().length > 0, draft.media.length > 0 && draft.media.every((item) => item.status === "READY" && item.altText.trim()) && draft.media.filter((item) => item.primary).length === 1, isJson(draft.compliance), draft.storeSku.trim().length > 0, /^\d+\.\d{2}$/.test(draft.price), Number.isSafeInteger(Number(draft.stock)) && Number(draft.stock) >= 0, true, draft.title.length >= 3, false], [draft]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) { persistDraft({ ...draft, [key]: value }); setStatus("Draft changed in this browser view."); }

  async function submitDraft() {
    if (saving) return;
    const nextErrors: string[] = [];
    if (!draft.productTypeDefinitionId) nextErrors.push("Select a product type.");
    if (!draft.primaryCategoryId) nextErrors.push("Select a category.");
    if (draft.title.trim().length < 3) nextErrors.push("Enter a product title.");
    if (!isJson(draft.attributes)) nextErrors.push("Attributes must be valid JSON.");
    if (!isJson(draft.compliance)) nextErrors.push("Compliance data must be valid JSON.");
    if (draft.media.length < 1) nextErrors.push("Attach at least one READY product image.");
    if (draft.media.some((item) => !item.altText.trim())) nextErrors.push("Enter alt text for every attached image.");
    if (draft.media.filter((item) => item.primary && item.variantAssociation === "PRODUCT").length !== 1) nextErrors.push("Select exactly one primary product image.");
    setErrors(nextErrors);
    if (nextErrors.length) { setStep(1); document.getElementById("catalog-error-summary")?.focus(); return; }
    setSaving(true); setStatus("Saving the canonical server draft…");
    try {
      const response = await fetch("/api/store/catalog/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "STORE_PRIVATE", productTypeDefinitionId: draft.productTypeDefinitionId, primaryCategoryId: draft.primaryCategoryId, title: draft.title, description: draft.description || undefined, condition: "NEW", attributeValues: JSON.parse(draft.attributes), complianceValues: JSON.parse(draft.compliance), operationId: crypto.randomUUID() }) });
      const body = await response.json().catch(() => ({})) as { product?: { publicReference: string; version: number; variants: { publicReference: string }[] } };
      if (!response.ok) { setErrors([draftSaveFailure(response.status)]); setStatus("The server draft was not saved."); return; }
      if (!body.product) { setErrors(["The catalog service did not return the canonical draft confirmation."]); setStatus("The server draft could not be confirmed."); return; }
      let productVersion = body.product.version;
      for (const [index, media] of draft.media.entries()) {
        const attachmentResponse = await fetch(`/api/store/catalog/products/${encodeURIComponent(body.product.publicReference)}/media`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operationId: crypto.randomUUID(), productVersion, assetPublicReference: media.assetPublicReference, role: media.variantAssociation === "DEFAULT" ? "VARIANT" : media.primary ? "PRIMARY" : "GALLERY", altText: media.altText, displayOrder: index, variantPublicReference: media.variantAssociation === "DEFAULT" ? body.product.variants[0]?.publicReference ?? null : null }) });
        const attachmentBody = await attachmentResponse.json().catch(() => ({})) as { productVersion?: number };
        if (!attachmentResponse.ok || !attachmentBody.productVersion) { setErrors([draftSaveFailure(attachmentResponse.status, true)]); setStatus("The product was saved, but media needs review."); return; }
        productVersion = attachmentBody.productVersion;
      }
      setStatus("The canonical product draft was saved. Review the source-backed draft before submitting it for approval."); setStep(12);
    } catch {
      setErrors(["The catalog service could not be reached. Check your connection and try again."]); setStatus("The server draft was not saved.");
    } finally { setSaving(false); }
  }

  return <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
    <Card padding="sm"><h2 className="mb-3 text-sm font-black text-[var(--kt-ink-navy)]">Listing progress</h2><ol className="space-y-1" aria-label="Product listing steps">{STEPS.map((label, index) => <li key={label}><button type="button" onClick={() => setStep(index)} aria-current={step === index ? "step" : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${step === index ? "bg-[var(--kt-cloud-blue)] font-extrabold" : "hover:bg-[var(--kt-surface-muted)]"}`}><span aria-hidden="true">{completed[index] ? "✓" : index + 1}</span><span>{label}</span><span className="sr-only">{completed[index] ? "complete" : "incomplete"}</span></button></li>)}</ol></Card>
    <div className="space-y-4">
      <div id="catalog-error-summary" tabIndex={-1}>{errors.length > 0 ? <div className="rounded-xl border border-red-300 bg-red-50 p-4" role="alert"><h2 className="font-black">Resolve these issues</h2><ul className="mt-2 list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}</div>
      <p className="text-sm text-[var(--kt-text-muted)]" aria-live="polite">{status}</p>
      <Card><p className="text-xs font-extrabold uppercase tracking-widest text-[var(--kt-signal-cobalt)]">Step {step + 1} of {STEPS.length}</p><h2 className="mt-1 text-xl font-black">{STEPS[step]}</h2><div className="mt-5 space-y-4">{renderStep(step, draft, update, productTypes, categories, selectedType)}</div><div className="mt-6 flex flex-wrap justify-between gap-3"><Button type="button" variant="secondary" disabled={saving || step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>Previous</Button>{step < 12 ? <Button type="button" disabled={saving} onClick={() => setStep((value) => Math.min(12, value + 1))}>Continue</Button> : <Button type="button" disabled={saving} onClick={submitDraft}>{saving ? "Saving product draft…" : "Save product draft"}</Button>}</div></Card>
    </div>
  </div>;
}

function isJson(value: string) { try { const parsed = JSON.parse(value) as unknown; return !!parsed && typeof parsed === "object" && !Array.isArray(parsed); } catch { return false; } }

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) { const id = label.toLocaleLowerCase("en-ZA").replace(/[^a-z0-9]+/g, "-"); return <div><label htmlFor={id} className="mb-1 block text-sm font-extrabold">{label}</label>{children}<p id={`${id}-help`} className="mt-1 text-xs text-[var(--kt-text-muted)]">{help}</p></div>; }

function renderStep(step: number, draft: Draft, update: <K extends keyof Draft>(key: K, value: Draft[K]) => void, productTypes: ProductTypeChoice[], categories: CategoryChoice[], selectedType?: ProductTypeChoice) {
  if (step === 0) return <Field label="Find an existing product" help="Duplicate suggestions appear before a new identity is created."><Input id="find-an-existing-product" value={draft.existingSearch} onChange={(event) => update("existingSearch", event.target.value)} placeholder="Title, GTIN, brand or MPN" /></Field>;
  if (step === 1) return <div className="grid gap-4 md:grid-cols-2"><Field label="Product type" help="The stored version remains attached to this product."><Select id="product-type" value={draft.productTypeDefinitionId} onChange={(event) => update("productTypeDefinitionId", event.target.value)} placeholder="Select a product type" options={productTypes.map((item) => ({ value: item.id, label: `${item.name} · v${item.versionNumber}` }))} /></Field><Field label="Category" help="Categories drive navigation; the product type drives attributes."><Select id="category" value={draft.primaryCategoryId} onChange={(event) => update("primaryCategoryId", event.target.value)} placeholder="Select a category" options={categories.map((item) => ({ value: item.id, label: `${item.name} · ${item.path}` }))} /></Field></div>;
  if (step === 2) return <><Field label="Product title" help="Describe the product identity, not price or stock."><Input id="product-title" value={draft.title} onChange={(event) => update("title", event.target.value)} /></Field><Field label="Description" help="Plain text only. Include material facts and condition disclosures."><Textarea id="description" value={draft.description} onChange={(event) => update("description", event.target.value)} rows={7} /></Field></>;
  if (step === 3) return <Field label="Attribute values" help={`Schema-driven JSON for ${selectedType?.code ?? "the selected product type"}. Unknown fields are rejected.`}><Textarea id="attribute-values" value={draft.attributes} onChange={(event) => update("attributes", event.target.value)} rows={9} className="font-mono" /></Field>;
  if (step === 4) return <Field label="Variant matrix" help="One row per exact option combination. Products without options retain the Default variant."><Textarea id="variant-matrix" value={draft.variants} onChange={(event) => update("variants", event.target.value)} rows={6} /></Field>;
  if (step === 5) return <CatalogMediaUploader value={draft.media} onChange={(media) => update("media", media)} />;
  if (step === 6) return <Field label="Compliance values" help="Ingredients, allergens, origin, condition and restriction evidence are validated before submission."><Textarea id="compliance-values" value={draft.compliance} onChange={(event) => update("compliance", event.target.value)} rows={8} className="font-mono" /></Field>;
  if (step === 7) return <Field label="Store SKU" help="Unique inside this store. It does not replace GTIN or manufacturer part number."><Input id="store-sku" value={draft.storeSku} onChange={(event) => update("storeSku", event.target.value)} /></Field>;
  if (step === 8) return <Field label="VAT-inclusive price (ZAR)" help="Enter an exact amount such as 24999.00. Price versions are immutable after activation."><Input id="vat-inclusive-price-zar" inputMode="decimal" value={draft.price} onChange={(event) => update("price", event.target.value)} /></Field>;
  if (step === 9) return <Field label="Opening stock" help="Tracked inventory is posted through an INITIAL_STOCK movement; no direct overwrite or reservation occurs."><Input id="opening-stock" inputMode="numeric" value={draft.stock} onChange={(event) => update("stock", event.target.value)} /></Field>;
  if (step === 10) return <Field label="Modifier groups" help="Flat store-scoped groups only. Variants and modifiers remain distinct."><Textarea id="modifier-groups" value={draft.modifiers} onChange={(event) => update("modifiers", event.target.value)} rows={6} /></Field>;
  if (step === 11) return <div aria-label="Exact draft preview" className="space-y-2 rounded-xl border border-[var(--kt-soft-border)] p-4"><h3 className="text-lg font-black">{draft.title || "Untitled product"}</h3><p>{draft.description || "No description"}</p><dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-bold">SKU</dt><dd>{draft.storeSku || "Not ready"}</dd></div><div><dt className="font-bold">Price</dt><dd>{draft.price ? `R ${draft.price}` : "Not ready"}</dd></div><div><dt className="font-bold">Stock</dt><dd>{draft.stock}</dd></div><div><dt className="font-bold">Publication</dt><dd>Blocked pending Phase 26.5</dd></div></dl></div>;
  return <div><h3 className="font-black">Quality checklist</h3><ul className="mt-3 space-y-2">{["Product type and category", "Core information", "Attributes", "Variant", "Compliance", "Offer SKU", "Price", "Inventory"].map((item, index) => <li key={item} className="flex gap-2"><span aria-hidden="true">{completedForSubmit(index, draft) ? "✓" : "○"}</span>{item}</li>)}</ul><p className="mt-4 text-sm text-[var(--kt-text-muted)]">Saving creates a draft only. Submission and public activation are separate reviewed actions.</p></div>;
}

function completedForSubmit(index: number, draft: Draft) { return [!!draft.productTypeDefinitionId && !!draft.primaryCategoryId, draft.title.length >= 3, isJson(draft.attributes), draft.variants.length > 0, isJson(draft.compliance), draft.storeSku.length > 0, /^\d+\.\d{2}$/.test(draft.price), Number(draft.stock) >= 0][index]; }
