"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
export function BusinessSupportAccess({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function open() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/business-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, reason }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error ?? "Support access could not be opened.");
      router.push(
        `/admin/business-support/${storeId}?grant=${encodeURIComponent(b.id)}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Support access unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void open();
      }}
    >
      <Label htmlFor="business-support-reason">
        Reason for accessing this business
      </Label>
      <textarea
        id="business-support-reason"
        required
        minLength={10}
        maxLength={1000}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        className="w-full border rounded-[var(--eo-radius-control)] p-3"
      />
      <p className="text-sm">
        The business can see your identity, reason and access time. This support
        session expires after 15 minutes.
      </p>
      <Button type="submit" loading={busy}>
        Open read-only business dashboard
      </Button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
