"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  PROVINCES,
  SIZES,
  type DeliveryConfiguration as Config,
} from "@/lib/client-platform/contracts";
type Version = Config & { version: number; id: string };
export function DeliveryConfiguration() {
  const [rows, setRows] = useState<Version[]>([]);
  const [selected, setSelected] = useState<Version | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/admin/delivery-configuration")
      .then(async (r) => {
        const v = await r.json();
        if (!r.ok) throw new Error(v.error);
        setRows(v);
      })
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <div className="space-y-6">
      <Label htmlFor="service-config">Delivery service</Label>
      <select
        id="service-config"
        className="w-full border-b py-3"
        onChange={(e) =>
          setSelected(rows.find((r) => r.stableKey === e.target.value) ?? null)
        }
      >
        <option value="">Create new service</option>
        {rows.map((r) => (
          <option key={r.stableKey} value={r.stableKey}>
            {r.displayName} · v{r.version} · {r.active ? "active" : "draft"}
          </option>
        ))}
      </select>
      <form
        key={selected?.id ?? "new"}
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setMessage("");
          const tariff = (size: string) => ({
            baseFee: f.get(`${size}-base`),
            perKmRate: f.get(`${size}-km`),
            maximumWeightKg: f.get(`${size}-weight`)
              ? Number(f.get(`${size}-weight`))
              : null,
            minimumCharge: f.get(`${size}-minimum`) || null,
          });
          try {
            const r = await fetch("/api/admin/delivery-configuration", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                stableKey: f.get("stableKey"),
                displayName: f.get("displayName"),
                active: f.get("active") === "on",
                turnaround: f.get("turnaround"),
                provinces: f.getAll("province"),
                regionIds: selected?.regionIds ?? [],
                tariffs: {
                  SMALL: tariff("SMALL"),
                  MEDIUM: tariff("MEDIUM"),
                  LARGE: tariff("LARGE"),
                },
                expectedVersion: selected?.version ?? 0,
                reason: f.get("reason"),
              }),
            });
            const v = await r.json();
            if (!r.ok) throw new Error(v.error);
            const list = await fetch("/api/admin/delivery-configuration");
            if (!list.ok)
              throw new Error(
                "Saved. Refresh the service list before another change.",
              );
            const updated = await list.json();
            setRows(updated);
            setSelected(
              updated.find((r: Version) => r.stableKey === f.get("stableKey")),
            );
            setMessage("New service version saved.");
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Save unavailable.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="stableKey">Stable service key</Label>
            <Input
              id="stableKey"
              name="stableKey"
              required
              pattern="CLIENT_[A-Z0-9_]{2,40}"
              defaultValue={selected?.stableKey ?? "CLIENT_"}
              readOnly={!!selected}
            />
          </div>
          <div>
            <Label htmlFor="displayName">Service name</Label>
            <Input
              id="displayName"
              name="displayName"
              required
              defaultValue={selected?.displayName ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="turnaround">Turnaround</Label>
            <Input
              id="turnaround"
              name="turnaround"
              required
              defaultValue={selected?.turnaround ?? ""}
            />
          </div>
          <label>
            <input
              name="active"
              type="checkbox"
              defaultChecked={selected?.active}
            />{" "}
            Available for quotations
          </label>
        </div>
        <fieldset>
          <legend className="mb-3 font-semibold">Active provinces</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {PROVINCES.map((p) => (
              <label key={p}>
                <input
                  name="province"
                  type="checkbox"
                  value={p}
                  defaultChecked={selected?.provinces.includes(p)}
                />{" "}
                {p}
              </label>
            ))}
          </div>
          <p className="mt-3 text-sm">
            Mapped addresses must also fall inside operationally active delivery
            regions. Configure those regions in coverage settings.
          </p>
        </fieldset>
        {SIZES.map((size) => (
          <fieldset key={size} className="grid gap-4 sm:grid-cols-4">
            <legend className="mb-3 font-semibold">
              {size.toLowerCase()} parcel
            </legend>
            {(
              [
                ["base", "Base fee (R)", selected?.tariffs[size].baseFee],
                ["km", "Rate / km (R)", selected?.tariffs[size].perKmRate],
                [
                  "weight",
                  "Maximum kg (optional)",
                  selected?.tariffs[size].maximumWeightKg,
                ],
                [
                  "minimum",
                  "Minimum charge (optional)",
                  selected?.tariffs[size].minimumCharge,
                ],
              ] as const
            ).map(([key, label, value]) => (
              <div key={key}>
                <Label htmlFor={`${size}-${key}`}>{label}</Label>
                <Input
                  id={`${size}-${key}`}
                  name={`${size}-${key}`}
                  type="number"
                  min={0}
                  step={key === "weight" ? "0.0001" : "0.01"}
                  required={key === "base" || key === "km"}
                  defaultValue={value ?? ""}
                />
              </div>
            ))}
          </fieldset>
        ))}
        <Label htmlFor="config-reason">Reason for change</Label>
        <Input
          id="config-reason"
          name="reason"
          required
          minLength={5}
          maxLength={500}
        />
        <Button type="submit" loading={busy}>
          Save a new version
        </Button>
      </form>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
