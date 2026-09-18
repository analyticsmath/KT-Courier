"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import {
  KtIconHome,
  KtIconShop,
  KtIconSend,
  KtIconCart,
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
  const [cartCount, setCartCount] = useState<number>(0);

  // Suppress bottom nav on auth / checkout flows
  const isSuppressed = suppressedRoutes.some((route) => pathname.startsWith(route));

  // Sync cart item count
  useEffect(() => {
    if (isSuppressed) return;

    let active = true;
    const fetchCartCount = async () => {
      try {
        const res = await fetch("/api/cart");
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.cart) {
          const totalItems = (data.cart.lines || []).reduce(
            (acc: number, line: { quantity: number }) => acc + line.quantity,
            0
          );
          setCartCount(totalItems);
        }
      } catch {
        // Fallback silently if unauthenticated or offline
      }
    };

    fetchCartCount();

    const handleCartUpdated = () => {
      fetchCartCount();
    };

    window.addEventListener("kt-cart-updated", handleCartUpdated);
    return () => {
      active = false;
      window.removeEventListener("kt-cart-updated", handleCartUpdated);
    };
  }, [isSuppressed]);

  const [hiddenNearFooter, setHiddenNearFooter] = useState(false);


  // Hide mobile bottom nav before footer legal links to avoid overlap
  useEffect(() => {
    if (isSuppressed) return;

    const footer = document.querySelector("footer");
    if (!footer) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setHiddenNearFooter(entry.isIntersecting);
      },
      { rootMargin: "0px 0px -40px 0px", threshold: 0.1 }
    );

    observer.observe(footer);
    return () => observer.disconnect();
  }, [pathname, isSuppressed]);

  if (isSuppressed) {
    return null;
  }

  const items = [
    { label: "Home", href: "/", icon: KtIconHome, targetRef: undefined },
    { label: "Shop", href: marketplaceHref(), icon: KtIconShop, targetRef: undefined },
    { label: "Send", href: "/services/pricing", icon: KtIconSend, targetRef: undefined, isSend: true },
    { label: "Cart", href: "/cart", icon: KtIconCart, targetRef: "mobile-bottom-nav", badge: cartCount },
    { label: "Account", href: "/login", icon: KtIconAccount, targetRef: undefined },
  ];

  return (
    <nav
      aria-label="Mobile application navigation"
      className={styles.mobileBottomNav}
      data-kt-app-shell="mobile-nav"
      style={{
        transform: hiddenNearFooter ? "translateY(120%)" : "none",
        transition: "transform 240ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={`${styles.mobileNavItem} ${isActive ? styles.mobileNavItemActive : ""} ${
              item.isSend ? styles.mobileNavItemSend : ""
            }`}
            data-kt-cart-target={item.targetRef}
            href={item.href}
            key={item.label}
          >
            <span className={styles.mobileNavIconWrapper}>
              <Icon size={20} />
              {typeof item.badge === "number" && item.badge > 0 && (
                <span aria-label={`${item.badge} items in cart`} className={styles.mobileNavBadge}>
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </span>
            <span className={styles.mobileNavLabel}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
