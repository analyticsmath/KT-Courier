"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { StoreOfferPatchSchema, StorePriceVersionCreateSchema } from "@/lib/validation/catalog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";

type Offer = {
  publicReference: string; version: number; status: string;
  merchantTitle: string | null; merchantDescription: string | null;
  fulfilmentMode: string; primaryInventoryLocationId: string | null;
};

export function StoreOfferEditor({ offer, locations, canManage, canPrice, initialPrice, initialEffectiveFrom }: {
  offer: Offer; locations: { id: string; name: string }[];
  canManage: boolean; canPrice: boolean; initialPrice: string; initialEffectiveFrom: string;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const operation = useRef<{ facts: string; id: string } | null>(null);
  const [busy, setBusy] = useState<"offer" | "price" | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const editable = ["DRAFT", "NEEDS_CHANGES", "PAUSED"].includes(offer.status);
  const priceEditable = ["DRAFT", "NEEDS_CHANGES"].includes(offer.status);
  const disabled = busy !== null || confirmed;

  async function command(action: "offer" | "price", values: FormData) {
    if (inFlight.current || confirmed || !editable || (action === "offer" ? !canManage : !canPrice || !priceEditable)) return;
    setError(""); setMessage("");
    const location = String(values.get("location") ?? "");
    const from = String(values.get("effectiveFrom") ?? "");
    const until = String(values.get("effectiveUntil") ?? "");
    const facts = action === "offer" ? {
      version: offer.version,
      merchantTitle: String(values.get("merchantTitle") ?? "").trim() || null,
      merchantDescription: String(values.get("merchantDescription") ?? "").trim() || null,
      fulfilmentMode: String(values.get("fulfilmentMode") ?? ""),
      ...(location !== (offer.primaryInventoryLocationId ?? "") ? { primaryInventoryLocationId: location || null } : {}),
    } : {
      offerPublicReference: offer.publicReference, offerVersion: offer.version,
      amount: String(values.get("amount") ?? "").trim(), currency: "ZAR", priceIncludesTax: true,
      effectiveFrom: from ? `${from}:00.000Z` : "",
      ...(until ? { effectiveUntil: `${until}:00.000Z` } : {}),
      reasonCode: "STORE_PRICE_CORRECTION",
    };
    const identity = JSON.stringify([offer.publicReference, action, facts]);
    if (operation.current?.facts !== identity) operation.current = { facts: identity, id: crypto.randomUUID() };
    const raw = { ...facts, operationId: operation.current.id };
    const parsed = action === "offer" ? StoreOfferPatchSchema.safeParse(raw) : StorePriceVersionCreateSchema.safeParse(raw);
    if (!parsed.success || (action === "price" && until && until <= from)) {
      setError(action === "price" ? "Enter an exact price with two decimal places and a valid UTC effective period." : "Review the offer fields. Use plain text and a valid fulfilment option."); return;
    }
    inFlight.current = true; setBusy(action);
    try {
      const response = await fetch(action === "offer" ? `/api/store/catalog/offers/${encodeURIComponent(offer.publicReference)}` : "/api/store/catalog/prices", {
        method: action === "offer" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data),
      });
      const body = await response.json().catch(() => null) as { error?: string; offer?: { publicReference: string; version: number }; price?: { publicReference: string } } | null;
      if (!response.ok) {
        setError(response.status === 409 || response.status === 412 ? "This offer changed or its price period conflicts. Refresh and review the current record before saving again." : body?.error ?? "The correction could not be saved."); return;
      }
      if (action === "offer" ? body?.offer?.publicReference !== offer.publicReference || !Number.isSafeInteger(body?.offer?.version) : !body?.price?.publicReference) {
        throw new Error("Unconfirmed catalog response");
      }
      setConfirmed(true);
      setMessage(action === "offer" ? "Offer changes saved. Loading the current record…" : "A new draft price was saved for independent review. Loading the current record…");
      router.refresh();
    } catch {
      setError("The save could not be confirmed. Refresh the offer and check its recorded changes before saving again.");
    } finally { inFlight.current = false; setBusy(null); }
  }

  function submit(action: "offer" | "price", event: FormEvent<HTMLFormElement>) { event.preventDefault(); void command(action, new FormData(event.currentTarget)); }
  if (!editable || (!canManage && (!canPrice || !priceEditable))) return null;
  return <div className="space-y-6" aria-busy={busy !== null}>
    {error ? <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p> : null}
    {canManage ? <form aria-label="Correct offer details" className="space-y-4" onSubmit={event => submit("offer", event)}>
      <h3 className="font-semibold">Offer details</h3>
      <div><Label htmlFor="offer-merchant-title">Store listing title</Label><Input id="offer-merchant-title" name="merchantTitle" maxLength={180} defaultValue={offer.merchantTitle ?? ""} disabled={disabled} /></div>
      <div><Label htmlFor="offer-merchant-description">Store listing description</Label><Textarea id="offer-merchant-description" name="merchantDescription" maxLength={2_000} defaultValue={offer.merchantDescription ?? ""} disabled={disabled} /></div>
      <div><Label htmlFor="offer-fulfilment">Fulfilment</Label><select id="offer-fulfilment" name="fulfilmentMode" defaultValue={offer.fulfilmentMode} disabled={disabled} className="min-h-11 w-full rounded-lg border p-2"><option value="COURIER_DELIVERY">Courier delivery</option><option value="STORE_PICKUP">Store pickup</option><option value="PICKUP_AND_DELIVERY">Pickup and delivery</option></select></div>
      <div><Label htmlFor="offer-stock-location">Primary stock location</Label><select id="offer-stock-location" name="location" defaultValue={offer.primaryInventoryLocationId ?? ""} disabled={disabled} className="min-h-11 w-full rounded-lg border p-2"><option value="">No primary location</option>{offer.primaryInventoryLocationId && !locations.some(location => location.id === offer.primaryInventoryLocationId) ? <option value={offer.primaryInventoryLocationId}>Current location (inactive)</option> : null}{locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div>
      <Button type="submit" disabled={disabled} loading={busy === "offer"}>Save offer changes</Button>
    </form> : null}
    {canPrice && priceEditable ? <form aria-label="Correct draft price" className="space-y-4 border-t border-[var(--eo-line-soft)] pt-5" onSubmit={event => submit("price", event)}>
      <h3 className="font-semibold">Draft price correction</h3><p className="text-sm text-[var(--eo-text-secondary)]">Save a new VAT-inclusive ZAR price version, then submit the offer for independent review.</p>
      <div><Label htmlFor="offer-price-amount">Price including VAT (ZAR)</Label><Input id="offer-price-amount" name="amount" inputMode="decimal" pattern="(?:0|[1-9][0-9]{0,15})\.[0-9]{2}" required defaultValue={initialPrice} disabled={disabled} /></div>
      <div><Label htmlFor="offer-price-from">Effective from (UTC)</Label><Input id="offer-price-from" name="effectiveFrom" type="datetime-local" required defaultValue={initialEffectiveFrom.slice(0, 16)} disabled={disabled} /></div>
      <div><Label htmlFor="offer-price-until">Effective until (UTC, optional)</Label><Input id="offer-price-until" name="effectiveUntil" type="datetime-local" disabled={disabled} /></div>
      <Button type="submit" disabled={disabled} loading={busy === "price"}>Create reviewed-price draft</Button>
    </form> : null}
    <p role="status">{message}</p>
  </div>;
}
