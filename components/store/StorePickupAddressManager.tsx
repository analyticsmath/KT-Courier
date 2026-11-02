"use client";

import { useState } from "react";
import { AddressAutocomplete, type AddressAutocompleteValue } from "@/components/maps/AddressAutocomplete";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import type { SavedAddressDto } from "@/lib/services/customer-addresses.service";
import { storePickupSetupState } from "@/lib/marketplace-checkout/store-pickup-selection";
import { isMerchantPickupEvidenceComplete } from "@/lib/store-presentation/merchant-pickup-evidence";

interface LegacyPickupAddress {
  storeName?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

interface StorePickupAddressManagerProps {
  pickupAddress: SavedAddressDto | null;
  legacyAddress?: LegacyPickupAddress;
}

interface FormState {
  label: string;
  contactName: string;
  contactPhone: string;
  accessNotes: string;
  address: AddressAutocompleteValue | null;
}

function addressToValue(address: SavedAddressDto): AddressAutocompleteValue {
  return {
    formattedAddress:
      address.formattedAddress ??
      [address.line1, address.line2, address.city, address.province, address.postalCode, address.country]
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

function legacyToValue(address?: LegacyPickupAddress): AddressAutocompleteValue | null {
  if (!address?.line1) return null;
  return {
    formattedAddress: [address.line1, address.line2, address.city, address.province, address.postalCode, address.country ?? "South Africa"]
      .filter(Boolean)
      .join(", "),
    placeId: null,
    line1: address.line1,
    line2: address.line2 ?? null,
    city: address.city ?? null,
    province: address.province ?? null,
    postalCode: address.postalCode ?? null,
    country: address.country ?? "South Africa",
    latitude: null,
    longitude: null,
  };
}

function initialForm(address: SavedAddressDto | null, legacy?: LegacyPickupAddress): FormState {
  return {
    label: address?.label ?? "Default pickup",
    contactName: address?.contactName ?? legacy?.contactName ?? legacy?.storeName ?? "",
    contactPhone: address?.contactPhone ?? legacy?.contactPhone ?? "",
    accessNotes: address?.accessNotes ?? "",
    address: address ? addressToValue(address) : legacyToValue(legacy),
  };
}

function displaySummary(address: SavedAddressDto | null, legacy?: LegacyPickupAddress): string {
  if (address) return [address.line1, address.line2, address.city, address.province, address.postalCode].filter(Boolean).join(", ");
  if (legacy?.line1) return [legacy.line1, legacy.line2, legacy.city, legacy.province, legacy.postalCode].filter(Boolean).join(", ");
  return "";
}

export function StorePickupAddressManager({
  pickupAddress,
  legacyAddress,
}: StorePickupAddressManagerProps) {
  const [current, setCurrent] = useState(pickupAddress);
  const [formOpen, setFormOpen] = useState(() => storePickupSetupState(pickupAddress, legacyAddress).setupRequired);
  const [form, setForm] = useState<FormState>(() => initialForm(pickupAddress, legacyAddress));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [readiness, setReadiness] = useState<{ stage: string; blockers: string[]; outstandingChecks: string[] } | null>(null);

  const hasDisplayAddress = !storePickupSetupState(current, legacyAddress).setupRequired;
  const hasLocation = !!current && typeof current.latitude === "number" && typeof current.longitude === "number";
  const hasCompleteEvidence = isMerchantPickupEvidenceComplete(current);

  function openForm() {
    setForm(initialForm(current, legacyAddress));
    setError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  async function savePickupAddress() {
    setSaving(true);
    setError(null);
    setFieldErrors({});

    if (!form.address?.line1 || form.address.line1.trim().length < 3) {
      setFieldErrors({ line1: "Pickup address is required." });
      setSaving(false);
      return;
    }

    if (!form.address?.city?.trim() || !form.address?.province?.trim()) {
      setError("A complete collection city and province are required for customer delivery quotes. Please select a precise pickup address.");
      setSaving(false);
      return;
    }
    if (!form.address.line2?.trim()) {
      setFieldErrors({ line2: "Enter the pickup suburb or area." });
      setSaving(false);
      return;
    }
    if (!/^\d{4}$/.test(form.address.postalCode?.trim() ?? "")) {
      setFieldErrors({ postalCode: "Enter a valid four-digit South African postal code." });
      setSaving(false);
      return;
    }
    const latitude = Number(form.address.latitude);
    const longitude = Number(form.address.longitude);
    if (form.address.latitude == null || form.address.longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || (latitude === 0 && longitude === 0)) {
      setFieldErrors({ mapLocation: "Select the precise collection point on the map." });
      setSaving(false);
      return;
    }

    const payload = {
      label: form.label.trim() || "Default pickup",
      contactName: form.contactName.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      line1: form.address.line1.trim(),
      line2: form.address.line2,
      city: form.address.city,
      province: form.address.province,
      postalCode: form.address.postalCode,
      country: form.address.country ?? "South Africa",
      accessNotes: form.accessNotes.trim() || null,
      formattedAddress: form.address.formattedAddress || null,
      placeId: form.address.placeId,
      latitude: form.address.latitude,
      longitude: form.address.longitude,
    };

    try {
      const res = await fetch("/api/store/pickup-address", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as {
        pickupAddress?: SavedAddressDto;
        readiness?: { stage: string; blockers: string[]; outstandingChecks: string[] } | null;
        error?: string;
        fields?: Record<string, string>;
      };

      if (!res.ok || data.error || !data.pickupAddress) {
        setError(data.error ?? "Could not save pickup address.");
        if (data.fields) setFieldErrors(data.fields);
        return;
      }

      setCurrent(data.pickupAddress);
      setReadiness(data.readiness ?? { stage: "UNVERIFIED", blockers: ["PICKUP_COVERAGE_UNVERIFIED"], outstandingChecks: [] });
      setForm(initialForm(data.pickupAddress, legacyAddress));
      setFormOpen(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-extrabold text-[var(--kt-ink-navy)]">Default pickup address</h2>
          <p className="text-sm text-[var(--kt-text-muted)] mt-1">
            Used for customer courier quotes and collection by KT Couriers drivers.
          </p>
        </div>
        {!formOpen && (
          <Button variant="primary" size="sm" onClick={openForm}>
            {hasDisplayAddress ? "Manage pickup" : "Add pickup"}
          </Button>
        )}
      </div>

      {current && !hasCompleteEvidence && (
        <p role="status" className="text-sm text-[var(--kt-text-muted)]">
          This pickup address is not fully configured for marketplace delivery. Confirm the street, suburb, city, province, four-digit postal code and precise map location before customers order from the store. Delivery coverage and the actual route are checked separately.
        </p>
      )}
      {!current && legacyAddress?.line1 && (
        <p role="status" className="text-sm text-[var(--kt-text-muted)]">
          Your earlier business address is not yet a confirmed courier collection point. Review the real pickup location below and save it before accepting customer delivery orders.
        </p>
      )}

      {readiness && !formOpen && (
        <div role="status" className="rounded-xl border border-[var(--kt-border)] bg-[var(--kt-surface-muted)] px-4 py-3 text-sm">
          <strong>Collection area check: {readiness.stage === "PICKUP_AREA_READY" ? "Pickup service area recorded" : "Needs further verification"}</strong>
          <p className="mt-1 text-[var(--kt-text-muted)]">Saving an address does not activate your store. Trading hours, the actual destination road route, seller checks, and checkout still require verification.</p>
          {readiness.blockers.length ? <ul className="mt-2 list-disc space-y-1 pl-5">
            {readiness.blockers.map(code => <li key={code}>{
              ({
                STORE_CONTACT_MISSING: "Add a store contact email or phone.",
                PICKUP_ADDRESS_MISSING: "Save a complete collection address.",
                PICKUP_SUBURB_MISSING: "Enter the pickup suburb or area.",
                PICKUP_POSTAL_CODE_MISSING: "Enter a valid four-digit postal code.",
                PICKUP_MAP_LOCATION_MISSING: "Select an accurate map location.",
                PICKUP_COVERAGE_UNVERIFIED: "The pickup area could not be independently verified. Check the address or contact operations.",
                ACTIVE_COURIER_SERVICE_MISSING: "Courier service is not yet active for this pickup area.",
                STORE_ACCOUNT_PAUSED: "Store account is paused; contact operations.",
              } as Record<string, string>)[code] ?? "Collection details need administrator review."
            }</li>)}
          </ul> : null}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {!formOpen && hasDisplayAddress && (
        <Card padding="sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-extrabold text-[var(--kt-ink-navy)]">
                  {current?.label ?? "Default pickup"}
                </p>
                <Badge variant={hasLocation ? "green" : "amber"}>
                  {hasLocation ? "Location captured" : "Manual address"}
                </Badge>
              </div>
              <p className="text-sm text-[var(--kt-text-muted)] mt-1">
                {displaySummary(current, legacyAddress)}
              </p>
              {(current?.contactName || legacyAddress?.contactName || legacyAddress?.storeName) && (
                <p className="text-xs text-[var(--kt-text-muted)] mt-1">
                  {current?.contactName ?? legacyAddress?.contactName ?? legacyAddress?.storeName}
                  {(current?.contactPhone ?? legacyAddress?.contactPhone)
                    ? ` · ${current?.contactPhone ?? legacyAddress?.contactPhone}`
                    : ""}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {!formOpen && !hasDisplayAddress && (
        <EmptyState
          title="No pickup address saved"
          description="Add your default collection point before creating regular store deliveries."
          action={{ label: "Add pickup address", onClick: openForm }}
        />
      )}

      {formOpen && (
        <Card>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="store_pickup_label">Label</Label>
                <Input
                  id="store_pickup_label"
                  value={form.label}
                  onChange={(event) => setForm((currentForm) => ({ ...currentForm, label: event.target.value }))}
                  placeholder="Default pickup"
                  error={fieldErrors.label}
                />
              </div>
            </div>

            <AddressAutocomplete
              id="store_pickup_address"
              label="Pickup address"
              required
              value={form.address}
              onChange={(value) => setForm((currentForm) => ({ ...currentForm, address: value }))}
              contactName={form.contactName}
              contactPhone={form.contactPhone}
              onContactNameChange={(value) => setForm((currentForm) => ({ ...currentForm, contactName: value }))}
              onContactPhoneChange={(value) => setForm((currentForm) => ({ ...currentForm, contactPhone: value }))}
              accessNotes={form.accessNotes}
              onAccessNotesChange={(value) => setForm((currentForm) => ({ ...currentForm, accessNotes: value }))}
              error={fieldErrors.line1 ?? fieldErrors["address.line1"]}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="store_pickup_suburb">Suburb / area</Label>
                <Input
                  id="store_pickup_suburb"
                  value={form.address?.line2 ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((currentForm) => ({ ...currentForm, address: currentForm.address ? { ...currentForm.address, line2: value } : currentForm.address }));
                    setFieldErrors((current) => ({ ...current, line2: "" }));
                  }}
                  placeholder="e.g. Sandton"
                  disabled={!form.address}
                  error={fieldErrors.line2}
                />
                <p className="mt-1 text-xs text-[var(--kt-text-muted)]">Use access notes for unit, gate or collection instructions.</p>
              </div>
              <div>
                <Label htmlFor="store_pickup_postal">Postal code</Label>
                <Input
                  id="store_pickup_postal"
                  value={form.address?.postalCode ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((currentForm) => ({ ...currentForm, address: currentForm.address ? { ...currentForm.address, postalCode: value } : currentForm.address }));
                    setFieldErrors((current) => ({ ...current, postalCode: "" }));
                  }}
                  placeholder="4-digit postal code"
                  disabled={!form.address}
                  error={fieldErrors.postalCode}
                />
              </div>
            </div>
            {fieldErrors.mapLocation ? <p role="alert" className="text-sm text-red-600">{fieldErrors.mapLocation}</p> : null}
            <p className="text-xs text-[var(--kt-text-muted)]">Select a precise map location. Typing a street address without confirming its map pin is not sufficient for courier collection.</p>

            <div className="flex items-center gap-3">
              <Button variant="primary" size="sm" onClick={savePickupAddress} disabled={saving}>
                {saving ? "Saving..." : "Save pickup address"}
              </Button>
              {hasDisplayAddress && (
                <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)} disabled={saving}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
