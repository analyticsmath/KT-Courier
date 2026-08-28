"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AuthErrorSummary,
  AuthSecurityNote,
  AuthTextField,
  PasswordField,
} from "@/components/public-v2/auth";
import styles from "@/components/public-v2/auth/auth-pages.module.css";

type AccountType = "customer" | "store";

interface FieldErrors {
  fullName?: string;
  storeName?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  _root?: string;
}

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role")?.toLowerCase();
  const [accountType, setAccountType] = useState<AccountType>(
    roleParam === "store" || roleParam === "business" ? "store" : "customer"
  );
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [rootError, setRootError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setRootError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const payload =
      accountType === "customer"
        ? {
            accountType: "CUSTOMER",
            fullName: form.get("full_name") as string,
            email: form.get("email") as string,
            phone: form.get("phone") as string,
            password: form.get("password") as string,
            confirmPassword: form.get("confirm_password") as string,
          }
        : {
            accountType: "STORE",
            storeName: form.get("business_name") as string,
            contactPerson: form.get("contact_person") as string,
            email: form.get("email") as string,
            phone: form.get("phone") as string,
            businessAddress: form.get("business_address") as string,
            password: form.get("password") as string,
            confirmPassword: form.get("confirm_password") as string,
          };

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.fields) {
          setFieldErrors(data.fields as FieldErrors);
        } else {
          setRootError(data.error ?? "Sign up failed. Please try again.");
        }
        return;
      }

      router.push(`/verify-otp?email=${encodeURIComponent(data.email)}`);
    } catch {
      setRootError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div aria-label="Account type" className={styles.accountChoices}>
        <button
          aria-pressed={accountType === "customer"}
          className={`${styles.accountChoice} ${accountType === "customer" ? styles.accountChoiceActive : ""}`}
          onClick={() => setAccountType("customer")}
          type="button"
        >
          <span className={styles.accountChoiceTitle}>Customer</span>
          <span className={styles.accountChoiceText}>Send deliveries and manage your account.</span>
        </button>
        <button
          aria-pressed={accountType === "store"}
          className={`${styles.accountChoice} ${accountType === "store" ? styles.accountChoiceActive : ""}`}
          onClick={() => setAccountType("store")}
          type="button"
        >
          <span className={styles.accountChoiceTitle}>Business</span>
          <span className={styles.accountChoiceText}>Manage delivery requests for your store or business.</span>
        </button>
      </div>

      <form className={`${styles.formCard} ${styles.formStack}`} noValidate onSubmit={handleSubmit}>
        <AuthErrorSummary fieldErrors={fieldErrors} message={rootError} />
        {accountType === "customer" ? (
          <>
            <AuthTextField
              autoComplete="name"
              error={fieldErrors.fullName}
              id="full_name"
              label="Full name"
              name="full_name"
              placeholder="Your full name"
              required
            />
            <AuthTextField
              autoCapitalize="none"
              autoComplete="email"
              error={fieldErrors.email}
              id="email"
              label="Email address"
              name="email"
              placeholder="you@example.com"
              required
              spellCheck={false}
              type="email"
            />
            <AuthTextField
              autoComplete="tel"
              error={fieldErrors.phone}
              id="phone"
              label="Phone number"
              name="phone"
              placeholder="Your phone number"
              type="tel"
            />
          </>
        ) : (
          <>
            <AuthTextField
              autoComplete="organization"
              error={fieldErrors.storeName}
              id="business_name"
              label="Business or store name"
              name="business_name"
              placeholder="Your business name"
              required
            />
            <AuthTextField
              autoComplete="name"
              error={fieldErrors.contactPerson}
              id="contact_person"
              label="Contact person"
              name="contact_person"
              placeholder="Full name"
              required
            />
            <AuthTextField
              autoCapitalize="none"
              autoComplete="email"
              error={fieldErrors.email}
              id="email"
              label="Email address"
              name="email"
              placeholder="business@example.com"
              required
              spellCheck={false}
              type="email"
            />
            <AuthTextField
              autoComplete="tel"
              error={fieldErrors.phone}
              id="phone"
              label="Phone number"
              name="phone"
              placeholder="Your phone number"
              required
              type="tel"
            />
            <AuthTextField
              autoComplete="street-address"
              id="business_address"
              label="Business address"
              name="business_address"
              placeholder="Street address, city"
            />
          </>
        )}
        <PasswordField
          autoComplete="new-password"
          error={fieldErrors.password}
          hint="Use at least 8 characters."
          id="password"
          label="Password"
          name="password"
          placeholder="Choose a password"
          required
        />
        <PasswordField
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
          id="confirm_password"
          label="Confirm password"
          name="confirm_password"
          placeholder="Repeat your password"
          required
        />
        <button className={styles.primaryAction} disabled={loading} type="submit">
          {loading ? "Creating account…" : "Create account"}
        </button>
        <AuthSecurityNote />
      </form>

      <p className={styles.legalCopy}>
        By creating an account, you agree to the{" "}
        <Link className={styles.textLink} href="/terms">
          Terms
        </Link>{" "}
        and{" "}
        <Link className={styles.textLink} href="/privacy-policy">
          Privacy Policy
        </Link>
        .
      </p>
      <p className={styles.legalCopy}>
        Already have an account?{" "}
        <Link className={styles.textLink} href="/login">
          Sign in
        </Link>
        .
      </p>
    </>
  );
}
