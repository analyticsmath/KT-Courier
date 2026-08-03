"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import type { DeliveryRegionDto } from "@/lib/services/admin-regions.service";

// ─── Badge ─────────────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
        active
          ? "bg-[var(--kt-mint-wash)] text-[var(--kt-teal-emerald)]"
          : "bg-[var(--kt-soft-border)] text-[var(--kt-text-muted)]"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-[var(--kt-teal-emerald)]" : "bg-[var(--kt-text-muted)]"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

// ─── Region form ───────────────────────────────────────────────────────────────

interface RegionFormState {
  name: string;
  slug: string;
  description: string;
  city: string;
  province: string;
  centerLat: string;
  centerLng: string;
  coverageRadiusKm: string;
  maxDistanceKm: string;
  baseFee: string;
  notes: string;
  displayOrder: string;
  active: boolean;
}

const EMPTY_FORM: RegionFormState = {
  name: "",
  slug: "",
  description: "",
  city: "",
  province: "",
  centerLat: "",
  centerLng: "",
  coverageRadiusKm: "",
  maxDistanceKm: "",
  baseFee: "",
  notes: "",
  displayOrder: "0",
  active: true,
};

function dtoToForm(dto: DeliveryRegionDto): RegionFormState {
  return {
    name: dto.name,
    slug: dto.slug,
    description: dto.description ?? "",
    city: dto.city ?? "",
    province: dto.province ?? "",
    centerLat: dto.centerLat?.toString() ?? "",
    centerLng: dto.centerLng?.toString() ?? "",
    coverageRadiusKm: dto.coverageRadiusKm?.toString() ?? "",
    maxDistanceKm: dto.maxDistanceKm?.toString() ?? "",
    baseFee: dto.baseFee?.toString() ?? "",
    notes: dto.notes ?? "",
    displayOrder: dto.displayOrder.toString(),
    active: dto.active,
  };
}

function buildSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DeliveryRegionsManagerProps {
  initialRegions: DeliveryRegionDto[];
}

