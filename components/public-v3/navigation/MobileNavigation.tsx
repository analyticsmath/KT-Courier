"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useMarketplaceCartCount } from "./marketplace-cart-client";
import styles from "./mobile-navigation.module.css";

export function MobileNavigation() {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const isCommerce = pathname.startsWith("/shop") || pathname === "/cart";
  const cartCount = useMarketplaceCartCount(!pathname.startsWith("/checkout"));

  // Hide mobile nav on checkout and full-screen auth if needed
  if (pathname.startsWith("/checkout")) {
    return null;
  }

  const items = [
    {
      label: "Home",
      href: "/",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      label: "Shop",
      href: "/shop",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
      ),
    },
    {
      label: "Send",
      href: "/services/parcel",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      ),
    },
    {
      label: "Cart",
      href: "/cart",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    {
      label: "Account",
      href: "/login",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
  ];
  const navItems = isCommerce
    ? [
        items[1]!,
        { label: "Categories", href: "/shop/categories", icon: <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="2"/></svg> },
        { label: "Search", href: "/shop/search", icon: <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8" strokeWidth="2"/><path d="m16 16 5 5" strokeWidth="2" strokeLinecap="round"/></svg> },
        items[3]!,
        items[4]!,
      ]
    : items;
  const activeIndex = navItems.findIndex((item) => item.href === "/" ? pathname === "/" :
    item.href === "/shop" ? pathname === "/shop" || (pathname.startsWith("/shop/") && !pathname.startsWith("/shop/categories") && !pathname.startsWith("/shop/search")) :
    pathname.startsWith(item.href));

  return (
    <nav
      aria-label="Mobile app navigation"
      className={styles.nav}
      data-kt-app-shell="mobile-nav"
      data-commerce-nav={isCommerce ? "true" : undefined}
      style={{ "--active-center": `${(Math.max(activeIndex, 0) + .5) * 20}%` } as React.CSSProperties}
    >
      {activeIndex >= 0 && <svg className={styles.cradle} viewBox="0 0 100 44" aria-hidden="true" focusable="false"><path d="M0 44V36C15 36 16 30 23 16C34 -7 66 -7 77 16C84 30 85 36 100 36V44Z" /></svg>}
      {navItems.map((item, index) => {
        const isActive = index === activeIndex;

        return (
          <Link
            key={item.href}
            aria-current={isActive ? "page" : undefined}
            data-kt-cart-target={isCommerce && item.href === "/cart" ? "mobile-bottom-nav" : undefined}
            href={item.href}
            className={`${styles.item} ${isActive ? styles.active : ""}`}
          >
            {isActive ? <motion.span className={styles.icon} layoutId="kt-mobile-nav-active-bubble" transition={{ duration: reducedMotion ? 0 : .32, ease: [.22, 1, .36, 1] }}>
              {item.icon}
              {item.href === "/cart" && cartCount > 0 && <span aria-label={`${cartCount} items in cart`} className={styles.badge}>{cartCount > 99 ? "99+" : cartCount}</span>}
            </motion.span> : <span className={styles.icon}>
              {item.icon}
              {item.href === "/cart" && cartCount > 0 && <span aria-label={`${cartCount} items in cart`} className={styles.badge}>{cartCount > 99 ? "99+" : cartCount}</span>}
            </span>}
            <span className={styles.label}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
