/* eslint-disable @next/next/no-img-element -- Private profile images require the browser session cookie. */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
export function ProfileAvatar({ hasAvatar = false }: { hasAvatar?: boolean }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [image, setImage] = useState(hasAvatar),
    [revision, setRevision] = useState(0);
  async function save(remove = false) {
    setBusy(true);
    try {
      const data = new FormData();
      if (file) data.append("file", file);
      const r = await fetch("/api/platform/avatar", {
        method: remove ? "DELETE" : "POST",
        ...(remove ? {} : { body: data }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      setImage(!remove);
      setRevision(Date.now());
      setFile(null);
      setMessage(remove ? "Profile image removed." : "Profile image updated.");
      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "The image could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      {image && (
        <img
          src={`/api/platform/avatar?v=${revision}`}
          width={96}
          height={96}
          alt="Your profile"
          className="rounded-[var(--eo-radius-control)] object-cover"
        />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-3"
      >
        <Label htmlFor="profile-avatar">Profile image</Label>
        <input
          id="profile-avatar"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-sm text-[var(--eo-text-secondary)]">
          JPEG, PNG or WebP, up to 5 MB.
        </p>
        <div className="flex gap-3">
          <Button type="submit" disabled={!file} loading={busy}>
            Upload image
          </Button>
          {image && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void save(true)}
            >
              Remove image
            </Button>
          )}
        </div>
      </form>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
