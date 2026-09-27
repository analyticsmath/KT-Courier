"use client";

import { useState } from "react";
import Link from "next/link";
import { CanonicalKtLogo } from "../brand/CanonicalKtLogo";
import { CurvedMenuSheet } from "./CurvedMenuSheet";
import { useMotionContext } from "../motion/PublicMotionProvider";
import { useMarketplaceCartCount } from "./marketplace-cart-client";

interface PublicHeaderProps {
  className?: string;
}

export function PublicHeader({ className = "" }: PublicHeaderProps) {
  const { headerTone } = useMotionContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const cartCount = useMarketplaceCartCount();

  const isDark = headerTone === "dark";

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 lg:px-12 h-[66px] transition-colors duration-[160ms] ease-out ${
          isDark
            ? "bg-[var(--kt-public-surface-inverse)] text-[var(--kt-public-text-inverse)] border-b border-[var(--kt-public-border-inverse)]"
            : "bg-[var(--kt-public-canvas)] text-[var(--kt-public-text-primary)] border-b border-[var(--kt-public-border-default)]/40"
        } ${className}`}
        role="banner"
        data-tone={headerTone}
      >
        {/* Left: Canonical Brand Logo */}
        <div className="flex items-center">
          <Link
            href="/"
            aria-label="KT Couriers Home"
            className="flex items-center transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kt-public-focus)]"
          >
            <CanonicalKtLogo size={34} priority />
          </Link>
        </div>

        {/* Center: Primary Actions */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-8 font-medium text-sm tracking-wide"
        >
          <Link
            href="/shop"
            className="hover:text-[var(--kt-public-interactive-text)] transition-colors py-1 focus-visible:outline-2 focus-visible:outline-[var(--kt-public-focus)]"
          >
            Shop
          </Link>
          <Link
            href="/services/parcel"
            className="hover:text-[var(--kt-public-interactive-text)] transition-colors py-1 focus-visible:outline-2 focus-visible:outline-[var(--kt-public-focus)]"
          >
            Send a parcel
          </Link>
          <Link
            href="/services"
            className="hover:text-[var(--kt-public-interactive-text)] transition-colors py-1 focus-visible:outline-2 focus-visible:outline-[var(--kt-public-focus)]"
          >
            Services
          </Link>
        </nav>

        {/* Right: Search, Cart, Account, Menu trigger */}
        <div className="flex items-center gap-5">
          <Link
            href="/shop/search"
            aria-label="Search marketplace"
            className="p-1.5 hover:text-[var(--kt-public-interactive-text)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--kt-public-focus)]"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" strokeWidth="2" />
              <path strokeWidth="2" strokeLinecap="round" d="m20 20-3.5-3.5" />
            </svg>
          </Link>

          <Link
            href="/cart"
            aria-label={`Shopping cart containing ${cartCount} items`}
            data-kt-cart-target="header"
            className="relative p-1.5 hover:text-[var(--kt-public-interactive-text)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--kt-public-focus)]"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--kt-public-action-primary)] text-[10px] font-bold text-[var(--kt-public-text-inverse)]">
                {cartCount}
              </span>
            )}
          </Link>

          <Link
            href="/login"
            className={`hidden sm:inline-block text-xs font-semibold tracking-wide uppercase px-3 py-1.5 border border-current rounded-none transition-colors ${
              isDark
                ? "hover:bg-[var(--kt-public-surface-primary)] hover:text-[var(--kt-public-text-primary)]"
                : "hover:bg-[var(--kt-public-action-primary)] hover:text-[var(--kt-public-text-inverse)]"
            }`}
          >
            Account
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open expanded navigation menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 p-1.5 hover:text-[var(--kt-public-interactive-text)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--kt-public-focus)]"
          >
            <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">
              Menu
            </span>
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeWidth="2"
                strokeLinecap="round"
                d="M4 7h16M4 12h16M4 17h16"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Expanded Menu Drawer */}
      <CurvedMenuSheet
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        tone={isDark ? "dark" : "light"}
      />
    </>
  );
}
