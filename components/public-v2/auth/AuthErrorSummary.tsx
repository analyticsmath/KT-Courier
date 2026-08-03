import styles from "./auth-pages.module.css";

export type AuthFieldErrors = Record<string, string | undefined>;

export function AuthErrorSummary<T extends object>({
  message,
  fieldErrors,
}: {
  message?: string;
  fieldErrors?: T;
}) {
  const errors = Object.values(fieldErrors ?? {}).filter(
    (error): error is string => typeof error === "string" && Boolean(error)
  );

  if (!message && errors.length === 0) return null;

  return (
    <div className={styles.errorSummary} role="alert" tabIndex={-1}>
      <p>{message ?? "Please correct the highlighted fields and try again."}</p>
      {errors.length > 0 ? (
        <ul>
          {errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
