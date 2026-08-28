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
        <AuthRouteIntro title="Check your email">
          If an account exists for that email address, we have sent the next secure reset step.
        </AuthRouteIntro>
        <section className={styles.statusCard}>
          <div className={styles.formStack}>
            <p className={styles.fieldHint}>Check your inbox and spam folder for instructions.</p>
            <button className={styles.secondaryAction} onClick={() => setSubmitted(false)} type="button">
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
      <AuthRouteIntro title="Reset your password">
        Enter your email address and we’ll send the next secure step if the account is eligible.
      </AuthRouteIntro>
      <form className={`${styles.formCard} ${styles.formStack}`} noValidate onSubmit={handleSubmit}>
        <AuthErrorSummary fieldErrors={{ email: emailError }} />
        <AuthTextField
          autoCapitalize="none"
          autoComplete="email"
          error={emailError}
          id="email"
          label="Email address"
          name="email"
          placeholder="you@example.com"
          required
          spellCheck={false}
          type="email"
        />
        <button className={styles.primaryAction} disabled={loading} type="submit">
          {loading ? "Sending reset link…" : "Send reset link"}
        </button>
        <AuthSecurityNote />
      </form>
      <AuthFlowLinks links={[{ href: "/login", label: "Back to sign in" }]} />
    </>
  );
}
