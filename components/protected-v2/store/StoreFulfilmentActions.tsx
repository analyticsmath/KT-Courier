"use client";

import { useRef, useState, type FormEvent } from "react";
import { createDriverOperationIdStore } from "@/lib/driver-operations/client-operation";
import { useRouter } from "next/navigation";
import styles from "./store-pages.module.css";

type Action = "begin-review" | "accept" | "start-preparation" | "mark-ready" | "reject" | "confirm-availability" | "generate-pickup-code";

export function StoreFulfilmentActions({ reference, acceptanceStatus, preparationStatus, lines }: Readonly<{ lines: readonly Readonly<{ id: string; title: string; quantity: number }>[]; reference: string; acceptanceStatus: string; preparationStatus: string }>) {
  const router = useRouter();
  const operations = useRef(createDriverOperationIdStore());
  const busy = useRef(false);
  const [pickupCode, setPickupCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState<Action | null>(null);

  async function submit(action: Action, fields: Record<string, string | number> = {}) {
    if (busy.current) return;
    busy.current = true;
    setMessage(null); setFailed(false); setSubmitting(action);
    try {
      const response = await fetch(`/api/store/orders/${encodeURIComponent(reference)}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, operationId: operations.current.get(action, fields), ...fields }) });
      if (!response.ok) {
        setFailed(true);
        if (response.status === 409 || response.status === 412) setMessage("This order changed before the request completed. Refresh and review its canonical state before trying again.");
        else if (response.status === 429) setMessage("The order service is temporarily rate limited. Wait before trying again.");
        else if (response.status >= 500) setMessage("The order service is temporarily unavailable. Try again later.");
        else setMessage("The order service could not complete this action. Review the form and try again.");
        return;
      }
      const body = await response.json();
      if (action === "generate-pickup-code") setPickupCode(typeof body.result?.pickupCode === "string" ? body.result.pickupCode : null);
      operations.current.clear(action);
      setMessage("The store order was updated by the server.");
      router.refresh();
    } catch { setFailed(true); setMessage("The action could not be completed. Check your connection and try again."); } finally { busy.current = false; setSubmitting(null); }
  }

  function accept(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const values = new FormData(event.currentTarget); void submit("accept", { preparationMinutes: Number(values.get("preparationMinutes")), pickupInstructions: String(values.get("pickupInstructions") ?? "") }); }
  function reject(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const values = new FormData(event.currentTarget); void submit("reject", { reasonCode: String(values.get("reasonCode") ?? ""), note: String(values.get("note") ?? "") }); }

  const canReview = acceptanceStatus === "PENDING_STORE_REVIEW";
  const canAccept = ["PENDING_STORE_REVIEW", "REVIEWING"].includes(acceptanceStatus);
  const canStart = acceptanceStatus === "ACCEPTED" && preparationStatus === "NOT_STARTED";
  const canReady = preparationStatus === "PREPARING";
  const canReject = ["PENDING_STORE_REVIEW", "REVIEWING"].includes(acceptanceStatus);

  return <div className={styles.scope}><section className="eo-store-actions" aria-labelledby="store-fulfilment-actions"><h2 id="store-fulfilment-actions">Fulfilment actions</h2><p>Only actions that the current server state may permit are shown. The server confirms any change before this record updates.</p>
    {canReview ? <button className="eo-button eo-button--secondary" disabled={submitting !== null} onClick={() => void submit("begin-review")}>{submitting === "begin-review" ? "Starting review…" : "Begin review"}</button> : null}
    {canAccept ? lines.map(line => <form key={line.id} className="eo-store-action-form" onSubmit={event => { event.preventDefault(); const values = new FormData(event.currentTarget); void submit("confirm-availability", { orderLineId: line.id, availableQuantity: Number(values.get("availableQuantity")), reasonCode: "STORE_REPORTED_AVAILABILITY" }); }}><h3>{line.title}</h3><label>Available quantity for {line.title}<input required name="availableQuantity" type="number" inputMode="numeric" min="0" max={line.quantity} defaultValue={line.quantity} /></label><button className="eo-button eo-button--secondary" disabled={submitting !== null} type="submit">Confirm availability</button></form>) : null}
    {canAccept ? <form onSubmit={accept} className="eo-store-action-form"><h3>Accept order</h3><label>Preparation time (minutes)<input required min="1" max="1440" name="preparationMinutes" type="number" inputMode="numeric" /></label><label>Pickup instructions<textarea required maxLength={500} name="pickupInstructions" /></label><button className="eo-button eo-button--primary" disabled={submitting !== null} type="submit">{submitting === "accept" ? "Accepting…" : "Accept order"}</button></form> : null}
    {canStart ? <button className="eo-button eo-button--secondary" disabled={submitting !== null} onClick={() => void submit("start-preparation")}>{submitting === "start-preparation" ? "Starting…" : "Start preparation"}</button> : null}
    {canReady ? <button className="eo-button eo-button--primary" disabled={submitting !== null} onClick={() => void submit("mark-ready")}>{submitting === "mark-ready" ? "Marking ready…" : "Mark ready for collection"}</button> : null}
    {preparationStatus === "READY_FOR_HANDOFF" ? <div><button className="eo-button eo-button--primary" disabled={submitting !== null} onClick={() => void submit("generate-pickup-code")}>Generate store pickup code</button>{pickupCode ? <p role="status">Store pickup code: <strong>{pickupCode}</strong>. Share it with the assigned driver after checking the packages. It expires in ten minutes.</p> : null}</div> : null}
    {canReject ? <details className="eo-store-destructive"><summary>Reject this order</summary><form onSubmit={reject} className="eo-store-action-form"><label>Reason code<input required minLength={3} maxLength={80} name="reasonCode" /></label><label>Store-safe note (optional)<textarea maxLength={500} name="note" /></label><label className="eo-store-checkbox"><input required type="checkbox" /> I understand that rejection is an operational action.</label><button className="eo-button eo-button--danger" disabled={submitting !== null} type="submit">{submitting === "reject" ? "Rejecting…" : "Confirm rejection"}</button></form></details> : null}
    {message ? <p className="eo-store-action-message" role={failed ? "alert" : "status"} aria-live="polite">{message}</p> : null}
  </section></div>;
}
