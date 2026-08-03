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

function legacyToValue(address?: LegacyPickupAddress): AddressAutocompleteValue | null {
  if (!address?.line1) return null;
  return {
    formattedAddress: [address.line1, address.city, address.province, address.postalCode, address.country ?? "South Africa"]
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
  if (address) return [address.line1, address.city, address.province].filter(Boolean).join(", ");
  if (legacy?.line1) return [legacy.line1, legacy.city, legacy.province].filter(Boolean).join(", ");
  return "";
}

export function StorePickupAddressManager({
  pickupAddress,
  legacyAddress,
}: StorePickupAddressManagerProps) {
  const [current, setCurrent] = useState(pickupAddress);
  const [formOpen, setFormOpen] = useState(!pickupAddress && !legacyAddress?.line1);
  const [form, setForm] = useState<FormState>(() => initialForm(pickupAddress, legacyAddress));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const hasDisplayAddress = !!current || !!legacyAddress?.line1;
  const hasLocation = !!current && typeof current.latitude === "number" && typeof current.longitude === "number";

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

    const payload = {
      label: form.label.trim() || "Default pickup",
      contactName: form.contactName.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      line1: form.address.line1.trim(),
      line2: form.address.line2 ?? undefined,
      city: form.address.city ?? undefined,
      province: form.address.province ?? undefined,
      postalCode: form.address.postalCode ?? undefined,
      country: form.address.country ?? "South Africa",
      accessNotes: form.accessNotes.trim() || undefined,
      formattedAddress: form.address.formattedAddress || undefined,
      placeId: form.address.placeId ?? undefined,
      latitude: form.address.latitude ?? undefined,
      longitude: form.address.longitude ?? undefined,
    };

    try {
      const res = await fetch("/api/store/pickup-address", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as {
        pickupAddress?: SavedAddressDto;
        error?: string;
        fields?: Record<string, string>;
      };

      if (!res.ok || data.error || !data.pickupAddress) {
        setError(data.error ?? "Could not save pickup address.");
        if (data.fields) setFieldErrors(data.fields);
        return;
      }

      setCurrent(data.pickupAddress);
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
            Used to prefill new store delivery requests.
          </p>
        </div>
        {!formOpen && (
          <Button variant="primary" size="sm" onClick={openForm}>
            {hasDisplayAddress ? "Manage pickup" : "Add pickup"}
          </Button>
        )}
      </div>

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
