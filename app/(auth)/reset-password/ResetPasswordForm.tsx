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
        <AuthRouteIntro title="This reset link is invalid">
          Request a new reset link and use it from the email we send you.
        </AuthRouteIntro>
        <section className={styles.statusCard}>
          <Link className={styles.primaryAction} href="/forgot-password">
            Request a reset link
          </Link>
        </section>
      </>
    );
  }

  return (
    <>
      <AuthRouteIntro title="Choose a new password">
        Choose a secure new password for your KT Couriers account.
      </AuthRouteIntro>
      <form className={`${styles.formCard} ${styles.formStack}`} id="reset-password-form" noValidate onSubmit={handleSubmit}>
        <AuthErrorSummary fieldErrors={fieldErrors} message={rootError} />
        <PasswordField
          autoComplete="new-password"
          error={fieldErrors.password}
          hint="Use at least 8 characters."
          id="password"
          label="New password"
          name="password"
          placeholder="Choose a new password"
          required
        />
        <PasswordField
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
          id="confirm_password"
          label="Confirm new password"
          name="confirm_password"
          placeholder="Repeat your new password"
          required
        />
        <button className={styles.primaryAction} disabled={loading} type="submit">
          {loading ? "Updating password…" : "Update password"}
        </button>
        <AuthSecurityNote />
      </form>
    </>
  );
}
