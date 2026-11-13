"use client";
import { useEffect, useRef, useState } from "react";
import { AddressAutocomplete } from "@/components/maps/AddressAutocomplete";
import type { AddressDto } from "@/lib/maps/google-maps.types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { ParcelPaymentChoice, type ParcelPaymentMethod, type ParcelCodAvailability, type ParcelCardAvailability } from "@/components/forms/ParcelPaymentChoice";
import { parcelBookingDestination, parcelBookingStepHref } from "@/lib/client-platform/parcel-booking-navigation";
import { ParcelBookedNextStep } from "@/components/forms/ParcelBookedNextStep";
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
  personalizedRateApplied?: boolean;
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
  bookingOnly = false,
  reference,
  senderDefaults,
  savedAddresses = [],
  prefill,
  defaultPickup,
}: {
  signedIn?: boolean;
  business?: boolean;
  bookingOnly?: boolean;
  reference?: string;
  senderDefaults?: { name?: string | null; email?: string | null; phone?: string | null };
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
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [parcelCatalogError, setParcelCatalogError] = useState("");
  const [serviceCatalogError, setServiceCatalogError] = useState("");
  const [quote, rawSetQuote] = useState<Quote | null>(null);
  const [methods, setMethods] = useState<{
    quoteId: string;
    items: { mode: string; digitalRequired: string; cashRequired: string }[];
    cod: ParcelCodAvailability;
    card: ParcelCardAvailability;
  } | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<ParcelPaymentMethod>("DIGITAL_ONLY");
  const [methodError, setMethodError] = useState("");
  const [methodRevision, setMethodRevision] = useState(0);
  // The canonical quote may be consumed even if the browser navigation fails.
  // Retain the confirmed next step and never silently submit it again.
  const bookingInFlight = useRef(false);
  const [bookedNextStep, setBookedNextStep] = useState<{ href: string; paymentMethod: ParcelPaymentMethod } | null>(null);
  const setQuote = (next: Quote | null) => {
    rawSetQuote(next);
    setBookedNextStep(null);
    bookingInFlight.current = false;
    setSelectedPaymentMethod("DIGITAL_ONLY");
    setMethods(null);
    setMethodError("");
  };
  useEffect(() => {
    if (!quote || !signedIn) return;
    const controller = new AbortController();
    fetch(`/api/public/delivery-quotes/${quote.id}/payment-methods`, {
      headers: business ? { "X-KT-Workspace": "STORE" } : {},
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw Error(b.error);
        if (!controller.signal.aborted) {
          setMethods({ quoteId: quote.id, items: b.methods, cod: b.cod, card: b.card ?? { eligible: false, message: "Card payment availability could not be verified." } });
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
  }, [quote, signedIn, business, methodRevision]);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickup, setPickup] = useState<Address>(
    prefill?.pickupAddress ?? defaultPickup ?? {},
  );
  const [dropoff, setDropoff] = useState<Address>(
    prefill?.dropoffAddress ?? {},
  );
  useEffect(() => {
    let live = true;
    // A resumed booking has already received its canonical server-priced quote.
    // Do not delay the contact/payment step with an unrelated catalogue fetch.
    const parcelRequest = bookingOnly ? Promise.resolve() : fetch("/api/public/parcel-profiles", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Parcel profiles unavailable.");
        const profiles: unknown = await r.json();
        if (!Array.isArray(profiles)) throw new Error("Invalid parcel profile response.");
        if (live) {
          setParcels(profiles);
          setParcelCatalogError(profiles.length ? "" : "No approved parcel sizes are available. An administrator must activate the Small, Medium and Large operating limits before quotes can be calculated.");
        }
      })
      .catch(() => {
        if (live) {
          setParcels([]);
          setParcelCatalogError("Parcel sizes could not be loaded. Check your connection and refresh availability.");
        }
      });
    const serviceRequest = bookingOnly ? Promise.resolve() : fetch("/api/public/delivery-quotes", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Delivery services unavailable.");
        const items: unknown = await r.json();
        if (!Array.isArray(items)) throw new Error("Invalid delivery service response.");
        if (live) {
          setServices(items);
          setServiceCatalogError(items.length ? "" : "No delivery services are enabled. Please contact KT Couriers to confirm current operations.");
        }
      })
      .catch(() => {
        if (live) {
          setServices([]);
          setServiceCatalogError("Delivery services could not be loaded. Check your connection and refresh availability.");
        }
      });
    void Promise.all([parcelRequest, serviceRequest]).finally(() => {
      if (live) setCatalogLoading(false);
    });
    if (reference)
      fetch(`/api/public/delivery-quotes/${reference}`)
        .then(async (r) => {
          const v = await r.json();
          if (!r.ok) throw Error(v.error);
          if (live) setQuote(v);
        })
        .catch((e) => {
          if (live) setError(e instanceof Error ? e.message : "Could not load this quote.");
        });
    return () => { live = false; };
  }, [reference, catalogRevision, bookingOnly]);
  const address = (f: FormData, p: string, selected: Address) => ({
    line1: String(f.get(`${p}-line1`)),
    ...(selected.line2 ? { line2: selected.line2 } : {}),
    city: String(f.get(`${p}-city`)),
    province: String(f.get(`${p}-province`)),
    ...(f.get(`${p}-postalCode`)
      ? { postalCode: String(f.get(`${p}-postalCode`)) }
      : {}),
    // Google Places confirms this selection on the client; the server
    // resolves the Place ID independently. Never price from browser lat/lng.
    ...(selected.placeId && typeof selected.latitude === "number" && typeof selected.longitude === "number"
      ? { placeId: selected.placeId, latitude: selected.latitude, longitude: selected.longitude }
      : {}),
  });
  async function estimate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setErrorCode("");
    setQuote(null);
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/public/delivery-quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(business ? { "X-KT-Workspace": "STORE" } : {}) },
        body: JSON.stringify({
          serviceKey: f.get("service"),
          parcelSize: f.get("size"),
          weightKg: f.get("weight"),
          pickupAddress: address(f, "pickup", pickup),
          dropoffAddress: address(f, "dropoff", dropoff),
        }),
      });
      const v = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(typeof v.error === "string" ? v.error : "Quote unavailable. Please try again.");
        setErrorCode(typeof v.code === "string" ? v.code : "");
        return;
      }
      setQuote(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quote unavailable.");
      setErrorCode("");
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
                  setError("");
                  setErrorCode("");
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
          onChange={address => { setValue(address ?? {}); setQuote(null); setError(""); setErrorCode(""); }}
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
                setError("");
                setErrorCode("");
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
            setError("");
            setErrorCode("");
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
    <div className={bookingOnly ? "space-y-6" : "space-y-8"}>
      {bookingOnly && !quote && !error && (
        <p role="status" className="rounded-xl border border-[var(--kt-border-strong)] bg-white p-6 text-sm">
          Loading your saved delivery quotation…
        </p>
      )}
      {bookingOnly && error && (
        <Link className="inline-flex rounded-xl border border-[var(--kt-border-strong)] bg-white px-5 py-3 font-semibold underline" href="/quote">
          Get a new delivery quote
        </Link>
      )}
      {error && (
        <div className="space-y-2" aria-live="polite">
          <p role="alert">{error}</p>
          {errorCode === "ADDRESS_UNRESOLVED" && (
            <p role="status" className="text-sm">
              Google Maps locating a pin does not by itself verify delivery eligibility.
              Please select a specific building or entrance and confirm the map pin.
              If the location is correct, <Link href="/contact" className="underline">contact operations</Link> for assistance.
            </p>
          )}
          {errorCode === "COVERAGE_UNAVAILABLE" || errorCode === "COVERAGE_DISTANCE_EXCEEDED" ? (
            <p className="text-sm">
              Route availability is confirmed against active operating areas and capacity. Check <Link className="underline" href="/coverage-areas">current coverage</Link> or <Link className="underline" href="/contact">contact operations</Link> to verify this route.
            </p>
          ) : null}
        </div>
      )}
      {catalogLoading && <p id="quote-configuration-status" role="status">Loading delivery services and parcel limits…</p>}
      {!bookingOnly && <form onSubmit={estimate} className="space-y-6" aria-busy={busy || catalogLoading}>
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
              disabled={catalogLoading || services.length === 0}
              aria-describedby={serviceCatalogError ? "quote-service-status" : undefined}
              onChange={() => { setQuote(null); setError(""); setErrorCode(""); }}
            >
              {services.length === 0 && <option value="">{catalogLoading ? "Loading services…" : "No delivery services available"}</option>}
              {services.map((s) => (
                <option key={s.stableKey} value={s.stableKey}>
                  {s.displayName} · {s.turnaround}
                </option>
              ))}
            </select>
            {serviceCatalogError && <p id="quote-service-status" role="status" className="mt-2 text-sm">{serviceCatalogError}</p>}
          </div>
          <div>
            <Label htmlFor="quote-size">Parcel size</Label>
            <select
              id="quote-size"
              name="size"
              className="w-full border-b py-3"
              required
              disabled={catalogLoading || parcels.length === 0}
              aria-describedby={parcelCatalogError ? "quote-size-status" : "quote-parcel-limits"}
              value={selectedParcel?.stableKey ?? ""}
              onChange={(e) => { setParcelKey(e.target.value); setQuote(null); setError(""); setErrorCode(""); }}
            >
              {parcels.length === 0 && <option value="">{catalogLoading ? "Loading parcel sizes…" : "No approved parcel sizes available"}</option>}
              {parcels.map((s) => (
                <option key={s.id} value={s.stableKey}>
                  {s.displayName} · max {s.maximumWeightKg} kg
                </option>
              ))}
            </select>
            {parcelCatalogError && <p id="quote-size-status" role="status" className="mt-2 text-sm">{parcelCatalogError}</p>}
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
              disabled={catalogLoading || parcels.length === 0}
              aria-describedby={selectedParcel ? "quote-parcel-limits" : undefined}
              onChange={() => { setQuote(null); setError(""); setErrorCode(""); }}
            />
          </div>
        </div>
        {selectedParcel && <p id="quote-parcel-limits" role="status" className="text-sm">
          {selectedParcel.displayName} limits: {selectedParcel.lengthCm} × {selectedParcel.widthCm} × {selectedParcel.heightCm} cm; maximum {selectedParcel.maximumWeightKg} kg.
        </p>}
        {(parcelCatalogError || serviceCatalogError) && (
          <div className="space-y-2" role="status">
            <p className="text-sm">Delivery pricing is temporarily unavailable until the required operating configuration is active.</p>
            <Button type="button" variant="secondary" disabled={catalogLoading} onClick={() => {
              setCatalogLoading(true);
              setParcelCatalogError("");
              setServiceCatalogError("");
              setCatalogRevision((revision) => revision + 1);
            }}>
              Refresh delivery options
            </Button>
            <p className="text-sm">For help, contact <a className="underline" href="mailto:support@ktcouriers.com">support@ktcouriers.com</a>.</p>
          </div>
        )}
        <Button
          type="submit"
          loading={busy}
          disabled={busy || catalogLoading || !services.length || !parcels.length}
          className="bg-[var(--kt-public-interactive-active)]"
        >
          Calculate delivery price
        </Button>
      </form>}
      {quote && (
        <section className={bookingOnly
          ? "space-y-6 rounded-2xl border border-[var(--kt-border-strong)] bg-white p-5 shadow-sm sm:p-8"
          : "space-y-5 border-t pt-6"} aria-live="polite">
          <h2 className="text-2xl font-semibold text-[var(--kt-brand-navy)]">
            R{quote.total} · {quote.serviceName}
          </h2>
          <p>
            {quote.pickupSummary} → {quote.dropoffSummary}
          </p>
          <p>
            {quote.turnaround} · {quote.parcelSize.toLowerCase()} parcel
          </p>
          {quote.personalizedRateApplied && <p role="status" className="text-sm font-semibold">Your account-specific KT Couriers delivery rate has been applied.</p>}
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
            Choose online payment or a cash-on-delivery option only when your store, service and area are independently approved.
          </p>
          {bookingOnly && signedIn ? (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (bookingInFlight.current || bookedNextStep) return;
                const f = new FormData(e.currentTarget);
                // Server revalidates the COD policy at booking; guard against stale client options too.
                if (selectedPaymentMethod !== "DIGITAL_ONLY" &&
                    !(methods?.quoteId === quote?.id && methods.items.some(item => item.mode === selectedPaymentMethod) && methods.cod.eligible)) {
                  setError("This cash payment split is not approved for this delivery. Choose online payment or refresh availability.");
                  return;
                }
                bookingInFlight.current = true;
                setBusy(true);
                setError("");
                let bookingCommitted = false;
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
                        pickupContactEmail: f.get("pickupContactEmail"),
                        recipientName: f.get("recipientName"),
                        recipientPhone: f.get("recipientPhone"),
                        recipientEmail: f.get("recipientEmail"),
                        parcelDescription: f.get("parcelDescription"),
                        paymentMethod: selectedPaymentMethod,
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
                  // Booking is committed. A failed client-side route transition must
                  // not strand the payer with a USED quote and a live submit button.
                  const destination = parcelBookingDestination({
                    business,
                    paymentMethod: selectedPaymentMethod,
                    orderId: v.id,
                    orderNumber: v.orderNumber,
                  });
                  bookingCommitted = true;
                  setBookedNextStep({ href: destination, paymentMethod: selectedPaymentMethod });
                  router.push(destination);
                } catch (e) {
                  setError(bookingCommitted
                    ? "Your delivery was booked, but automatic navigation did not complete. Use the secure continuation link below."
                    : e instanceof Error ? e.message : "Booking unavailable.");
                } finally {
                  if (!bookingCommitted) bookingInFlight.current = false;
                  setBusy(false);
                }
              }}
            >
              {(
                [
                  ["pickupContactName", "Sender name", pickup.contactName ?? senderDefaults?.name],
                  ["pickupContactPhone", "Sender phone", pickup.contactPhone ?? senderDefaults?.phone],
                  ["pickupContactEmail", "Sender email for pickup code", senderDefaults?.email],
                  ["recipientName", "Recipient name", prefill?.recipientName],
                  ["recipientEmail", "Recipient email for delivery code", prefill?.recipientEmail],
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
                    type={key.endsWith("Email") ? "email" : key.endsWith("Phone") ? "tel" : "text"}
                    minLength={key.endsWith("Phone") ? 7 : 2}
                    maxLength={key.endsWith("Email") ? 254 : key.endsWith("Phone") ? 30 : 150}
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
              <ParcelPaymentChoice
                total={quote.total}
                value={selectedPaymentMethod}
                onChange={setSelectedPaymentMethod}
                cod={methods?.quoteId === quote.id ? methods.cod : null}
                card={methods?.quoteId === quote.id ? methods.card : { eligible: false, message: "Checking Paystack availability." }}
                authorizedMethods={methods?.quoteId === quote.id ? methods.items : []}
                loading={methods?.quoteId !== quote.id && !methodError}
                error={methodError}
              />
              {methodError && <div className="sm:col-span-2">
                <Button type="button" variant="secondary" disabled={busy} onClick={() => { setMethodError(""); setMethodRevision((n) => n + 1); }}>
                  Retry payment methods
                </Button>
              </div>}
              <Button type="submit" loading={busy} disabled={busy || Boolean(bookedNextStep) ||
                  methods?.quoteId !== quote.id ||
                  (selectedPaymentMethod === "DIGITAL_ONLY"
                    ? methods.card.eligible !== true
                    : !methods.items.some(method => method.mode === selectedPaymentMethod))}
                className="sm:col-span-2 sm:justify-self-start sm:min-w-64">
                {bookedNextStep ? "Delivery booked" : selectedPaymentMethod === "DIGITAL_ONLY" ? "Book and continue to card payment" : "Book this delivery"}
              </Button>
              {bookedNextStep && <ParcelBookedNextStep href={bookedNextStep.href} paymentMethod={bookedNextStep.paymentMethod} />}
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {signedIn ? (
                <Button href={parcelBookingStepHref(quote.id, business)}>
                  Continue to delivery details
                </Button>
              ) : (
                <>
                  <Button href={`/login?returnUrl=${encodeURIComponent(parcelBookingStepHref(quote.id, business))}`}>
                    Sign in to book
                  </Button>
                  <Link className="rounded-xl border border-[var(--kt-border-strong)] px-5 py-3 text-sm font-semibold underline underline-offset-4" href={`/signup?role=customer&returnUrl=${encodeURIComponent(parcelBookingStepHref(quote.id, business))}`}>
                    Create an account to book
                  </Link>
                </>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
