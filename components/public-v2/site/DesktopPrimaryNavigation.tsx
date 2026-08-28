"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import { KtIconChevronDown } from "@/components/public-v2/graphics/KtIcons";
import styles from "./public-shell.module.css";

interface DesktopPrimaryNavigationProps {
  onOpenServices: () => void;
  servicesOpen: boolean;
}

export function DesktopPrimaryNavigation({ onOpenServices, servicesOpen }: DesktopPrimaryNavigationProps) {
  const pathname = usePathname();

  const links = [
    { label: "Shop", href: marketplaceHref() },
    { label: "Send", href: "/account/request-delivery" },
  ];

  return (
    <nav aria-label="Main navigation" className={styles.desktopNav}>
      {links.map((link) => {
        const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
            href={link.href}
            key={link.label}
          >
            {link.label}
          </Link>
        );
      })}

      <button
        aria-expanded={servicesOpen}
        aria-haspopup="dialog"
        className={`${styles.navItem} ${pathname.startsWith("/services") || servicesOpen ? styles.navItemActive : ""}`}
        onClick={onOpenServices}
        type="button"
      >
        Services
        <KtIconChevronDown size={14} style={{ transform: servicesOpen ? "rotate(180deg)" : "none", transition: "transform 180ms ease" }} />
      </button>

      <Link
        aria-current={pathname === "/coverage-areas" ? "page" : undefined}
        className={`${styles.navItem} ${pathname === "/coverage-areas" ? styles.navItemActive : ""}`}
        href="/coverage-areas"
      >
        Coverage
      </Link>

      <Link
        aria-current={pathname.startsWith("/services/business") ? "page" : undefined}
        className={`${styles.navItem} ${pathname.startsWith("/services/business") ? styles.navItemActive : ""}`}
        href="/services/business"
      >
        Business
      </Link>
    </nav>
  );
}
