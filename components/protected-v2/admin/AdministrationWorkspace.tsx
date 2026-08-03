import styles from "./administration-workspace.module.css";

/**
 * The administrative layout owns the protected-v2 presentation boundary for
 * every administration route. Route modules remain Server Components and keep
 * their existing guards, queries, DTOs, and action islands inside this shell.
 */
export function AdministrationWorkspace({ children }: { children: React.ReactNode }) {
  return <div className={styles.workspace} data-administration-presentation="r21">{children}</div>;
}
