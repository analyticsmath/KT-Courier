"use client";
import { useEffect, useState } from "react";
import { AddressAutocomplete } from "@/components/maps/AddressAutocomplete";
import type { AddressDto } from "@/lib/maps/google-maps.types";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import {
  PROVINCES,
  type DeliveryConfiguration,
} from "@/lib/client-platform/contracts";
import type { SavedAddressDto } from "@/lib/services/customer-addresses.service";
import type {
  RepeatDeliveryPrefillDto,
  RepeatDeliveryAddressPrefill,
} from "@/lib/services/orders.service";
type Address = {
  [K in keyof Omit<RepeatDeliveryAddressPrefill, "formattedAddress">]?:
    | RepeatDeliveryAddressPrefill[K]
    | null;
} & { formattedAddress?: string | null };
type Quote = {
  id: string;
  total: string;
  currency: string;
  serviceName: string;
  turnaround: string;
  parcelSize: string;
  expiresAt: string;
  pickupSummary: string;
  dropoffSummary: string;
  lineItems: { code: string; label: string; amount: string }[];
};
export function PublicDeliveryQuoteForm({
  signedIn = false,
  business = false,
  reference,
  savedAddresses = [],
  prefill,
  defaultPickup,
}: {
  signedIn?: boolean;
  business?: boolean;
  reference?: string;
  savedAddresses?: SavedAddressDto[];
  prefill?: RepeatDeliveryPrefillDto | null;
  defaultPickup?: Address;
}) {
  const router = useRouter();
  const [services, setServices] = useState<DeliveryConfiguration[]>([]);
  const [parcels, setParcels] = useState<{ id: string; stableKey: string; displayName: string; lengthCm: number; widthCm: number; heightCm: number; maximumWeightKg: number }[]>([]);
  const [parcelKey, setParcelKey] = useState("");
  const selectedParcel = parcels.find((p) => p.stableKey === parcelKey) ?? parcels[0];
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [methods, setMethods] = useState<{
    quoteId: string;
    items: { mode: string; digitalRequired: string; cashRequired: string }[];
  } | null>(null);
  const [methodError, setMethodError] = useState("");
  useEffect(() => {
    if (!quote || !signedIn) return;
    const controller = new AbortController();
    fetch(`/api/public/delivery-quotes/${quote.id}/payment-methods`, {
      headers: business ? { "X-KT-Workspace": "STORE" } : {},
      signal: controller.signal,
    })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw Error(b.error);
        if (!controller.signal.aborted) {
          setMethods({ quoteId: quote.id, items: b.methods });
          setMethodError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setMethodError(
            e instanceof Error ? e.message : "Payment methods unavailable.",
          );
      });
    return () => controller.abort();
  }, [quote, signedIn, business]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickup, setPickup] = useState<Address>(
    prefill?.pickupAddress ?? defaultPickup ?? {},
  );
  const [dropoff, setDropoff] = useState<Address>(
    prefill?.dropoffAddress ?? {},
  );
  useEffect(() => {
    let live = true;
    const parcelRequest = fetch("/api/public/parcel-profiles").then(async (r) => {
      if (!r.ok) throw new Error("Parcel profiles unavailable.");
      const profiles = await r.json();
      if (live) { setParcels(profiles); if (!profiles.length) setError("Parcel acceptance limits await operational approval. Please contact support."); }
    }).catch(() => { if (live) setError("Parcel profiles could not be loaded. Please retry."); });
    const serviceRequest = fetch("/api/public/delivery-quotes")
      .then(async (r) => {
        const v = await r.json();
        if (!r.ok) throw new Error(v.error);
        if (live) {
          setServices(v);
          if (!v.length) setError("Delivery services await operational configuration. Please contact support.");
        }
      })
      .catch(() => {
        if (live)
          setError("Delivery services could not be loaded. Please retry.");
      });
    void Promise.all([parcelRequest, serviceRequest]).finally(() => { if (live) setCatalogLoading(false); });
    if (reference)
      fetch(`/api/public/delivery-quotes/${reference}`)
        .then(async (r) => {
          const v = await r.json();
          if (!r.ok) throw new Error(v.error);
          if (live) setQuote(v);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    return () => {
      live = false;
    };
  }, [reference]);
  const address = (f: FormData, p: string) => ({
    line1: String(f.get(`${p}-line1`)),
    city: String(f.get(`${p}-city`)),
    province: String(f.get(`${p}-province`)),
    ...(f.get(`${p}-postalCode`)
      ? { postalCode: String(f.get(`${p}-postalCode`)) }
      : {}),
  });
  async function estimate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setQuote(null);
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/public/delivery-quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceKey: f.get("service"),
          parcelSize: f.get("size"),
          weightKg: f.get("weight"),
          pickupAddress: address(f, "pickup"),
          dropoffAddress: address(f, "dropoff"),
        }),
      });
      const v = await r.json();
      if (!r.ok) throw new Error(v.error);
      setQuote(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quote unavailable.");
    } finally {
      setBusy(false);
    }
  }
  function addressFields(
    prefix: string,
    title: string,
    value: Address,
    setValue: (v: Address) => void,
  ) {
    return (
      <fieldset className="space-y-4">
        <legend className="mb-4 font-semibold">{title}</legend>
        {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY && <p className="text-sm">Map suggestions are unavailable. Enter address details; pricing requires the server to confirm both locations.</p>}
        {savedAddresses.length > 0 && (
          <>
            <Label htmlFor={`${prefix}-saved`}>Use a saved address</Label>
            <select
              id={`${prefix}-saved`}
              className="w-full border-b py-3"
              defaultValue=""
              onChange={(e) => {
                const a = savedAddresses.find((a) => a.id === e.target.value);
                if (a) {
                  setValue(a);
                  setQuote(null);
                }
              }}
            >
              <option value="">Enter an address</option>
              {savedAddresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label ?? a.line1}
                </option>
              ))}
            </select>
          </>
        )}
        {process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY && <AddressAutocomplete
          id={`${prefix}-mapped-address`} label={`Find ${title.toLowerCase()}`}
          showContactFields={false} showNotesField={false}
          value={value.line1 ? { formattedAddress: value.formattedAddress ?? value.line1, placeId: value.placeId ?? null, line1: value.line1, line2: value.line2 ?? null, city: value.city ?? null, province: value.province ?? null, postalCode: value.postalCode ?? null, country: value.country ?? "South Africa", latitude: value.latitude ?? null, longitude: value.longitude ?? null } as AddressDto : null}
          onChange={address => { setValue(address ?? {}); setQuote(null); }}
        />}
        {(
          [
            ["line1", "Street address"],
            ["city", "City"],
            ["postalCode", "Postal code"],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <Label htmlFor={`${prefix}-${key}`}>{label}</Label>
            <Input
              id={`${prefix}-${key}`}
              name={`${prefix}-${key}`}
              value={value[key] ?? ""}
              required={key !== "postalCode"}
              maxLength={key === "line1" ? 250 : 100}
              onChange={(e) => {
                setValue({ ...value, [key]: e.target.value, latitude: null, longitude: null, placeId: null, formattedAddress: null });
                setQuote(null);
              }}
            />
          </div>
        ))}
        <Label htmlFor={`${prefix}-province`}>Province</Label>
        <select
          id={`${prefix}-province`}
          name={`${prefix}-province`}
          className="w-full border-b py-3"
          value={value.province ?? ""}
          required
          onChange={(e) => {
            setValue({ ...value, province: e.target.value, latitude: null, longitude: null, placeId: null, formattedAddress: null });
            setQuote(null);
          }}
        >
          <option value="">Select province</option>
          {PROVINCES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </fieldset>
    );
  }
  return (
    <div className="space-y-8">
      {error && <p role="alert">{error}</p>}
      {catalogLoading && <p id="quote-configuration-status" role="status">Loading delivery services and parcel limits…</p>}
      <form onSubmit={estimate} className="space-y-6" aria-busy={busy || catalogLoading}>
        <div className="grid gap-8 md:grid-cols-2">
          {addressFields("pickup", "Collection address", pickup, setPickup)}
          {addressFields("dropoff", "Delivery address", dropoff, setDropoff)}
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <Label htmlFor="quote-service">Delivery service</Label>
            <select
              id="quote-service"
              name="service"
              className="w-full border-b py-3"
              required
              onChange={() => setQuote(null)}
            >
              {services.map((s) => (
                <option key={s.stableKey} value={s.stableKey}>
                  {s.displayName} · {s.turnaround}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="quote-size">Parcel size</Label>
            <select
              id="quote-size"
              name="size"
              className="w-full border-b py-3"
              required
              value={selectedParcel?.stableKey ?? ""}
              onChange={(e) => { setParcelKey(e.target.value); setQuote(null); }}
            >
              {parcels.map((s) => (
                <option key={s.id} value={s.stableKey}>
                  {s.displayName} · max {s.maximumWeightKg} kg
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="quote-weight">Weight (kg)</Label>
            <Input
              id="quote-weight"
              name="weight"
              type="number"
              min="0.0001"
              max={selectedParcel?.maximumWeightKg}
              step="0.0001"
              required
              aria-describedby={selectedParcel ? "quote-parcel-limits" : undefined}
              onChange={() => setQuote(null)}
            />
          </div>
        </div>
        {selectedParcel && <p id="quote-parcel-limits" role="status" className="text-sm">
          {selectedParcel.displayName} limits: {selectedParcel.lengthCm} × {selectedParcel.widthCm} × {selectedParcel.heightCm} cm; maximum {selectedParcel.maximumWeightKg} kg.
        </p>}
        <Button type="submit" loading={busy} disabled={!services.length || !parcels.length}>
          Calculate delivery price
        </Button>
      </form>
      {quote && (
        <section className="space-y-5 border-t pt-6" aria-live="polite">
          <h2 className="text-2xl">
            R{quote.total} · {quote.serviceName}
          </h2>
          <p>
            {quote.pickupSummary} → {quote.dropoffSummary}
          </p>
          <p>
            {quote.turnaround} · {quote.parcelSize.toLowerCase()} parcel
          </p>
          <dl>
            {quote.lineItems.map((i) => (
              <div key={i.code} className="flex justify-between gap-4">
                <dt>{i.label}</dt>
                <dd>R{i.amount}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm">
            Quote valid until {new Date(quote.expiresAt).toLocaleString()}.
            Final payment is completed after sign-in.
          </p>
          {signedIn ? (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setBusy(true);
                setError("");
                try {
                  const scheduled = f.get("scheduledFor");
                  const r = await fetch(
                    `/api/public/delivery-quotes/${quote.id}/book`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        ...(business ? { "X-KT-Workspace": "STORE" } : {}),
                      },
                      body: JSON.stringify({
                        pickupContactName: f.get("pickupContactName"),
                        pickupContactPhone: f.get("pickupContactPhone"),
                        recipientName: f.get("recipientName"),
                        recipientPhone: f.get("recipientPhone"),
                        parcelDescription: f.get("parcelDescription"),
                        paymentMethod: f.get("paymentMethod") || "DIGITAL_ONLY",
                        ...(scheduled
                          ? {
                              scheduledFor: new Date(
                                String(scheduled),
                              ).toISOString(),
                            }
                          : {}),
                      }),
                    },
                  );
                  const v = await r.json();
                  if (!r.ok) throw new Error(v.error);
                  router.push(
                    `${business ? "/store" : "/account"}/orders/${v.id}`,
                  );
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Booking unavailable.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {(
                [
                  ["pickupContactName", "Sender name", pickup.contactName],
                  ["pickupContactPhone", "Sender phone", pickup.contactPhone],
                  ["recipientName", "Recipient name", prefill?.recipientName],
                  [
                    "recipientPhone",
                    "Recipient phone",
                    prefill?.recipientPhone,
                  ],
                ] as const
              ).map(([key, label, value]) => (
                <div key={key}>
                  <Label htmlFor={`booking-${key}`}>{label}</Label>
                  <Input
                    id={`booking-${key}`}
                    name={key}
                    required
                    minLength={key.endsWith("Phone") ? 7 : 2}
                    maxLength={key.endsWith("Phone") ? 30 : 150}
                    defaultValue={value ?? ""}
                  />
                </div>
              ))}
              <div>
                <Label htmlFor="parcelDescription">Parcel description</Label>
                <Input
                  id="parcelDescription"
                  name="parcelDescription"
                  maxLength={500}
                  defaultValue={prefill?.parcelDescription ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="scheduledFor">
                  Future collection (optional)
                </Label>
                <Input
                  id="scheduledFor"
                  name="scheduledFor"
                  type="datetime-local"
                />
                <p className="text-sm">
                  Scheduling keeps this service&apos;s quoted tariff.
                </p>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="booking-payment-method">Payment method</Label>
                <select
                  id="booking-payment-method"
                  name="paymentMethod"
                  className="w-full min-h-12 border-b"
                  defaultValue="DIGITAL_ONLY"
                >
                  <option value="DIGITAL_ONLY">
                    Full online payment · R {quote.total}
                  </option>
                  {(methods?.quoteId === quote.id ? methods.items : [])
                    .filter((m) => m.mode !== "DIGITAL_ONLY")
                    .map((m) => (
                      <option key={m.mode} value={m.mode}>
                        Online R {m.digitalRequired} + cash R {m.cashRequired}
                      </option>
                    ))}
                </select>
                {methodError && (
                  <p role="alert" className="text-sm">
                    {methodError}
                  </p>
                )}
              </div>
              <Button type="submit" loading={busy}>
                Book this delivery
              </Button>
            </form>
          ) : (
            <Button
              href={`/login?returnUrl=${encodeURIComponent(`/quote?reference=${quote.id}`)}`}
            >
              Sign in to book
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
