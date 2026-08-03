"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import type { PricingRuleDto } from "@/lib/dto/order.dto";

const DELIVERY_TYPE_OPTIONS = [
  { value: "", label: "Any (no delivery type filter)" },
  { value: "SAME_DAY", label: "Same-day" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "BUSINESS", label: "Business" },
  { value: "PARCEL_DOCUMENT", label: "Parcel / Document" },
];

interface PricingRuleFormProps {
  rule?: PricingRuleDto;
  regions: Array<{ id: string; name: string }>;
  onCancel: () => void;
}

export function PricingRuleForm({ rule, regions, onCancel }: PricingRuleFormProps) {
  const router = useRouter();
  const isEdit = !!rule;

  const [name, setName] = useState(rule?.name ?? "");
  const [deliveryType, setDeliveryType] = useState(rule?.deliveryType ?? "");
  const [amount, setAmount] = useState(rule ? String(rule.amount) : "");
  const [baseFee, setBaseFee] = useState(rule ? String(rule.baseFee) : "");
  const [perKmRate, setPerKmRate] = useState(rule ? String(rule.perKmRate) : "0");
  const [includedDistanceKm, setIncludedDistanceKm] = useState(rule ? String(rule.includedDistanceKm) : "0");
  const [distanceIncrementKm, setDistanceIncrementKm] = useState(rule ? String(rule.distanceIncrementKm) : "0.1");
  const [minimumCharge, setMinimumCharge] = useState(rule?.minimumCharge === null || !rule ? "" : String(rule.minimumCharge));
  const [flatSurcharge, setFlatSurcharge] = useState(rule?.flatSurcharge === null || !rule ? "" : String(rule.flatSurcharge));
  const [maxDistanceKm, setMaxDistanceKm] = useState(rule?.maxDistanceKm === null || !rule ? "" : String(rule.maxDistanceKm));
  const [regionId, setRegionId] = useState(rule?.regionId ?? "");
  const [vehicleClass, setVehicleClass] = useState(rule?.vehicleClass ?? "");
  const [vehicleSurcharge, setVehicleSurcharge] = useState(rule?.vehicleSurcharge === null || !rule ? "" : String(rule.vehicleSurcharge));
  const [includedWeightKg, setIncludedWeightKg] = useState(rule?.includedWeightKg === null || !rule ? "" : String(rule.includedWeightKg));
  const [perAdditionalKgRate, setPerAdditionalKgRate] = useState(rule?.perAdditionalKgRate === null || !rule ? "" : String(rule.perAdditionalKgRate));
  const [weightIncrementKg, setWeightIncrementKg] = useState(rule?.weightIncrementKg === null || !rule ? "" : String(rule.weightIncrementKg));
  const [maximumWeightKg, setMaximumWeightKg] = useState(rule?.maximumWeightKg === null || !rule ? "" : String(rule.maximumWeightKg));
  const [dimensionalPricingEnabled, setDimensionalPricingEnabled] = useState(rule?.dimensionalPricingEnabled ?? false);
  const [volumetricDivisor, setVolumetricDivisor] = useState(rule?.volumetricDivisor === null || !rule ? "" : String(rule.volumetricDivisor));
  const [allowGlobalFallback, setAllowGlobalFallback] = useState(rule?.allowGlobalFallback ?? true);
  const [effectiveFrom, setEffectiveFrom] = useState(rule?.effectiveFrom ? new Date(rule.effectiveFrom).toISOString().slice(0, 16) : "");
  const [effectiveTo, setEffectiveTo] = useState(rule?.effectiveTo ? new Date(rule.effectiveTo).toISOString().slice(0, 16) : "");
  const [active, setActive] = useState(rule?.active ?? true);
  const [priority, setPriority] = useState(rule ? String(rule.priority) : "0");
  const [changeReason, setChangeReason] = useState("");
  const [currency] = useState(rule?.currency ?? "ZAR");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const body = {
      name: name.trim(),
      type: "FLAT" as const,
      deliveryType: deliveryType || undefined,
      amount: parseFloat(amount),
      baseFee: parseFloat(baseFee || amount),
      perKmRate: parseFloat(perKmRate || "0"),
      includedDistanceKm: parseFloat(includedDistanceKm || "0"),
      distanceIncrementKm: parseFloat(distanceIncrementKm || "0.1"),
      minimumCharge: minimumCharge ? parseFloat(minimumCharge) : null,
      flatSurcharge: flatSurcharge ? parseFloat(flatSurcharge) : null,
      maxDistanceKm: maxDistanceKm ? parseFloat(maxDistanceKm) : null,
      regionId: regionId || undefined,
      vehicleClass: vehicleClass || null,
      vehicleSurcharge: vehicleSurcharge ? parseFloat(vehicleSurcharge) : null,
      includedWeightKg: includedWeightKg ? parseFloat(includedWeightKg) : null,
      perAdditionalKgRate: perAdditionalKgRate ? parseFloat(perAdditionalKgRate) : null,
      weightIncrementKg: weightIncrementKg ? parseFloat(weightIncrementKg) : null,
      maximumWeightKg: maximumWeightKg ? parseFloat(maximumWeightKg) : null,
      dimensionalPricingEnabled,
      volumetricDivisor: volumetricDivisor ? parseFloat(volumetricDivisor) : null,
      allowGlobalFallback,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom).toISOString() : null,
      effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : null,
      active,
      priority: parseInt(priority || "0", 10),
      ...(isEdit && { changeReason: changeReason.trim(), expectedRevision: rule!.revision }),
      currency,
      description: description.trim() || undefined,
    };

    try {
      const url = isEdit ? `/api/admin/pricing/rules/${rule!.id}` : "/api/admin/pricing/rules";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json() as { error?: string; fields?: Record<string, string> };

      if (data.error) {
        setError(data.error);
        if (data.fields) setFieldErrors(data.fields);
        return;
      }

      router.refresh();
      onCancel();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="rule_name" required>Rule name</Label>
        <Input
          id="rule_name"
          placeholder="e.g. Same-day base fee"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
      </div>
      <div>
        <Label htmlFor="rule_delivery_type">Delivery type</Label>
        <select
          id="rule_delivery_type"
          className="w-full h-10 rounded-xl border border-[--kt-border] bg-[--kt-surface] px-3 text-sm text-[--kt-text] focus:outline-none focus:ring-2 focus:ring-[--kt-brand-blue]"
          value={deliveryType}
          onChange={(e) => setDeliveryType(e.target.value)}
        >
          {DELIVERY_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {fieldErrors.deliveryType && <p className="mt-1 text-xs text-red-600">{fieldErrors.deliveryType}</p>}
      </div>
      <div>
        <Label htmlFor="rule_region">Region scope</Label>
        <select id="rule_region" className="w-full h-10 rounded-xl border border-[--kt-border] bg-[--kt-surface] px-3 text-sm text-[--kt-text]" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
          <option value="">Global rule</option>
          {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="rule_amount" required>Amount ({currency})</Label>
          <Input
            id="rule_amount"
            type="number"
            min={0}
            step={0.01}
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {fieldErrors.amount && <p className="mt-1 text-xs text-red-600">{fieldErrors.amount}</p>}
        </div>
        <div>
          <Label>Currency</Label>
          <Input value={currency} disabled className="opacity-60" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumberField id="rule_base_fee" label="Base fee" value={baseFee} onChange={setBaseFee} step="0.01" />
        <NumberField id="rule_per_km" label="Per kilometre rate" value={perKmRate} onChange={setPerKmRate} step="0.0001" />
        <NumberField id="rule_included_km" label="Included distance (km)" value={includedDistanceKm} onChange={setIncludedDistanceKm} step="0.0001" />
        <NumberField id="rule_increment" label="Distance increment (km)" value={distanceIncrementKm} onChange={setDistanceIncrementKm} step="0.1" />
        <NumberField id="rule_minimum" label="Minimum charge" value={minimumCharge} onChange={setMinimumCharge} step="0.01" />
        <NumberField id="rule_surcharge" label="Flat surcharge" value={flatSurcharge} onChange={setFlatSurcharge} step="0.01" />
        <NumberField id="rule_max_distance" label="Maximum distance (km)" value={maxDistanceKm} onChange={setMaxDistanceKm} step="0.0001" />
        <NumberField id="rule_priority" label="Priority" value={priority} onChange={setPriority} step="1" />
      </div>
      <fieldset className="border border-[--kt-border] rounded-xl p-4 space-y-4">
        <legend className="px-1 text-sm font-semibold text-[--kt-text]">Vehicle and parcel constraints</legend>
        <div>
          <Label htmlFor="rule_vehicle">Vehicle scope</Label>
          <select id="rule_vehicle" className="w-full h-10 rounded-xl border border-[--kt-border] bg-[--kt-surface] px-3 text-sm text-[--kt-text]" value={vehicleClass} onChange={(e) => setVehicleClass(e.target.value)}>
            <option value="">Any vehicle</option>
            <option value="MOTORBIKE">Motorbike</option><option value="CAR">Car</option><option value="VAN">Van</option><option value="TRUCK">Truck</option><option value="BICYCLE">Bicycle</option><option value="WALKER">Walker</option><option value="OTHER">Other</option>
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberField id="rule_vehicle_surcharge" label="Vehicle surcharge" value={vehicleSurcharge} onChange={setVehicleSurcharge} step="0.01" />
          <NumberField id="rule_included_weight" label="Included weight (kg)" value={includedWeightKg} onChange={setIncludedWeightKg} step="0.0001" />
          <NumberField id="rule_additional_weight" label="Per additional kg" value={perAdditionalKgRate} onChange={setPerAdditionalKgRate} step="0.0001" />
          <NumberField id="rule_weight_increment" label="Weight increment (kg)" value={weightIncrementKg} onChange={setWeightIncrementKg} step="0.0001" />
          <NumberField id="rule_max_weight" label="Maximum weight (kg)" value={maximumWeightKg} onChange={setMaximumWeightKg} step="0.0001" />
        </div>
      </fieldset>
      <fieldset className="border border-[--kt-border] rounded-xl p-4 space-y-4">
        <legend className="px-1 text-sm font-semibold text-[--kt-text]">Applicability and lifecycle</legend>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dimensionalPricingEnabled} onChange={(e) => setDimensionalPricingEnabled(e.target.checked)} /> Enable dimensional pricing</label>
        {dimensionalPricingEnabled && <NumberField id="rule_volumetric_divisor" label="Volumetric divisor" value={volumetricDivisor} onChange={setVolumetricDivisor} step="0.0001" />}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowGlobalFallback} onChange={(e) => setAllowGlobalFallback(e.target.checked)} /> Allow global fallback</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Rule is active</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label htmlFor="rule_effective_from">Effective start</Label><Input id="rule_effective_from" type="datetime-local" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></div>
          <div><Label htmlFor="rule_effective_to">Effective end</Label><Input id="rule_effective_to" type="datetime-local" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} /></div>
        </div>
      </fieldset>
      <div>
        <Label htmlFor="rule_description">Description</Label>
        <Input
          id="rule_description"
          placeholder="Optional description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      {isEdit && (
        <div>
          <Label htmlFor="rule_change_reason" required>Reason for change (revision {rule!.revision})</Label>
          <Input id="rule_change_reason" value={changeReason} onChange={(e) => setChangeReason(e.target.value)} />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={loading}>
          {loading ? "Saving…" : isEdit ? "Save changes" : "Create rule"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function NumberField({ id, label, value, onChange, step }: { id: string; label: string; value: string; onChange: (value: string) => void; step: string }) {
  return <div><Label htmlFor={id}>{label}</Label><Input id={id} type="number" min={0} step={step} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}
