"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import styles from "./public-site-shell.module.css";

export const publicNavigationLinks = [
  { label: "Services", href: "/services" },
  { label: "Coverage", href: "/coverage-areas" },
  { label: "Marketplace", href: marketplaceHref() },
  { label: "Join", href: "/join" },
] as const;

type PublicNavigationProps = {
  mobile?: boolean;
  onNavigate?: () => void;
};

export function PublicNavigation({ mobile = false, onNavigate }: PublicNavigationProps) {
  const pathname = usePathname();

  return (
    <nav aria-label={mobile ? "Mobile navigation" : "Main navigation"} className={mobile ? styles.mobileNav : styles.desktopNav}>
      {publicNavigationLinks.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(mobile ? styles.mobileNavLink : styles.desktopNavLink, active && styles.navLinkActive)}
            href={link.href}
            key={link.href}
            onClick={onNavigate}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
