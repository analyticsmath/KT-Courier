"use client";

import { type ChangeEvent, type InputHTMLAttributes } from "react";
import styles from "./auth-pages.module.css";

type OtpFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type" | "onChange"> & {
  label: string;
  error?: string;
  onValueChange?: (value: string) => void;
};

export function OtpField({ label, error, id, required, onValueChange, ...props }: OtpFieldProps) {
  const errorId = error ? `${id}-error` : undefined;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const numericCode = event.currentTarget.value.replace(/\D/g, "").slice(0, 6);
    event.currentTarget.value = numericCode;
    onValueChange?.(numericCode);
  }

  return (
    <div className={styles.fieldGroup}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}{required ? <span className={styles.required}> *</span> : null}
      </label>
      <input
        {...props}
        id={id}
        required={required}
        type="text"
        maxLength={6}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        className={styles.otpInput}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        onChange={handleChange}
      />
      {error ? <p id={errorId} className={styles.fieldError}>{error}</p> : null}
    </div>
  );
}
