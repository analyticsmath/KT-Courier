"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMotionContext } from "../motion/PublicMotionProvider";
import { useMarketplaceCartCount } from "./marketplace-cart-client";

export function MobileNavigation() {
  const pathname = usePathname();
  const { headerTone } = useMotionContext();
  const isDark = headerTone === "dark";
  const isCommerce = pathname.startsWith("/shop") || pathname === "/cart";
  const isProductPage = pathname.startsWith("/shop/products/");
  const cartCount = useMarketplaceCartCount(isCommerce);

  // Hide mobile nav on checkout and full-screen auth if needed
  if (pathname.startsWith("/checkout")) {
    return null;
  }
  if (isProductPage) return null;

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

  return (
    <nav
      aria-label="Mobile app navigation"
      className={`md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t transition-colors duration-200 ${
        isDark
          ? "bg-[var(--kt-asphalt)] border-[#23272B] text-[var(--kt-freight-paper)]"
          : "bg-[var(--kt-freight-paper)] border-[var(--kt-concrete)]/40 text-[var(--kt-asphalt)]"
      }`}
      data-kt-app-shell="mobile-nav"
      data-commerce-nav={isCommerce ? "true" : undefined}
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        height: "calc(var(--kt-mobile-nav-height) + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {navItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            aria-current={isActive ? "page" : undefined}
            data-kt-cart-target={isCommerce && item.href === "/cart" ? "mobile-bottom-nav" : undefined}
            href={item.href}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-medium transition-colors ${
              isActive
                ? "text-[var(--kt-brand-blue)] font-bold"
                : "opacity-75 hover:opacity-100"
            }`}
          >
            <span className="relative">
              {item.icon}
              {isCommerce && item.href === "/cart" && cartCount > 0 && <span aria-label={`${cartCount} items in cart`} className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--kt-brand-blue)] px-1 text-[9px] font-bold text-white">{cartCount > 99 ? "99+" : cartCount}</span>}
            </span>
            <span className="mt-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
