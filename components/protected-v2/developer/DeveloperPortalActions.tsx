"use client";

import { useId, useState } from "react";

type OneTimeSecret = Readonly<{ label: string; value: string }>;
type RequestOptions = Readonly<{ method: "POST" | "PATCH"; body?: Record<string, unknown>; etag?: number }>;

async function requestDeveloperAction(path: string, options: RequestOptions): Promise<Record<string, unknown>> {
  const response = await fetch(path, {
    method: options.method,
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.etag ? { "if-match": `\"${options.etag}\"` } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    if (response.status === 409 || response.status === 412) throw new Error("This developer record changed before the request completed. Refresh and review its canonical state before trying again.");
    if (response.status === 429) throw new Error("The developer service is temporarily rate limited. Wait before trying again.");
    if (response.status >= 500) throw new Error("The developer service is temporarily unavailable. Try again later.");
    throw new Error("The developer service could not complete this request. Review the form and try again.");
  }
  return body;
}

function extractSecret(body: Record<string, unknown>, label: string): OneTimeSecret | null {
  const secret = typeof body.secret === "string" ? body.secret : typeof body.signingSecret === "string" ? body.signingSecret : null;
  return secret ? { label, value: secret } : null;
}

function DeveloperSecretReveal({ secret, onDismiss }: { secret: OneTimeSecret; onDismiss: () => void }) {
  const [copyMessage, setCopyMessage] = useState("");
  const warningId = useId();
  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret.value);
      setCopyMessage("Copied. Store the value in your protected backend environment now.");
    } catch {
      setCopyMessage("Copy was unavailable. Select the value and store it securely.");
    }
  }
  return <section className="eo-panel eo-panel--dark eo-panel--default" aria-labelledby={warningId}>
    <p className="eo-page-header__eyebrow">One-time secret</p>
    <h2 className="eo-panel__title" id={warningId}>{secret.label}</h2>
    <p className="eo-panel__description">This value is shown only from the confirmed server response. Copy it deliberately and store it in a protected backend environment. It cannot be recovered after this view is dismissed or reloaded.</p>
    <code className="eo-developer-secret" aria-describedby={warningId}>{secret.value}</code>
    <div className="mt-4 flex flex-wrap gap-3">
      <button className="eo-button eo-button--primary" type="button" onClick={copySecret}>Copy secret</button>
      <button className="eo-button eo-button--secondary" type="button" onClick={onDismiss}>I stored it securely</button>
    </div>
    <p aria-live="polite" className="mt-3 text-sm">{copyMessage}</p>
  </section>;
}

function ActionFeedback({ message }: { message: string }) {
  return message ? <p className="mt-3 text-sm text-[var(--eo-text-secondary)]" aria-live="polite">{message}</p> : null;
}

export function DeveloperApplicationCreateForm() {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(form: HTMLFormElement) {
    setSaving(true); setMessage("");
    const values = new FormData(form);
    try {
      const body = await requestDeveloperAction("/api/developer/applications", { method: "POST", body: { name: values.get("name"), businessPurpose: values.get("businessPurpose"), environment: values.get("environment"), storeBound: values.get("storeBound") === "on" } });
      if (typeof body.reference === "string") window.location.assign(`/developers/applications/${body.reference}`);
      else setMessage("The application was created. Refresh the application list to review its canonical state.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The application could not be created."); }
    finally { setSaving(false); }
  }
  return <form className="eo-developer-form" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
    <div><label htmlFor="developer-application-name">Application name</label><input id="developer-application-name" name="name" required maxLength={120} /></div>
    <div><label htmlFor="developer-application-purpose">Integration purpose</label><textarea id="developer-application-purpose" name="businessPurpose" required maxLength={2000} rows={4} /></div>
    <div><label htmlFor="developer-application-environment">Requested environment</label><select id="developer-application-environment" name="environment" defaultValue="TEST"><option value="TEST">Test</option><option value="LIVE">Live</option></select></div>
    <label className="eo-developer-checkbox"><input name="storeBound" type="checkbox" /> Bind to my active store where the canonical owner rule permits it</label>
    <p className="eo-developer-form__note">Creation does not approve access, scopes, terms, credentials, or live operation.</p>
    <button className="eo-button eo-button--primary" disabled={saving} type="submit">{saving ? "Creating application…" : "Create application"}</button>
    <ActionFeedback message={message} />
  </form>;
}

