"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AuthErrorSummary,
  AuthRouteIntro,
  AuthSecurityNote,
  OtpField,
} from "@/components/public-v2/auth";
import styles from "@/components/public-v2/auth/auth-pages.module.css";

export function VerifyOtpForm({ email, maskedEmail }: { email: string; maskedEmail: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [rootError, setRootError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCodeError("");
    setRootError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const code = (form.get("otp") as string).trim();

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.fields?.code) {
          setCodeError(data.fields.code);
        } else {
          setRootError(data.error ?? "Verification failed. Please try again.");
        }
        return;
      }

      router.push(data.redirect ?? "/account");
    } catch {
      setRootError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setSuccessMessage("");
    setRootError("");

    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRootError(data.error ?? "Could not resend code. Please try again.");
        return;
      }
      setSuccessMessage(data.message ?? "A new code has been sent.");
    } catch {
      setRootError("Could not resend code. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <AuthRouteIntro eyebrow="Email verification" title="Verify your email">
        Enter the six-digit code sent to <strong>{maskedEmail}</strong>.
      </AuthRouteIntro>
      <form className={`${styles.formCard} ${styles.formStack}`} noValidate onSubmit={handleSubmit}>
        <AuthErrorSummary message={rootError} fieldErrors={{ code: codeError }} />
        {successMessage ? <div className={styles.successSummary} role="status"><p>{successMessage}</p></div> : null}
        <OtpField id="otp" name="otp" label="Verification code" placeholder="123456" required error={codeError} />
        <button className={styles.primaryAction} type="submit" disabled={loading}>
          {loading ? "Verifying code…" : "Verify code"}
        </button>
        <button className={styles.secondaryAction} type="button" onClick={handleResend} disabled={resending}>
          {resending ? "Sending another code…" : "Resend verification code"}
        </button>
        <AuthSecurityNote />
      </form>
    </>
  );
}
