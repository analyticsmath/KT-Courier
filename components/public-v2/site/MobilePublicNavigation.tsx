"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import {
  KtIconHome,
  KtIconShop,
  KtIconSend,
  KtIconOrders,
  KtIconAccount,
} from "@/components/public-v2/graphics/KtIcons";
import styles from "./public-shell.module.css";

const suppressedRoutes = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-otp",
  "/accept-invitation",
  "/account-locked",
  "/session-expired",
  "/security-verification",
  "/checkout",
  "/order-confirmation",
];

export function MobilePublicNavigation() {
  const pathname = usePathname();

  // Suppress bottom nav on auth / checkout flows
  if (suppressedRoutes.some((route) => pathname.startsWith(route))) {
    return null;
  }

  const items = [
    { label: "Home", href: "/", icon: KtIconHome },
    { label: "Shop", href: marketplaceHref(), icon: KtIconShop },
    { label: "Send", href: "/account/request-delivery", icon: KtIconSend },
    { label: "Orders", href: "/account/orders", icon: KtIconOrders },
    { label: "Account", href: "/login", icon: KtIconAccount },
  ];

  return (
    <nav aria-label="Mobile bottom navigation" className={styles.mobileBottomNav}>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={`${styles.mobileNavItem} ${isActive ? styles.mobileNavItemActive : ""}`}
            href={item.href}
            key={item.label}
          >
            <span className={styles.mobileNavIcon}>
              <Icon size={20} />
            </span>
            <span className={styles.mobileNavLabel}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