export function DeveloperCredentialActions({ applicationReference, canCreate, credentialReference, canRotate, canRevoke }: { applicationReference?: string; canCreate: boolean; credentialReference?: string; canRotate: boolean; canRevoke: boolean }) {
  const [message, setMessage] = useState("");
  const [secret, setSecret] = useState<OneTimeSecret | null>(null);
  const [saving, setSaving] = useState(false);
  async function issue(form: HTMLFormElement) {
    if (!applicationReference) return;
    setSaving(true); setMessage("");
    const values = new FormData(form);
    try { const body = await requestDeveloperAction(`/api/developer/applications/${applicationReference}/credentials`, { method: "POST", body: values.get("expiresAt") ? { expiresAt: values.get("expiresAt") } : {} }); const next = extractSecret(body, "Credential secret"); if (next) setSecret(next); else setMessage("The canonical service did not return a one-time secret."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The credential could not be issued."); }
    finally { setSaving(false); }
  }
  async function mutate(action: "rotate" | "revoke") {
    if (!credentialReference || (action === "revoke" && !window.confirm("Revoke this credential? This canonical action is irreversible."))) return;
    setSaving(true); setMessage("");
    try { const body = await requestDeveloperAction(`/api/developer/credentials/${credentialReference}/${action}`, { method: "POST" }); const next = action === "rotate" ? extractSecret(body, "Replacement credential secret") : null; if (next) setSecret(next); else setMessage(action === "revoke" ? "Credential revoked. Refresh this record to see its canonical status." : "Credential rotated. Refresh this record to see its canonical status."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The credential action could not be completed."); }
    finally { setSaving(false); }
  }
  return <div className="space-y-4">
    {canCreate && applicationReference ? <form className="eo-developer-inline-form" onSubmit={(event) => { event.preventDefault(); void issue(event.currentTarget); }}><label htmlFor={`credential-expiry-${applicationReference}`}>Optional expiry date</label><input id={`credential-expiry-${applicationReference}`} name="expiresAt" type="datetime-local" /><button className="eo-button eo-button--primary" disabled={saving} type="submit">Issue credential</button></form> : null}
    {credentialReference && (canRotate || canRevoke) ? <div className="space-y-3"><p className="text-sm text-[var(--eo-text-secondary)]">Rotation creates a replacement credential and marks the previous credential expiring under the canonical overlap policy. Revocation is irreversible.</p><div className="flex flex-wrap gap-3">{canRotate ? <button className="eo-button eo-button--secondary" disabled={saving} type="button" onClick={() => void mutate("rotate")}>Rotate credential</button> : null}{canRevoke ? <button className="eo-button eo-button--danger" disabled={saving} type="button" onClick={() => void mutate("revoke")}>Revoke credential</button> : null}</div></div> : null}
    {secret ? <DeveloperSecretReveal secret={secret} onDismiss={() => setSecret(null)} /> : null}
    <ActionFeedback message={message} />
  </div>;
}

export function DeveloperWebhookCreateForm({ applicationReference, eventTypes }: { applicationReference: string; eventTypes: readonly string[] }) {
  const [message, setMessage] = useState("");
  const [secret, setSecret] = useState<OneTimeSecret | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(form: HTMLFormElement) {
    setSaving(true); setMessage("");
    const values = new FormData(form);
    const selectedEvents = eventTypes.filter((eventType) => values.getAll("eventType").includes(eventType));
    try { const body = await requestDeveloperAction(`/api/developer/applications/${applicationReference}/webhooks`, { method: "POST", body: { endpoint: values.get("endpoint"), eventTypes: selectedEvents } }); const next = extractSecret(body, "Webhook signing secret"); if (next) setSecret(next); else setMessage("The canonical service did not return a one-time signing secret."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The webhook endpoint could not be created."); }
    finally { setSaving(false); }
  }
  return <div className="space-y-4"><form className="eo-developer-form" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}><div><label htmlFor={`webhook-endpoint-${applicationReference}`}>HTTPS endpoint</label><input id={`webhook-endpoint-${applicationReference}`} name="endpoint" inputMode="url" required type="url" /></div><fieldset><legend>Event subscriptions</legend><div className="eo-developer-event-list">{eventTypes.map((eventType) => <label key={eventType} className="eo-developer-checkbox"><input name="eventType" type="checkbox" value={eventType} /> <code>{eventType}</code></label>)}</div></fieldset><p className="eo-developer-form__note">The service validates the URL, environment, approved scope, event catalog, and endpoint state. A saved endpoint is not presented as verified until canonical confirmation.</p><button className="eo-button eo-button--primary" disabled={saving} type="submit">{saving ? "Creating endpoint…" : "Create endpoint"}</button></form>{secret ? <DeveloperSecretReveal secret={secret} onDismiss={() => setSecret(null)} /> : null}<ActionFeedback message={message} /></div>;
}

export function DeveloperWebhookActions({ reference, version, status, canManage, eventTypes, allEventTypes }: { reference: string; version: number; status: string; canManage: boolean; eventTypes: readonly string[]; allEventTypes: readonly string[] }) {
  const [message, setMessage] = useState("");
  const [secret, setSecret] = useState<OneTimeSecret | null>(null);
  const [saving, setSaving] = useState(false);
  async function action(path: string, label: string) {
    setSaving(true); setMessage("");
    try { const body = await requestDeveloperAction(path, { method: "POST" }); const next = extractSecret(body, "Replacement webhook signing secret"); if (next) setSecret(next); else setMessage(`${label} was accepted by the canonical service. Refresh this record to view its state.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : `${label} could not be completed.`); }
    finally { setSaving(false); }
  }
  async function update(form: HTMLFormElement) {
    setSaving(true); setMessage("");
    const values = new FormData(form); const selectedEvents = allEventTypes.filter((eventType) => values.getAll("eventType").includes(eventType));
    try { await requestDeveloperAction(`/api/developer/webhooks/${reference}`, { method: "PATCH", etag: version, body: { eventTypes: selectedEvents } }); setMessage("Subscription selection was submitted. The endpoint returns to draft until verification is confirmed."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The subscription could not be updated."); }
    finally { setSaving(false); }
  }
  if (!canManage) return null;
  return <div className="space-y-4"><div className="flex flex-wrap gap-3">{["DRAFT", "VERIFICATION_FAILED"].includes(status) ? <button className="eo-button eo-button--primary" disabled={saving} type="button" onClick={() => void action(`/api/developer/webhooks/${reference}/verify`, "Verification request")}>Request verification</button> : null}{status !== "REVOKED" ? <button className="eo-button eo-button--secondary" disabled={saving} type="button" onClick={() => void action(`/api/developer/webhooks/${reference}/rotate-secret`, "Secret rotation")}>Rotate signing secret</button> : null}{status === "ACTIVE" ? <button className="eo-button eo-button--secondary" disabled={saving} type="button" onClick={() => void action(`/api/developer/webhooks/${reference}/pause`, "Pause")}>Pause endpoint</button> : null}{status === "PAUSED" ? <button className="eo-button eo-button--secondary" disabled={saving} type="button" onClick={() => void action(`/api/developer/webhooks/${reference}/resume`, "Resume")}>Resume endpoint</button> : null}{!["REVOKED", "DISABLED"].includes(status) ? <button className="eo-button eo-button--danger" disabled={saving} type="button" onClick={() => { if (window.confirm("Revoke this webhook endpoint? This canonical action cannot be undone.")) void action(`/api/developer/webhooks/${reference}/revoke`, "Revocation"); }}>Revoke endpoint</button> : null}</div><form className="eo-developer-form" onSubmit={(event) => { event.preventDefault(); void update(event.currentTarget); }}><fieldset><legend>Update event subscriptions</legend><div className="eo-developer-event-list">{allEventTypes.map((eventType) => <label key={eventType} className="eo-developer-checkbox"><input defaultChecked={eventTypes.includes(eventType)} name="eventType" type="checkbox" value={eventType} /> <code>{eventType}</code></label>)}</div></fieldset><button className="eo-button eo-button--secondary" disabled={saving} type="submit">Save subscriptions</button></form>{secret ? <DeveloperSecretReveal secret={secret} onDismiss={() => setSecret(null)} /> : null}<ActionFeedback message={message} /></div>;
}

export function DeveloperDeliveryRetryAction({ reference, canRetry }: { reference: string; canRetry: boolean }) {
  const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  if (!canRetry) return null;
  return <div><button className="eo-button eo-button--primary" disabled={saving} type="button" onClick={() => { setSaving(true); setMessage(""); void requestDeveloperAction(`/api/developer/webhook-deliveries/${reference}/retry`, { method: "POST" }).then(() => setMessage("Retry request accepted. Refresh the delivery to view its canonical state.")).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Retry could not be requested.")).finally(() => setSaving(false)); }}>Request retry</button><ActionFeedback message={message} /></div>;
}
