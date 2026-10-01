"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
export function BusinessInvitation({
  token,
  signedIn,
}: {
  token: string;
  signedIn: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const returnUrl = `/business-invitation?token=${encodeURIComponent(token)}`;
  async function accept() {
    setBusy(true);
    try {
      const r = await fetch("/api/business-invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      window.location.assign("/store/workspace");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The invitation could not be accepted.",
      );
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <p>
        Use the verified account matching the invited email address. You will
        retain your own account and receive the business access assigned to you.
      </p>
      {signedIn ? (
        <Button loading={busy} onClick={() => void accept()}>
          Accept business invitation
        </Button>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`}>
            Sign in to accept
          </Button>
          <Button
            variant="secondary"
            href={`/signup?returnUrl=${encodeURIComponent(returnUrl)}`}
          >
            Create an account
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
