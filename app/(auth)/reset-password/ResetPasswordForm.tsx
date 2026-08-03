"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AuthErrorSummary,
  AuthRouteIntro,
  AuthSecurityNote,
  PasswordField,
} from "@/components/public-v2/auth";
import styles from "@/components/public-v2/auth/auth-pages.module.css";

interface FieldErrors {
  password?: string;
  confirmPassword?: string;
}

export function ResetPasswordForm({ hasResetToken }: { hasResetToken: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [rootError, setRootError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setRootError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const password = form.get("password") as string;
    const confirmPassword = form.get("confirm_password") as string;
    const resetToken = form.get("token") as string;

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password, confirmPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.fields) {
          setFieldErrors(data.fields as FieldErrors);
        } else {
          setRootError(data.error ?? "Password reset failed. Please try again.");
        }
        return;
      }

      router.push("/login?reset=success");
    } catch {
      setRootError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!hasResetToken) {
    return (
      <>
        <AuthRouteIntro eyebrow="Password reset" title="This reset link is invalid">
          Request a new reset link and use it from the email we send you.
        </AuthRouteIntro>
        <section className={styles.statusCard}>
          <Link className={styles.primaryAction} href="/forgot-password">Request a reset link</Link>
        </section>
      </>
    );
  }

  return (
    <>
      <AuthRouteIntro eyebrow="Password reset" title="Set a new password">
        Choose a new password for your account.
      </AuthRouteIntro>
      <form id="reset-password-form" className={`${styles.formCard} ${styles.formStack}`} noValidate onSubmit={handleSubmit}>
        <AuthErrorSummary message={rootError} fieldErrors={fieldErrors} />
        <PasswordField id="password" name="password" label="New password" placeholder="Choose a new password" required autoComplete="new-password" hint="Use at least 8 characters." error={fieldErrors.password} />
        <PasswordField id="confirm_password" name="confirm_password" label="Confirm new password" placeholder="Repeat your new password" required autoComplete="new-password" error={fieldErrors.confirmPassword} />
        <button className={styles.primaryAction} type="submit" disabled={loading}>
          {loading ? "Updating password…" : "Update password"}
        </button>
        <AuthSecurityNote />
      </form>
    </>
  );
}
