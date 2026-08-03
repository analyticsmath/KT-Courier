"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedDialog } from "@/components/protected-v2/overlays/ProtectedDialog";
import styles from "./admin-pages.module.css";

type AssignmentActionProps = {
  orderId: string;
  assignment?: { id: string; driverProfileId: string; version: number } | null;
  candidates: readonly { id: string; driverCode: string; displayName: string | null }[];
  canAssign: boolean;
  canReassign: boolean;
};

export function AdminAssignmentActions({ orderId, assignment, candidates, canAssign, canReassign }: AssignmentActionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [driverProfileId, setDriverProfileId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const reassignment = Boolean(assignment);
  const permitted = reassignment ? canReassign : canAssign;
  const availableCandidates = candidates.filter((candidate) => candidate.id !== assignment?.driverProfileId);

  if (!permitted) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!driverProfileId) { setError("Select an eligible driver."); return; }
    if (reassignment && !reason.trim()) { setError("A reassignment reason is required."); return; }
    setPending(true); setError(null);
    try {
      const response = await fetch(reassignment ? `/api/admin/orders/${orderId}/reassign` : `/api/admin/orders/${orderId}/assign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reassignment
          ? { currentAssignmentId: assignment?.id, expectedVersion: assignment?.version, newDriverProfileId: driverProfileId, reasonCode: "OPERATIONAL_CHANGE", note: reason }
          : { driverProfileId, reasonCode: "INITIAL_ASSIGNMENT" }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setError(data.error ?? "The assignment could not be recorded."); return; }
      setOpen(false); setDriverProfileId(""); setReason(""); router.refresh();
    } catch { setError("The assignment request could not be completed."); }
    finally { setPending(false); }
  }

  return <>
    <button className={`${styles.button} ${styles.primaryButton}`} type="button" onClick={() => setOpen(true)}>{reassignment ? "Reassign driver" : "Assign driver"}</button>
    <ProtectedDialog open={open} onClose={() => !pending && setOpen(false)} title={reassignment ? "Reassign courier order" : "Assign courier order"}>
      <form className={styles.actionForm} onSubmit={submit}>
        <p>{reassignment ? "Choose a replacement from the canonical eligible-driver projection. The server remains responsible for compatibility and conflict checks." : "Only currently eligible drivers are listed. The server confirms availability, compatibility, and concurrency."}</p>
        <label htmlFor="assignment-driver">Eligible driver<select id="assignment-driver" value={driverProfileId} onChange={(event) => setDriverProfileId(event.target.value)} required><option value="">Select a driver</option>{availableCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.displayName ?? candidate.driverCode} · {candidate.driverCode}</option>)}</select></label>
        {reassignment ? <label htmlFor="assignment-reason">Reason for reassignment<textarea id="assignment-reason" value={reason} onChange={(event) => setReason(event.target.value)} required /></label> : null}
        {error ? <p role="alert" className={styles.actionFormError}>{error}</p> : null}
        <div className={styles.actionFormActions}><button className={`${styles.button} ${styles.secondaryButton}`} type="button" onClick={() => setOpen(false)} disabled={pending}>Cancel</button><button className={`${styles.button} ${styles.primaryButton}`} type="submit" disabled={pending}>{pending ? "Saving…" : reassignment ? "Confirm reassignment" : "Confirm assignment"}</button></div>
      </form>
    </ProtectedDialog>
  </>;
}
