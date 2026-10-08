"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FileInput } from "@/components/ui/FileInput";
import { Button } from "@/components/ui/Button";
import { createDriverOperationIdStore } from "@/lib/driver-operations/client-operation";
export function StoreBrandingUploader() {
  const [images, setImages] = useState<{ logo: string | null; cover: string | null }>({ logo: null, cover: null });
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false), operations = useRef(createDriverOperationIdStore());
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/store/profile-media", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw Error("Store images could not be loaded.");
      const body = await response.json();
      if (active) setImages(body);
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, []);
  async function upload(file: File, purpose: "STORE_LOGO" | "STORE_HERO") {
    if (busyRef.current) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) { setFailed(true); setMessage("Choose a JPEG, PNG or WebP image up to 8 MiB."); return; }
    busyRef.current = true; setBusy(true); setFailed(false); setMessage("Uploading and checking your image…");
    try {
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, "0")).join("");
      const form = new FormData(); form.set("file", file); form.set("purpose", purpose);
      const response = await fetch("/api/store/profile-media", { method: "POST", headers: { "X-Catalog-Operation-Id": operations.current.get(purpose, { digest }) }, body: form });
      const result = await response.json();
      if (!response.ok || result.asset?.status !== "READY") throw Error(result.error || "The image could not be saved.");
      setImages(current => ({ ...current, [purpose === "STORE_LOGO" ? "logo" : "cover"]: result.asset.publicReference }));
      operations.current.clear(purpose);
      setMessage("Your store image has been saved.");
    } catch (error) { setFailed(true); setMessage(error instanceof TypeError ? "The upload could not be confirmed. Retry the same file after reconnecting." : error instanceof Error ? error.message : "The upload failed. Please retry."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function remove(kind: "logo" | "cover") {
    const reference = images[kind];
    if (busyRef.current || !reference) return;
    busyRef.current = true; setBusy(true); setFailed(false); setMessage("");
    const action = `remove-${kind}`;
    try {
      const response = await fetch("/api/store/profile-media", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, operationId: operations.current.get(action, { reference }) }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "The store image could not be removed. Refresh before retrying.");
      operations.current.clear(action); setImages(current => ({ ...current, [kind]: null })); setMessage("Your store image has been removed.");
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Removal could not be confirmed. Retry after reconnecting."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <div className="space-y-4">
    <p className="text-sm text-[var(--kt-text-muted)]">Add your store logo and cover photo. Choose a JPEG, PNG or WebP image at least 300 × 300 pixels, up to 8 MiB.</p>
    <div className="grid gap-6 sm:grid-cols-2">{(["logo", "cover"] as const).map(kind => <div key={kind} className="space-y-3">
      <label htmlFor={`store-${kind}-upload`} className="block text-sm font-bold">{kind === "logo" ? "Store logo" : "Store cover photo"}</label>
      {images[kind] && <Image unoptimized src={`/api/store/profile-media?reference=${encodeURIComponent(images[kind])}`} alt={kind === "logo" ? "Your store logo" : "Your store cover photo"} width={640} height={300} className="h-40 w-full rounded-xl border object-contain" />}
      <FileInput id={`store-${kind}-upload`} accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file, kind === "logo" ? "STORE_LOGO" : "STORE_HERO"); event.currentTarget.value = ""; }} />
      {images[kind] && <Button type="button" variant="secondary" disabled={busy} onClick={() => void remove(kind)}>{kind === "logo" ? "Remove store logo" : "Remove store cover photo"}</Button>}
    </div>)}</div>
    <p role={failed ? "alert" : "status"} aria-live="polite" className="text-sm">{message}</p>
  </div>;
}
