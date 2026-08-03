"use client";

import { useState, useCallback, useRef } from "react";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { AddressAutocomplete, type AddressAutocompleteValue } from "@/components/maps/AddressAutocomplete";
import { RoutePreviewCard } from "@/components/maps/RoutePreviewCard";
import type { SavedAddressDto } from "@/lib/services/customer-addresses.service";

// ─── Constants ────────────────────────────────────────────────────────────────

const DELIVERY_TYPES = [
  { value: "SAME_DAY", label: "Same-day delivery", description: "Delivered within hours today" },
  { value: "SCHEDULED", label: "Scheduled delivery", description: "Pick a future date and time" },
  { value: "BUSINESS", label: "Business courier", description: "Priority business deliveries" },
  { value: "PARCEL_DOCUMENT", label: "Parcel / document", description: "Documents and small parcels" },
] as const;

const STEPS = ["Delivery type", "Pickup", "Dropoff", "Parcel & schedule", "Review"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParcelFields {
  parcelCount: string;
  parcelDescription: string;
  scheduledFor: string;
  customerNote: string;
}

interface PriceQuote {
  id: string;
  total: string;
  currency: string;
  expiresAt: string;
  subtotal: string;
  taxAmount: string;
  lineItems: Array<{ code: string; label: string; amount: string }>;
}

interface RouteEstimate {
  distanceMeters: number;
  durationSeconds: number;
  routeSummary: string;
}

export interface DefaultPickupAddress {
  contactName?: string;
  contactPhone?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
  accessNotes?: string;
  formattedAddress?: string | null;
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DeliveryAddressPrefill extends AddressAutocompleteValue {
  contactName?: string | null;
  contactPhone?: string | null;
  accessNotes?: string | null;
}

export interface RepeatDeliveryPrefill {
  sourceOrderNumber: string;
  deliveryType: string;
  pickupAddress: DeliveryAddressPrefill | null;
  dropoffAddress: DeliveryAddressPrefill | null;
  recipientName: string;
  recipientPhone: string;
  parcelCount: number;
  parcelDescription: string;
  customerNote: string;
}

interface DeliveryRequestFormProps {
  defaultPickupAddress?: DefaultPickupAddress;
  savedAddresses?: SavedAddressDto[];
  repeatPrefill?: RepeatDeliveryPrefill | null;
  ordersHref?: string;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <nav aria-label="Form steps">
      <ol className="flex items-center gap-2 flex-wrap">
        {steps.map((step, index) => (
          <li key={index} className="flex items-center gap-2">
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0 ${
                index < current
                  ? "bg-[--kt-brand-blue] text-white"
                  : index === current
                  ? "border-2 border-[--kt-brand-blue] text-[--kt-brand-blue]"
                  : "border-2 border-[--kt-border] text-[--kt-text-muted]"
              }`}
              aria-current={index === current ? "step" : undefined}
            >
              {index < current ? (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                index + 1
              )}
            </span>
            <span
              className={`text-sm font-medium hidden sm:block ${
                index === current ? "text-[--kt-text]" : "text-[--kt-text-muted]"
              }`}
            >
              {step}
            </span>
            {index < steps.length - 1 && (
              <span className="w-4 h-px bg-[--kt-border] hidden sm:block" aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ─── Field error helper ───────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

// ─── Review row ───────────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-2 border-b border-[--kt-border] last:border-0">
      <span className="text-xs font-semibold text-[--kt-text-muted] w-28 flex-shrink-0 pt-0.5 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-[--kt-text]">{value}</span>
    </div>
  );
}

// ─── Contact fields for dropoff ───────────────────────────────────────────────

function RecipientFields({
  recipientName,
  recipientPhone,
  onNameChange,
  onPhoneChange,
  nameError,
  phoneError,
}: {
  recipientName: string;
  recipientPhone: string;
  onNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  nameError?: string;
  phoneError?: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <Label htmlFor="recipient_name" required>Recipient name</Label>
        <Input
          id="recipient_name"
          placeholder="Full name"
          value={recipientName}
          onChange={(e) => onNameChange(e.target.value)}
          aria-invalid={!!nameError}
        />
        {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
      </div>
      <div>
        <Label htmlFor="recipient_phone" required>Recipient phone</Label>
        <Input
          id="recipient_phone"
          type="tel"
          placeholder="e.g. 082 000 0000"
          value={recipientPhone}
          onChange={(e) => onPhoneChange(e.target.value)}
          aria-invalid={!!phoneError}
        />
        {phoneError && <p className="mt-1 text-xs text-red-600">{phoneError}</p>}
      </div>
    </div>
  );
}

function defaultPickupToValue(address?: DefaultPickupAddress): AddressAutocompleteValue | null {
  if (!address?.line1) return null;
  return {
    formattedAddress:
      address.formattedAddress ??
      [address.line1, address.city, address.province, address.postalCode, address.country ?? "South Africa"]
        .filter(Boolean)
        .join(", "),
    placeId: address.placeId ?? null,
    line1: address.line1,
    line2: address.line2 ?? null,
    city: address.city ?? null,
    province: address.province ?? null,
    postalCode: address.postalCode ?? null,
    country: address.country ?? "South Africa",
    latitude: address.latitude ?? null,
    longitude: address.longitude ?? null,
  };
}

function savedAddressToValue(address: SavedAddressDto): AddressAutocompleteValue {
  return {
    formattedAddress:
      address.formattedAddress ??
      [address.line1, address.city, address.province, address.postalCode, address.country]
        .filter(Boolean)
        .join(", "),
    placeId: address.placeId,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    province: address.province,
    postalCode: address.postalCode,
    country: address.country,
    latitude: address.latitude,
    longitude: address.longitude,
  };
}

function SavedAddressSelect({
  addresses,
  target,
  onSelect,
}: {
  addresses: SavedAddressDto[];
  target: "pickup" | "dropoff";
  onSelect: (address: SavedAddressDto) => void;
}) {
  const filtered = addresses.filter((address) => {
    if (target === "pickup") return address.type === "PICKUP" || address.type === "CUSTOMER";
    return address.type === "DROPOFF" || address.type === "CUSTOMER";
  });

  if (filtered.length === 0) return null;

  return (
    <div>
      <Label htmlFor={`saved_${target}_address`}>Use saved address</Label>
      <select
        id={`saved_${target}_address`}
        defaultValue=""
        onChange={(event) => {
          const selected = filtered.find((address) => address.id === event.target.value);
          if (selected) onSelect(selected);
        }}
        className="w-full h-11 px-3 rounded-xl border border-[var(--kt-border)] bg-white text-sm text-[var(--kt-text)] focus:border-[var(--kt-brand-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--kt-brand-blue)]/20"
      >
        <option value="">Choose from saved addresses</option>
        {filtered
          .slice()
          .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
          .map((address) => (
            <option key={address.id} value={address.id}>
              {address.label ?? address.line1}{address.isDefault ? " (default)" : ""}
            </option>
          ))}
      </select>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DeliveryRequestForm({
  defaultPickupAddress,
  savedAddresses = [],
  repeatPrefill,
  ordersHref = "/account/orders",
}: DeliveryRequestFormProps) {
  const [step, setStep] = useState(0);
  const [deliveryType, setDeliveryType] = useState(repeatPrefill?.deliveryType ?? "");

  const [pickupAddress, setPickupAddress] = useState<AddressAutocompleteValue | null>(
    repeatPrefill?.pickupAddress ?? defaultPickupToValue(defaultPickupAddress)
  );
  const [pickupContactName, setPickupContactName] = useState(
    repeatPrefill?.pickupAddress?.contactName ?? defaultPickupAddress?.contactName ?? ""
  );
  const [pickupContactPhone, setPickupContactPhone] = useState(
    repeatPrefill?.pickupAddress?.contactPhone ?? defaultPickupAddress?.contactPhone ?? ""
  );
  const [pickupAccessNotes, setPickupAccessNotes] = useState(
    repeatPrefill?.pickupAddress?.accessNotes ?? defaultPickupAddress?.accessNotes ?? ""
  );

  const [dropoffAddress, setDropoffAddress] = useState<AddressAutocompleteValue | null>(
    repeatPrefill?.dropoffAddress ?? null
  );
  const [recipientName, setRecipientName] = useState(repeatPrefill?.recipientName ?? "");
  const [recipientPhone, setRecipientPhone] = useState(repeatPrefill?.recipientPhone ?? "");
  const [dropoffAccessNotes, setDropoffAccessNotes] = useState(
    repeatPrefill?.dropoffAddress?.accessNotes ?? ""
  );

  const [parcel, setParcel] = useState<ParcelFields>({
    parcelCount: repeatPrefill?.parcelCount ? String(repeatPrefill.parcelCount) : "1",
    parcelDescription: repeatPrefill?.parcelDescription ?? "",
    scheduledFor: "",
    customerNote: repeatPrefill?.customerNote ?? "",
  });

  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [routeEstimate, setRouteEstimate] = useState<RouteEstimate | null>(null);
  const [routeCalculating, setRouteCalculating] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successOrderNumber, setSuccessOrderNumber] = useState<string | null>(null);
  const quoteRequestRef = useRef(0);

  const fetchQuote = useCallback(async () => {
    if (!deliveryType || !pickupAddress || !dropoffAddress) return;
    if (
      typeof pickupAddress.latitude !== "number" || typeof pickupAddress.longitude !== "number" ||
      typeof dropoffAddress.latitude !== "number" || typeof dropoffAddress.longitude !== "number"
    ) {
      setQuote(null);
      setFormError("A confirmed mapped pickup and destination are required before a delivery quote can be generated.");
      return;
    }
    setEstimating(true);
    setQuote(null);
    const requestId = ++quoteRequestRef.current;
    try {
      const res = await fetch("/api/pricing/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryType,
          pickupAddress: { line1: pickupAddress.line1, city: pickupAddress.city ?? undefined, province: pickupAddress.province ?? undefined, country: pickupAddress.country, latitude: pickupAddress.latitude ?? undefined, longitude: pickupAddress.longitude ?? undefined },
          dropoffAddress: { line1: dropoffAddress.line1, city: dropoffAddress.city ?? undefined, province: dropoffAddress.province ?? undefined, country: dropoffAddress.country, latitude: dropoffAddress.latitude ?? undefined, longitude: dropoffAddress.longitude ?? undefined },
        }),
      });
      const data = await res.json() as PriceQuote & { error?: string };
      if (requestId !== quoteRequestRef.current) return;
      if (!data.error && data.id && data.total) {
        setQuote(data);
      } else if (data.error) {
        setFormError(data.error);
      }
    } catch {
      if (requestId === quoteRequestRef.current) setFormError("Pricing is temporarily unavailable. Please retry.");
    } finally {
      setEstimating(false);
    }
  }, [deliveryType, pickupAddress, dropoffAddress]);

  const fetchRouteEstimate = useCallback(async (
    pickup: AddressAutocompleteValue | null,
    dropoff: AddressAutocompleteValue | null
  ) => {
    if (
      typeof pickup?.latitude !== "number" || typeof pickup?.longitude !== "number" ||
      typeof dropoff?.latitude !== "number" || typeof dropoff?.longitude !== "number"
    ) {
      setRouteEstimate(null);
      return;
    }

    setRouteCalculating(true);
    setRouteEstimate(null);
    try {
      const res = await fetch("/api/maps/route-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupLat: pickup.latitude,
          pickupLng: pickup.longitude,
          dropoffLat: dropoff.latitude,
          dropoffLng: dropoff.longitude,
        }),
      });
      const data = await res.json() as {
        available?: boolean;
        distanceMeters?: number;
        durationSeconds?: number;
        routeSummary?: string;
      };
      if (data.available && data.distanceMeters) {
        setRouteEstimate({
          distanceMeters: data.distanceMeters,
          durationSeconds: data.durationSeconds ?? 0,
          routeSummary: data.routeSummary ?? "",
        });
      }
    } catch {
      // non-blocking
    } finally {
      setRouteCalculating(false);
    }
  }, []);

  function goNext() {
    setFormError(null);
    setFieldErrors({});
    const next = step + 1;
    setStep(next);
    if (next === STEPS.length - 1) {
      fetchQuote();
      fetchRouteEstimate(pickupAddress, dropoffAddress);
    }
  }

  function goBack() {
    setFormError(null);
    setFieldErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  function canContinue(): boolean {
    if (step === 0) return deliveryType !== "";
    if (step === 1) {
      return (pickupAddress?.line1?.trim().length ?? 0) >= 3;
    }
    if (step === 2) {
      return (
        (dropoffAddress?.line1?.trim().length ?? 0) >= 3 &&
        recipientName.trim().length >= 2 &&
        recipientPhone.trim().length >= 7
      );
    }
    return true;
  }

  async function handleSubmit() {
    if (!quote) {
      setFormError("Please wait for a valid delivery quote before submitting.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const body = {
        pricingQuoteId: quote.id,
        deliveryType,
        pickupAddress: {
          contactName: pickupContactName.trim() || undefined,
          contactPhone: pickupContactPhone.trim() || undefined,
          line1: pickupAddress?.line1?.trim() ?? "",
          line2: pickupAddress?.line2 ?? undefined,
          city: pickupAddress?.city ?? undefined,
          province: pickupAddress?.province ?? undefined,
          postalCode: pickupAddress?.postalCode ?? undefined,
          country: pickupAddress?.country ?? "South Africa",
          accessNotes: pickupAccessNotes.trim() || undefined,
          formattedAddress: pickupAddress?.formattedAddress ?? undefined,
          placeId: pickupAddress?.placeId ?? undefined,
          latitude: pickupAddress?.latitude ?? undefined,
          longitude: pickupAddress?.longitude ?? undefined,
        },
        dropoffAddress: {
          contactName: recipientName.trim() || undefined,
          contactPhone: recipientPhone.trim() || undefined,
          line1: dropoffAddress?.line1?.trim() ?? "",
          line2: dropoffAddress?.line2 ?? undefined,
          city: dropoffAddress?.city ?? undefined,
          province: dropoffAddress?.province ?? undefined,
          postalCode: dropoffAddress?.postalCode ?? undefined,
          country: dropoffAddress?.country ?? "South Africa",
          accessNotes: dropoffAccessNotes.trim() || undefined,
          formattedAddress: dropoffAddress?.formattedAddress ?? undefined,
          placeId: dropoffAddress?.placeId ?? undefined,
          latitude: dropoffAddress?.latitude ?? undefined,
          longitude: dropoffAddress?.longitude ?? undefined,
        },
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        parcelCount: Math.max(1, parseInt(parcel.parcelCount) || 1),
        parcelDescription: parcel.parcelDescription.trim() || undefined,
        scheduledFor: parcel.scheduledFor
          ? new Date(parcel.scheduledFor).toISOString()
          : undefined,
        customerNote: parcel.customerNote.trim() || undefined,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json() as { orderNumber?: string; error?: string; fields?: Record<string, string> };

      if (data.error) {
        setFormError(data.error);
        if (data.fields) setFieldErrors(data.fields);
        return;
      }

      if (data.orderNumber) {
        setSuccessOrderNumber(data.orderNumber);
      }
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ────────────────────────────────────────────────────────────

  if (successOrderNumber) {
    return (
      <Card className="text-center py-12">
        <div className="w-14 h-14 rounded-2xl bg-[--kt-green-soft] flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-[--kt-green]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[--kt-text] mb-1">Delivery request submitted</h2>
        <p className="text-sm text-[--kt-text-muted] mb-1">Your order number is</p>
        <p className="text-lg font-mono font-bold text-[--kt-brand-blue] mb-6">{successOrderNumber}</p>
        <p className="text-sm text-[--kt-text-muted] mb-6 max-w-xs mx-auto">
          We&apos;ll confirm your delivery shortly. You can track status updates from your orders page.
        </p>
        <Button href={ordersHref} variant="secondary" size="sm">
          View orders
        </Button>
      </Card>
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const deliveryTypeLabel = DELIVERY_TYPES.find((d) => d.value === deliveryType)?.label ?? deliveryType;
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      {repeatPrefill && (
        <div className="rounded-2xl bg-[var(--kt-amber-wash)] border border-[rgba(245,158,11,0.24)] px-4 py-3">
          <p className="text-sm font-bold text-[var(--kt-ink-navy)]">
            Creating a similar delivery from {repeatPrefill.sourceOrderNumber}
          </p>
          <p className="text-xs text-[var(--kt-text-muted)] mt-0.5">
            Review the copied details before sending. Route and pricing are recalculated when you submit.
          </p>
        </div>
      )}

      <StepIndicator current={step} steps={STEPS} />

      <Card>
        {/* Step 0 — Delivery type */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-[--kt-text]">What type of delivery do you need?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DELIVERY_TYPES.map((type) => (
                <label
                  key={type.value}
                  onClick={() => { setDeliveryType(type.value); setQuote(null); }}
                  className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${
                    deliveryType === type.value
                      ? "border-[--kt-brand-blue] bg-[--kt-blue-soft]"
                      : "border-[--kt-border] hover:border-[--kt-brand-blue] hover:bg-[--kt-blue-soft]"
                  }`}
                >
                  <input
                    type="radio"
                    name="delivery_type"
                    value={type.value}
                    checked={deliveryType === type.value}
                    onChange={() => { setDeliveryType(type.value); setQuote(null); }}
                    className="accent-[--kt-brand-blue] mt-0.5 flex-shrink-0"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[--kt-text]">{type.label}</p>
                    <p className="text-xs text-[--kt-text-muted] mt-0.5">{type.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 1 — Pickup */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-[--kt-text]">Pickup details</h2>
              <p className="text-sm text-[--kt-text-muted] mt-0.5">Where should we collect the parcel from?</p>
            </div>
            <SavedAddressSelect
              addresses={savedAddresses}
              target="pickup"
              onSelect={(address) => {
                setPickupAddress(savedAddressToValue(address)); setQuote(null);
                if (address.contactName) setPickupContactName(address.contactName);
                if (address.contactPhone) setPickupContactPhone(address.contactPhone);
                setPickupAccessNotes(address.accessNotes ?? "");
              }}
            />
            <AddressAutocomplete
              id="pickup_address"
              label="Pickup address"
              required
              value={pickupAddress}
              onChange={(value) => { setPickupAddress(value); setQuote(null); }}
              contactName={pickupContactName}
              contactPhone={pickupContactPhone}
              onContactNameChange={setPickupContactName}
              onContactPhoneChange={setPickupContactPhone}
              accessNotes={pickupAccessNotes}
              onAccessNotesChange={setPickupAccessNotes}
              error={fieldErrors["pickupAddress.line1"]}
            />
          </div>
        )}

        {/* Step 2 — Dropoff */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-[--kt-text]">Dropoff details</h2>
              <p className="text-sm text-[--kt-text-muted] mt-0.5">Who should receive this delivery?</p>
            </div>
            <RecipientFields
              recipientName={recipientName}
              recipientPhone={recipientPhone}
              onNameChange={setRecipientName}
              onPhoneChange={setRecipientPhone}
              nameError={fieldErrors["recipientName"]}
              phoneError={fieldErrors["recipientPhone"]}
            />
            <SavedAddressSelect
              addresses={savedAddresses}
              target="dropoff"
              onSelect={(address) => {
                setDropoffAddress(savedAddressToValue(address)); setQuote(null);
                if (address.contactName) setRecipientName(address.contactName);
                if (address.contactPhone) setRecipientPhone(address.contactPhone);
                setDropoffAccessNotes(address.accessNotes ?? "");
              }}
            />
            <AddressAutocomplete
              id="dropoff_address"
              label="Delivery address"
              required
              value={dropoffAddress}
              onChange={(value) => { setDropoffAddress(value); setQuote(null); }}
              showContactFields={false}
              accessNotes={dropoffAccessNotes}
              onAccessNotesChange={setDropoffAccessNotes}
              error={fieldErrors["dropoffAddress.line1"]}
            />
          </div>
        )}

        {/* Step 3 — Parcel & schedule */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-[--kt-text]">Parcel & schedule</h2>
            <div>
              <Label htmlFor="parcel_count" required>Number of parcels</Label>
              <Input
                id="parcel_count"
                type="number"
                min={1}
                max={20}
                value={parcel.parcelCount}
                onChange={(e) => setParcel((p) => ({ ...p, parcelCount: e.target.value }))}
              />
              <FieldError message={fieldErrors["parcelCount"]} />
            </div>
            <div>
              <Label htmlFor="parcel_description">Parcel description</Label>
              <Input
                id="parcel_description"
                placeholder="e.g. Documents, small box, grocery items"
                value={parcel.parcelDescription}
                onChange={(e) => setParcel((p) => ({ ...p, parcelDescription: e.target.value }))}
              />
            </div>
            {deliveryType === "SCHEDULED" && (
              <div>
                <Label htmlFor="scheduled_for" required>Scheduled date</Label>
                <Input
                  id="scheduled_for"
                  type="date"
                  min={minDateStr}
                  value={parcel.scheduledFor}
                  onChange={(e) => setParcel((p) => ({ ...p, scheduledFor: e.target.value }))}
                />
                <FieldError message={fieldErrors["scheduledFor"]} />
              </div>
            )}
            <div>
              <Label htmlFor="customer_note">Additional notes</Label>
              <Textarea
                id="customer_note"
                placeholder="Any special instructions for this delivery?"
                rows={3}
                value={parcel.customerNote}
                onChange={(e) => setParcel((p) => ({ ...p, customerNote: e.target.value }))}
              />
            </div>
          </div>
        )}

        {/* Step 4 — Review */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-[--kt-text]">Review your request</h2>

            <div className="bg-[--kt-surface-muted] rounded-xl p-4">
              <ReviewRow label="Type" value={deliveryTypeLabel} />
              <ReviewRow
                label="Pickup"
                value={[pickupContactName, pickupAddress?.line1, pickupAddress?.city].filter(Boolean).join(" · ")}
              />
              <ReviewRow
                label="Dropoff"
                value={[recipientName, dropoffAddress?.line1, dropoffAddress?.city].filter(Boolean).join(" · ")}
              />
              <ReviewRow label="Parcels" value={parcel.parcelCount} />
              <ReviewRow label="Description" value={parcel.parcelDescription} />
              {deliveryType === "SCHEDULED" && parcel.scheduledFor && (
                <ReviewRow
                  label="Scheduled"
                  value={new Date(parcel.scheduledFor).toLocaleDateString("en-ZA", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric",
                  })}
                />
              )}
              {parcel.customerNote && <ReviewRow label="Notes" value={parcel.customerNote} />}
            </div>

            {/* Route estimate */}
            <RoutePreviewCard
              distanceMeters={routeEstimate?.distanceMeters}
              durationSeconds={routeEstimate?.durationSeconds}
              routeSummary={routeEstimate?.routeSummary}
              loading={routeCalculating}
            />

            {/* Price estimate */}
            <div className="border border-[--kt-border] rounded-xl p-4">
              <p className="text-xs font-semibold text-[--kt-text-muted] uppercase tracking-wide mb-2">Estimated price</p>
              {estimating ? (
                <p className="text-sm text-[--kt-text-muted]">Calculating estimate…</p>
              ) : quote ? (
                <div className="space-y-2" aria-live="polite">
                  <p className="text-2xl font-bold text-[--kt-text]">{quote.currency} {quote.total}</p>
                  <dl className="text-sm space-y-1">
                    {quote.lineItems.map((item) => <div key={item.code} className="flex justify-between gap-4"><dt className="text-[--kt-text-muted]">{item.label}</dt><dd>{quote.currency} {item.amount}</dd></div>)}
                    <div className="flex justify-between gap-4 border-t border-[--kt-border] pt-2"><dt>Subtotal</dt><dd>{quote.currency} {quote.subtotal}</dd></div>
                    <div className="flex justify-between gap-4"><dt>{quote.taxAmount === "0.00" ? "VAT (not applied)" : "VAT"}</dt><dd>{quote.currency} {quote.taxAmount}</dd></div>
                  </dl>
                  {routeEstimate && <p className="text-xs text-[--kt-text-muted]">Route: {routeEstimate.routeSummary}</p>}
                  <p className="text-xs text-[--kt-text-muted]">Quote expires {new Date(quote.expiresAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}.</p>
                </div>
              ) : (
                <p className="text-sm text-[--kt-text-muted]">Price will be confirmed on approval.</p>
              )}
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert">
                <p className="text-sm text-red-700">{formError}</p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-[--kt-border]">
          {step > 0 ? (
            <Button variant="ghost" size="sm" onClick={goBack} disabled={submitting}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <Button
              variant="primary"
              size="md"
              onClick={goNext}
              disabled={!canContinue()}
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmit}
              disabled={submitting || !quote}
            >
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
