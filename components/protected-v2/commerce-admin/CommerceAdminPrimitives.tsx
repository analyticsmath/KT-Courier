import Link from "next/link";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import styles from "./commerce-admin.module.css";

export type CommerceNavigationItem = Readonly<{ label: string; href: string }>;

export function CommerceWorkspaceNav({ items, currentPath, label }: { items: readonly CommerceNavigationItem[]; currentPath: string; label: string }) {
  return <nav aria-label={label} className={styles.workspaceNav}>{items.map((item) => <Link aria-current={item.href === currentPath ? "page" : undefined} href={item.href} key={item.href}>{item.label}</Link>)}</nav>;
}

export function CommerceDefinitionList({ items }: { items: readonly { label: string; value: React.ReactNode }[] }) {
  return <dl className={styles.definitionGrid}>{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
}

export function CommerceLockNotice({ title, description }: { title: string; description: string }) {
  return <aside className={styles.lockNotice} role="status"><strong>{title}</strong><p>{description}</p></aside>;
}

export function CommerceUnavailable({ title, description }: { title: string; description: string }) {
  return <ProtectedState kind="unavailable" title={title} description={description} />;
}

export { styles as commerceAdminStyles };
