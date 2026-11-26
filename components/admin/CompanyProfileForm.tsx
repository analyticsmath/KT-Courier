"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export interface CompanyProfileFormData {
  publicReference: string | null;
  versionNumber: number;
  legalName: string;
  tradingName: string;
  registrationNumber: string;
  vatNumber: string;
  supportEmail: string;
  businessEmail: string;
  telephoneNumbersText: string;
  website: string;
  addressLine1: string;
  addressCity: string;
  addressProvince: string;
  addressPostalCode: string;
  walkInOffice: boolean;
  activatedAtIso: string | null;
}

export function CompanyProfileForm({
  initial,
  canManage,
}: {
  initial: CompanyProfileFormData | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [legalName, setLegalName] = useState(initial?.legalName ?? "");
  const [tradingName, setTradingName] = useState(initial?.tradingName ?? "");
  const [registrationNumber, setRegistrationNumber] = useState(initial?.registrationNumber ?? "");
  const [vatNumber, setVatNumber] = useState(initial?.vatNumber ?? "");
  const [supportEmail, setSupportEmail] = useState(initial?.supportEmail ?? "");
  const [businessEmail, setBusinessEmail] = useState(initial?.businessEmail ?? "");
  const [telephoneNumbersText, setTelephoneNumbersText] = useState(initial?.telephoneNumbersText ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "https://www.ktcouriers.com");
  const [addressLine1, setAddressLine1] = useState(initial?.addressLine1 ?? "");
  const [addressCity, setAddressCity] = useState(initial?.addressCity ?? "");
  const [addressProvince, setAddressProvince] = useState(initial?.addressProvince ?? "");
  const [addressPostalCode, setAddressPostalCode] = useState(initial?.addressPostalCode ?? "");
  const [walkInOffice, setWalkInOffice] = useState(initial?.walkInOffice ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || saving) return;
    setSaving(true);
    setError(null);
    setSavedNotice(null);

    const phones = telephoneNumbersText
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    const hasAddress = [addressLine1, addressCity, addressProvince, addressPostalCode].some((v) =>
      Boolean(v.trim()),
    );
    const physicalAddress = hasAddress
      ? {
          ...(addressLine1.trim() ? { line1: addressLine1.trim() } : {}),
          ...(addressCity.trim() ? { city: addressCity.trim() } : {}),
          ...(addressProvince.trim() ? { province: addressProvince.trim() } : {}),
          ...(addressPostalCode.trim() ? { postalCode: addressPostalCode.trim() } : {}),
          country: "South Africa",
        }
      : null;

    try {
      const res = await fetch("/api/admin/company-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: legalName.trim(),
          tradingName: tradingName.trim() || null,
          registrationNumber: registrationNumber.trim() || null,
          vatNumber: vatNumber.trim() || null,
          physicalAddress,
          supportEmail: supportEmail.trim() || null,
          businessEmail: businessEmail.trim() || null,
          telephoneNumbers: phones.length ? phones : null,
          website: website.trim() || null,
          documentIdentityMetadata: {
            walkInOffice,
          },
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        versionNumber?: number;
      } | null;

      if (!res.ok) {
        setError(data?.error ?? "Unable to activate company profile version.");
        return;
      }

      setSavedNotice(
        `Activated Company Profile version ${data?.versionNumber ?? (initial?.versionNumber ?? 0) + 1}. New waybills and POD certificates will capture this issuer snapshot.`,
      );
      router.refresh();
    } catch {
      setError("Network error while updating company profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Active Issuer Identity</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            {initial
              ? `Version ${initial.versionNumber} · Ref ${initial.publicReference ?? "ACTIVE"}`
              : "No active CompanyProfileVersion is present yet. Activate one below to enable Waybill & POD issuance."}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            initial ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"
          }`}
        >
          {initial ? "ACTIVE" : "NOT CONFIGURED"}
        </span>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {savedNotice && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {savedNotice}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="company-legal-name" required>
            Legal company name
          </Label>
          <Input
            id="company-legal-name"
            required
            disabled={!canManage}
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="KT Couriers (Pty) Ltd"
          />
        </div>
        <div>
          <Label htmlFor="company-trading-name">Trading name</Label>
          <Input
            id="company-trading-name"
            disabled={!canManage}
            value={tradingName}
            onChange={(e) => setTradingName(e.target.value)}
            placeholder="KT Couriers"
          />
        </div>
        <div>
          <Label htmlFor="company-reg-no">Company registration number</Label>
          <Input
            id="company-reg-no"
            disabled={!canManage}
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            placeholder="2024/475266/07"
          />
        </div>
        <div>
          <Label htmlFor="company-vat-no">VAT registration number (if VAT registered)</Label>
          <Input
            id="company-vat-no"
            disabled={!canManage}
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            placeholder="Optional VAT number"
          />
        </div>
        <div>
          <Label htmlFor="company-support-email">Customer support email</Label>
          <Input
            id="company-support-email"
            type="email"
            disabled={!canManage}
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            placeholder="support@ktcouriers.com"
          />
        </div>
        <div>
          <Label htmlFor="company-business-email">Business contact email</Label>
          <Input
            id="company-business-email"
            type="email"
            disabled={!canManage}
            value={businessEmail}
            onChange={(e) => setBusinessEmail(e.target.value)}
            placeholder="info@ktcouriers.com"
          />
        </div>
        <div>
          <Label htmlFor="company-phones">Telephone numbers (comma-separated)</Label>
          <Input
            id="company-phones"
            disabled={!canManage}
            value={telephoneNumbersText}
            onChange={(e) => setTelephoneNumbersText(e.target.value)}
            placeholder="067 815 5245, 075 019 2265"
          />
        </div>
        <div>
          <Label htmlFor="company-website">Official website URL</Label>
          <Input
            id="company-website"
            type="url"
            disabled={!canManage}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://www.ktcouriers.com"
          />
        </div>
      </div>

      <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wider text-slate-600">
          Physical / Registered Office Address (Optional)
        </legend>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="company-addr-line1">Street / unit</Label>
            <Input
              id="company-addr-line1"
              disabled={!canManage}
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="company-addr-city">City</Label>
            <Input
              id="company-addr-city"
              disabled={!canManage}
              value={addressCity}
              onChange={(e) => setAddressCity(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="company-addr-province">Province</Label>
            <Input
              id="company-addr-province"
              disabled={!canManage}
              value={addressProvince}
              onChange={(e) => setAddressProvince(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="company-addr-postal">Postal code</Label>
            <Input
              id="company-addr-postal"
              disabled={!canManage}
              value={addressPostalCode}
              onChange={(e) => setAddressPostalCode(e.target.value)}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-800 pt-1">
          <input
            type="checkbox"
            disabled={!canManage}
            checked={walkInOffice}
            onChange={(e) => setWalkInOffice(e.target.checked)}
          />
          Walk-in counter open to public parcels
        </label>
      </fieldset>

      {canManage ? (
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Activating…" : "Save & Activate Company Profile Version"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-slate-600">
          Read-only view. Updating company issuer identity requires the{" "}
          <code>company_settings.manage</code> permission.
        </p>
      )}
    </form>
  );
}
