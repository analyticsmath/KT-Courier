"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import type { BusinessPromotion } from "@/lib/client-platform/promotion-authoring.service";
type Option = { id: string; name: string };
export function PromotionDraftForm({
  initial,
  products,
  categories,
}: {
  initial?: BusinessPromotion;
  products: Option[];
  categories: Option[];
}) {
  const router = useRouter(),
    [requestId] = useState(() => crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(form: HTMLFormElement) {
    setBusy(true);
    setError("");
    try {
      const f = new FormData(form),
        text = (k: string) => String(f.get(k) ?? ""),
        optional = (k: string) => text(k) || null;
      const draft = {
        requestId,
        name: text("name"),
        description: text("description"),
        mechanism: text("mechanism"),
        value: text("value"),
        maximumDiscountAmount: optional("maximumDiscountAmount"),
        minimumSubtotal: optional("minimumSubtotal"),
        proposedBudget: text("proposedBudget"),
        startsAt: new Date(`${text("startsAt")}Z`).toISOString(),
        endsAt: new Date(`${text("endsAt")}Z`).toISOString(),
        globalLimit: Number(text("globalLimit")),
        perCustomerLimit: Number(text("perCustomerLimit")),
        coupon: optional("coupon"),
        productIds: f.getAll("productIds").map(String),
        categoryIds: f.getAll("categoryIds").map(String),
      };
      const r = await fetch(
        initial
          ? `/api/store/promotions/${encodeURIComponent(initial.reference)}`
          : "/api/store/promotions",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            initial ? { draft, expectedRevision: initial.revision } : draft,
          ),
        },
      );
      const b = await r.json();
      if (!r.ok) throw Error(b.error ?? "Could not save promotion.");
      router.push(`/store/promotions/${encodeURIComponent(b.reference)}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save promotion.");
    } finally {
      setBusy(false);
    }
  }
  const fields = [
    {
      name: "name",
      label: "Campaign name",
      type: "text",
      value: initial?.name,
      required: true,
    },
    {
      name: "value",
      label: "Discount value (% or ZAR)",
      type: "number",
      value: initial?.value,
      required: true,
    },
    {
      name: "maximumDiscountAmount",
      label: "Maximum discount per order (ZAR, optional)",
      type: "number",
      value: initial?.maximumDiscountAmount,
    },
    {
      name: "minimumSubtotal",
      label: "Minimum eligible subtotal (ZAR, optional)",
      type: "number",
      value: initial?.minimumSubtotal,
    },
    {
      name: "proposedBudget",
      label: "Proposed campaign budget (ZAR)",
      type: "number",
      value: initial?.proposedBudget,
      required: true,
    },
    {
      name: "startsAt",
      label: "Starts at (UTC)",
      type: "datetime-local",
      value: initial?.startsAt.slice(0, 16),
      required: true,
    },
    {
      name: "endsAt",
      label: "Ends at (UTC)",
      type: "datetime-local",
      value: initial?.endsAt.slice(0, 16),
      required: true,
    },
    {
      name: "globalLimit",
      label: "Maximum total uses",
      type: "number",
      value: initial?.globalLimit ?? 100,
      required: true,
    },
    {
      name: "perCustomerLimit",
      label: "Maximum uses per customer",
      type: "number",
      value: initial?.perCustomerLimit ?? 1,
      required: true,
    },
    {
      name: "coupon",
      label: "Coupon code (blank for automatic promotion)",
      type: "text",
      value: "",
    },
  ];
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(e.currentTarget);
      }}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name}>
            <Label htmlFor={`promotion-${f.name}`}>{f.label}</Label>
            <Input
              id={`promotion-${f.name}`}
              name={f.name}
              type={f.type}
              defaultValue={f.value ?? ""}
              required={f.required}
              {...(f.type === "number"
                ? { min: 0.01, step: f.name.endsWith("Limit") ? 1 : 0.01 }
                : {})}
              maxLength={f.name === "coupon" ? 32 : 120}
            />
          </div>
        ))}
      </div>
      {initial?.couponMasked && (
        <p>
          Current coupon: {initial.couponMasked}. Re-enter its code to retain it
          when saving. A blank code changes the draft to an automatic promotion.
        </p>
      )}
      <div>
        <Label htmlFor="promotion-mechanism">Discount type</Label>
        <select
          id="promotion-mechanism"
          name="mechanism"
          defaultValue={initial?.mechanism ?? "PERCENTAGE"}
          className="w-full border p-3"
        >
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED_AMOUNT">Fixed amount (ZAR)</option>
        </select>
      </div>
      <div>
        <Label htmlFor="promotion-description">
          Customer-facing description
        </Label>
        <textarea
          id="promotion-description"
          name="description"
          minLength={10}
          maxLength={1000}
          required
          defaultValue={initial?.description ?? ""}
          className="w-full border p-3"
          rows={3}
        />
      </div>
      {[
        {
          name: "productIds",
          label: "Products",
          items: products,
          values: initial?.productIds,
        },
        {
          name: "categoryIds",
          label: "Categories",
          items: categories,
          values: initial?.categoryIds,
        },
      ].map((g) => (
        <div key={g.name}>
          <Label htmlFor={`promotion-${g.name}`}>{g.label} (optional)</Label>
          <select
            id={`promotion-${g.name}`}
            name={g.name}
            multiple
            defaultValue={g.values ?? []}
            className="w-full border p-3"
            size={Math.max(2, Math.min(6, g.items.length))}
          >
            {g.items.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      ))}
      <p className="text-sm">
        Leave targets empty to cover your business catalog. The proposed budget
        is a review request; saving a draft does not charge your wallet or
        activate a discount.
      </p>
      {error && <p role="alert">{error}</p>}
      <Button type="submit" loading={busy}>
        Save draft
      </Button>
    </form>
  );
}
export function PromotionSubmitButton({
  reference,
  revision,
}: {
  reference: string;
  revision: number;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      <Button
        type="button"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await fetch(
              `/api/store/promotions/${encodeURIComponent(reference)}/submit`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ expectedRevision: revision }),
              },
            );
            const b = await r.json();
            if (!r.ok) throw Error(b.error ?? "Submission failed.");
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Submission failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Submit for review
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
