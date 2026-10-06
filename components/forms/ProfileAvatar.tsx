/* eslint-disable @next/next/no-img-element -- Private profile images require the browser session cookie. */
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { FileInput } from "@/components/ui/FileInput";
export function ProfileAvatar({ hasAvatar = false }: { hasAvatar?: boolean }) {
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [image, setImage] = useState(hasAvatar),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview);
  }, [preview]);
  function selectFile(selected: File | null) {
    setMessage("");
    if (selected && (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) || selected.size < 1 || selected.size > 5 * 1024 * 1024)) {
      setFile(null);
      setPreview(null);
      if (picker.current) picker.current.value = "";
      setMessage("Choose a JPEG, PNG or WebP image, up to 5 MB.");
      return;
    }
    setFile(selected);
    setPreview(selected ? URL.createObjectURL(selected) : null);
  }
  async function save(remove = false) {
    if (busy || (!remove && !file)) return;
    setBusy(true);
    setMessage(remove ? "Removing your profile image…" : "Uploading your profile image…");
    try {
      const data = new FormData();
      if (!remove && file) data.append("file", file);
      const r = await fetch("/api/platform/avatar", {
        method: remove ? "DELETE" : "POST",
        ...(remove ? {} : { body: data }),
      });
      const b = await r.json();
      if (!r.ok || (!remove && !b.saved) || (remove && !b.removed)) throw Error(b.error || "The image could not be saved. Please retry.");
      setImage(!remove);
      setRevision(Date.now());
      setFile(null);
      setPreview(null);
      if (picker.current) picker.current.value = "";
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
      {(preview || image) && (
        <img
          src={preview || `/api/platform/avatar?v=${revision}`}
          width={96}
          height={96}
          alt={preview ? "Selected profile image preview" : "Your profile"}
          className="h-24 w-24 rounded-[var(--eo-radius-control)] border object-cover"
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
        <FileInput
          ref={picker}
          id="profile-avatar"
          accept="image/jpeg,image/png,image/webp"
          required
          disabled={busy}
          aria-describedby="profile-avatar-help"
          onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
        />
        <p id="profile-avatar-help" className="text-sm text-[var(--eo-text-secondary)]">
          Choose a JPEG, PNG or WebP, up to 5 MB, then select Upload image to save it.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={!file} loading={busy}>
            {busy ? "Saving image…" : "Upload image"}
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
