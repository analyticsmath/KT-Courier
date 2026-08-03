import Link from "next/link";
import styles from "./auth-pages.module.css";

export type AuthFlowLink = { href: string; label: string };

export function AuthFlowLinks({ links }: { links: readonly AuthFlowLink[] }) {
  return (
    <nav className={styles.flowLinks} aria-label="Account access links">
      {links.map((link) => <Link className={styles.textLink} href={link.href} key={link.href}>{link.label}</Link>)}
    </nav>
  );
}
