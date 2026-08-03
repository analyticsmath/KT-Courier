import type { InputHTMLAttributes } from "react";
import styles from "./auth-pages.module.css";

type AuthTextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  label: string;
  error?: string;
  hint?: string;
};

export function AuthTextField({ label, error, hint, id, required, ...props }: AuthTextFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.fieldGroup}>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label}{required ? <span className={styles.required}> *</span> : null}
      </label>
      <input
        {...props}
        id={id}
        required={required}
        className={styles.input}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
      />
      {hint ? <p id={hintId} className={styles.fieldHint}>{hint}</p> : null}
      {error ? <p id={errorId} className={styles.fieldError}>{error}</p> : null}
    </div>
  );
}