export function DeliveryRegionsManager({ initialRegions }: DeliveryRegionsManagerProps) {
  const [regions, setRegions] = useState<DeliveryRegionDto[]>(initialRegions);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<RegionFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const setField = useCallback(<K extends keyof RegionFormState>(key: K, value: RegionFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(region: DeliveryRegionDto) {
    setEditId(region.id);
    setForm(dtoToForm(region));
    setFormError(null);
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditId(null);
    setFormError(null);
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || undefined,
      active: form.active,
      city: form.city.trim() || undefined,
      province: form.province.trim() || undefined,
      centerLat: form.centerLat ? parseFloat(form.centerLat) : undefined,
      centerLng: form.centerLng ? parseFloat(form.centerLng) : undefined,
      coverageRadiusKm: form.coverageRadiusKm ? parseFloat(form.coverageRadiusKm) : undefined,
      maxDistanceKm: form.maxDistanceKm ? parseFloat(form.maxDistanceKm) : undefined,
      baseFee: form.baseFee ? parseFloat(form.baseFee) : undefined,
      notes: form.notes.trim() || undefined,
      displayOrder: parseInt(form.displayOrder) || 0,
    };

    try {
      const url = editId ? `/api/admin/regions/${editId}` : "/api/admin/regions";
      const method = editId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { region?: DeliveryRegionDto; error?: string };

      if (data.error) {
        setFormError(data.error);
        return;
      }

      if (data.region) {
        if (editId) {
          setRegions((r) => r.map((x) => (x.id === editId ? data.region! : x)));
        } else {
          setRegions((r) => [...r, data.region!]);
        }
        cancel();
      }
    } catch {
      setFormError("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string) {
    setToggling(id);
    try {
      const res = await fetch(`/api/admin/regions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggleActive: true }),
      });
      const data = await res.json() as { region?: DeliveryRegionDto; error?: string };
      if (data.region) {
        setRegions((r) => r.map((x) => (x.id === id ? data.region! : x)));
      }
    } catch {
      // non-blocking
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--kt-text-muted)]">
          {regions.length} region{regions.length !== 1 ? "s" : ""} configured
        </p>
        {!showForm && (
          <Button variant="primary" size="sm" onClick={openCreate}>
            + Add region
          </Button>
        )}
      </div>

      {/* Region form */}
      {showForm && (
        <Card>
          <h2 className="text-sm font-extrabold text-[var(--kt-ink-navy)] mb-4">
            {editId ? "Edit region" : "New delivery region"}
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rg_name" required>Region name</Label>
                <Input
                  id="rg_name"
                  placeholder="e.g. Cape Town Metro"
                  value={form.name}
                  onChange={(e) => {
                    setField("name", e.target.value);
                    if (!editId) setField("slug", buildSlug(e.target.value));
                  }}
                />
              </div>
              <div>
                <Label htmlFor="rg_slug" required>Slug</Label>
                <Input
                  id="rg_slug"
                  placeholder="e.g. cape-town-metro"
                  value={form.slug}
                  onChange={(e) => setField("slug", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rg_city">City / area</Label>
                <Input
                  id="rg_city"
                  placeholder="e.g. Cape Town"
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="rg_province">Province</Label>
                <Input
                  id="rg_province"
                  placeholder="e.g. Western Cape"
                  value={form.province}
                  onChange={(e) => setField("province", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="rg_lat">Center lat</Label>
                <Input
                  id="rg_lat"
                  type="number"
                  placeholder="-33.9249"
                  value={form.centerLat}
                  onChange={(e) => setField("centerLat", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="rg_lng">Center lng</Label>
                <Input
                  id="rg_lng"
                  type="number"
                  placeholder="18.4241"
                  value={form.centerLng}
                  onChange={(e) => setField("centerLng", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="rg_radius">Radius (km)</Label>
                <Input
                  id="rg_radius"
                  type="number"
                  min={0}
                  placeholder="25"
                  value={form.coverageRadiusKm}
                  onChange={(e) => setField("coverageRadiusKm", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="rg_maxdist">Max distance (km)</Label>
                <Input
                  id="rg_maxdist"
                  type="number"
                  min={0}
                  placeholder="50"
                  value={form.maxDistanceKm}
                  onChange={(e) => setField("maxDistanceKm", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="rg_basefee">Base fee (ZAR)</Label>
                <Input
                  id="rg_basefee"
                  type="number"
                  min={0}
                  placeholder="0.00"
                  value={form.baseFee}
                  onChange={(e) => setField("baseFee", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="rg_order">Display order</Label>
                <Input
                  id="rg_order"
                  type="number"
                  min={0}
                  value={form.displayOrder}
                  onChange={(e) => setField("displayOrder", e.target.value)}
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-[var(--kt-signal-cobalt)] w-4 h-4"
                    checked={form.active}
                    onChange={(e) => setField("active", e.target.checked)}
                  />
                  <span className="text-sm font-medium text-[var(--kt-ink-navy)]">Active</span>
                </label>
              </div>
            </div>

            <div>
              <Label htmlFor="rg_description">Description</Label>
              <Input
                id="rg_description"
                placeholder="Brief region description"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="rg_notes">Internal notes</Label>
              <Textarea
                id="rg_notes"
                rows={2}
                placeholder="Operational notes, coverage caveats, etc."
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </div>

            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !form.name.trim() || !form.slug.trim()}>
                {saving ? "Saving…" : editId ? "Save changes" : "Create region"}
              </Button>
              <Button variant="ghost" size="sm" onClick={cancel} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Regions list */}
      {regions.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--kt-text-muted)] text-center py-6">
            No delivery regions configured. Add a region to define service areas and coverage rules.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {regions.map((region) => (
            <Card key={region.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-bold text-[var(--kt-ink-navy)]">{region.name}</p>
                    <StatusBadge active={region.active} />
                  </div>
                  <p className="text-xs text-[var(--kt-text-muted)] font-mono mb-2">{region.slug}</p>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--kt-text-muted)]">
                    {(region.city || region.province) && (
                      <span>{[region.city, region.province].filter(Boolean).join(", ")}</span>
                    )}
                    {region.centerLat && region.centerLng && (
                      <span>
                        {region.centerLat.toFixed(4)}, {region.centerLng.toFixed(4)}
                        {region.coverageRadiusKm && ` · ${region.coverageRadiusKm} km radius`}
                      </span>
                    )}
                    {region.maxDistanceKm && (
                      <span>Max {region.maxDistanceKm} km</span>
                    )}
                    {region.baseFee && (
                      <span>Base ZAR {region.baseFee.toFixed(2)}</span>
                    )}
                  </div>

                  {region.description && (
                    <p className="text-xs text-[var(--kt-text-muted)] mt-1.5">{region.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(region)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleActive(region.id)}
                    disabled={toggling === region.id}
                  >
                    {toggling === region.id ? "…" : region.active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
