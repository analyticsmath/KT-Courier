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
    const payload = accountType === "customer"
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
      <div className={styles.accountChoices} aria-label="Account type">
        <button
          className={styles.accountChoice}
          type="button"
          onClick={() => setAccountType("customer")}
          aria-pressed={accountType === "customer"}
        >
          <span className={styles.accountChoiceTitle}>Customer account</span>
          <span className={styles.accountChoiceText}>Request and follow your deliveries.</span>
        </button>
        <button
          className={styles.accountChoice}
          type="button"
          onClick={() => setAccountType("store")}
          aria-pressed={accountType === "store"}
        >
          <span className={styles.accountChoiceTitle}>Business account</span>
          <span className={styles.accountChoiceText}>Coordinate delivery requests for your store.</span>
        </button>
      </div>
      <form className={`${styles.formCard} ${styles.formStack} ${styles.formAfterChoices}`} noValidate onSubmit={handleSubmit}>
        <AuthErrorSummary message={rootError} fieldErrors={fieldErrors} />
        {accountType === "customer" ? (
          <>
            <AuthTextField id="full_name" name="full_name" label="Full name" placeholder="Your full name" required autoComplete="name" error={fieldErrors.fullName} />
            <AuthTextField id="email" name="email" type="email" label="Email address" placeholder="you@example.com" required autoComplete="email" spellCheck={false} autoCapitalize="none" error={fieldErrors.email} />
            <AuthTextField id="phone" name="phone" type="tel" label="Phone number" placeholder="Your phone number" autoComplete="tel" error={fieldErrors.phone} />
          </>
        ) : (
          <>
            <AuthTextField id="business_name" name="business_name" label="Business or store name" placeholder="Your business name" required autoComplete="organization" error={fieldErrors.storeName} />
            <AuthTextField id="contact_person" name="contact_person" label="Contact person" placeholder="Full name" required autoComplete="name" error={fieldErrors.contactPerson} />
            <AuthTextField id="email" name="email" type="email" label="Email address" placeholder="business@example.com" required autoComplete="email" spellCheck={false} autoCapitalize="none" error={fieldErrors.email} />
            <AuthTextField id="phone" name="phone" type="tel" label="Phone number" placeholder="Your phone number" required autoComplete="tel" error={fieldErrors.phone} />
            <AuthTextField id="business_address" name="business_address" label="Business address" placeholder="Street address, city" autoComplete="street-address" />
          </>
        )}
        <PasswordField id="password" name="password" label="Password" placeholder="Choose a password" required autoComplete="new-password" hint="Use at least 8 characters." error={fieldErrors.password} />
        <PasswordField id="confirm_password" name="confirm_password" label="Confirm password" placeholder="Repeat your password" required autoComplete="new-password" error={fieldErrors.confirmPassword} />
        <button className={styles.primaryAction} type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </button>
        <AuthSecurityNote />
      </form>
      <p className={styles.legalCopy}>
        By creating an account, you agree to the <Link className={styles.textLink} href="/terms">Terms</Link> and <Link className={styles.textLink} href="/privacy-policy">Privacy Policy</Link>.
      </p>
      <p className={styles.legalCopy}>
        Already have an account? <Link className={styles.textLink} href="/login">Sign in</Link>.
      </p>
    </>
  );
}
