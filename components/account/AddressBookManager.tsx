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

type AddressKind = "PICKUP" | "DROPOFF" | "CUSTOMER";

interface AddressBookManagerProps {
  initialAddresses: SavedAddressDto[];
}

interface FormState {
  id: string | null;
  type: AddressKind;
  label: string;
  isDefault: boolean;
  contactName: string;
  contactPhone: string;
  accessNotes: string;
  address: AddressAutocompleteValue | null;
}

const EMPTY_FORM: FormState = {
  id: null,
  type: "DROPOFF",
  label: "",
  isDefault: false,
  contactName: "",
  contactPhone: "",
  accessNotes: "",
  address: null,
};

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

function typeLabel(type: AddressKind): string {
  if (type === "PICKUP") return "Pickup";
  if (type === "DROPOFF") return "Dropoff";
  return "Saved";
}

function summary(address: SavedAddressDto): string {
  return [address.line1, address.city, address.province].filter(Boolean).join(", ");
}

export function AddressBookManager({ initialAddresses }: AddressBookManagerProps) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [formOpen, setFormOpen] = useState(initialAddresses.length === 0);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function openCreate(type: AddressKind = "DROPOFF") {
    setForm({ ...EMPTY_FORM, type });
    setFieldErrors({});
    setError(null);
    setFormOpen(true);
  }

  function openEdit(address: SavedAddressDto) {
    setForm({
      id: address.id,
      type: address.type as AddressKind,
      label: address.label ?? "",
      isDefault: address.isDefault,
      contactName: address.contactName ?? "",
      contactPhone: address.contactPhone ?? "",
      accessNotes: address.accessNotes ?? "",
      address: addressToValue(address),
    });
    setFieldErrors({});
    setError(null);
    setFormOpen(true);
  }

  function cancelForm() {
    setForm(EMPTY_FORM);
    setFormOpen(false);
    setFieldErrors({});
    setError(null);
  }

  async function saveAddress() {
    setSaving(true);
    setError(null);
    setFieldErrors({});

    if (!form.address?.line1 || form.address.line1.trim().length < 3) {
      setFieldErrors({ line1: "Address is required." });
      setSaving(false);
      return;
    }

    const payload = {
      type: form.type,
      label: form.label.trim() || undefined,
      isDefault: form.isDefault,
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
      const res = await fetch(form.id ? `/api/account/addresses/${form.id}` : "/api/account/addresses", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as {
        address?: SavedAddressDto;
        error?: string;
        fields?: Record<string, string>;
      };

      if (!res.ok || data.error || !data.address) {
        setError(data.error ?? "Could not save this address.");
        if (data.fields) setFieldErrors(data.fields);
        return;
      }

      setAddresses((current) => {
        const without = current.filter((a) => a.id !== data.address!.id);
        return [data.address!, ...without].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
      });
      cancelForm();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(address: SavedAddressDto) {
    setError(null);
    try {
      const res = await fetch(`/api/account/addresses/${address.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      const data = await res.json() as { address?: SavedAddressDto; error?: string };
      if (!res.ok || data.error || !data.address) {
        setError(data.error ?? "Could not update the default address.");
        return;
      }
      setAddresses((current) =>
        current.map((item) => {
          if (item.id === data.address!.id) return data.address!;
          if (item.type === data.address!.type) return { ...item, isDefault: false };
          return item;
        })
      );
    } catch {
      setError("Network error. Please try again.");
    }
  }

  async function deleteAddress(address: SavedAddressDto) {
    setDeletingId(address.id);
    setError(null);
    try {
      const res = await fetch(`/api/account/addresses/${address.id}`, { method: "DELETE" });
      const data = await res.json() as { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Could not delete this address.");
        return;
      }
      setAddresses((current) => current.filter((item) => item.id !== address.id));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-[var(--kt-text-muted)]">
          {addresses.length} saved address{addresses.length !== 1 ? "es" : ""}
        </p>
        {!formOpen && (
          <Button variant="primary" size="sm" onClick={() => openCreate()}>
            Add address
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {formOpen && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-extrabold text-[var(--kt-ink-navy)]">
                {form.id ? "Edit address" : "Add address"}
              </h2>
              {addresses.length > 0 && (
                <Button variant="ghost" size="sm" onClick={cancelForm} disabled={saving}>
                  Cancel
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="address_label">Label</Label>
                <Input
                  id="address_label"
                  placeholder="Home, office, client, supplier"
                  value={form.label}
                  onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                  error={fieldErrors.label}
                />
              </div>
              <div>
                <Label htmlFor="address_type">Address type</Label>
                <select
                  id="address_type"
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as AddressKind }))}
                  className="w-full h-11 px-3 rounded-xl border border-[var(--kt-border)] bg-white text-sm text-[var(--kt-text)] focus:border-[var(--kt-brand-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--kt-brand-blue)]/20"
                >
                  <option value="DROPOFF">Dropoff</option>
                  <option value="PICKUP">Pickup</option>
                  <option value="CUSTOMER">General saved address</option>
                </select>
              </div>
            </div>

            <AddressAutocomplete
              id="saved_address"
              label="Address"
              required
              value={form.address}
              onChange={(value) => setForm((current) => ({ ...current, address: value }))}
              contactName={form.contactName}
              contactPhone={form.contactPhone}
              onContactNameChange={(value) => setForm((current) => ({ ...current, contactName: value }))}
              onContactPhoneChange={(value) => setForm((current) => ({ ...current, contactPhone: value }))}
              accessNotes={form.accessNotes}
              onAccessNotesChange={(value) => setForm((current) => ({ ...current, accessNotes: value }))}
              error={fieldErrors["line1"] ?? fieldErrors["address.line1"]}
            />

            <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--kt-ink-navy)]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--kt-signal-cobalt)]"
                checked={form.isDefault}
                onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))}
              />
              Make this the default for this type
            </label>

            <Button variant="primary" size="sm" onClick={saveAddress} disabled={saving}>
              {saving ? "Saving..." : form.id ? "Save address" : "Add address"}
            </Button>
          </div>
        </Card>
      )}

      {addresses.length === 0 && !formOpen ? (
        <EmptyState
          title="No saved addresses"
          description="Save pickup and dropoff addresses you use often."
          action={{ label: "Add address", onClick: () => openCreate() }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => {
            const hasLocation = typeof address.latitude === "number" && typeof address.longitude === "number";
            return (
              <Card key={address.id} padding="sm">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-extrabold text-[var(--kt-ink-navy)]">
                          {address.label || typeLabel(address.type as AddressKind)}
                        </p>
                        <Badge variant={address.type === "PICKUP" ? "blue" : address.type === "DROPOFF" ? "green" : "slate"}>
                          {typeLabel(address.type as AddressKind)}
                        </Badge>
                        {address.isDefault && <Badge variant="amber">Default</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-[var(--kt-text-muted)]">{summary(address)}</p>
                      {address.contactName && (
                        <p className="text-xs text-[var(--kt-text-muted)] mt-1">
                          {address.contactName}{address.contactPhone ? ` · ${address.contactPhone}` : ""}
                        </p>
                      )}
                    </div>
                  </div>

                  {hasLocation && (
                    <p className="text-xs font-semibold text-[var(--kt-teal-emerald)]">
                      Location captured
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[var(--kt-soft-border)]">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(address)}>
                      Edit
                    </Button>
                    {!address.isDefault && (
                      <Button variant="ghost" size="sm" onClick={() => setDefault(address)}>
                        Set default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAddress(address)}
                      disabled={deletingId === address.id}
                      className="text-[var(--kt-signal-red)] hover:text-[var(--kt-signal-red)]"
                    >
                      {deletingId === address.id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
