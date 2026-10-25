"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { utcDateInputToIso } from "@/lib/utils/utc-date-input";
import { TrustedConsignmentSchema, type TrustedPackageVersion } from "@/lib/marketplace-checkout/parcel-classification";

type Bundle = NonNullable<TrustedPackageVersion["bundles"]>[number];
type Entry = { offerReference: string; variantReference: string; publicationVersion: string; quantity: number; modifiers: string };
const newEntry = (): Entry => ({ offerReference: "", variantReference: "", publicationVersion: "", quantity: 1, modifiers: "[]" });

export function parseMeasuredConsignmentDraft(input: unknown): Bundle {
  const result = TrustedConsignmentSchema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Check sealed-package measurements and selected products.");
  return result.data;
}

/** Exact measured consignment authoring. Deliberately no guessed dimensions,
 * weight summing, shopper-supplied class or automatic financial activation. */
export function MeasuredConsignmentDraft({ disabled, onSave }: {
  disabled: boolean;
  onSave: (bundle: Bundle, schedule: { effectiveFrom: string; effectiveTo: string | null; reason: string }) => void;
}) {
  const [lines, setLines] = useState<Entry[]>([newEntry()]);
  const [error, setError] = useState("");
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const data = new FormData(event.currentTarget);
    const text = (field: string) => String(data.get(field) ?? "").trim();
    try {
      const measured = lines.map(line => ({ ...line, quantity: Number(line.quantity), modifiers: JSON.parse(line.modifiers) as Bundle["lines"][number]["modifiers"] }));
      if (measured.length === 1 && measured[0].quantity < 2) throw Error("Enter at least two sealed units or use a single prepackaged unit.");
      if (measured.some(line => !line.offerReference || !line.variantReference || !line.publicationVersion || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 || !Array.isArray(line.modifiers))) throw Error("Every line needs a valid offer, variant, publication revision, quantity and modifier array.");
      const bundle: Bundle = {
        storeId: text("storeId"), packingRule: "MEASURED_SEALED_CONSIGNMENT", lines: measured,
        lengthCm: Number(text("lengthCm")), widthCm: Number(text("widthCm")), heightCm: Number(text("heightCm")),
        weightKg: Number(text("weightKg")), authorityReference: text("authorityReference"),
      };
      onSave(parseMeasuredConsignmentDraft(bundle), { effectiveFrom: utcDateInputToIso(text("effectiveFrom")), effectiveTo: text("effectiveTo") ? utcDateInputToIso(text("effectiveTo")) : null, reason: text("reason") });
    } catch (err) { setError(err instanceof Error ? err.message : "Review the exact selected lines and effective dates."); }
  }
  function setLine(index: number, field: keyof Entry, value: string) {
    setLines(current => current.map((item, i) => i === index ? { ...item, [field]: field === "quantity" ? Number(value) : value } : item));
  }
  return <section className="space-y-4 rounded-xl border border-[var(--kt-border)] p-4 sm:p-6" aria-labelledby="consignment-draft-title">
    <h3 id="consignment-draft-title" className="text-lg font-semibold">Measured multi-item consignment</h3>
    <p className="max-w-3xl text-sm leading-6">Use actual dimensions and weight measured after these exact products were packed and sealed together. A different authorized administrator must approve the version before any delivery tariff can use it. Product weights are never automatically added.</p>
    {error ? <p role="alert" className="text-sm">{error}</p> : null}
    <form onSubmit={submit} className="space-y-5">
      <div className="max-w-xl"><Label htmlFor="bundle-store">Store ID for the sealed package</Label><Input id="bundle-store" name="storeId" required /></div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold">Exact contents of this package</h4><Button type="button" disabled={disabled || lines.length >= 50} onClick={() => setLines(current => [...current, newEntry()])}>Add product line</Button></div>
        {lines.map((line, index) => <fieldset className="space-y-3 rounded-lg border p-3 sm:p-4" key={index}>
          <legend className="px-1 font-medium">Package line {index + 1}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {([ ["offerReference", "Published offer reference"], ["variantReference", "Variant reference"], ["publicationVersion", "Current offer revision"], ["quantity", "Units in package"] ] as const).map(([key, label]) => <div key={key}><Label htmlFor={`bundle-line-${index}-${key}`}>{label}</Label><Input id={`bundle-line-${index}-${key}`} value={line[key]} type={key === "quantity" ? "number" : "text"} min={key === "quantity" ? 1 : undefined} step={key === "quantity" ? 1 : undefined} required onChange={event => setLine(index, key, event.target.value)} /></div>)}
          </div>
          <div><Label htmlFor={`bundle-line-${index}-modifiers`}>Selected modifier options (JSON)</Label><Input id={`bundle-line-${index}-modifiers`} value={line.modifiers} required onChange={event => setLine(index, "modifiers", event.target.value)} /><p className="mt-1 text-xs">Use [] where no selected options exist. Each option requires its exact optionReference and quantity.</p></div>
          {lines.length > 1 ? <Button type="button" disabled={disabled} onClick={() => setLines(current => current.filter((_, i) => i !== index))}>Remove this line</Button> : null}
        </fieldset>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {([ ["lengthCm", "Sealed package length (cm)"], ["widthCm", "Sealed package width (cm)"], ["heightCm", "Sealed package height (cm)"], ["weightKg", "Sealed package total weight (kg)"] ] as const).map(([key,label]) => <div key={key}><Label htmlFor={`bundle-${key}`}>{label}</Label><Input id={`bundle-${key}`} name={key} type="number" min="0.0001" max={key === "weightKg" ? "10000" : "1000"} step="0.0001" required /></div>)}
        <div><Label htmlFor="bundle-authority">Measurement evidence / authority reference</Label><Input id="bundle-authority" name="authorityReference" minLength={10} required /></div>
        <div><Label htmlFor="bundle-reason">Why is this package being reviewed?</Label><Input id="bundle-reason" name="reason" minLength={10} maxLength={500} required /></div>
        <div><Label htmlFor="bundle-from">Effective from (UTC)</Label><Input id="bundle-from" name="effectiveFrom" type="datetime-local" required /></div>
        <div><Label htmlFor="bundle-to">Effective until (UTC, optional)</Label><Input id="bundle-to" name="effectiveTo" type="datetime-local" /></div>
      </div>
      <Button type="submit" disabled={disabled}>Save measured consignment draft</Button>
    </form>
  </section>;
}
