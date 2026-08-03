"use client";

import { useState, type InputHTMLAttributes } from "react";
import styles from "./auth-pages.module.css";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type"> & {
  label: string;
  error?: string;
  hint?: string;
};

export function PasswordField({ label, error, hint, id, required, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const visibilityLabel = visible ? "Hide password" : "Show password";

  return (
    <div className={styles.fieldGroup}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}{required ? <span className={styles.required}> *</span> : null}
      </label>
      <div className={styles.passwordWrap}>
        <input
          {...props}
          id={id}
          required={required}
          type={visible ? "text" : "password"}
          className={`${styles.input} ${styles.passwordInput}`}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className={styles.visibilityButton}
          onClick={() => setVisible((current) => !current)}
          aria-label={visibilityLabel}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {hint ? <p id={hintId} className={styles.fieldHint}>{hint}</p> : null}
      {error ? <p id={errorId} className={styles.fieldError}>{error}</p> : null}
    </div>
  );
}
