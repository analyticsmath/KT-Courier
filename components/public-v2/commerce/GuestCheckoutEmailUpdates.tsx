"use client";

import { useEffect, useId, useState } from "react";

export function GuestCheckoutEmailUpdates({ checkoutReference }: { checkoutReference: string }) {
  const id = useId();
  const [required, setRequired] = useState(false);
  const [verified, setVerified] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [verificationReference, setVerificationReference] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    fetch(`/api/checkout/${checkoutReference}/contact-verification`).then(async (response) => {
      if (!response.ok) throw new Error("Email verification status could not be loaded.");
      const result = await response.json();
      if (current) { setRequired(result.required); setVerified(result.verified); setEnabled(result.emailUpdatesEnabled !== false); }
    }).catch((failure) => { if (current) { setRequired(true); setError(failure.message); } });
    return () => { current = false; };
  }, [checkoutReference]);

  async function mutate(path: string, method: string, body: Record<string, unknown>) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/checkout/${checkoutReference}/${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your email update could not be saved.");
      return result;
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Your email update could not be saved."); }
    finally { setBusy(false); }
  }
  if (!required) return null;
  return <section aria-labelledby={`${id}-heading`} style={{ marginTop: 16 }}>
    <h3 id={`${id}-heading`}>Guest checkout email updates</h3>
    <p>Verify your email to receive order, payment and refund updates. You can continue shopping without an account.</p>
    <p role="status" aria-live="polite">{message || (verified ? "Email verified." : "")}</p>
    {error && <p id={`${id}-error`} role="alert">{error}</p>}
    {!verified && <button type="button" disabled={busy} onClick={async () => {
      const result = await mutate("contact-verification", "POST", { operationId: `guest-email-${crypto.randomUUID()}` });
      if (result) { setVerificationReference(result.verificationReference); setVerified(result.verified); setMessage(result.verified ? "Email verified." : "A verification code has been queued for your saved email address."); }
    }} style={{ minHeight: 44, padding: "8px 16px" }}>{busy ? "Please wait…" : verificationReference ? "Send a new code" : "Send verification code"}</button>}
    {!verified && verificationReference && <form onSubmit={async (event) => {
      event.preventDefault();
      const result = await mutate("contact-verification", "PUT", { verificationReference, code });
      if (result?.verified) { setVerified(true); setCode(""); setMessage("Email verified."); }
    }} style={{ marginTop: 12 }}>
      <label htmlFor={`${id}-code`}>Six-digit email verification code</label>
      <input id={`${id}-code`} value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required aria-describedby={error ? `${id}-error` : undefined} aria-invalid={Boolean(error)} style={{ minHeight: 44, margin: "0 8px" }} />
      <button disabled={busy} type="submit" style={{ minHeight: 44, padding: "8px 16px" }}>Verify email</button>
    </form>}
    <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
      <input type="checkbox" checked={enabled} disabled={busy} onChange={async (event) => {
        const next = event.target.checked;
        const result = await mutate("contact-notifications", "PUT", { enabled: next });
        if (result) { setEnabled(result.emailUpdatesEnabled); setMessage(next ? "Email updates enabled." : "Email updates disabled."); }
      }} /> Receive order, payment and refund updates by email
    </label>
  </section>;
}
