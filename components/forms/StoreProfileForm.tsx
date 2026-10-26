"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";

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
  };
  userEmail?: string;
}

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
