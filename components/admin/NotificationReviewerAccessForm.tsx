"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { Button } from "@/components/ui/Button";

const keys = [PERMISSIONS.NOTIFICATION_TEMPLATE_PUBLISH, PERMISSIONS.NOTIFICATION_ROUTE_APPROVE];

export function NotificationReviewerAccessForm({ employees }: { employees: { id: string; label: string }[] }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [employeeId, setEmployeeId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function grant(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || !employeeId || !reason.trim() || !confirmed) return;
    inFlight.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/employees/${encodeURIComponent(employeeId)}/permissions`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "MERGE", overrides: keys.map(permissionKey => ({ permissionKey, effect: "ALLOW", reason: reason.trim() })) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Permission update failed.");
      if (!Array.isArray(result.effectivePermissionKeys) || !keys.every(key => result.effectivePermissionKeys.includes(key))) throw new Error("The server did not confirm both permissions. Review the employee record before retrying.");
      setMessage("Both notification review permissions are effective. Other permission overrides were preserved.");
      setConfirmed(false); router.refresh();
    } catch (failure) {
      setError(failure instanceof TypeError ? "The update could not be confirmed. Retry the same selection to check its effective permissions." : failure instanceof Error ? failure.message : "Permission update failed.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  return <form aria-label="Grant notification reviewer access" onSubmit={grant} className="space-y-4">
    <label className="block" htmlFor="notification-reviewer">Administrator
      <select id="notification-reviewer" required disabled={busy} value={employeeId} onChange={event => { setEmployeeId(event.target.value); setConfirmed(false); setMessage(""); setError(""); }} className="block w-full rounded border p-2">
        <option value="">Select an active administrator</option>
        {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.label}</option>)}
      </select>
    </label>
    <ul className="list-disc pl-5"><li>Publish approved notification templates</li><li>Approve notification delivery routes</li></ul>
    <label className="block" htmlFor="notification-reviewer-reason">Permission change reason
      <textarea id="notification-reviewer-reason" required maxLength={500} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} className="block w-full rounded border p-2" />
    </label>
    <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />I confirm granting these two permissions to the selected administrator.</label>
    <Button type="submit" disabled={busy || !employeeId || !reason.trim() || !confirmed}>{busy ? "Saving permissions…" : "Grant notification review permissions"}</Button>
    <p role="status">{message}</p><p role="alert">{error}</p>
  </form>;
}
