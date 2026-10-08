"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function InboxControls({ reference, state }: { reference: string; state: string }) {
  const router = useRouter(), busy = useRef(false);
  const [saving, setSaving] = useState(false), [message, setMessage] = useState("");
  async function change(action: "read" | "unread" | "archive") {
    if (busy.current) return; busy.current = true; setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(reference)}/${action}`, { method: "POST" });
      if (!response.ok) throw new Error();
      setMessage(action === "archive" ? "Notification archived." : action === "read" ? "Notification marked read." : "Notification marked unread."); router.refresh();
    } catch { setMessage("The notification could not be updated. Refresh and retry."); }
    finally { busy.current = false; setSaving(false); }
  }
  return <div className="mt-3 space-y-2"><div className="flex flex-wrap gap-2">
    <Button variant="secondary" size="sm" disabled={saving} onClick={() => void change(state === "UNREAD" ? "read" : "unread")}>{state === "UNREAD" ? "Mark read" : "Mark unread"}</Button>
    <Button variant="secondary" size="sm" disabled={saving} onClick={() => void change("archive")}>Archive notification</Button>
  </div><p role="status" aria-live="polite">{message}</p></div>;
}

export function NotificationPreferences({ categories }: { categories: Array<{ key: string; required: boolean; emailEnabled: boolean }> }) {
  const router = useRouter(), busy = useRef(false);
  const [saving, setSaving] = useState<string | null>(null), [message, setMessage] = useState("");
  async function change(key: string, enabled: boolean) {
    if (busy.current) return; busy.current = true; setSaving(key); setMessage("");
    try {
      const response = await fetch("/api/notifications/preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoryKey: key, channel: "EMAIL", mode: enabled ? "ENABLED" : "DISABLED", digestMode: "IMMEDIATE" }) });
      if (!response.ok) throw new Error(); setMessage("Email preference saved."); router.refresh();
    } catch { setMessage("Your preference could not be saved. Refresh and retry."); }
    finally { busy.current = false; setSaving(null); }
  }
  return <section aria-labelledby="notification-email-preferences" className="rounded-xl border p-4 space-y-3">
    <h2 id="notification-email-preferences" className="font-bold">Email preferences</h2>
    <p className="text-sm">Preferences apply when reviewed notification delivery is active. Required security and legal messages remain enabled.</p>
    {categories.map(category => <label key={category.key} className="flex min-h-12 items-center gap-3">
      <input type="checkbox" checked={category.required || category.emailEnabled} disabled={category.required || saving !== null} onChange={event => void change(category.key, event.target.checked)} />
      <span>{category.key.toLowerCase().replaceAll("_", " ")}{category.required ? " (required)" : ""}</span>
    </label>)}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
