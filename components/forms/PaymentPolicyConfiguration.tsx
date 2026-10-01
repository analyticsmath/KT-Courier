"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROVINCES } from "@/lib/client-platform/contracts";
import type { listPaymentConfigurations } from "@/lib/client-platform/payment-configuration.service";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
type Data = Awaited<ReturnType<typeof listPaymentConfigurations>>;
type Policy = Data["policies"][number];
export function PaymentPolicyConfiguration({ data }: { data: Data }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Policy | null>(null),
    [mode, setMode] = useState("DEPOSIT_PLUS_COD"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function save(form: HTMLFormElement) {
    const f = new FormData(form);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/admin/payment-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: f.get("storeId") || null,
          deliveryServiceId: f.get("service") || null,
          provinces: f.getAll("province").length ? f.getAll("province") : null,
          regionId: f.get("region") || null,
          orderId: f.get("orderId") || null,
          mode,
          depositPercent:
            mode === "DEPOSIT_PLUS_COD"
              ? (Number(f.get("percent")) / 100).toFixed(4)
              : null,
          maximumCodAmount: mode !== "DIGITAL" ? f.get("maximum") : null,
          active: f.get("active") === "on",
          expectedVersion: editing?.expectedVersion ?? 0,
          reason: f.get("reason"),
        }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error ?? "Policy could not be saved.");
      setNotice(`Policy version ${b.version} saved.`);
      setEditing(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Policy could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-8">
      <p className="text-sm">
        Cash is enabled only for the approved business and matching scopes.
        Existing bookings keep their committed split. An order override can
        change an unpaid order before payment is prepared or pickup begins.
      </p>
      <form
        key={editing?.id ?? "new"}
        onSubmit={(e) => {
          e.preventDefault();
          void save(e.currentTarget);
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <div>
          <Label htmlFor="policy-store">Approved business</Label>
          <select
            id="policy-store"
            name="storeId"
            required={mode !== "DIGITAL"}
            defaultValue={editing?.storeId ?? ""}
            disabled={busy || !!editing}
            className="w-full min-h-12 border-b"
          >
            <option value="">All businesses (digital only)</option>
            {data.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {editing && (
            <input type="hidden" name="storeId" value={editing.storeId ?? ""} />
          )}
        </div>
        <div>
          <Label htmlFor="policy-mode">Payment method</Label>
          <select
            id="policy-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="w-full min-h-12 border-b"
          >
            <option value="DIGITAL">Full online payment</option>
            <option value="DEPOSIT_PLUS_COD">
              Online deposit + cash on delivery
            </option>
            <option value="FULL_COD">Full cash on delivery</option>
          </select>
        </div>
        <div>
          <Label htmlFor="policy-service">Service</Label>
          <select
            id="policy-service"
            name="service"
            defaultValue={editing?.deliveryServiceId ?? ""}
            disabled={!!editing}
            className="w-full min-h-12 border-b"
          >
            <option value="">All services</option>
            {data.services.map((s) => (
              <option key={s.stableKey} value={s.stableKey}>
                {s.displayName}
              </option>
            ))}
          </select>
          {editing && (
            <input
              type="hidden"
              name="service"
              value={editing.deliveryServiceId ?? ""}
            />
          )}
        </div>
        <div>
          <Label htmlFor="policy-region">Destination region</Label>
          <select
            id="policy-region"
            name="region"
            defaultValue={editing?.regionId ?? ""}
            disabled={!!editing}
            className="w-full min-h-12 border-b"
          >
            <option value="">All regions</option>
            {data.regions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {editing && (
            <input type="hidden" name="region" value={editing.regionId ?? ""} />
          )}
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="font-medium mb-3">
            Provinces (leave empty for all)
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {PROVINCES.map((p) => (
              <label key={p} className="flex gap-2 text-sm">
                <input
                  name="province"
                  type="checkbox"
                  value={p}
                  defaultChecked={editing?.provinces?.includes(p)}
                  disabled={!!editing}
                />
                {p}
              </label>
            ))}
          </div>
          {editing?.provinces?.map((p) => (
            <input key={p} type="hidden" name="province" value={p} />
          ))}
        </fieldset>
        {mode === "DEPOSIT_PLUS_COD" && (
          <div>
            <Label htmlFor="policy-percent">Online deposit (%)</Label>
            <Input
              id="policy-percent"
              name="percent"
              type="number"
              min="0.01"
              max="99.99"
              step="0.01"
              required
              defaultValue={
                editing?.depositPercent
                  ? Number(editing.depositPercent) * 100
                  : 50
              }
            />
          </div>
        )}
        {mode !== "DIGITAL" && (
          <div>
            <Label htmlFor="policy-maximum">
              Maximum cash per delivery (ZAR)
            </Label>
            <Input
              id="policy-maximum"
              name="maximum"
              inputMode="decimal"
              required
              pattern="[0-9]+([.][0-9]{1,2})?"
              defaultValue={editing?.maximumCodAmount ?? ""}
            />
          </div>
        )}
        <div>
          <Label htmlFor="policy-order">Specific delivery ID (optional)</Label>
          <Input
            id="policy-order"
            name="orderId"
            defaultValue={editing?.orderId ?? ""}
            readOnly={!!editing}
            maxLength={40}
          />
        </div>
        <label className="flex items-center gap-3">
          <input
            name="active"
            type="checkbox"
            defaultChecked={editing?.active ?? true}
          />
          Enable this policy
        </label>
        <div className="sm:col-span-2">
          <Label htmlFor="policy-reason">Reason for change</Label>
          <Input
            id="policy-reason"
            name="reason"
            required
            minLength={10}
            maxLength={500}
          />
        </div>
        <div className="flex gap-3 sm:col-span-2">
          <Button type="submit" loading={busy}>
            Save policy version
          </Button>
          {editing && (
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(null);
                setMode("DEPOSIT_PLUS_COD");
              }}
            >
              New policy
            </Button>
          )}
        </div>
      </form>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <section className="space-y-4">
        <h2 className="font-semibold">Policy history</h2>
        {data.policies.length ? (
          data.policies.map((p) => (
            <article
              key={p.id}
              className="flex flex-wrap justify-between gap-4 border-b pb-4"
            >
              <div>
                <p className="font-medium">
                  {data.stores.find((s) => s.id === p.storeId)?.name ??
                    p.storeId ??
                    "All businesses"}{" "}
                  · v{p.expectedVersion}
                </p>
                <p className="text-sm">
                  {p.mode.replaceAll("_", " ")} ·{" "}
                  {p.active ? "Active" : "Inactive"} ·{" "}
                  {p.provinces?.join(", ") ?? "All provinces"}
                </p>
                {p.orderId && <p className="text-sm">Delivery: {p.orderId}</p>}
              </div>
              {p.editable && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setEditing(p);
                    setMode(p.mode);
                    setError("");
                    setNotice("");
                  }}
                >
                  Edit policy
                </Button>
              )}
            </article>
          ))
        ) : (
          <p>No payment policies configured.</p>
        )}
      </section>
    </div>
  );
}
