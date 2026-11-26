"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import {
  DEFAULT_STORE_OPERATING_HOURS,
  STORE_WEEKDAYS,
  type StoreOperatingHours,
  type StoreWeekday,
} from "@/lib/qa-acceptance/operating-hours";

interface StoreProfileFormProps {
  defaultValues?: {
    storeName?: string;
    contactPerson?: string;
    businessPhone?: string;
    businessEmail?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    operatingHours?: StoreOperatingHours | null;
  };
  userEmail?: string;
}

const WEEKDAY_DISPLAY: Record<StoreWeekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export function StoreProfileForm({ defaultValues, userEmail }: StoreProfileFormProps) {
  const router = useRouter();
  const pending = useRef(false);
  const [fields, setFields] = useState({
    storeName: defaultValues?.storeName ?? "",
    contactPerson: defaultValues?.contactPerson ?? "",
    businessPhone: defaultValues?.businessPhone ?? "",
    businessEmail: defaultValues?.businessEmail ?? "",
    addressLine1: defaultValues?.addressLine1 ?? "",
    addressLine2: defaultValues?.addressLine2 ?? "",
    city: defaultValues?.city ?? "",
    province: defaultValues?.province ?? "",
    postalCode: defaultValues?.postalCode ?? "",
  });
  const [operatingHours, setOperatingHours] = useState<StoreOperatingHours>(
    () => defaultValues?.operatingHours ?? DEFAULT_STORE_OPERATING_HOURS,
  );
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  function set(key: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setSaved(false);
      setFields((f) => ({ ...f, [key]: e.target.value }));
    };
  }

  function updateDaySchedule(
    day: StoreWeekday,
    patch: Partial<{ closed: boolean; open: string; close: string }>,
  ) {
    setSaved(false);
    setOperatingHours((prev) => ({
      ...prev,
      days: {
        ...prev.days,
        [day]: {
          ...prev.days[day],
          ...patch,
        },
      },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setSaved(false);
    setErrors({});
    setServerError(null);

    const body = {
      storeName: fields.storeName.trim(),
      contactPerson: fields.contactPerson.trim(),
      businessPhone: fields.businessPhone.trim(),
      businessEmail: fields.businessEmail.trim(),
      operatingHours,
    };

    try {
      const res = await fetch("/api/store/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json() as {
        success?: boolean;
        fields?: Record<string, string>;
        error?: string;
      };

      if (!res.ok) {
        if (data.fields) {
          setErrors(data.fields);
        } else {
          setServerError(data.error ?? "The changes could not be saved. Please try again.");
        }
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <fieldset disabled={loading} className="space-y-6">
      <div>
        <h2 className="text-sm font-bold text-[--kt-text] mb-5">Store information</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="sp_store_name" required>Business / store name</Label>
            <Input
              id="sp_store_name"
              value={fields.storeName}
              onChange={set("storeName")}
              placeholder="Your store name"
              error={errors.storeName}
              required
            />
          </div>
          <div>
            <Label htmlFor="sp_contact_person" required>Contact person</Label>
            <Input
              id="sp_contact_person"
              value={fields.contactPerson}
              onChange={set("contactPerson")}
              placeholder="Full name"
              error={errors.contactPerson}
              required
            />
          </div>
          <div>
            <Label htmlFor="sp_business_phone">Business phone</Label>
            <Input
              id="sp_business_phone"
              type="tel"
              value={fields.businessPhone}
              onChange={set("businessPhone")}
              placeholder="+27 11 123 4567"
              error={errors.businessPhone}
            />
          </div>
          <div>
            <Label htmlFor="sp_business_email">Business email</Label>
            <Input
              id="sp_business_email"
              type="email"
              value={fields.businessEmail}
              onChange={set("businessEmail")}
              placeholder="store@example.com"
              error={errors.businessEmail}
            />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-bold text-[--kt-text] mb-2">Trading &amp; collection hours ({operatingHours.timezone})</h2>
        <p className="text-xs text-[--kt-text-soft] mb-4">Set open days, trading windows, and courier collection notes for storefront display.</p>
        <div className="space-y-3 rounded-xl border border-[--kt-border] p-4">
          {STORE_WEEKDAYS.map((day) => {
            const slot = operatingHours.days[day];
            return (
              <div key={day} className="grid grid-cols-1 gap-2 sm:grid-cols-[130px_90px_1fr_1fr] sm:items-center">
                <span className="text-xs font-semibold text-[--kt-text]">{WEEKDAY_DISPLAY[day]}</span>
                <label className="inline-flex items-center gap-2 text-xs text-[--kt-text-soft]">
                  <input
                    type="checkbox"
                    checked={!slot.closed}
                    onChange={(e) =>
                      updateDaySchedule(day, {
                        closed: !e.target.checked,
                        ...(e.target.checked && (!slot.open || !slot.close)
                          ? { open: "08:00", close: "17:00" }
                          : {}),
                      })
                    }
                  />
                  Open
                </label>
                <Input
                  id={`sp_hours_${day}_open`}
                  type="time"
                  aria-label={`${WEEKDAY_DISPLAY[day]} open time`}
                  disabled={slot.closed}
                  value={slot.closed ? "" : (slot.open ?? "08:00")}
                  onChange={(e) => updateDaySchedule(day, { open: e.target.value })}
                />
                <Input
                  id={`sp_hours_${day}_close`}
                  type="time"
                  aria-label={`${WEEKDAY_DISPLAY[day]} close time`}
                  disabled={slot.closed}
                  value={slot.closed ? "" : (slot.close ?? "17:00")}
                  onChange={(e) => updateDaySchedule(day, { close: e.target.value })}
                />
              </div>
            );
          })}
          <div className="pt-2">
            <Label htmlFor="sp_collection_note">Collection window note</Label>
            <Input
              id="sp_collection_note"
              value={operatingHours.collectionWindowNote ?? ""}
              onChange={(e) => {
                setSaved(false);
                setOperatingHours((prev) => ({
                  ...prev,
                  collectionWindowNote: e.target.value,
                }));
              }}
              placeholder="Courier collection Monday to Friday, 09:00 to 16:30 SAST."
            />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-bold text-[--kt-text] mb-4">Login / account email</h2>
        <Input
          id="sp_user_email"
          type="email"
          value={userEmail ?? ""}
          readOnly
          disabled
          helpText="Login email cannot be changed here."
        />
      </div>

      {serverError && (
        <p className="text-sm text-[--kt-red]" role="alert">{serverError}</p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="md" loading={loading}>
          Save changes
        </Button>
        {saved && (
          <span role="status" className="text-sm text-[--kt-green] font-medium">Changes saved</span>
        )}
      </div>
      </fieldset>
    </form>
  );
}
