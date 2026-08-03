import styles from "./auth-pages.module.css";

export function AuthSecurityNote() {
  return (
    <aside className={styles.securityNote}>
      <p>For your security, never share your password or verification code.</p>
    </aside>
  );
}
