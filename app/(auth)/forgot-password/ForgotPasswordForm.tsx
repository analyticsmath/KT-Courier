"use client";

import { useState } from "react";
import {
  AuthErrorSummary,
  AuthFlowLinks,
  AuthRouteIntro,
  AuthSecurityNote,
  AuthTextField,
} from "@/components/public-v2/auth";
import styles from "@/components/public-v2/auth/auth-pages.module.css";

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const email = form.get("email") as string;

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok && data.fields?.email) {
        setEmailError(data.fields.email);
        return;
      }

      // The API intentionally gives the same outcome whether or not an account exists.
      setSubmitted(true);
    } catch {
      setEmailError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <>
        <AuthRouteIntro eyebrow="Password reset" title="Check your email">
          If an account exists for that email address, a reset link has been sent.
        </AuthRouteIntro>
        <section className={styles.statusCard}>
          <div className={styles.formStack}>
            <p className={styles.fieldHint}>Check your spam folder if it has not arrived.</p>
            <button className={styles.secondaryAction} type="button" onClick={() => setSubmitted(false)}>
              Use another email address
            </button>
            <AuthSecurityNote />
          </div>
        </section>
        <AuthFlowLinks links={[{ href: "/login", label: "Back to sign in" }]} />
      </>
    );
  }

  return (
    <>
      <AuthRouteIntro eyebrow="Password reset" title="Reset your password">
        Enter your email address and we will send a secure reset link if an account is available.
      </AuthRouteIntro>
      <form className={`${styles.formCard} ${styles.formStack}`} noValidate onSubmit={handleSubmit}>
        <AuthErrorSummary fieldErrors={{ email: emailError }} />
        <AuthTextField
          id="email"
          name="email"
          type="email"
          label="Email address"
          placeholder="you@example.com"
          required
          autoComplete="email"
          spellCheck={false}
          autoCapitalize="none"
          error={emailError}
        />
        <button className={styles.primaryAction} type="submit" disabled={loading}>
          {loading ? "Sending reset link…" : "Send reset link"}
        </button>
        <AuthSecurityNote />
      </form>
      <AuthFlowLinks links={[{ href: "/login", label: "Back to sign in" }]} />
    </>
  );
}
