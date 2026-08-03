"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";

interface ProfileFormProps {
  defaultValues?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

export function ProfileForm({ defaultValues }: ProfileFormProps) {
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [phone, setPhone] = useState(defaultValues?.phone ?? "");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    setErrors({});
    setServerError(null);

    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null, phone: phone.trim() || null }),
      });

      const data = await res.json() as {
        success?: boolean;
        errors?: Record<string, string>;
        message?: string;
      };

      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors);
        } else {
          setServerError(data.message ?? "Something went wrong. Please try again.");
        }
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 max-w-lg">
      <div>
        <Label htmlFor="profile_name" required>Full name</Label>
        <Input
          id="profile_name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          error={errors.name}
          required
        />
      </div>
      <div>
        <Label htmlFor="profile_email">Email address</Label>
        <Input
          id="profile_email"
          name="email"
          type="email"
          value={defaultValues?.email ?? ""}
          readOnly
          disabled
          helpText="Email address cannot be changed here."
        />
      </div>
      <div>
        <Label htmlFor="profile_phone">Phone number</Label>
        <Input
          id="profile_phone"
          name="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="07700 000000"
          error={errors.phone}
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
          <span className="text-sm text-[--kt-green] font-medium">Changes saved</span>
        )}
      </div>
    </form>
  );
}
