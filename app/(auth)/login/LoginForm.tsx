"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AuthErrorSummary,
  AuthSecurityNote,
  AuthTextField,
  PasswordField,
} from "@/components/public-v2/auth";
import styles from "@/components/public-v2/auth/auth-pages.module.css";

interface FieldErrors {
  email?: string;
  password?: string;
  _root?: string;
}

export function LoginForm() {
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
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.fields) {
          setFieldErrors(data.fields as FieldErrors);
        } else if (data.requiresVerification) {
          router.push(`/verify-otp?email=${encodeURIComponent(data.email)}`);
          return;
        } else {
          setRootError(data.error ?? "Login failed. Please try again.");
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

  return (
    <form className={`${styles.formCard} ${styles.formStack}`} noValidate onSubmit={handleSubmit}>
      <AuthErrorSummary message={rootError} fieldErrors={fieldErrors} />
      <AuthTextField
        id="email"
        name="email"
        type="email"
        label="Email address"
        placeholder="you@example.com"
        required
        autoComplete="username"
        spellCheck={false}
        autoCapitalize="none"
        error={fieldErrors.email}
      />
      <div className={styles.formStack}>
        <PasswordField
          id="password"
          name="password"
          label="Password"
          placeholder="Enter your password"
          required
          autoComplete="current-password"
          error={fieldErrors.password}
        />
        <Link className={styles.textLink} href="/forgot-password">Forgot password?</Link>
      </div>
      <button className={styles.primaryAction} type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <AuthSecurityNote />
    </form>
  );
}
