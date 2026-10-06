"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { FileInput } from "@/components/ui/FileInput";
export function MarketingArtworkUpload() {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function upload(form: HTMLFormElement) {
    setBusy(true);
    setError("");
    setNotice("");
    const f = new FormData(form),
      file = f.get("file");
    if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024) {
      setError("Select a JPG, PNG or WebP image up to 5 MB.");
      setBusy(false);
      return;
    }
    try {
      const r = await fetch("/api/store/marketing-media", {
        method: "POST",
        body: f,
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error ?? "Image upload failed.");
      form.reset();
      setNotice(
        "Artwork uploaded. Select it when attaching campaign creative.",
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void upload(e.currentTarget);
      }}
      className="space-y-4"
    >
      <Label htmlFor="marketing-artwork">Upload campaign artwork</Label>
      <FileInput
        id="marketing-artwork"
        name="file"
        accept="image/jpeg,image/png,image/webp"
        required
        disabled={busy}
        className="block w-full text-sm"
      />
      <p className="text-sm">
        JPG, PNG or WebP, up to 5 MB. Uploaded artwork is available to your
        authorized marketing team.
      </p>
      <Button type="submit" loading={busy}>
        Upload artwork
      </Button>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}
