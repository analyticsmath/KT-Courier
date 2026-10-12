"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function InventoryLocationForm() {
  const router = useRouter();
  const command = useRef<{ name: string; operationId: string } | null>(null);
  const pending = useRef(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(""); setStatus("");
    const trimmed = name.trim();
    if (!command.current || command.current.name !== trimmed) command.current = { name: trimmed, operationId: crypto.randomUUID() };
    try {
      const response = await fetch("/api/store/catalog/inventory/locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command.current) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error ?? "The stock location could not be saved.");
      setStatus(`Stock location saved: ${result.location.name}.`); setName(""); command.current = null; router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The save could not be confirmed. Retry to check its receipt."); }
    finally { pending.current = false; setBusy(false); }
  }

  return <form onSubmit={submit} aria-labelledby="stock-location-heading" className="space-y-4 rounded-xl border p-5">
    <h2 id="stock-location-heading" className="text-xl font-semibold">Create a stock location</h2>
    <p className="text-sm">Name the place where you hold product stock, such as your stockroom. You can then choose it when adding opening stock to a product.</p>
    <div><label htmlFor="stock-location-name" className="mb-2 block font-medium">Stock location name</label><Input id="stock-location-name" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={120} required disabled={busy} aria-describedby={error ? "stock-location-error" : undefined} /></div>
    <Button type="submit" disabled={busy}>{busy ? "Saving stock location…" : "Save stock location"}</Button>
    <p role="status">{status}</p><p id="stock-location-error" role="alert" className="text-sm text-red-600">{error}</p>
  </form>;
}
