"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
export function StoreBrandingUploader() {
  const [images, setImages] = useState<{ logo: string | null; cover: string | null }>({ logo: null, cover: null });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
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
    setBusy(true); setMessage("Uploading and checking your image…");
    try {
      const form = new FormData(); form.set("file", file); form.set("purpose", purpose);
      const response = await fetch("/api/store/profile-media", { method: "POST", headers: { "X-Catalog-Operation-Id": crypto.randomUUID() }, body: form });
      const result = await response.json();
      if (!response.ok || result.asset?.status !== "READY") throw Error(result.error || "The image could not be saved.");
      setImages(current => ({ ...current, [purpose === "STORE_LOGO" ? "logo" : "cover"]: result.asset.publicReference }));
      setMessage("Your store image has been saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The upload failed. Please retry."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4">
    <p className="text-sm text-[var(--kt-text-muted)]">Add your store logo and cover photo. Choose a JPEG, PNG or WebP image at least 300 × 300 pixels, up to 8 MiB.</p>
    <div className="grid gap-6 sm:grid-cols-2">{(["logo", "cover"] as const).map(kind => <div key={kind} className="space-y-3">
      <label htmlFor={`store-${kind}-upload`} className="block text-sm font-bold">{kind === "logo" ? "Store logo" : "Store cover photo"}</label>
      {images[kind] && <Image unoptimized src={`/api/store/profile-media?reference=${encodeURIComponent(images[kind])}`} alt={kind === "logo" ? "Your store logo" : "Your store cover photo"} width={640} height={300} className="h-40 w-full rounded-xl border object-contain" />}
      <input id={`store-${kind}-upload`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="block w-full text-sm" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file, kind === "logo" ? "STORE_LOGO" : "STORE_HERO"); event.currentTarget.value = ""; }} />
    </div>)}</div>
    <p role="status" className="text-sm">{message}</p>
  </div>;
}
